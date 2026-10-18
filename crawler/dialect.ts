// File roles and the dsp-plugin dialect (ROADMAP Q-024; ADR 0018). Deterministic: a role is set by a named rule, and
// `roleRule` says which, so an auditor can check every role against the rule that set it. The rule ids are listed in
// docs/graph-schema.md.
//
// Layers, later ones overriding earlier (Julian, 2026-10-17: defaults, then the dialect, then the repo's config):
//   1. default:path/<x>        generic path rules (docs, tests, build files, tools, data, src)
//   2. dsp-plugin:path/<x>     the dialect's path rules; then dsp-plugin:build/<x> from the build: what the plugin's
//                              targets build or their compiles reach is product; test, probe, bench and generator
//                              targets give their files those roles; a src/ file reached only by such targets takes
//                              their role; data compiled into the product is data
//   3. graph:runs-command      a generator is the code a custom command runs, or code that writes a file itself
//      graph:writes-file       (Julian, 2026-10-17): a command's inputs keep their own roles (gui2.html stays gui)
//   4. config:roles[i]         the target repo's own patterns in .loupe/config.json, human-owned, first match wins
// A file no rule names stays unroled and is counted.
//
// The dsp-plugin dialect also draws the GUI bridge at file level (Julian, 2026-10-17; ADR 0018 wanted symbols, P1b):
// a name the C++ side registers with `<x>.bind("name", ...)` and an HTML or JS file uses in code (a call or a
// reference, not an assignment or a mock definition) is a `call` edge, role `bridge`, resolution `syntactic`. When a
// name is registered by a product or gui file, registrations of it elsewhere (a test's own web view) are counted, not
// drawn (Julian, 2026-10-17).
// TypeScript is run by Node's built-in type stripping: only erasable syntax here.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { maskJs } from './langs.ts';

// ADR 0018's vocabulary, as Julian fixed it for Q-024. No other role is invented here.
export const ROLES = ['product', 'gui', 'test', 'probe', 'bench', 'generator', 'scratch', 'data', 'build', 'tool', 'doc'];
export const DIALECTS: Record<string, string> = { none: '0', 'dsp-plugin': '1' };
type Rule = [RegExp, string, string]; // pattern on the repo path, role, rule id
const CODE_LANG = new Set(['c', 'cpp', 'objc', 'objcpp', 'python', 'js', 'sh', 'cmake']);

const DEFAULT_PATH: Rule[] = [
  [/\.(md|rst|adoc)$/i, 'doc', 'default:path/doc-ext'],
  [/^docs?\//, 'doc', 'default:path/docs-dir'],
  [/(^|\/)(tests?|__tests__|spec)\/|(^|\/)test_[^/]*\.py$|_test\.[a-z]+$|\.test\.[jt]sx?$/, 'test', 'default:path/test'],
  [/(^|\/)(CMakeLists\.txt|CMakePresets\.json|Makefile|meson\.build|package\.json|tsconfig\.json)$|\.cmake$|^\.github\/workflows\//, 'build', 'default:path/build'],
  [/^\.[^/]+$/, 'build', 'default:path/root-dotfile'],                       // .gitignore, .gitattributes, .gitmodules
  [/^\.(claude|kit|vscode|github|husky)\//, 'tool', 'default:path/repo-tooling'],
  [/^(scratch|tmp|sandbox)\//, 'scratch', 'default:path/scratch'],
  [/^(tools|scripts|bin)\//, 'tool', 'default:path/tools-dir'],
  [/\.(json|csv|tsv|ya?ml|txt|toml|xml|ini|f32|wav)$/i, 'data', 'default:path/data-ext'],
  [/^(src|lib|include)\//, 'product', 'default:path/source-dir'],
];
const DSP_PATH: Rule[] = [
  [/(^|\/)gui\//, 'gui', 'dsp-plugin:path/gui-dir'],
  [/_probe\.[a-z]+$/, 'probe', 'dsp-plugin:path/probe-name'],
  [/(_bench\.[a-z]+$|(^|\/)bench\/)/, 'bench', 'dsp-plugin:path/bench-name'],
  [/_check\.[a-z]+$/, 'test', 'dsp-plugin:path/check-name'],
];
// Target names that say what a target is for (HORDE: alias_check, paramfunc_smoke, rtsafety_probe, tailprobe,
// cpu_bench, measure_fx, gen_factory_bank).
const DSP_TARGET: Rule[] = [
  [/(_check|_test|_tests|_smoke)$|^test_/, 'test', 'dsp-plugin:build/test-target'],
  [/probe$/, 'probe', 'dsp-plugin:build/probe-target'],
  [/(_bench$|^measure_)/, 'bench', 'dsp-plugin:build/bench-target'],
  [/^gen_/, 'generator', 'dsp-plugin:build/generator-target'],
];

// A small glob for config patterns: `**` any path, `*` within a segment, `?` one character.
export function globRe(glob: string): RegExp {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') { re += glob[i + 2] === '/' ? '(?:.*/)?' : '.*'; i += glob[i + 2] === '/' ? 2 : 1; }
    else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp('^' + re + '$');
}

export type RepoLoupeConfig = { dialect: string | null; roles: { match: string; role: string }[]; problems: string[] };
export function readRoleConfig(repo: string): RepoLoupeConfig {
  const p = join(repo, '.loupe', 'config.json');
  const out: RepoLoupeConfig = { dialect: null, roles: [], problems: [] };
  if (!existsSync(p)) return out;
  let cfg: any; try { cfg = JSON.parse(readFileSync(p, 'utf8')); } catch { out.problems.push('.loupe/config.json is not JSON'); return out; }
  if (cfg.dialect != null) { if (DIALECTS[cfg.dialect]) out.dialect = cfg.dialect; else out.problems.push(`.loupe/config.json names dialect "${cfg.dialect}", which Loupe does not have`); }
  if (cfg.roles != null && !Array.isArray(cfg.roles)) out.problems.push('.loupe/config.json "roles" must be a list of {"match", "role"}');
  (Array.isArray(cfg.roles) ? cfg.roles : []).forEach((r: any, i: number) => {
    if (typeof r?.match !== 'string' || !ROLES.includes(r?.role)) out.problems.push(`.loupe/config.json roles[${i}] needs a "match" glob and a role from: ${ROLES.join(', ')}`);
    else out.roles.push({ match: r.match, role: r.role });
  });
  return out;
}

// assignRoles: role and roleRule on every file node (mutated). `runs`: files a custom command runs (graph.ts reads
// them from the command lines). Returns counts for notEvaluated.
export function assignRoles(fileNodes: any[], edges: any[], targets: { name: string; type: string; dependencies: string[] }[], dialect: string, cfg: RepoLoupeConfig, runs: Set<string> = new Set()) {
  const set = (n: any, role: string, rule: string) => { n.role = role; n.roleRule = rule; };
  const first = (rules: Rule[], p: string) => rules.find(([re]) => re.test(p));
  const report = { unroled: 0, unreachedSources: 0, unusedConfig: [] as string[] };
  for (const n of fileNodes) { const r = first(DEFAULT_PATH, n.path); if (r) set(n, r[1], r[2]); }
  if (dialect === 'dsp-plugin') {
    for (const n of fileNodes) { const r = first(DSP_PATH, n.path); if (r) set(n, r[1], r[2]); }
    // build: product targets are the plugin's module or shared libraries and the libraries they link. An executable or
    // utility they depend on (HORDE's auv2 build-helper, a build stamp) is built first and never shipped, so it is not
    // followed (Q-009). design/prototype/lens.js productTargets() is the same rule; tools/lens.test.mjs compares them.
    const byName = new Map(targets.map((t) => [t.name, t]));
    const LINKED = /^(STATIC|SHARED|MODULE|OBJECT|INTERFACE)_LIBRARY$/;
    const product = new Set<string>(), work = targets.filter((t) => /MODULE_LIBRARY|SHARED_LIBRARY/.test(t.type) && !first(DSP_TARGET, t.name)).map((t) => t.name);
    while (work.length) { const t = work.pop()!; if (product.has(t)) continue; product.add(t); for (const d of byName.get(t)?.dependencies || []) if (LINKED.test(byName.get(d)?.type || '')) work.push(d); }
    const builtBy = new Map<string, string[]>();
    for (const e of edges) if (e.kind === 'builds') (builtBy.get(e.dst) || builtBy.set(e.dst, []).get(e.dst)!).push(e.src.slice(7));
    const COMPILED = /\.(c|cc|cpp|cxx|c\+\+|m|mm)$/i;
    const incOut = new Map<string, string[]>();
    for (const e of edges) if (e.kind === 'include' && e.dst.startsWith('file:')) (incOut.get(e.src) || incOut.set(e.src, []).get(e.src)!).push(e.dst);
    // What a set of targets' compiles reach through includes (HORDE's impl lists two sources and includes the rest).
    const reachOf = (pick: (t: string) => boolean) => {
      const seen = new Set<string>(), q: string[] = [];
      for (const [f, ts] of builtBy) if (f.startsWith('file:') && COMPILED.test(f) && ts.some(pick)) { seen.add(f); q.push(f); }
      while (q.length) for (const d of incOut.get(q.pop()!) || []) if (!seen.has(d)) { seen.add(d); q.push(d); }
      return seen;
    };
    const productReach = reachOf((t) => product.has(t));
    const roleOfTarget = (t: string) => first(DSP_TARGET, t);
    for (const n of fileNodes) {
      const ts = (builtBy.get(n.id) || []).sort();
      if (ts.some((t) => product.has(t))) { if (n.role !== 'gui') set(n, 'product', 'dsp-plugin:build/product-target'); continue; } // shared with a test: still product
      if (!ts.length && productReach.has(n.id)) { if (n.role !== 'gui') set(n, 'product', 'dsp-plugin:build/product-reach'); continue; }
      const r = ts.map(roleOfTarget).find(Boolean);
      if (r) set(n, r[1], r[2]);
    }
    if (product.size) {
      // A src/ file the product neither builds nor reaches, reached only by test/probe/bench compiles, takes their role
      // (Julian, 2026-10-17: station_core.h and the like are included only by their checks). Reached by nothing: counted.
      const reachers = new Map<string, Rule>();
      for (const t of [...targets].sort((a, b) => (a.name < b.name ? -1 : 1))) { const r = roleOfTarget(t.name); if (!r || r[1] === 'generator') continue; for (const f of reachOf((x) => x === t.name)) if (!reachers.has(f)) reachers.set(f, r); }
      for (const n of fileNodes) if (n.roleRule === 'default:path/source-dir') {
        const r = reachers.get(n.id);
        if (r) set(n, r[1], 'dsp-plugin:build/reached-only-by-tests'); else report.unreachedSources++;
      }
      // Data compiled into the product (a custom command's input whose output the product builds) is data, not doc.
      const productBuilt = new Set([...builtBy].filter(([, ts]) => ts.some((t) => product.has(t))).map(([f]) => f));
      const byId = new Map(fileNodes.map((n) => [n.id, n]));
      for (const e of edges) if (e.kind === 'generates' && e.provenance === 'config' && productBuilt.has(e.dst)) {
        const n = byId.get(e.src);
        if (n && !CODE_LANG.has(n.lang) && n.role !== 'gui' && !runs.has(n.id)) set(n, 'data', 'dsp-plugin:build/product-input');
      }
    }
  }
  // Generators: the code a command runs, or code that writes a file itself (a static generates edge from a code file).
  for (const n of fileNodes) if (runs.has(n.id)) set(n, 'generator', 'graph:runs-command');
  const writers = new Set(edges.filter((e) => e.kind === 'generates' && e.provenance === 'static').map((e) => e.src));
  for (const n of fileNodes) if (writers.has(n.id) && CODE_LANG.has(n.lang) && !runs.has(n.id)) set(n, 'generator', 'graph:writes-file');
  const cre = cfg.roles.map((r) => globRe(r.match)), used = new Set<number>();
  for (const n of fileNodes) { const i = cre.findIndex((re) => re.test(n.path)); if (i >= 0) { set(n, cfg.roles[i].role, `config:roles[${i}]`); used.add(i); } }
  report.unusedConfig = cfg.roles.map((r, i) => (used.has(i) ? '' : r.match)).filter(Boolean);
  report.unroled = fileNodes.filter((n) => !n.role).length;
  return report;
}

// The GUI bridge: names registered with `<x>.bind("name", ...)` in C-family files, used in HTML/JS code.
export type BridgeEdge = { from: string; to: string; line: number; names: string[] };
export function guiBridge(repo: string, files: { path: string; lang: string; role?: string }[]) {
  const read = (p: string) => { try { return readFileSync(join(repo, p), 'utf8'); } catch { return null; } };
  const lineAt = (t: string, pos: number) => { let n = 1; for (let i = 0; i < pos; i++) if (t.charCodeAt(i) === 10) n++; return n; };
  const reg = new Map<string, Set<string>>(), roleOf = new Map(files.map((f) => [f.path, f.role]));
  let nonLiteral = 0;
  for (const f of files.filter((x) => ['c', 'cpp', 'objc', 'objcpp'].includes(x.lang))) {
    const t = read(f.path); if (!t || !t.includes('.bind')) continue;
    const m = maskJs(t, { cppRawStrings: true }); // C-family comments and strings mask like JS, plus C++ raw strings
    for (const x of m.code.matchAll(/\.\s*bind\s*\(\s*("([A-Za-z_$][\w$]*)"|(?!["\s)])[^,)\n]{1,60})/g)) {
      if (m.inStr[x.index!]) continue;
      if (!x[2]) { nonLiteral++; continue; } // a name in a variable: cannot be matched, counted
      (reg.get(x[2]) || reg.set(x[2], new Set()).get(x[2])!).add(f.path);
    }
  }
  // Prefer product/gui registrations: a test registering the same name on its own web view is not where pages call.
  let dropped = 0;
  for (const [name, set] of reg) {
    const main = [...set].filter((p) => ['product', 'gui'].includes(roleOf.get(p) || ''));
    if (main.length && main.length < set.size) { dropped += set.size - main.length; reg.set(name, new Set(main)); }
  }
  const out: BridgeEdge[] = [];
  if (!reg.size) return { edges: out, nonLiteral, dropped };
  const names = [...reg.keys()].sort((a, b) => b.length - a.length || (a < b ? -1 : 1));
  const NAME = new RegExp(`(?<![\\w$])(${names.map((n) => n.replace(/\$/g, '\\$')).join('|')})(?![\\w$])`, 'g');
  for (const f of files.filter((x) => x.lang === 'html' || x.lang === 'js')) {
    const t = read(f.path); if (!t) continue;
    // HTML: inline script bodies and on*="..." handler attributes are code; JS: the whole file
    let chunks: [string, number][];
    if (f.lang === 'js') chunks = [[t, 0]];
    else {
      const html = t.replace(/<!--[\s\S]*?-->/g, (c) => c.replace(/[^\n]/g, ' '));
      chunks = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((x) => [x[1], x.index! + x[0].indexOf(x[1])] as [string, number])
        .concat([...html.matchAll(/\son[a-z]+\s*=\s*"([^"]*)"/gi)].map((x) => [x[1], x.index! + x[0].indexOf(x[1])] as [string, number]));
    }
    const perLine = new Map<string, Set<string>>(); // "line|to" -> names used on that line
    for (const [body, off] of chunks) {
      const m = maskJs(body);
      for (const x of m.code.matchAll(NAME)) {
        if (m.inStr[x.index!]) continue;
        const after = m.code.slice(x.index! + x[1].length, x.index! + x[1].length + 40);
        let k = x.index! - 1; while (k >= 0 && /\s/.test(m.code[k])) k--;
        if (m.code[k] === '.') { k--; while (k >= 0 && /[\w$]/.test(m.code[k])) k--; while (k >= 0 && /\s/.test(m.code[k])) k--; }
        const prev = k >= 0 ? m.code[k] : '';
        // a mock defines the name (an assignment, or a key in an object literal); it does not use the bridge
        if (/^\s*(=(?!=)|\|\|=|&&=|\?\?=)/.test(after) || (/^\s*:/.test(after) && (prev === '{' || prev === ','))) continue;
        const line = lineAt(t, off + x.index!);
        for (const to of reg.get(x[1])!) { const key = line + '|' + to; (perLine.get(key) || perLine.set(key, new Set()).get(key)!).add(x[1]); }
      }
    }
    // One site per use line; its evidence names every bound name used on it (hzUndo and hzRedo share a line in HORDE).
    for (const [key, ns] of perLine) { const [line, to] = key.split('|'); out.push({ from: f.path, to, line: +line, names: [...ns].sort() }); }
  }
  out.sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0) || a.line - b.line || (a.to < b.to ? -1 : 1));
  return { edges: out, nonLiteral, dropped };
}
