// Languages layer of the P1a crawler (ROADMAP Q-023): Python, JavaScript, HTML and shell. Deterministic and
// line-oriented, like the syntax layer's directive scanner, with one rule above all (Julian, 2026-10-17, after the
// critic found 15 invented npm packages on HORDE): **imports are read from code only.** Each language has a small
// scanner that blanks comments and marks string literals; an import keyword inside a comment, a string, a template
// literal or a docstring is not a dependency. A missed edge is preferred to a made-up one.
//
//   import      Python import / from-import (relative, parenthesised, `;`-separated), JS import / export-from /
//               import() / require(), HTML inline module imports, shell `source` / `.`
//   reference   HTML script / link / img / iframe / source; a shell interpreter call of a repo script; a repo path
//               written as a string literal (strings on purpose: Julian, 2026-10-17, "imports plus references")
//   data        such a literal naming a data file (json, csv, tsv, yaml, txt, ...)
//   generates   a literal that is the thing written: open(<lit>, 'w'), <lit>.write_text, writeFileSync(<lit>, ...),
//               the word after `>` in shell. Tied to the literal's position, never to the line (a read and a write on
//               one line are a read and a write).
//
// Resolution (0028): a path next to the file is `exact`; one from the repo root, or a Python module found by its
// unique name, is `search`; a literal with no `/` resolves only next to the file (a bare "index.html" passed to
// join(outDir, ...) named a repo file it never touched), unless the code joins it onto a variable named for the repo
// root (`ROOT / "CMakeLists.txt"`, `join(repo_root, "x")`; Q-025: four of HORDE's checks read the root CMakeLists.txt
// that way; five, it turned out), which resolves from the repo root as `search`. Shell paths are `search` at best: the shell resolves them
// from its working directory, which the crawl cannot know. Unresolved: an external package (`ext:`), or a missing node.
// What cannot be evaluated (import(name), __import__(var), `${...}` specifiers, `$VAR/x.sh`) is listed in `computed`.
// TypeScript is run by Node's built-in type stripping: only erasable syntax here.
import { readFileSync, openSync, readSync, closeSync } from 'node:fs';
import { join, posix } from 'node:path';

export type LangEdge = { from: string; line: number; kind: 'import' | 'reference' | 'data' | 'generates';
  to: string; resolution: 'exact' | 'search' | 'syntactic'; missing?: 'unknown' | 'external'; note?: string;
  typeOnly?: boolean }; // TypeScript `import type` / `export type ... from`: erased at compile time (Q-026)
export type Computed = { from: string; line: number; text: string };
const by = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export const LANG_OF: Record<string, string> = { '.py': 'python', '.js': 'js', '.mjs': 'js', '.cjs': 'js', '.html': 'html', '.htm': 'html', '.sh': 'sh', '.bash': 'sh',
  '.ts': 'ts', '.tsx': 'ts', '.mts': 'ts', '.cts': 'ts' }; // TypeScript reads with the JS lexer (Q-026)
// CMakeLists.txt ends in .txt but is build configuration: a script reading it references the build, not data (Q-025).
const DATA_EXT = /^(?!(?:.*\/)?CMakeLists\.txt$).*\.(json|csv|tsv|ya?ml|txt|f32|wav|toml|ini|xml)$/i;
// Fixed lists, never read from the host (the crawl must not depend on what is installed).
export const PY_STD = new Set(('__future__ abc argparse array ast asyncio base64 binascii bisect builtins bz2 calendar cmath codecs collections '
  + 'colorsys concurrent configparser contextlib copy copyreg csv ctypes curses dataclasses datetime decimal difflib dis doctest email enum '
  + 'errno fcntl filecmp fileinput fnmatch fractions ftplib functools gc getopt getpass gettext glob graphlib gzip hashlib heapq hmac html '
  + 'http imaplib importlib inspect io ipaddress itertools json keyword linecache locale logging lzma mailbox marshal math mimetypes mmap '
  + 'multiprocessing netrc numbers operator optparse os pathlib pdb pickle pkgutil platform plistlib poplib posix posixpath pprint profile '
  + 'pstats pty pwd queue quopri random re readline reprlib resource rlcompleter runpy sched secrets select selectors shelve shlex shutil '
  + 'signal site smtplib socket socketserver sqlite3 ssl stat statistics string stringprep struct subprocess symtable sys sysconfig '
  + 'syslog tabnanny tarfile tempfile termios textwrap threading time timeit tkinter token tokenize tomllib trace traceback tracemalloc '
  + 'tty turtle types typing unicodedata unittest urllib uuid venv warnings wave weakref webbrowser wsgiref xml xmlrpc zipapp zipfile '
  + 'zipimport zlib zoneinfo').split(' '));
export const NODE_BUILTINS = new Set(('assert async_hooks buffer child_process cluster console constants crypto dgram diagnostics_channel dns '
  + 'domain events fs http http2 https inspector module net os path perf_hooks process punycode querystring readline repl stream '
  + 'string_decoder sys test timers tls trace_events tty url util v8 vm wasi worker_threads zlib').split(' '));
// A bare name joined onto the repo root: `ROOT / "x"` (pathlib) or `join(ROOT, "x")`, with the variable named for the
// root. Read on the code mask, so text in a comment never matches. Other names (outDir, here) stay next-to-the-file.
// Lowercase `root`/`repo` is usually a parameter that receives ROOT (HORDE: gen_sbom.py, license_audit_check.py), but
// also the walker's `for root, dirs, files in os.walk(...)` or a CLI argument (h2_ab.mjs writes join(outDir, ...)):
// it counts only in a file that defines an uppercase root and never binds `root` by a loop or from argv (critic M1).
const rootJoin = (v: string) => new RegExp(`(?:(?:^|[^\\w.])${v}\\s*\\/|\\bjoin\\(\\s*${v}\\s*,)\\s*$`);
const ROOT_JOIN = rootJoin('(?:REPO_ROOT|ROOT|REPO)');
const DEFINES_ROOT = /\b(?:REPO_ROOT|ROOT)\s*=/;
// Any other binding disqualifies that name: a loop, `with ... as root` (a temporary copy, HORDE's plant-into-a-copy
// selftests), or `root = <anything but ROOT>` (critic round 2: a scratch root once read as a write to ROADMAP.md).
// Per name: `repo = re.search(...)` disqualifies `repo`, not the file's `root` (gen_sbom.py binds both).
const LOWER_ROOTS = ['root', 'repo', 'repo_root', 'reporoot'];
const bindsOtherwise = (v: string) => new RegExp(`\\bfor\\s*\\(?\\s*(?:(?:const|let|var)\\s+)?(?:[\\w\\s,]*,\\s*)?${v}\\b|\\b${v}\\s*,\\s*\\w+\\s*,\\s*\\w+\\s+in\\b|\\bas\\s+${v}\\b|\\b${v}\\s*=(?!=)\\s*(?![\\s]|(?:REPO_)?ROOT\\b|[\\w.]*\\(\\s*${v}\\s*\\))`); // root = Path(root) keeps the same root
const BINDS = Object.fromEntries(LOWER_ROOTS.map((v) => [v, bindsOtherwise(v)]));
const DTS = /\.d\.[cm]?ts$/; // a declaration file: emits nothing, so all it imports is type-only (Q-026)
const MODULE_SPEC = /^[\w@.\/:~-][^\s'"(),;&|<>`{}]*$/; // what a JS specifier can look like; anything else is not one

// ---- code masks: same length as the text, comments blanked, string contents kept but marked
export type Mask = { code: string; inStr: Uint8Array };
// Python and shell-like texts: `#` comments, quotes, and (Python) triple-quoted strings blanked whole.
export function maskHash(text: string, triple: boolean): Mask {
  const out = text.split(''), inStr = new Uint8Array(text.length);
  const blank = (a: number, b: number) => { for (let k = a; k < b; k++) if (out[k] !== '\n') out[k] = ' '; };
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === '#') { const e = text.indexOf('\n', i); const end = e < 0 ? text.length : e; blank(i, end); i = end; continue; }
    if (triple && (text.startsWith('"""', i) || text.startsWith("'''", i))) {
      const q = text.slice(i, i + 3), e = text.indexOf(q, i + 3), end = e < 0 ? text.length : e + 3;
      blank(i, end); i = end; continue; // docstrings and multi-line strings: never code, never a path we want
    }
    if (c === '"' || c === "'") {
      let k = i + 1; while (k < text.length && text[k] !== c && text[k] !== '\n') k += text[k] === '\\' ? 2 : 1;
      for (let x = i + 1; x < k; x++) inStr[x] = 1;
      i = k + 1; continue;
    }
    i++;
  }
  return { code: out.join(''), inStr };
}
// JavaScript: a small lexer, because a regex literal holding a quote (/"/) or code inside a template's ${...} would
// otherwise desynchronise a naive quote scan and swallow real code (it hid `join(root, 'tests/morph_order.txt')` on
// HORDE). Template literal text is blanked; code inside ${...} is lexed as code; regex literals are skipped.
export function maskJs(text: string, opts: { cppRawStrings?: boolean } = {}): Mask {
  const out = text.split(''), inStr = new Uint8Array(text.length), n = text.length;
  const blank = (a: number, b: number) => { for (let k = a; k < b; k++) if (out[k] !== '\n') out[k] = ' '; };
  // Can a `/` here start a regex? After an operator, an opening bracket, a keyword, or at the start.
  const regexOk = (i: number) => {
    let k = i - 1; while (k >= 0 && /\s/.test(text[k])) k--;
    if (k < 0) return true;
    if (/[(,=:[!&|?{};+\-*%<>~^]/.test(text[k])) return true;
    const w = /[A-Za-z_$]+$/.exec(text.slice(Math.max(0, k - 10), k + 1));
    return !!w && /^(return|typeof|in|of|case|do|else|void|delete|throw|yield|await)$/.test(w[0]);
  };
  // code(i, braceStop): lex code from i; with braceStop, return just past the `}` that closes a ${...}.
  const code = (i: number, braceStop: boolean): number => {
    let depth = 0;
    while (i < n) {
      const c = text[i], d = text[i + 1];
      if (c === '/' && d === '/') { const e = text.indexOf('\n', i); const end = e < 0 ? n : e; blank(i, end); i = end; continue; }
      if (c === '/' && d === '*') { const e = text.indexOf('*/', i + 2); const end = e < 0 ? n : e + 2; blank(i, end); i = end; continue; }
      // C++ raw string R"d(...)d": may hold quotes and newlines; masked whole (the dialect scans C++ with this mask)
      if (opts.cppRawStrings && c === '"' && /(?:^|[^\w])(?:u8|[uUL])?R$/.test(text.slice(Math.max(0, i - 3), i))) {
        const m = /^"([^()\\\s]{0,16})\(/.exec(text.slice(i, i + 20));
        if (m) { const close = ')' + m[1] + '"', e = text.indexOf(close, i + m[0].length), end = e < 0 ? n : e + close.length; blank(i, end); i = end; continue; }
      }
      if (c === '"' || c === "'") { let k = i + 1; while (k < n && text[k] !== c && text[k] !== '\n') k += text[k] === '\\' ? 2 : 1; for (let x = i + 1; x < k; x++) inStr[x] = 1; i = k + 1; continue; }
      if (c === '`') { i = template(i + 1, i); continue; }
      if (c === '/' && regexOk(i)) {
        let k = i + 1, cls = false;
        while (k < n && text[k] !== '\n' && (cls || text[k] !== '/')) { if (text[k] === '\\') k++; else if (text[k] === '[') cls = true; else if (text[k] === ']') cls = false; k++; }
        blank(i, Math.min(k + 1, n)); i = k + 1; continue;
      }
      if (braceStop) { if (c === '{') depth++; else if (c === '}') { if (depth === 0) return i + 1; depth--; } }
      i++;
    }
    return n;
  };
  // template(i, start): template text from i (start = where its text began); ${...} is code. Returns past the backtick.
  const template = (i: number, start: number): number => {
    while (i < n) {
      if (text[i] === '\\') { i += 2; continue; }
      if (text[i] === '`') { blank(start, i + 1); return i + 1; }
      if (text[i] === '$' && text[i + 1] === '{') { blank(start, i + 2); const end = code(i + 2, true); return template(end, end); }
      i++;
    }
    blank(start, n); return n;
  };
  code(0, false);
  return { code: out.join(''), inStr };
}
const lineStarts = (t: string) => { const s = [0]; for (let i = 0; i < t.length; i++) if (t[i] === '\n') s.push(i + 1); return s; };
const lineAt = (starts: number[], pos: number) => { let lo = 0, hi = starts.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (starts[m] <= pos) lo = m; else hi = m - 1; } return lo + 1; };

export function langLayer(repo: string, tracked: string[], textFiles: Set<string> = new Set(tracked)) {
  const set = new Set(tracked), out: LangEdge[] = [], computed: Computed[] = [], notes: { what: string; reason: string }[] = [];
  // A file with no extension is a script when its first line says so (`#!/usr/bin/env bash`): HORDE's ./verify is one.
  const shebang = (p: string): string | null => {
    if (posix.extname(p) || !textFiles.has(p)) return null;
    try { const fd = openSync(join(repo, p), 'r'), b = Buffer.alloc(200); const n = readSync(fd, b, 0, 200, 0); closeSync(fd);
      const m = /^#!.*\b(bash|sh|zsh|python3?|node)\b/.exec(b.subarray(0, n).toString('utf8').split('\n')[0]);
      return m ? (m[1].startsWith('python') ? 'python' : m[1] === 'node' ? 'js' : 'sh') : null; } catch { return null; }
  };
  const langOfFile = new Map<string, string>();
  for (const p of tracked) if (textFiles.has(p)) { const l = LANG_OF[posix.extname(p).toLowerCase()] || shebang(p); if (l) langOfFile.set(p, l); }
  const files = [...langOfFile.keys()].sort(by);
  const pyByName = new Map<string, string[]>();
  for (const p of tracked) if (p.endsWith('.py')) { const n = posix.basename(p, '.py'); pyByName.set(n, [...(pyByName.get(n) || []), p]); }
  const rel = (from: string, spec: string) => posix.normalize(posix.join(posix.dirname(from), spec));
  const add = (e: LangEdge) => { if (e.to !== 'file:' + e.from) out.push(e); };
  // A path: next to the file (exact), else from the repo root (search; only for specs with a `/`, see above).
  const findPath = (from: string, spec: string, exts: string[] = [''], rootOk = true): { to: string; resolution: 'exact' | 'search' } | null => {
    const s = spec.replace(/^\.\//, '');
    for (const e of exts) { const r = rel(from, s + e); if (!r.startsWith('../') && set.has(r)) return { to: 'file:' + r, resolution: 'exact' }; }
    if (rootOk && !spec.startsWith('.')) for (const e of exts) { const r = posix.normalize(s.replace(/^\//, '') + e); if (set.has(r)) return { to: 'file:' + r, resolution: 'search' }; }
    return null;
  };
  const missTo = (from: string, spec: string) => {
    const p = spec.startsWith('/') ? posix.normalize(spec.slice(1)) : rel(from, spec);
    return p.startsWith('../') ? { to: 'miss:' + posix.basename(p), missing: 'external' as const } : { to: 'miss:' + p, missing: 'unknown' as const };
  };

  // ---- string literals that name repo files; `writes(start)` says whether the literal at that offset is written
  const literals = (p: string, text: string, m: Mask, starts: number[], writes: (pos: number, lit: string) => boolean, skip: Set<number>) => {
    const okLower = DEFINES_ROOT.test(m.code) ? LOWER_ROOTS.filter((v) => !BINDS[v].test(m.code)) : [];
    const rootJoinLower = okLower.length ? rootJoin(`(?:${okLower.join('|')})`) : null;
    for (const x of text.matchAll(/(['"])([A-Za-z0-9_.\/-]+\.[A-Za-z0-9]+)\1/g)) {
      const pos = x.index! + 1, lit = x[2];
      if (!m.inStr[pos] || skip.has(pos) || /^https?:|^\/\//.test(lit)) continue;
      const before = m.code.slice(Math.max(0, x.index! - 48), x.index!);
      const rooted = ROOT_JOIN.test(before) || (!!rootJoinLower && rootJoinLower.test(before));
      const hit = rooted && !lit.includes('/') ? (set.has(lit) ? { to: 'file:' + lit, resolution: 'search' as const } : null) : findPath(p, lit, [''], lit.includes('/'));
      if (!hit) continue;
      add({ from: p, line: lineAt(starts, pos), kind: writes(x.index!, lit) ? 'generates' : DATA_EXT.test(lit) ? 'data' : 'reference', ...hit });
    }
  };

  // ---- JS specifiers
  const JS_EXT = ['', '.js', '.mjs', '.cjs', '/index.js', '/index.mjs'];
  // TypeScript's module resolution (Q-026): its own extensions first, declaration files, index files, and the ESM
  // convention of writing the OUTPUT name (`./x.js`) for a source that is `x.ts`.
  const TS_EXT = ['', '.ts', '.tsx', '.d.ts', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs', '/index.ts', '/index.tsx', '/index.d.ts', '/index.js'];
  // The source name first: with both b.js and b.ts tracked, tsc picks b.ts for './b.js' (critic L2).
  const tsSpecs = (spec: string) => { const m = /^(.*)\.(m|c)?jsx?$/.exec(spec); return m ? [m[1] + '.' + (m[2] ? m[2] + 'ts' : 'ts'), m[1] + '.tsx', spec] : [spec]; };
  const findTs = (from: string, spec: string) => { for (const s0 of tsSpecs(spec)) { const h = findPath(from, s0, TS_EXT); if (h) return h; } return null; };
  // tsconfig (Q-026): which config governs a file, then its paths and baseUrl, as tsc reads them. JSON with comments,
  // trailing commas and a BOM. What cannot be applied is said in `notes`, never silently skipped (critic H2): a config
  // that does not parse, an `extends` naming a package. Approximation, documented: a file is governed by the nearest
  // tsconfig.json above it; a solution-style one (`references`, no own options) hands over to the referenced config
  // whose `include` covers the file. tsc assigns files by include/files, so a file two projects both reach may differ.
  type TsCfg = { dir: string; baseUrl: string | null; paths: Record<string, string[]> | null; pathsDir: string; include: string[]; refs: string[] };
  const tsconfigs = new Map<string, TsCfg | null>();
  const readJsonc = (p: string) => { try { const t = readFileSync(join(repo, p), 'utf8').replace(/^﻿/, ''), m = maskJs(t); let code = '';
    for (let i = 0; i < t.length; i++) code += m.code[i] === ' ' && t[i] !== ' ' && !m.inStr[i] ? ' ' : t[i]; // drop comments, keep strings
    return JSON.parse(code.replace(/,(\s*[}\]])/g, '$1')); } catch { return null; } };
  const cfgPath = (dir: string, ref: string) => { const q = posix.normalize(posix.join(dir || '.', ref)); return q.endsWith('.json') ? q : q + '/tsconfig.json'; };
  const loadTsconfig = (p: string, seen: Set<string> = new Set()): TsCfg | null => {
    if (tsconfigs.has(p)) return tsconfigs.get(p)!;
    if (seen.has(p)) return null; seen.add(p);
    const j = readJsonc(p), dir = posix.dirname(p) === '.' ? '' : posix.dirname(p);
    if (!j || typeof j !== 'object') { notes.push({ what: p, reason: 'tsconfig does not parse as JSON with comments: its paths and baseUrl are not applied' }); tsconfigs.set(p, null); return null; }
    // `extends`, one or a list, later bases winning option by option (critic H2c); a package base is not followed.
    const cfg: TsCfg = { dir, baseUrl: null, paths: null, pathsDir: dir, include: [], refs: [] };
    for (const ext of ([] as unknown[]).concat(j.extends || [])) {
      if (typeof ext !== 'string') continue;
      if (!ext.startsWith('.')) { notes.push({ what: p, reason: `tsconfig extends the package ${ext}: not followed, so options it sets are not applied` }); continue; }
      const q = posix.normalize(posix.join(dir || '.', ext.endsWith('.json') ? ext : ext + '.json'));
      const b = set.has(q) ? loadTsconfig(q, seen) : null;
      if (!b) { if (!set.has(q)) notes.push({ what: p, reason: `tsconfig extends ${ext}, which is not a tracked file` }); continue; }
      if (b.baseUrl != null) cfg.baseUrl = b.baseUrl;
      if (b.paths) { cfg.paths = b.paths; cfg.pathsDir = b.pathsDir; }
    }
    const co = j.compilerOptions || {};
    if (typeof co.baseUrl === 'string') cfg.baseUrl = posix.normalize(posix.join(dir || '.', co.baseUrl));
    if (co.paths && typeof co.paths === 'object') { cfg.paths = co.paths; cfg.pathsDir = dir; }
    cfg.include = Array.isArray(j.include) ? j.include.filter((x: unknown) => typeof x === 'string').map((x: string) => posix.normalize(posix.join(dir || '.', x))) : [];
    cfg.refs = Array.isArray(j.references) ? j.references.map((r: any) => r && typeof r.path === 'string' ? cfgPath(dir, r.path) : null).filter((q: string | null) => q && set.has(q)) : [];
    tsconfigs.set(p, cfg); return cfg;
  };
  const covers = (c: TsCfg, file: string) => !c.include.length ? file.startsWith(c.dir ? c.dir + '/' : '') : c.include.some((g) => { const pre = g.split('*')[0].replace(/\/$/, ''); return pre === '' || pre === '.' || file === pre || file.startsWith(pre + '/'); });
  const tsconfigFor = (file: string): TsCfg | null => {
    for (let d = posix.dirname(file); ; d = posix.dirname(d)) {
      const c = (d === '.' ? '' : d + '/') + 'tsconfig.json';
      if (set.has(c)) {
        const cfg = loadTsconfig(c);
        // Solution style (critic H2a): no options of its own, references to the real projects.
        if (cfg && cfg.paths == null && cfg.baseUrl == null && cfg.refs.length) for (const r of cfg.refs) { const rc = loadTsconfig(r); if (rc && covers(rc, file)) return rc; }
        return cfg;
      }
      if (d === '.' || d === '') return null;
    }
  };
  // A bare TS specifier: `paths` (the longest prefix first, which puts an exact pattern first, as tsc), resolved from the effective
  // baseUrl (own or inherited), else from the config that declares paths (critic M2); then baseUrl alone. Found:
  // `search`. A pattern that matches but finds no file falls back to module resolution, as tsc does, and is said in
  // `notes` (criterion 3: reported, never dropped; critic M1: a catch-all "*" must not turn every package unknown).
  const tsAlias = (p: string, spec: string, line: number): LangEdge | null => {
    const cfg = tsconfigFor(p); if (!cfg) return null;
    const pats = Object.entries(cfg.paths || {}).filter(([, v]) => Array.isArray(v))
      .sort((a, b) => b[0].split('*')[0].length - a[0].split('*')[0].length || by(a[0], b[0])); // longest prefix: an exact pattern's prefix is the whole specifier, so it comes first ('ab' before 'ab*' on the tie)
    const base = cfg.baseUrl ?? (cfg.pathsDir || '.');
    for (const [pat, targets] of pats) {
      const star = pat.indexOf('*'), pre = star < 0 ? pat : pat.slice(0, star), post = star < 0 ? '' : pat.slice(star + 1);
      if (star < 0 ? spec !== pat : !(spec.startsWith(pre) && spec.endsWith(post) && spec.length >= pre.length + post.length)) continue;
      const mid = star < 0 ? '' : spec.slice(pre.length, spec.length - post.length);
      for (const t of targets as string[]) {
        const cand = posix.normalize(posix.join(base, String(t).replace('*', mid)));
        if (cand.startsWith('../')) return { from: p, line, kind: 'import', to: 'miss:' + posix.basename(cand), resolution: 'syntactic', missing: 'external', note: `tsconfig paths alias ${pat} points outside the repo` };
        for (const s0 of tsSpecs(cand)) for (const e of TS_EXT) if (set.has(s0 + e)) return { from: p, line, kind: 'import', to: 'file:' + s0 + e, resolution: 'search' };
      }
      notes.push({ what: `${p}:${line}`, reason: `tsconfig paths alias ${pat} matches ${spec} but no file is there: resolved as a module instead, as tsc does` });
      break;
    }
    if (cfg.baseUrl != null) for (const s0 of tsSpecs(posix.normalize(posix.join(cfg.baseUrl, spec)))) for (const e of TS_EXT) if (set.has(s0 + e)) return { from: p, line, kind: 'import', to: 'file:' + s0 + e, resolution: 'search' };
    return null;
  };
  // An npm name: optional @scope/, then a name; `@/util` or `~/util` cannot be a package (critic H2: an alias whose
  // config was not found must not pass as one).
  const NPM_NAME = /^(?:@[a-z0-9][\w.~-]*\/)?[a-z0-9_.~-][\w.~-]*$/i;
  const jsSpec = (p: string, spec: string, line: number, kind: 'import' | 'reference', ts = false, typeOnly = false) => {
    const addT = (e: LangEdge) => add(typeOnly ? { ...e, typeOnly: true } : e);
    if (/^(https?:)?\/\//.test(spec)) { let host = spec; try { host = new URL(spec.startsWith('//') ? 'https:' + spec : spec).host; } catch {} return add({ from: p, line, kind, to: 'ext:web:' + host, resolution: 'syntactic' }); }
    if (/^(data|blob|mailto|javascript|about):/.test(spec) || spec.startsWith('#')) return;
    if (spec.includes('${') || !MODULE_SPEC.test(spec)) { if (kind === 'import') computed.push({ from: p, line, text: spec.slice(0, 80) }); return; }
    if (spec.startsWith('.') || spec.startsWith('/') || kind === 'reference') {
      const clean = spec.split(/[?#]/)[0], hit = ts && kind === 'import' ? findTs(p, clean) : findPath(p, clean, kind === 'import' ? JS_EXT : ['']);
      if (hit) return addT({ from: p, line, kind, to: hit.to, resolution: hit.resolution });
      return addT({ from: p, line, kind, resolution: 'syntactic', ...missTo(p, clean) });
    }
    if (ts) { const a = tsAlias(p, spec, line); if (a) return addT(a); }
    const pkg = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
    if (!pkg.startsWith('node:') && !NPM_NAME.test(pkg)) return addT({ from: p, line, kind, to: 'miss:' + spec, resolution: 'syntactic', missing: 'unknown', note: 'not a package name, and no tsconfig alias resolves it' });
    addT({ from: p, line, kind, to: pkg.startsWith('node:') || NODE_BUILTINS.has(pkg) ? 'ext:node' : 'ext:npm:' + pkg, resolution: 'syntactic' });
  };
  // Import statements in a masked JS text; returns the offsets of specifier strings it consumed.
  // `export type { A } from` and `export type * from` are TypeScript's (Q-026); `import type` already fits the first form.
  const JS_IMPORT = /(?<![\w$.'"-])(?:import\s*(?:[\w*{}\s,$]+?\s*from\s*)?(['"])([^'"\n]+)\1|export\s+(?:type\s+)?(?:\*|\{[^}]*\}|\*\s+as\s+\w+)\s*from\s*(['"])([^'"\n]+)\3|import\s*\(\s*(['"])([^'"\n]+)\5\s*\)|require\s*\(\s*(['"])([^'"\n]+)\7\s*\))/g;
  const JS_COMPUTED = /(?<![\w$.'"-])(?:import|require)\s*\(\s*(?![\s'")])([^)\n]{1,60})\)/g;
  const jsImports = (p: string, text: string, m: Mask, starts: number[], base = 0, ts = false) => {
    const used = new Set<number>();
    for (const x of m.code.matchAll(JS_IMPORT)) {
      if (m.inStr[x.index!]) continue; // the keyword itself sits inside a string
      const spec = x[2] || x[4] || x[6] || x[8], q = x.index! + x[0].indexOf(spec);
      // Type-only for a whole statement (`import type`, `export type`, `import type X = require()`), and for anything a
      // declaration file imports (it emits nothing; critic M3). `import { type A, B }`, and even `import { type A }`,
      // count as possibly runtime: tsc keeps them under verbatimModuleSyntax. `import type from 'x'` is a default
      // import named type.
      const typeOnly = ts && (DTS.test(p) || /^(?:import|export)\s+type(?:\s+(?!from\b)|(?=[{*]))/.test(x[0])
        || /\bimport\s+type\s+[\w$]+\s*=\s*$/.test(m.code.slice(Math.max(0, x.index! - 80), x.index!)));
      used.add(q); jsSpec(p, spec, base + lineAt(starts, x.index!), 'import', ts, typeOnly);
    }
    for (const x of m.code.matchAll(JS_COMPUTED)) if (!m.inStr[x.index!]) computed.push({ from: p, line: base + lineAt(starts, x.index!), text: x[0].slice(0, 80) });
    return used;
  };

  for (const p of files) {
    let text: string; try { text = readFileSync(join(repo, p), 'utf8'); } catch { continue; }
    const lang = langOfFile.get(p)!, starts = lineStarts(text);
    if (lang === 'js' || lang === 'ts') {
      const m = maskJs(text);
      const used = jsImports(p, text, m, starts, 0, lang === 'ts');
      // Triple-slash directives live in comments, so the mask hides them: read on the raw lines (critic L1). Both are
      // compile-time: `path` names a file, `types` a package's declarations.
      if (lang === 'ts') for (const x of text.matchAll(/^[ \t]*\/\/\/[ \t]*<reference\s+(path|types)\s*=\s*(['"])([^'"\n]+)\2/gm))
        if (x[1] === 'path') { const h = findTs(p, x[3]); add({ from: p, line: lineAt(starts, x.index!), kind: 'import', resolution: h ? h.resolution : 'syntactic', ...(h ? { to: h.to } : missTo(p, x[3])), typeOnly: true }); }
        else jsSpec(p, x[3], lineAt(starts, x.index!), 'import', true, true);
      // a literal is written when it is the first argument of a write call
      literals(p, text, m, starts, (pos) => /(writeFileSync|writeFile|appendFileSync|appendFile|createWriteStream)\s*\(\s*$/.test(text.slice(Math.max(0, pos - 40), pos)), used);
    } else if (lang === 'html') {
      const noComments = text.replace(/<!--[\s\S]*?-->/g, (c) => c.replace(/[^\n]/g, ' '));
      for (const x of noComments.matchAll(/<(?:script|link|img|iframe|source)\b[^>]*?\b(?:src|href)\s*=\s*["']([^"'#]+)["']/gi)) jsSpec(p, x[1], lineAt(starts, x.index!), 'reference');
      // inline scripts: masked as JS on their own, with their line offset in the page
      for (const x of noComments.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
        const body = x[1], off = x.index! + x[0].indexOf(body), line0 = lineAt(starts, off) - 1;
        jsImports(p, body, maskJs(body), lineStarts(body), line0);
      }
    } else if (lang === 'python') {
      const m = maskHash(text, true), lines = m.code.split('\n');
      for (let i = 0; i < lines.length; i++) {
        let stmt = lines[i];
        const at = starts[i];
        if (/^\s*from\s+\S+\s+import\s*\(/.test(stmt)) while (!stmt.includes(')') && i + 1 < lines.length) stmt += ' ' + lines[++i]; // parenthesised
        for (const part of stmt.split(';')) {
          const mm = /^\s*(?:from\s+(\.*[\w.]*)\s+import\s+([\w*, ()]+)|import\s+([\w., ]+))/.exec(part);
          if (!mm || m.inStr[at]) continue;
          const n = lineAt(starts, at);
          for (const mod of mm[1] !== undefined ? [mm[1]] : mm[3].split(',').map((x) => x.trim().split(/\s+/)[0]).filter(Boolean)) {
            const dots = /^\.*/.exec(mod)![0].length, name = mod.slice(dots);
            const names = mm[2] ? mm[2].replace(/[()]/g, '').split(',').map((x) => x.trim().split(/\s+/)[0]).filter((x) => x && x !== '*') : [];
            if (dots) { // relative, from the file's own package
              const pkgDir = posix.normalize(posix.join(posix.dirname(p), ...Array(dots - 1).fill('..'))), base = name ? posix.join(pkgDir, name.replace(/\./g, '/')) : pkgDir;
              const targets = name ? [base] : names.map((x) => posix.join(pkgDir, x));
              for (const b of targets) {
                const f = [b + '.py', b + '/__init__.py'].find((c) => set.has(c)) || (!name && set.has(pkgDir + '/__init__.py') ? pkgDir + '/__init__.py' : null);
                // `from . import helper` where helper is not a module: it lives in the package's __init__ (critic M4)
                add(f ? { from: p, line: n, kind: 'import', to: 'file:' + f, resolution: 'exact' } : { from: p, line: n, kind: 'import', to: 'miss:' + b + '.py', resolution: 'syntactic', missing: 'unknown' });
              }
              continue;
            }
            const top = name.split('.')[0], path = name.replace(/\./g, '/');
            const subs = names.map((x) => findPath(p, path + '/' + x, ['.py'])).filter(Boolean) as { to: string; resolution: 'exact' | 'search' }[];
            if (subs.length) { for (const h of subs) add({ from: p, line: n, kind: 'import', ...h }); continue; }
            const hit = findPath(p, path, ['.py', '/__init__.py']) || findPath(p, top, ['.py', '/__init__.py']);
            if (hit) { add({ from: p, line: n, kind: 'import', ...hit }); continue; }
            // the standard library before a same-named repo file found elsewhere (a stray random.py must not capture `import random`)
            if (PY_STD.has(top)) { add({ from: p, line: n, kind: 'import', to: 'ext:python-std', resolution: 'syntactic' }); continue; }
            const same = pyByName.get(top) || [];
            if (same.length === 1) { add({ from: p, line: n, kind: 'import', to: 'file:' + same[0], resolution: 'search' }); continue; }
            add({ from: p, line: n, kind: 'import', to: 'ext:py:' + top, resolution: 'syntactic' });
          }
        }
      }
      for (const x of m.code.matchAll(/(?<![\w.])(?:__import__|importlib\.import_module)\s*\(\s*(?!['"])([^)\n]{1,60})\)/g)) computed.push({ from: p, line: lineAt(starts, x.index!), text: x[0].slice(0, 80) });
      literals(p, text, m, starts, (pos, lit) => {
        const after = text.slice(pos, pos + lit.length + 60), before = text.slice(Math.max(0, pos - 12), pos);
        return /open\s*\(\s*$/.test(before) && new RegExp('^[\'"]' + lit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\'"]\\s*,\\s*(mode\\s*=\\s*)?[\'"][^\'"]*[wax]').test(after)
          || new RegExp('^[\'"]' + lit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\'"]\\s*\\)\\s*\\.write_(text|bytes)').test(after);
      }, new Set());
    } else if (lang === 'sh') {
      // blank comments (a # after whitespace or at line start, outside quotes) and heredoc bodies
      const lines = text.split('\n'), code: string[] = [];
      let heredoc: string | null = null;
      for (const ln of lines) {
        if (heredoc) { code.push(''); if (ln.trim() === heredoc) heredoc = null; continue; }
        let q: string | null = null, cut = ln.length;
        for (let k = 0; k < ln.length; k++) { const c = ln[k]; if (q) { if (c === q) q = null; } else if (c === '"' || c === "'") q = c; else if (c === '#' && (k === 0 || /\s/.test(ln[k - 1]))) { cut = k; break; } }
        const c0 = ln.slice(0, cut); code.push(c0);
        const h = /<<-?\s*['"]?(\w+)['"]?/.exec(c0); if (h) heredoc = h[1];
      }
      code.forEach((ln, i) => {
        const n = i + 1, sr = (h: { to: string } | null) => h ? { to: h.to, resolution: 'search' as const } : null;
        if (!ln.trim()) return;
        const src = /^\s*(?:source|\.)\s+["']?([^\s"';]+)/.exec(ln);
        if (src) { if (src[1].includes('$')) computed.push({ from: p, line: n, text: src[0].trim().slice(0, 80) }); else { const hit = sr(findPath(p, src[1])); if (hit) add({ from: p, line: n, kind: 'import', ...hit }); } }
        const done = new Set<string>(src ? [src[1]] : []);
        for (const x of ln.matchAll(/(?:^|[\s;&|(])(?:bash|sh|zsh|python3?|node|exec)\s+["']?([A-Za-z0-9_.\/$-]+\.(?:sh|py|js|mjs))/g)) {
          done.add(x[1]);
          if (x[1].includes('$')) { computed.push({ from: p, line: n, text: x[0].trim().slice(0, 80) }); continue; }
          const hit = sr(findPath(p, x[1])); if (hit) add({ from: p, line: n, kind: 'reference', ...hit });
        }
        // Words (quoted or not) that name repo files: written when right after > or >>, else read or run.
        for (const x of ln.matchAll(/(^|[\s=(])(>{1,2}\s*)?["']?([A-Za-z0-9_.\/-]*[A-Za-z0-9_-]\.[A-Za-z0-9]+)["']?(?=$|[\s;&|)])/g)) {
          if (done.has(x[3])) continue;
          const hit = sr(findPath(p, x[3], [''], x[3].includes('/'))); if (!hit) continue;
          add({ from: p, line: n, kind: x[2] ? 'generates' : DATA_EXT.test(x[3]) ? 'data' : 'reference', ...hit });
        }
      });
    }
  }
  // One edge per (file, line, kind, target). Two statements on one line, one `import type` and one runtime, are one
  // runtime site: type-only survives only if every copy is (critic H1: the first copy used to win).
  const kept = new Map<string, LangEdge>();
  for (const e of out) { const k = `${e.from}|${e.line}|${e.kind}|${e.to}`, was = kept.get(k); if (!was) { kept.set(k, e); continue; } if (was.typeOnly && !e.typeOnly) kept.set(k, { ...was, typeOnly: undefined }); }
  const edges = [...kept.values()]
    .sort((a, b) => by(a.from, b.from) || a.line - b.line || by(a.kind, b.kind) || by(a.to, b.to));
  computed.sort((a, b) => by(a.from, b.from) || a.line - b.line || by(a.text, b.text));
  notes.sort((a, b) => by(a.what, b.what) || by(a.reason, b.reason));
  return { schema: 'loupe.langfacts/0.0-internal', files: files.length, langOf: Object.fromEntries(langOfFile), edges, computed, notes: [...new Map(notes.map((n) => [n.what + '|' + n.reason, n])).values()] };
}
