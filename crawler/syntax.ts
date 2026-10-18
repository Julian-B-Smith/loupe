// Syntax layer of the P1a crawler (ROADMAP Q-013; ADRs 0026, 0028). Reads every tracked C, C++ and Objective-C
// file and turns each `#include` / `#include_next` / `#import` into an include fact: where it is, the condition it sits
// under, and what it resolves to and how.
//
// Why a line scanner and not tree-sitter for this (Julian, 2026-10-16, after critic review): preprocessor directives
// are lines, not C syntax. tree-sitter dropped includes inside class bodies, put `__has_include` branches in ERROR
// nodes, and gave a false condition to includes after `#ifdef __cplusplus / extern "C" {`. The scanner keeps an
// #if/#elif/#else/#endif stack over comment-free logical lines, which is exactly the preprocessor's own view.
// tree-sitter stays for what it is good at: each file's parse-error count (0028) now, symbols in P1b.
//
// The census is the one rule applied to includes: every physical line that looks like an include directive is either
// an include fact or listed in `skipped` with a reason. Nothing is dropped silently.
//
// Conditions are recorded, never evaluated (0026: the graph is the union over configurations). Resolution (0028):
// a quoted include found next to the including file is `exact`; one found through the include dirs of a compile of
// the file, in order, is `build` (also a declared build output reached through a build dir); anything else is
// missing (`generated`, `external` or `unknown`) with resolution `syntactic`. Ids say which: `file:<repo path>` or
// `miss:<name>`, so a miss can never be mistaken for a repo file.
//
// Compiles are the roots (Julian, 2026-10-16): only a compiled source has include dirs of its own. Every other file,
// a header a target lists included, is resolved in each compile that reaches it, as a real compiler does; a resolution
// found through another file's compile records that compiled source (`via`). A context is (compile, configuration),
// so a file has at most one per compile: include cycles end and diamonds stay small. A compiled source included by
// another compile is resolved in both. A file takes only the contexts
// in which an include actually resolved to it, and a miss propagates nothing. A listed header no compile reaches
// falls back to its target's include dirs.
//
// Grammars are vendored .wasm files pinned by sha256 (crawler/grammars/GRAMMARS.json); a mismatch refuses to load.
// TypeScript is run by Node's built-in type stripping: only erasable syntax here.
import { execFileSync } from 'node:child_process';
import { readFileSync, realpathSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, posix, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Parser, Language } from 'web-tree-sitter';

type Ctx = { key: string; config: string; includes: string[]; root: string | null };
type BuildFacts = {
  configurations: { name: string }[];
  membership: { source: string; target: string; generated: boolean; configs: string[] }[];
  perConfiguration: { name: string; targets: { name: string; sources: { path: string }[];
    compileGroups: { includes: string[]; sources: string[] }[] }[];
    customCommands: { outputs: string[]; byproducts: string[] }[]; fetched?: string[] }[];
};
export type Include = { from: string; line: number; directive: string; spelled: string; angle: boolean; guard?: string;
  to: string; resolution: 'exact' | 'build' | 'search' | 'syntactic'; missing?: 'generated' | 'external' | 'unknown';
  note?: string; configs?: string[]; via?: string[] };

const GRAMMAR_DIR = join(dirname(fileURLToPath(import.meta.url)), 'grammars');
// Read for includes. .inc is a fragment, .m/.mm Objective-C: no grammar parses them, the scanner reads them all.
// Any other tracked file an include resolves to is read too, whatever its extension (.def, .tcc, ...): the census
// cannot see a file nobody opens.
const READ_EXT = /\.(c|h|cc|cpp|cxx|c\+\+|hh|hpp|hxx|h\+\+|inl|ipp|tpp|inc|m|mm)$/i;
// Parsed by tree-sitter for an error count. `.c` alone is C (a capital `.C` is C++ by convention).
const grammarOf = (p: string): 'c' | 'cpp' | null => (/\.c$/.test(p) ? 'c' : /\.(cc|cpp|cxx|c\+\+|h|hh|hpp|hxx|h\+\+|inl|ipp|tpp|C|H)$/i.test(p) ? 'cpp' : null);
const by = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const sha256 = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');

export function grammarManifest(): Record<string, { file: string; package: string; version: string; sha256: string }> {
  return JSON.parse(readFileSync(join(GRAMMAR_DIR, 'GRAMMARS.json'), 'utf8'));
}
// Loads a grammar only if its bytes match the pinned hash: a swapped file must not silently change every parse.
export async function loadGrammar(lang: 'c' | 'cpp', dir = GRAMMAR_DIR): Promise<Language> {
  const g = grammarManifest()[lang];
  const bytes = readFileSync(join(dir, g.file));
  const got = sha256(bytes);
  if (got !== g.sha256) throw new Error(`grammar ${g.file}: sha256 ${got} does not match GRAMMARS.json (${g.sha256})`);
  return Language.load(bytes);
}

// ---- the directive scanner
// Comments become spaces, line by line, so line numbers stay true. Modelled because each was a false include fact
// (critic, 2026-10-16): string and char literals (a "/*" in a string opens nothing), C++14 digit separators (1'000 is
// not a char literal), a `//` comment whose line ends in `\` (C splices it with the next line), raw string literals
// R"d(...)d" across lines, and `//` inside the <...> of an include.
const HDR_LINE = /^\s*(?:#|%:)\s*(include|include_next|import)\s*</;
export function stripComments(text: string): string[] {
  const out: string[] = [];
  let inBlock = false, lineCont = false, raw: string | null = null;
  for (const line of text.replace(/\r$/gm, '').split('\n')) {
    if (lineCont) { out.push(' '.repeat(line.length)); lineCont = /\\\s*$/.test(line); continue; }
    let s = '', q: string | null = null;
    const hdr = HDR_LINE.exec(line), hdrEnd = hdr ? line.indexOf('>', hdr[0].length) : -1;
    for (let i = 0; i < line.length; i++) {
      const c = line[i], d = line[i + 1];
      if (raw !== null) { if (line.startsWith(raw, i)) { s += ' '.repeat(raw.length); i += raw.length - 1; raw = null; } else s += ' '; continue; }
      if (inBlock) { if (c === '*' && d === '/') { inBlock = false; i++; s += '  '; } else s += ' '; continue; }
      if (q) { s += c; if (c === '\\') { s += d ?? ''; i++; } else if (c === q) q = null; continue; }
      if (hdr && i >= hdr[0].length - 1 && i <= hdrEnd) { s += c; continue; }
      if (c === '/' && d === '*') { inBlock = true; i++; s += '  '; continue; }
      if (c === '/' && d === '/') { s += ' '.repeat(line.length - i); lineCont = /\\\s*$/.test(line); break; }
      const rm = c === '"' ? /(?:^|[^\w])(?:u8|[uUL])?R$/.exec(line.slice(0, i)) : null;
      if (rm) { const m = /^"([^()\\\s]{0,16})\(/.exec(line.slice(i)); if (m) { raw = ')' + m[1] + '"'; s += ' '.repeat(m[0].length); i += m[0].length - 1; continue; } }
      if (c === "'" && /[0-9A-Fa-f]/.test(line[i - 1] ?? '') && /[0-9A-Fa-f]/.test(d ?? '') && /[0-9]/.test(line.slice(0, i).match(/[\w']*$/)?.[0][0] ?? '')) { s += c; continue; }
      if (c === '"' || c === "'") q = c;
      s += c;
    }
    out.push(s);
  }
  return out;
}

export type Directive = { line: number; name: string; arg: string };
// Logical directive lines: a `\` at the end of a line continues it; the directive keeps its first line's number.
// `%:` is the digraph for `#`.
export function directives(text: string): Directive[] {
  const lines = stripComments(text), out: Directive[] = [];
  for (let i = 0; i < lines.length; i++) {
    const start = i;
    let l = lines[i];
    while (/\\\s*$/.test(l) && i + 1 < lines.length) l = l.replace(/\\\s*$/, ' ') + lines[++i];
    const m = /^\s*(?:#|%:)\s*([A-Za-z_]\w*)\s*(.*?)\s*$/.exec(l);
    if (m) out.push({ line: start + 1, name: m[1], arg: m[2].replace(/\s+/g, ' ') });
  }
  return out;
}

type RawInclude = { line: number; directive: string; spelled: string; angle: boolean; guard: string; computed: boolean };
const INCLUDE = new Set(['include', 'include_next', 'import']);
type Part = { text: string; neg: boolean };

export function scanIncludes(text: string): { includes: RawInclude[]; problems: { line: number; text: string }[] } {
  const ds = directives(text), includes: RawInclude[] = [], problems: { line: number; text: string }[] = [];
  // Include guard: the first directive (pragmas aside) is `#ifndef X` or `#if !defined(X)`, the next is `#define X`
  // (any value), its `#endif` is the file's last directive, it has no #elif/#else, and no code sits outside it.
  const code = stripComments(text);
  const cond = (d: Directive) => d.name === 'ifndef' ? d.arg.split(' ')[0] : d.name === 'if' ? /^!\s*defined\s*\(?\s*(\w+)\s*\)?$/.exec(d.arg)?.[1] : undefined;
  const nonPragma = ds.filter((d) => d.name !== 'pragma');
  let guardOpen = -1;
  const gName = nonPragma[0] && cond(nonPragma[0]);
  if (gName && nonPragma[1]?.name === 'define' && nonPragma[1].arg.split(' ')[0] === gName && nonPragma[nonPragma.length - 1].name === 'endif') {
    let depth = 0, closes = -1, branches = false;
    for (const d of ds) {
      if (/^if/.test(d.name)) depth++;
      else if (depth === 1 && /^(elif|elifdef|elifndef|else)$/.test(d.name)) branches = true;
      else if (d.name === 'endif' && --depth === 0) { closes = d.line; break; }
    }
    const open = nonPragma[0].line, last = nonPragma[nonPragma.length - 1].line;
    const outside = code.some((l, i) => (i + 1 < open || i + 1 > closes) && l.trim() && !/^\s*(?:#|%:)\s*pragma\b/.test(l));
    if (closes === last && !outside && !branches) guardOpen = open;
  }
  const stack: { prior: string[]; cur: string | null; guard: boolean }[] = [];
  // Every raw condition is parenthesised when joined, so `!(A) || B` under `C` reads (C) && (!(A) || B) (critic).
  const guardNow = () => {
    const parts: Part[] = stack.filter((f) => !f.guard).flatMap((f) => [...f.prior.map((t) => ({ text: t, neg: true })), ...(f.cur === null ? [] : [{ text: f.cur, neg: false }])]);
    if (parts.length === 1) return parts[0].neg ? `!(${parts[0].text})` : parts[0].text;
    return parts.map((p) => (p.neg ? `!(${p.text})` : `(${p.text})`)).join(' && ');
  };
  const condOf = (d: Directive) => d.name === 'ifdef' || d.name === 'elifdef' ? `defined(${d.arg})`
    : d.name === 'ifndef' || d.name === 'elifndef' ? `!defined(${d.arg})` : d.arg;
  for (const d of ds) {
    if (d.name === 'if' || d.name === 'ifdef' || d.name === 'ifndef') stack.push({ prior: [], cur: condOf(d), guard: d.line === guardOpen });
    else if (d.name === 'elif' || d.name === 'elifdef' || d.name === 'elifndef' || d.name === 'else') {
      const f = stack[stack.length - 1];
      if (!f) { problems.push({ line: d.line, text: `#${d.name} without #if` }); continue; }
      if (f.cur !== null) f.prior.push(f.cur);
      f.cur = d.name === 'else' ? null : condOf(d);
    } else if (d.name === 'endif') { if (!stack.pop()) problems.push({ line: d.line, text: '#endif without #if' }); }
    else if (INCLUDE.has(d.name)) {
      const q = /^"([^"]*)"/.exec(d.arg), a = /^<([^>]*)>/.exec(d.arg);
      includes.push({ line: d.line, directive: d.name, spelled: q ? q[1] : a ? a[1] : d.arg, angle: !!a, guard: guardNow(), computed: !q && !a });
    }
  }
  if (stack.length) problems.push({ line: ds[ds.length - 1]?.line ?? 0, text: `${stack.length} #if without #endif` });
  return { includes, problems };
}

// Census: every physical line that looks like an include directive, read without any comment or continuation logic.
const RAW_INCLUDE = /^\s*(?:#|%:)\s*(include|include_next|import)\b/;
export function census(text: string, found: RawInclude[]) {
  const at = new Set(found.map((i) => i.line)), code = stripComments(text), skipped: { line: number; reason: string }[] = [];
  text.replace(/\r$/gm, '').split('\n').forEach((l, i) => {
    if (!RAW_INCLUDE.test(l) || at.has(i + 1)) return;
    skipped.push({ line: i + 1, reason: RAW_INCLUDE.test(code[i]) ? 'not read as a directive' : 'inside a comment or literal' });
  });
  return skipped;
}

function errorCount(tree: any): number {
  let n = 0;
  const c = tree.walk();
  for (let more = true; more;) {
    if (c.currentNode.isError || c.currentNode.isMissing) n++;
    if (c.gotoFirstChild()) continue;
    while (!c.gotoNextSibling()) if (!c.gotoParent()) { more = false; break; }
  }
  c.delete();
  return n;
}

// No machine paths in output: an absolute spelling (`/x`, `//server/x`, `C:\x`, `\x`) keeps only its last component.
const isAbs = (s: string) => /^[\\/]/.test(s) || /^[A-Za-z]:[\\/]/.test(s);
const redact = (s: string) => '${external}/' + posix.basename(s.replace(/\\/g, '/'));
const redactText = (s: string) => s.replace(/(^|[\s<"=(])((?:[\\/]|[A-Za-z]:[\\/])[^\s>")]*)/g, (_m, pre, p) => pre + redact(p));

// ---- the layer
export async function syntaxLayer(repoIn: string, build: BuildFacts) {
  let repo = repoIn; try { repo = realpathSync(repoIn); } catch {}
  let listing: string;
  try { listing = execFileSync('git', ['-C', repo, 'ls-files', '-z', '--', '.'], { stdio: ['ignore', 'pipe', 'pipe'] }).toString(); }
  catch (e: any) { throw new Error(`syntax layer: git ls-files failed in ${repoIn}: ${String(e.stderr || e.message).trim()}`); }
  const tracked = listing.split('\0').filter(Boolean).sort(by);
  const trackedSet = new Set(tracked);
  // Submodules (index mode 160000) and their pinned commits: a path inside one is a pinned outside repo, which the
  // crawl does not read, never "not found" (Q-025: 38 of HORDE's 47 unknowns were clap-wrapper and choc files).
  const subs = execFileSync('git', ['-C', repo, 'ls-files', '-s', '-z', '--', '.'], { stdio: ['ignore', 'pipe', 'pipe'] }).toString().split('\0').filter(Boolean)
    .filter((l) => l.startsWith('160000 ')).map((l) => ({ path: l.slice(l.indexOf('\t') + 1), sha: l.split(' ')[1] })).sort((a, b) => by(a.path, b.path));
  const subOf = (p: string) => subs.find((x) => p.startsWith(x.path + '/'));
  const allConfigs = build.configurations.map((c) => c.name);
  const generatedOutputs = new Set<string>();
  for (const m of build.membership) if (m.generated) generatedOutputs.add(m.source);
  for (const pc of build.perConfiguration) for (const c of pc.customCommands) for (const o of [...c.outputs, ...c.byproducts]) generatedOutputs.add(o);
  // Headers in sources the build fetched (build layer, listed during configure): found there, an include is external
  // and resolved by the build; not there, it stays unknown, so a typo is never taken for an SDK header (critic M2).
  const fetchedFiles = new Set<string>(build.perConfiguration.flatMap((pc) => pc.fetched || []));

  // Roots: one context per (configuration, compiled source), with that compile group's include dirs. Fallbacks: a
  // listed but uncompiled file gets its target's include dirs, used only if no compile reaches it.
  const roots = new Map<string, Ctx[]>(), fallback = new Map<string, Ctx[]>();
  const add = (m: Map<string, Ctx[]>, f: string, c: Ctx) => { const l = m.get(f) || []; if (!l.some((x) => x.key === c.key)) l.push(c); m.set(f, l); };
  for (const pc of build.perConfiguration) for (const t of pc.targets) {
    const all: string[] = []; for (const g of t.compileGroups) for (const d of g.includes) if (!all.includes(d)) all.push(d);
    for (const g of t.compileGroups) for (const s of g.sources) add(roots, s, { key: `${pc.name}\u0000${s}\u0000${g.includes.join('\u0001')}`, config: pc.name, includes: g.includes, root: s });
    for (const s of t.sources) if (!t.compileGroups.some((g) => g.sources.includes(s.path)))
      add(fallback, s.path, { key: `${pc.name}\u0000(listed by ${t.name})\u0000${all.join('\u0001')}`, config: pc.name, includes: all, root: null });
  }

  const parsers: Record<'c' | 'cpp', Parser> = { c: null as any, cpp: null as any };
  await Parser.init();
  for (const l of ['c', 'cpp'] as const) { parsers[l] = new Parser(); parsers[l].setLanguage(await loadGrammar(l)); }
  type Read = { path: string; grammar: 'c' | 'cpp' | null; parseErrors: number | null; includes: RawInclude[];
    problems: { line: number; text: string }[]; skipped: { line: number; reason: string }[] };
  const read = new Map<string, Read>();
  const readFile = (path: string) => {
    if (read.has(path)) return read.get(path)!;
    let text: string;
    try { text = readFileSync(join(repo, path), 'utf8'); }
    catch { const r = { path, grammar: null, parseErrors: null, includes: [], problems: [{ line: 0, text: 'tracked but not readable on disk' }], skipped: [] }; read.set(path, r); return r; }
    const { includes, problems } = scanIncludes(text);
    const g = grammarOf(path);
    let parseErrors: number | null = null;
    if (g) { const tree = parsers[g].parse(text); parseErrors = errorCount(tree); tree.delete(); }
    const r = { path, grammar: g, parseErrors, includes, problems, skipped: census(text, includes) };
    read.set(path, r);
    return r;
  };
  for (const p of tracked) if (READ_EXT.test(p)) readFile(p);

  const relTo = (from: string, spelled: string) => posix.normalize(posix.join(posix.dirname(from), spelled));
  const viaDirs = (spelled: string, dirs: string[], skip: string | null = null): string | null => {
    for (const d of dirs) {
      if (d.startsWith('${external}')) continue; // outside the repo: not looked in
      const cand = posix.normalize(posix.join(d, spelled));
      if (cand.startsWith('../') || cand === skip) continue;
      if (d.startsWith('${build}') ? generatedOutputs.has(cand) || fetchedFiles.has(cand) : trackedSet.has(cand)) return cand;
    }
    return null;
  };
  type One = { to: string; resolution: 'exact' | 'build' | 'search' | 'syntactic'; missing?: 'generated' | 'external' | 'unknown'; note?: string };
  // One include in one context (or in none). Windows backslashes read as `/`; an absolute spelling is never looked up.
  const resolveIn = (f: string, inc: RawInclude, c: Ctx | null): One => {
    const sp = posix.normalize(inc.spelled.replace(/\\/g, '/'));
    if (isAbs(inc.spelled)) return { to: 'miss:' + redact(inc.spelled), resolution: 'syntactic', missing: 'external' };
    // #include_next continues the search after the dir where this file itself was found, never next to it, and
    // never finds the including file again (critic, third review: a false self-edge hid the real next header).
    const next = inc.directive === 'include_next';
    if (!inc.angle && !next) { const r = relTo(f, sp); if (!r.startsWith('../') && trackedSet.has(r)) return { to: 'file:' + r, resolution: 'exact' }; }
    let dirs = c ? c.includes : [];
    if (next && c) { const at = dirs.findIndex((d) => posix.normalize(posix.join(d, sp)) === f); if (at >= 0) dirs = dirs.slice(at + 1); }
    const hit = c ? viaDirs(sp, dirs, next ? f : null) : null;
    if (hit && fetchedFiles.has(hit)) return { to: 'miss:' + hit, resolution: 'build', missing: 'external', note: 'in sources the build fetched (FetchContent): listed at configure, not read by the crawl' };
    if (hit) return { to: (hit.startsWith('${build}') ? 'miss:' : 'file:') + hit, resolution: 'build' };
    const gen = [...generatedOutputs].filter((o) => o === sp || o.endsWith('/' + sp)).sort(by)[0];
    if (gen) return { to: 'miss:' + gen, resolution: 'syntactic', missing: 'generated' };
    if (!inc.angle) {
      // Q-025, in this order. (1) Next to the file or on a repo include dir, but inside a submodule: a pinned outside
      // repo. Checked on disk when the submodule is checked out (the HORDE gate's clone fills them): the first candidate
      // that exists wins, and if none does the include stays unknown. Unchecked, and said so, only when it is not.
      const repoDirs = (c ? dirs : []).filter((d) => !d.startsWith('${'));
      const cands = [relTo(f, sp), ...repoDirs.map((d) => posix.normalize(posix.join(d, sp)))].filter((x) => !x.startsWith('../') && subOf(x));
      const out = (x: string) => subOf(x)!, checkedOut = (x: string) => existsSync(join(repo, out(x).path, '.git'));
      const found = cands.find((x) => checkedOut(x) && existsSync(join(repo, x)));
      // Found next to the file: exact; found through a -I include dir the build gave: build (critic round 2, L4).
      if (found) return { to: 'miss:' + found, resolution: found === cands[0] && found === relTo(f, sp) ? 'exact' : 'build', missing: 'external', note: `in submodule ${out(found).path} (pinned ${out(found).sha.slice(0, 12)}), which the crawl does not read` };
      const unchecked = cands.find((x) => !checkedOut(x));
      if (unchecked) return { to: 'miss:' + unchecked, resolution: 'syntactic', missing: 'external', note: `in submodule ${out(unchecked).path} (pinned ${out(unchecked).sha.slice(0, 12)}), not checked out: the file's existence is unchecked` };
      // (2) A file no compile reaches has no include path: try the nearest parent directory that has the header, as a
      // -I of that directory would (engine2/tests/controls/x.cpp including "suite.h" finds engine2/tests/suite.h).
      // Resolution `search`: a guess about an include path no build states, worth auditing.
      if (!c) for (let d = posix.dirname(posix.dirname(f)); ; d = posix.dirname(d)) {
        const cand = posix.normalize(posix.join(d, sp));
        if (!cand.startsWith('../') && trackedSet.has(cand)) return { to: 'file:' + cand, resolution: 'search' };
        if (d === '.' || d === '') break;
      }
    }
    return { to: 'miss:' + sp, resolution: 'syntactic', missing: inc.angle ? 'external' : 'unknown' };
  };

  // Reached contexts, per file, from compile roots; then fallbacks for listed files no compile reached. Two phases so
  // a file never switches from fallback to compile contexts after passing the fallback on.
  const reached = new Map<string, Ctx[]>();
  for (const [f, cs] of roots) for (const c of cs) add(reached, f, c);
  const spread = (seeds: Map<string, Ctx[]>, into: Map<string, Ctx[]>, allow: (f: string, c: Ctx) => boolean) => {
    const work = [...seeds.keys()].sort(by);
    while (work.length) {
      const f = work.shift()!;
      if (!trackedSet.has(f)) continue; // a build output or a file outside the repo: not ours to read
      const r = readFile(f);
      for (const inc of r.includes) if (!inc.computed) for (const c of into.get(f) || []) {
        const res = resolveIn(f, inc, c);
        if (!res.to.startsWith('file:')) continue;
        const to = res.to.slice(5);
        // A compiled source included by another compile (a unity build, an .mm including a .cpp) is resolved in that
        // compile too, as the compiler does (Julian, 2026-10-16).
        if (to === f && c.root === f) continue;
        if (!allow(to, c)) continue;
        const before = (into.get(to) || []).length;
        add(into, to, c);
        if ((into.get(to) || []).length > before && !work.includes(to)) work.push(to);
      }
    }
  };
  spread(roots, reached, () => true);
  // Fallback per (file, configuration) (Julian, 2026-10-16): a configuration in which no compile reaches a listed
  // header uses its target's dirs there, so nothing about that configuration is dropped.
  const reachedIn = (f: string, cfg: string) => (reached.get(f) || []).some((x) => x.config === cfg);
  const fb = new Map<string, Ctx[]>();
  for (const [f, cs] of fallback) for (const c of cs) if (!reachedIn(f, c.config)) add(fb, f, c);
  spread(fb, fb, (f, c) => !reachedIn(f, c.config));
  const ctxOf = (f: string) => [...(reached.get(f) || []), ...(fb.get(f) || [])];
  // Reach: every tracked file any include resolves to is read, also from files no compile reaches (critic H3).
  for (let grew = true; grew;) {
    grew = false;
    for (const p of [...read.values()]) for (const inc of p.includes) if (!inc.computed)
      for (const c of ctxOf(p.path).length ? ctxOf(p.path) : [null]) {
        const res = resolveIn(p.path, inc, c);
        if (res.to.startsWith('file:') && !read.has(res.to.slice(5))) { readFile(res.to.slice(5)); grew = true; }
      }
  }

  const includes: Include[] = [], computed: { from: string; line: number; text: string; guard?: string }[] = [];
  const files = [...read.values()].sort((a, b) => by(a.path, b.path));
  for (const p of files) {
    const cs = ctxOf(p.path);
    // `configs` is narrowed against the configurations this file is compiled in (critic M3).
    const fileCfgs = new Set(cs.map((c) => c.config));
    for (const inc of p.includes) {
      if (inc.computed) { computed.push({ from: p.path, line: inc.line, text: redactText(inc.spelled), ...(inc.guard ? { guard: inc.guard } : {}) }); continue; }
      const groups = new Map<string, { one: One; configs: Set<string>; via: Set<string> }>();
      for (const c of cs.length ? cs : [null]) {
        const one = resolveIn(p.path, inc, c), k = one.to + '\u0000' + one.resolution;
        const gr = groups.get(k) || { one, configs: new Set<string>(), via: new Set<string>() };
        if (c) { gr.configs.add(c.config); if (one.resolution === 'build' && c.root && c.root !== p.path) gr.via.add(c.root); }
        groups.set(k, gr);
      }
      for (const { one, configs, via } of groups.values()) {
        const e: Include = { from: p.path, line: inc.line, directive: inc.directive, spelled: isAbs(inc.spelled) ? redact(inc.spelled) : inc.spelled,
          angle: inc.angle, to: one.to, resolution: one.resolution };
        if (inc.guard) e.guard = inc.guard;
        if (one.missing) e.missing = one.missing;
        if (one.note) e.note = one.note;
        if (configs.size && configs.size < fileCfgs.size) e.configs = [...configs].sort(by);
        if (via.size) e.via = [...via].sort(by);
        includes.push(e);
      }
    }
  }
  includes.sort((a, b) => by(a.from, b.from) || a.line - b.line || by(a.to, b.to) || by(a.resolution, b.resolution));
  const man = grammarManifest();
  return {
    schema: 'loupe.syntaxfacts/0.0-internal',
    grammars: Object.fromEntries(Object.entries(man).map(([k, g]) => [k, { package: g.package, version: g.version, sha256: g.sha256 }])),
    // A file's configurations: where some compile reaches it. Spelled out unless it is all of them, so an include
    // with no `configs` is readable as "wherever its file is compiled" (critic, third review). `inCompile: false`:
    // no compile reaches the file, so its includes resolve only next to it.
    files: files.map((p) => {
      const cs = [...new Set(ctxOf(p.path).map((c) => c.config))].sort(by);
      return { path: p.path, grammar: p.grammar, parseErrors: p.parseErrors,
        ...(cs.length === 0 ? { inCompile: false } : cs.length < allConfigs.length ? { configs: cs } : {}) };
    }),
    includes,
    computed,
    skipped: files.flatMap((p) => p.skipped.map((s) => ({ from: p.path, ...s }))),
    problems: files.flatMap((p) => p.problems.map((s) => ({ from: p.path, ...s }))),
  };
}
