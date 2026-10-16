// Build layer of the P1a crawler (ROADMAP Q-012; ADRs 0026, 0027, 0028).
// Runs `cmake` configure (never a build) once per declared configuration, into a scratch directory OUTSIDE the
// target tree, with File API queries and a JSON trace, then reads the reply as data.
//
// Contract with the target repo (HORDE response-002): the scratch directory is always deleted, also on failure;
// configure output is parsed as JSON and nothing in it is executed or evaluated.
// Determinism (Q-012 criterion 6): no timestamps; every path is repo-relative, `${build}/...`, or `${external}`;
// arrays that carry no order meaning are sorted; toolchain-specific values go to `environment`, which the golden
// comparison excludes.
//
// TypeScript is run by Node's built-in type stripping (no compiler, no dependency): only erasable syntax here.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, realpathSync, existsSync } from 'node:fs';
import { join, relative, isAbsolute, sep, posix } from 'node:path';
import { tmpdir } from 'node:os';

export type Configuration = { name: string; args: string[] };
export type LoupeConfig = { configurations?: Configuration[] };

type Source = { path: string; generated: boolean; compiled: boolean; language: string | null };
type Target = { name: string; type: string; dependencies: string[]; sources: Source[];
  compileGroups: { language: string; includes: string[]; defines: string[]; sources: string[] }[] };
type CustomCommand = { file: string; line: number; outputs: string[]; depends: string[]; command: string[] };
type ConfigFacts = { name: string; args: string[]; buildType: string | null; targets: Target[]; customCommands: CustomCommand[] };

const DEFAULT: Configuration[] = [{ name: 'default', args: [] }];
const CPP_EXT = /\.(c|cc|cpp|cxx|c\+\+|m|mm)$/i;
const by = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function readLoupeConfig(repo: string): { configurations: Configuration[]; declared: boolean } {
  const p = join(repo, '.loupe', 'config.json');
  if (!existsSync(p)) return { configurations: DEFAULT, declared: false };
  const cfg = JSON.parse(readFileSync(p, 'utf8')) as LoupeConfig;
  const list = cfg.configurations && cfg.configurations.length ? cfg.configurations : DEFAULT;
  for (const c of list) if (typeof c.name !== 'string' || !Array.isArray(c.args)) throw new Error('.loupe/config.json: each configuration needs a name and an args array');
  return { configurations: list, declared: !!(cfg.configurations && cfg.configurations.length) };
}

// Paths: the realpath of the repo and of the scratch dir, because macOS reports /var/... and /private/var/...
// for the same place and CMake may print either.
function makeNormalizer(repo: string, build: string) {
  const roots: [string, string][] = [];
  for (const r of new Set([repo, safeReal(repo)])) roots.push([r, '']);
  for (const b of new Set([build, safeReal(build)])) roots.push([b, '${build}']);
  roots.sort((a, b) => b[0].length - a[0].length); // longest first: build dirs never sit inside the repo, but be safe
  return (p: string): string => {
    if (!isAbsolute(p)) return p.split(sep).join('/');
    for (const [root, tag] of roots) {
      if (p === root || p.startsWith(root + sep) || p.startsWith(root + '/')) {
        const rel = relative(root, p).split(sep).join('/');
        return tag ? (rel ? `${tag}/${rel}` : tag) : rel || '.';
      }
    }
    return '${external}';
  };
}
function safeReal(p: string): string { try { return realpathSync(p); } catch { return p; } }

// Replace roots inside free text (trace arguments carry absolute paths inside longer strings).
function makeTextNormalizer(repo: string, build: string) {
  const pairs: [string, string][] = [];
  for (const b of new Set([build, safeReal(build)])) pairs.push([b, '${build}']);
  for (const r of new Set([repo, safeReal(repo)])) pairs.push([r, '${source}']);
  pairs.sort((a, b) => b[0].length - a[0].length);
  return (s: string): string => {
    let out = s;
    for (const [from, to] of pairs) out = out.split(from).join(to);
    // Any absolute path that is still left would carry machine identity: replace it wholesale.
    return /(^|[\s=;"'])\/(Users|home|private|var|opt|tmp|Library|usr)\//.test(out) ? '${external}' : out;
  };
}

function writeQueries(build: string) {
  const q = join(build, '.cmake', 'api', 'v1', 'query');
  mkdirSync(q, { recursive: true });
  for (const k of ['codemodel-v2', 'cmakeFiles-v1', 'toolchains-v1']) writeFileSync(join(q, k), '');
}

function readReply(build: string) {
  const dir = join(build, '.cmake', 'api', 'v1', 'reply');
  const idxName = readdirSync(dir).filter((f) => f.startsWith('index-') && f.endsWith('.json')).sort().pop();
  if (!idxName) throw new Error('cmake wrote no File API reply index');
  const index = JSON.parse(readFileSync(join(dir, idxName), 'utf8'));
  const obj = (kind: string) => {
    const o = index.objects.find((x: { kind: string }) => x.kind === kind);
    return o ? JSON.parse(readFileSync(join(dir, o.jsonFile), 'utf8')) : null;
  };
  return { index, dir, codemodel: obj('codemodel'), toolchains: obj('toolchains') };
}

function parseTrace(file: string, repo: string, normPath: (p: string) => string, normText: (s: string) => string): CustomCommand[] {
  if (!existsSync(file)) return [];
  const out: CustomCommand[] = [];
  const realRepo = safeReal(repo);
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let ev: { cmd?: string; file?: string; line?: number; args?: string[] };
    try { ev = JSON.parse(line); } catch { continue; } // CMake may interleave non-JSON lines; they are data we skip
    if (!ev.cmd || !ev.file || !Array.isArray(ev.args)) continue;
    // Only the target's own CMake files: CMake's modules and toolchain probes are not the project's build rules.
    const f = safeReal(ev.file);
    if (!(f === realRepo || f.startsWith(realRepo + sep))) continue;
    if (ev.cmd.toLowerCase() !== 'add_custom_command') continue;
    const groups: Record<string, string[]> = {};
    let key = '';
    for (const a of ev.args) {
      if (/^(OUTPUT|COMMAND|DEPENDS|MAIN_DEPENDENCY|BYPRODUCTS|WORKING_DIRECTORY|COMMENT|TARGET|PRE_BUILD|PRE_LINK|POST_BUILD|VERBATIM|USES_TERMINAL|APPEND|IMPLICIT_DEPENDS|DEPFILE)$/.test(a)) { key = a; groups[key] = groups[key] || []; continue; }
      if (key) groups[key].push(a);
    }
    out.push({
      file: normPath(ev.file), line: ev.line ?? 0,
      outputs: (groups.OUTPUT || []).map((p) => normPath(p)).sort(by),
      depends: [...(groups.DEPENDS || []), ...(groups.MAIN_DEPENDENCY || [])].map((p) => (isAbsolute(p) ? normPath(p) : posix.normalize(p))).sort(by),
      command: (groups.COMMAND || []).map((a) => (isAbsolute(a) ? normPath(a) : normText(a))),
    });
  }
  return out.sort((a, b) => by(a.file, b.file) || a.line - b.line);
}

function configureOnce(repo: string, cfg: Configuration) {
  const scratch = mkdtempSync(join(tmpdir(), 'loupe-build-'));
  const build = join(scratch, 'b'), trace = join(scratch, 'trace.json');
  try {
    mkdirSync(build);
    writeQueries(build);
    // execFile, never a shell: args from the config are passed as-is and nothing is interpolated.
    // --trace-expand: arguments with variables expanded, so a custom command's OUTPUT can be matched to the
    // generated source the codemodel reports. (Adds one flag to the command HORDE named in response-002: ask first.)
    execFileSync('cmake', ['-S', repo, '-B', build, ...cfg.args, '--trace-expand', '--trace-format=json-v1', `--trace-redirect=${trace}`],
      { stdio: ['ignore', 'pipe', 'pipe'], timeout: 600_000 });
    const reply = readReply(build);
    const norm = makeNormalizer(repo, build), text = makeTextNormalizer(repo, build);
    const cm = reply.codemodel;
    if (!cm || !cm.configurations || !cm.configurations.length) throw new Error('File API reply has no codemodel configuration');
    const c0 = cm.configurations[0];
    const idToName: Record<string, string> = {};
    for (const t of c0.targets) idToName[t.id] = t.name;
    const targets: Target[] = c0.targets.map((ref: { jsonFile: string }) => {
      const T = JSON.parse(readFileSync(join(reply.dir, ref.jsonFile), 'utf8'));
      const groups = T.compileGroups || [];
      const sources: Source[] = (T.sources || [])
        // `.rule` entries are CMake's own bookkeeping for custom commands, not files of the project.
        .filter((s: { path: string; isGenerated?: boolean }) => !(s.isGenerated && s.path.endsWith('.rule')))
        .map((s: { path: string; isGenerated?: boolean; compileGroupIndex?: number }) => ({
          path: norm(isAbsolute(s.path) ? s.path : join(repo, s.path)),
          generated: !!s.isGenerated,
          compiled: s.compileGroupIndex != null,
          language: s.compileGroupIndex != null ? groups[s.compileGroupIndex].language : null,
        }))
        .sort((a: Source, b: Source) => by(a.path, b.path));
      return {
        name: T.name, type: T.type,
        dependencies: (T.dependencies || []).map((d: { id: string }) => idToName[d.id] || d.id).sort(by),
        sources,
        compileGroups: groups.map((g: { language: string; includes?: { path: string }[]; defines?: { define: string }[]; sourceIndexes: number[] }) => ({
          language: g.language,
          includes: (g.includes || []).map((i) => norm(i.path)), // order kept: it is the search order
          defines: (g.defines || []).map((d) => d.define).sort(by),
          sources: g.sourceIndexes.map((i) => norm(isAbsolute(T.sources[i].path) ? T.sources[i].path : join(repo, T.sources[i].path))).sort(by),
        })),
      };
    }).sort((a: Target, b: Target) => by(a.name, b.name));
    const facts: ConfigFacts = { name: cfg.name, args: cfg.args.map(text), buildType: c0.name || null, targets,
      customCommands: parseTrace(trace, repo, norm, text) };
    const env = {
      cmake: reply.index.cmake && reply.index.cmake.version ? reply.index.cmake.version.string : null,
      generator: reply.index.cmake && reply.index.cmake.generator ? reply.index.cmake.generator.name : null,
      compilers: ((reply.toolchains && reply.toolchains.toolchains) || []).map((t: { language: string; compiler: { id?: string; version?: string } }) =>
        ({ language: t.language, id: t.compiler.id || null, version: t.compiler.version || null })).sort((a: { language: string }, b: { language: string }) => by(a.language, b.language)),
      compileFragments: Object.fromEntries(targets.map((t) => {
        const T = c0.targets.find((x: { name: string }) => x.name === t.name);
        const J = JSON.parse(readFileSync(join(reply.dir, T.jsonFile), 'utf8'));
        return [t.name, (J.compileGroups || []).map((g: { compileCommandFragments?: { fragment: string }[] }) => (g.compileCommandFragments || []).map((f) => text(f.fragment)).join(' '))];
      })),
    };
    return { facts, env };
  } finally {
    // HORDE's condition 1: never leave a build directory behind, also when configure or parsing fails.
    rmSync(scratch, { recursive: true, force: true });
  }
}

// Tracked C/C++ sources under the repo, for "claimed by no target" (they may be platform- or option-only).
function trackedSources(repo: string): string[] {
  try {
    const out = execFileSync('git', ['-C', repo, 'ls-files', '-z', '--', '.'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
    return out.split('\0').filter((p) => p && CPP_EXT.test(p)).sort(by);
  } catch { return []; }
}

export function buildLayer(repoIn: string) {
  const repo = safeReal(repoIn);
  const { configurations, declared } = readLoupeConfig(repo);
  const runs = configurations.map((c) => configureOnce(repo, c));
  // Union across configurations (0026): membership is (source, target) with the configurations it was seen in.
  const member = new Map<string, { source: string; target: string; generated: boolean; configs: string[] }>();
  for (const { facts } of runs) for (const t of facts.targets) for (const s of t.sources) {
    const k = s.path + '\u0000' + t.name;
    const m = member.get(k) || { source: s.path, target: t.name, generated: s.generated, configs: [] };
    m.configs.push(facts.name); member.set(k, m);
  }
  const membership = [...member.values()].map((m) => ({ ...m, configs: m.configs.sort(by) }))
    .sort((a, b) => by(a.source, b.source) || by(a.target, b.target));
  const claimed = new Set(membership.map((m) => m.source));
  const unclaimed = trackedSources(repo).filter((p) => !claimed.has(p));
  const facts = {
    schema: 'loupe.buildfacts/0.0-internal',
    configurations: runs.map((r) => ({ name: r.facts.name, args: r.facts.args, buildType: r.facts.buildType })),
    declared,
    membership,
    unclaimedSources: unclaimed,
    perConfiguration: runs.map((r) => r.facts),
  };
  const environment = { host: process.platform, perConfiguration: runs.map((r, i) => ({ name: configurations[i].name, ...r.env })) };
  return { facts, environment };
}
