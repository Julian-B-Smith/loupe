// Build layer of the P1a crawler (ROADMAP Q-012; ADRs 0026, 0027, 0028).
// Runs `cmake` configure (never a build) once per declared configuration, into a scratch directory OUTSIDE the
// target tree, with File API queries and an expanded JSON trace, then reads the reply as data.
//
// Contract with the target repo (HORDE response-002): the scratch directory is always deleted, also on failure and
// on Ctrl-C; configure output is parsed as JSON and nothing in it is executed or evaluated; configuration args are
// limited to an allowlist, so a config file cannot turn "configure into a scratch dir" into anything else.
// Determinism (Q-012 criterion 6): no timestamps; every path is repo-relative, `${build}/...`, or `${external}/…`;
// CMake-affecting environment variables are cleared (they would silently override a declared configuration);
// arrays with no order meaning are sorted; toolchain-specific values go to `environment`, not compared.
//
// Revised 2026-10-16 after critic review: define leaks, external sources collapsing, args escaping the scratch dir,
// custom-command parsing (TARGET form, several COMMANDs, list values, relative paths, byproducts), Ctrl-C cleanup,
// multi-config generators, pseudo-sources of custom targets.
//
// TypeScript is run by Node's built-in type stripping (no compiler, no dependency): only erasable syntax here.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, realpathSync, existsSync,
  openSync, readSync, closeSync } from 'node:fs';
import { join, relative, isAbsolute, sep, posix, dirname, basename } from 'node:path';
import { tmpdir } from 'node:os';

export type Configuration = { name: string; args: string[] };
type Source = { path: string; generated: boolean; compiled: boolean; language: string | null };
type Target = { name: string; type: string; definedIn: { file: string; line: number } | null; dependencies: string[]; sources: Source[];
  compileGroups: { language: string; includes: string[]; defines: string[]; sources: string[] }[] };
type CustomCommand = { file: string; line: number; target: string | null; stage: string | null; outputs: string[];
  byproducts: string[]; depends: string[]; commands: string[][]; command?: string };

const DEFAULT: Configuration[] = [{ name: 'default', args: [] }];
// "Unclaimed" covers files a compiler would compile (headers are usually not listed in targets, so they would flood
// the list and say nothing).
const COMPILED_EXT = /\.(c|cc|cpp|cxx|c\+\+|m|mm)$/i;
const by = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

// ---- configuration: human-owned, but held to what "configure into a scratch directory" means
// Flags that take their value as the next argument, and flags that carry it inline. Anything else (-B, -S, --build,
// -E, -P, --preset, --trace*, --graphviz, --profiling-*, --install, --fresh ...) is refused: each could write outside
// the scratch directory, run something other than a configure, or override what the crawler controls.
const ALLOW_WITH_VALUE = new Set(['-G', '-T', '-A', '-C', '--toolchain']);
const ALLOW_INLINE = [/^-D./, /^-U./, /^-W(no-)?(dev|deprecated)$/, /^-W(no-)?error=(dev|deprecated)$/, /^--toolchain=./, /^-G./, /^-T./, /^-A./];

export function checkArgs(args: string[]): void {
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (typeof a !== 'string') throw new Error('.loupe/config.json: args must be strings');
    if (ALLOW_WITH_VALUE.has(a)) { if (i + 1 >= args.length) throw new Error(`.loupe/config.json: ${a} needs a value`); i++; continue; }
    if (ALLOW_INLINE.some((r) => r.test(a))) continue;
    throw new Error(`.loupe/config.json: argument "${a}" is not allowed (allowed: -G -T -A -C --toolchain -D -U -W)`);
  }
}

export function readLoupeConfig(repo: string): { configurations: Configuration[]; declared: boolean } {
  const p = join(repo, '.loupe', 'config.json');
  if (!existsSync(p)) return { configurations: DEFAULT, declared: false };
  const cfg = JSON.parse(readFileSync(p, 'utf8')) as { configurations?: Configuration[] };
  const list = cfg.configurations && cfg.configurations.length ? cfg.configurations : DEFAULT;
  const names = new Set<string>();
  for (const c of list) {
    if (typeof c.name !== 'string' || !c.name || !Array.isArray(c.args)) throw new Error('.loupe/config.json: each configuration needs a name and an args array');
    if (names.has(c.name)) throw new Error(`.loupe/config.json: configuration name "${c.name}" is used twice`);
    names.add(c.name);
    checkArgs(c.args);
  }
  return { configurations: list, declared: !!(cfg.configurations && cfg.configurations.length) };
}

// ---- paths
const realCache = new Map<string, string>();
function safeReal(p: string): string {
  let r = realCache.get(p);
  if (r === undefined) { try { r = realpathSync(p); } catch { r = p; } realCache.set(p, r); }
  return r;
}
// An absolute path outside the repo and the build dir keeps only its last component: enough to keep two external
// files apart and readable, without this machine's directory layout (doctrine: never commit machine identity).
const externalName = (p: string) => '${external}/' + basename(p.replace(/[\\/]+$/, ''));

function makeNormalizer(repo: string, build: string) {
  const roots: [string, string][] = [];
  for (const r of new Set([repo, safeReal(repo)])) roots.push([r, '']);
  for (const b of new Set([build, safeReal(build)])) roots.push([b, '${build}']);
  roots.sort((a, b) => b[0].length - a[0].length);
  return (p: string): string => {
    if (!isAbsolute(p)) return posix.normalize(p.split(sep).join('/'));
    for (const [root, tag] of roots) {
      if (p === root || p.startsWith(root + sep) || p.startsWith(root + '/')) {
        const rel = relative(root, p).split(sep).join('/');
        return tag ? (rel ? `${tag}/${rel}` : tag) : rel || '.';
      }
    }
    return externalName(p);
  };
}

// Free text (defines, command arguments): the repo becomes `${source}`, the build dir `${build}`, and every other
// absolute path token becomes `${external}/<last component>`. Token-wise, so `X=/abs/path` is caught too.
// `\/(?!\/)`: a `//` after `:` is a URL (https://...), not a path, and is left alone.
const ABS_TOKEN = /(^|[\s=:;,"'(<])((?:\/(?!\/)|[A-Za-z]:[\\/])[^\s;,"')>]*)/g;
function makeTextNormalizer(repo: string, build: string) {
  const pairs: [string, string][] = [];
  for (const b of new Set([build, safeReal(build)])) pairs.push([b, '${build}']);
  for (const r of new Set([repo, safeReal(repo)])) pairs.push([r, '${source}']);
  pairs.sort((a, b) => b[0].length - a[0].length);
  return (s: string): string => {
    let out = s;
    for (const [from, to] of pairs) out = out.split(from).join(to);
    return out.replace(ABS_TOKEN, (_m, pre: string, path: string) => pre + externalName(path));
  };
}

// ---- configure
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

// Environment variables CMake reads at configure time that would silently override a declared configuration.
const CLEARED_ENV = ['CMAKE_GENERATOR', 'CMAKE_GENERATOR_PLATFORM', 'CMAKE_GENERATOR_TOOLSET', 'CMAKE_GENERATOR_INSTANCE',
  'CMAKE_BUILD_TYPE', 'CMAKE_CONFIGURATION_TYPES', 'CMAKE_TOOLCHAIN_FILE', 'CMAKE_EXPORT_COMPILE_COMMANDS', 'CMAKE_PREFIX_PATH'];
// Variables that change the toolchain: kept (the build needs them), but their NAMES are recorded in `environment`.
const RECORDED_ENV = ['CC', 'CXX', 'CFLAGS', 'CXXFLAGS', 'CPPFLAGS', 'LDFLAGS', 'SDKROOT', 'MACOSX_DEPLOYMENT_TARGET', 'DEVELOPER_DIR'];

// Every scratch directory currently alive, so a signal handler can remove them. execFileSync blocks the event loop:
// the JS handler runs once the child has died and `finally` has run; without any handler Node would exit at once.
const liveScratch = new Set<string>();
const SIGNAL_EXIT: Record<string, number> = { SIGINT: 130, SIGTERM: 143, SIGHUP: 129 };
let handlersOn = false;
function installSignalCleanup() {
  if (handlersOn) return; handlersOn = true;
  const codes = SIGNAL_EXIT;
  for (const sig of Object.keys(codes)) {
    process.on(sig, () => { for (const d of liveScratch) rmSync(d, { recursive: true, force: true }); process.exit(codes[sig]); });
  }
}

// ---- trace: streamed line by line (a JUCE-sized trace is large); cheap substring test before JSON.parse.
function* traceLines(file: string): Generator<string> {
  const fd = openSync(file, 'r'), buf = Buffer.alloc(1 << 20);
  let rest = '';
  try {
    for (;;) {
      const n = readSync(fd, buf, 0, buf.length, null);
      if (n === 0) break;
      const parts = (rest + buf.toString('utf8', 0, n)).split('\n');
      rest = parts.pop() as string;
      yield* parts;
    }
    if (rest) yield rest;
  } finally { closeSync(fd); }
}

// add_custom_command and add_custom_target keywords (CMake docs). Flags take no value; ONE_KW take exactly one; the
// rest take a list (ALL is a flag of add_custom_target only, handled there). add_custom_target is read too (Q-009): HORDE's build stamp is one, and its BYPRODUCTS were dropped
// without a trace when only add_custom_command was read.
const FLAG_KW = new Set(['VERBATIM', 'APPEND', 'USES_TERMINAL', 'CODEGEN', 'COMMAND_EXPAND_LISTS', 'DEPENDS_EXPLICIT_ONLY', 'PRE_BUILD', 'PRE_LINK', 'POST_BUILD']);
const ONE_KW = new Set(['WORKING_DIRECTORY', 'COMMENT', 'DEPFILE', 'MAIN_DEPENDENCY', 'JOB_POOL', 'JOB_SERVER_AWARE', 'TARGET']);
const MULTI_KW = new Set(['OUTPUT', 'COMMAND', 'ARGS', 'DEPENDS', 'BYPRODUCTS', 'IMPLICIT_DEPENDS', 'SOURCES']);

function parseTrace(file: string, repo: string, build: string, normPath: (p: string) => string, normText: (s: string) => string): CustomCommand[] {
  if (!existsSync(file)) return [];
  const out: CustomCommand[] = [];
  const realRepo = safeReal(repo);
  for (const line of traceLines(file)) {
    if (!line.includes('add_custom_')) continue;
    let ev: { cmd?: string; file?: string; line?: number; args?: string[] };
    try { ev = JSON.parse(line); } catch { continue; } // non-JSON lines are data we skip
    const cmd = (ev.cmd || '').toLowerCase();
    if ((cmd !== 'add_custom_command' && cmd !== 'add_custom_target') || !ev.file || !Array.isArray(ev.args)) continue;
    // Only the target's own CMake files: CMake modules and included files outside the repo are not its rules.
    const f = safeReal(ev.file);
    if (!(f === realRepo || f.startsWith(realRepo + sep))) continue;
    const srcDir = dirname(f), relDir = relative(realRepo, srcDir);
    const binDir = relDir ? join(build, relDir) : build;
    const one: Record<string, string> = {};
    const multi: Record<string, string[]> = { OUTPUT: [], DEPENDS: [], BYPRODUCTS: [], IMPLICIT_DEPENDS: [], SOURCES: [] };
    const commands: string[][] = [];
    let key = '', stage: string | null = null;
    // add_custom_target(Name [ALL] [command args...] KEYWORDS...): the name is the owning target, and words before the
    // first keyword are a command of their own.
    const args = ev.args.slice();
    if (cmd === 'add_custom_target') { one.TARGET = args.shift() || ''; stage = 'CUSTOM_TARGET'; key = 'COMMAND'; commands.push([]); }
    for (const a of args) {
      if (a === 'ALL' && cmd === 'add_custom_target') continue; // ALL builds it by default; the command words go on
      if (FLAG_KW.has(a)) { if (a === 'PRE_BUILD' || a === 'PRE_LINK' || a === 'POST_BUILD') stage = a; key = ''; continue; }
      if (ONE_KW.has(a) || MULTI_KW.has(a)) { key = a; if (a === 'COMMAND') commands.push([]); continue; }
      if (!key) continue;
      if (ONE_KW.has(key)) { one[key] = a; key = ''; continue; }
      if (key === 'COMMAND' || key === 'ARGS') { if (!commands.length) commands.push([]); commands[commands.length - 1].push(a); continue; }
      multi[key].push(a);
    }
    // With --trace-expand a list variable arrives as one "a;b" argument: split it where a list of paths is meant.
    const split = (xs: string[]) => xs.flatMap((x) => x.split(';')).filter(Boolean);
    // CMake's rules: relative OUTPUT and BYPRODUCTS are in the current BINARY dir; a relative DEPENDS names a file in
    // the current SOURCE dir if one exists there, otherwise a target or a file made elsewhere (kept as a name).
    const inBin = (p: string) => normPath(isAbsolute(p) ? p : join(binDir, p));
    const dep = (p: string) => (isAbsolute(p) ? normPath(p) : existsSync(join(srcDir, p)) ? normPath(join(srcDir, p)) : `name:${p}`);
    const deps = split([...multi.DEPENDS, ...(one.MAIN_DEPENDENCY ? [one.MAIN_DEPENDENCY] : [])]).map(dep);
    out.push({
      file: normPath(f), line: ev.line ?? 0, command: cmd,
      target: one.TARGET ?? null, stage: one.TARGET ? stage ?? 'POST_BUILD' : null,
      outputs: split(multi.OUTPUT).map(inBin).sort(by),
      byproducts: split(multi.BYPRODUCTS).map(inBin).sort(by),
      depends: [...new Set(deps)].sort(by),
      commands: commands.filter((c) => c.length).map((c) => c.map((a) => (isAbsolute(a) ? normPath(a) : normText(a)))),
    });
  }
  return out.sort((a, b) => by(a.file, b.file) || a.line - b.line);
}

type RunFacts = { name: string; args: string[]; buildType: string | null; targets: Target[]; customCommands: CustomCommand[]; fetched: string[] };

// Headers in the sources the build fetched (FetchContent, under ${build}/_deps) that a compile's include path names.
// Configure has populated them, and the scratch is deleted after this run, so this is the only moment they can be
// read: listed here, an include into them is found (or shown missing) instead of guessed (Q-025, critic M2). Names
// only, never contents; headers only, to keep a large SDK's listing small.
const FETCHED_HEADER = /\.(h|hh|hpp|hxx|inc|inl|ipp|tpp)$/i; // by extension: an extensionless file is a LICENSE, not a header
export function listFetched(build: string, includeDirs: Set<string>): string[] {
  const out = new Set<string>();
  for (const d of [...includeDirs].sort(by)) {
    if (!d.startsWith('${build}/_deps/')) continue;
    const real = join(build, d.slice('${build}/'.length));
    const walk = (abs: string, rel: string) => {
      let ents; try { ents = readdirSync(abs, { withFileTypes: true }); } catch { return; }
      for (const e of ents) {
        if (e.name === '.git') continue;
        const r = rel ? rel + '/' + e.name : e.name;
        if (e.isDirectory()) walk(join(abs, e.name), r);
        else if (e.isFile() && FETCHED_HEADER.test(r)) out.add(d + '/' + r); // a symlink is neither: not followed
      }
    };
    walk(real, '');
  }
  return [...out].sort(by);
}

function configureOnce(repo: string, cfg: Configuration) {
  installSignalCleanup();
  const scratch = mkdtempSync(join(tmpdir(), 'loupe-build-'));
  liveScratch.add(scratch);
  const build = join(scratch, 'b'), trace = join(scratch, 'trace.json');
  try {
    mkdirSync(build);
    writeQueries(build);
    const env: Record<string, string | undefined> = { ...process.env };
    for (const k of CLEARED_ENV) delete env[k];
    // execFile, never a shell: args are passed as-is and nothing is interpolated. --trace-expand gives arguments with
    // variables expanded, so a custom command's OUTPUT matches the generated source the codemodel reports.
    // (It adds one flag to the command HORDE named in response-002: ask before running there.)
    execFileSync('cmake', ['-S', repo, '-B', build, ...cfg.args, '--trace-expand', '--trace-format=json-v1', `--trace-redirect=${trace}`],
      { stdio: ['ignore', 'pipe', 'pipe'], timeout: 600_000, env });
    const reply = readReply(build);
    const norm = makeNormalizer(repo, build), text = makeTextNormalizer(repo, build);
    const cm = reply.codemodel;
    if (!cm || !cm.configurations || !cm.configurations.length) throw new Error('File API reply has no codemodel configuration');
    const customCommands = parseTrace(trace, repo, build, norm, text);
    const multiConfig = cm.configurations.length > 1; // Xcode, Ninja Multi-Config, Visual Studio: one per build type
    const runs: RunFacts[] = [], envOut: Record<string, unknown>[] = [];
    for (const c of cm.configurations) {
      const idToName: Record<string, string> = {};
      for (const t of c.targets) idToName[t.id] = t.name;
      const raw = c.targets.map((ref: { jsonFile: string }) => JSON.parse(readFileSync(join(reply.dir, ref.jsonFile), 'utf8')));
      const abs = (p: string) => (isAbsolute(p) ? p : join(repo, p));
      const targets: Target[] = raw.map((T: any) => {
        const groups = T.compileGroups || [];
        const sources: Source[] = (T.sources || [])
          // CMake's own bookkeeping, not project files: `.rule` entries of custom commands and the
          // `CMakeFiles/<target>` stamps of custom targets.
          .filter((s: { path: string; isGenerated?: boolean }) => !(s.isGenerated && (s.path.endsWith('.rule') || /[\\/]CMakeFiles[\\/][^\\/]+$/.test(s.path))))
          .map((s: { path: string; isGenerated?: boolean; compileGroupIndex?: number }) => ({
            path: norm(abs(s.path)), generated: !!s.isGenerated, compiled: s.compileGroupIndex != null,
            language: s.compileGroupIndex != null ? groups[s.compileGroupIndex].language : null,
          }))
          .sort((a: Source, b: Source) => by(a.path, b.path));
        // Where the target is defined (the add_library/add_executable line), from the File API backtrace, so build
        // evidence can cite the right CMake file (Q-016: the first emitter cited the top-level file for every target).
        const bg = T.backtraceGraph, bn = bg && T.backtrace != null ? bg.nodes[T.backtrace] : null;
        const definedIn = bn ? { file: norm(abs(bg.files[bn.file])), line: bn.line ?? 0 } : null;
        return {
          name: T.name, type: T.type, definedIn,
          dependencies: (T.dependencies || []).map((d: { id: string }) => idToName[d.id] || d.id).sort(by),
          sources,
          compileGroups: groups.map((g: any) => ({
            language: g.language,
            includes: (g.includes || []).map((i: { path: string }) => norm(i.path)), // order kept: it is the search order
            defines: (g.defines || []).map((d: { define: string }) => text(d.define)).sort(by),
            sources: g.sourceIndexes.map((i: number) => norm(abs(T.sources[i].path))).sort(by),
          })),
        };
      }).sort((a: Target, b: Target) => by(a.name, b.name));
      const name = multiConfig ? `${cfg.name}/${c.name}` : cfg.name;
      const fetched = listFetched(build, new Set(targets.flatMap((t) => t.compileGroups.flatMap((g) => g.includes))));
      runs.push({ name, args: cfg.args.map(text), buildType: c.name || null, targets, customCommands, fetched });
      envOut.push({
        name,
        cmake: reply.index.cmake?.version?.string ?? null,
        generator: reply.index.cmake?.generator?.name ?? null,
        compilers: ((reply.toolchains && reply.toolchains.toolchains) || [])
          .map((t: any) => ({ language: t.language, id: t.compiler.id || null, version: t.compiler.version || null }))
          .sort((a: { language: string }, b: { language: string }) => by(a.language, b.language)),
        compileFragments: Object.fromEntries(raw.map((T: any) => [T.name, (T.compileGroups || [])
          .map((g: any) => (g.compileCommandFragments || []).map((fr: { fragment: string }) => text(fr.fragment)).join(' '))])
          .sort((a: [string, unknown], b: [string, unknown]) => by(a[0], b[0]))),
        toolchainEnvSet: RECORDED_ENV.filter((k) => process.env[k] != null),
      });
    }
    return { runs, env: envOut };
  } catch (e) {
    // Ctrl-C reaches cmake too (same process group): execFileSync then throws with the signal. Exit the way the
    // shell expects (128 + signal), AFTER the `finally` below has removed the scratch directory.
    const sig = (e as { signal?: string }).signal;
    if (sig && SIGNAL_EXIT[sig]) interrupted = SIGNAL_EXIT[sig];
    throw e;
  } finally {
    // HORDE's condition 1: never leave a build directory behind.
    rmSync(scratch, { recursive: true, force: true });
    liveScratch.delete(scratch);
    if (interrupted) process.exit(interrupted);
  }
}
let interrupted = 0;

// Tracked compiled-language sources under the repo, for "claimed by no target" (platform- or option-only files).
function trackedSources(repo: string): { files: string[] | null; note: string | null } {
  try {
    const out = execFileSync('git', ['-C', repo, 'ls-files', '-z', '--', '.'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
    return { files: out.split('\0').filter((p) => p && COMPILED_EXT.test(p)).sort(by), note: null };
  } catch { return { files: null, note: 'git ls-files failed: unclaimed sources could not be listed' }; }
}

export function buildLayer(repoIn: string) {
  const repo = safeReal(repoIn);
  const { configurations, declared } = readLoupeConfig(repo);
  const all = configurations.map((c) => configureOnce(repo, c));
  const runs = all.flatMap((r) => r.runs);
  // Union across configurations (0026): membership is (source, target) with the configurations it was seen in.
  const member = new Map<string, { source: string; target: string; generated: boolean; configs: Set<string> }>();
  for (const r of runs) for (const t of r.targets) for (const s of t.sources) {
    const k = s.path + '\u0000' + t.name;
    const m = member.get(k) || { source: s.path, target: t.name, generated: false, configs: new Set<string>() };
    m.generated = m.generated || s.generated; // generated in any configuration
    m.configs.add(r.name); member.set(k, m);
  }
  const membership = [...member.values()]
    .map((m) => ({ source: m.source, target: m.target, generated: m.generated, configs: [...m.configs].sort(by) }))
    .sort((a, b) => by(a.source, b.source) || by(a.target, b.target));
  const claimed = new Set(membership.map((m) => m.source));
  const tracked = trackedSources(repo);
  const facts = {
    schema: 'loupe.buildfacts/0.0-internal',
    configurations: runs.map((r) => ({ name: r.name, args: r.args, buildType: r.buildType })),
    declared,
    membership,
    unclaimedSources: tracked.files ? tracked.files.filter((p) => !claimed.has(p)) : null,
    notes: tracked.note ? [tracked.note] : [],
    perConfiguration: runs,
  };
  const environment = { host: process.platform, clearedEnv: CLEARED_ENV, perConfiguration: all.flatMap((r) => r.env) };
  return { facts, environment };
}
