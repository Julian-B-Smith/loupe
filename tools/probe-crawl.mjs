#!/usr/bin/env node
// PROBE v2, not the P1 crawler. File-level, zero dependencies, regex-based.
// Purpose: run schema 0.2 against a real repo and surface what it still cannot express.
// Covers: C/C++ includes (with preprocessor guards), Python imports and literal paths, JS/MJS imports,
// HTML script/link refs, shell literal paths, CMake generation rules (add_custom_command/target).
// Usage: node tools/probe-crawl.mjs <repo dir> <out dir> [config.json]
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, posix, extname, basename } from 'node:path';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { canonicalGraph, canonicalDoc, sha256, edgeId } from './canon.mjs';

const [repo, out, cfgPath] = process.argv.slice(2);
if (!repo || !out) { console.error('usage: probe-crawl.mjs <repo> <out> [config.json]'); process.exit(2); }
const CFG = { repo: 'repo', siblings: [], externalPrefixes: {}, includeRoots: [], ...(cfgPath ? JSON.parse(readFileSync(cfgPath, 'utf8')) : {}) };
const git = (a) => execSync(`git ${a}`, { cwd: repo, maxBuffer: 1 << 26 }).toString();

// ---------------------------------------------------------------- inventory
// Tracked files only; submodules (gitlinks) become external packages, not files.
const lsTree = git('ls-files -s').trim().split('\n').map((l) => { const [meta, path] = l.split('\t'); return { mode: meta.split(' ')[0], path }; });
const submodules = lsTree.filter((x) => x.mode === '160000').map((x) => x.path).sort();
const files = lsTree.filter((x) => x.mode !== '160000').map((x) => x.path).sort();
const fileSet = new Set(files);
const isBinary = (p) => { try { return readFileSync(join(repo, p)).subarray(0, 8000).includes(0); } catch { return true; } };
const shebang = (p) => { try { const m = readFileSync(join(repo, p), 'utf8').slice(0, 100).match(/^#!.*\b(bash|sh|zsh|python3?|node)\b/); return m ? m[1] : null; } catch { return null; } };

const LANG = { '.h': 'cpp', '.hpp': 'cpp', '.hh': 'cpp', '.inc': 'cpp', '.c': 'c', '.cc': 'cpp', '.cpp': 'cpp', '.cxx': 'cpp', '.mm': 'objcpp', '.m': 'objc',
  '.py': 'python', '.mjs': 'js', '.js': 'js', '.html': 'html', '.sh': 'sh', '.cmake': 'cmake', '.tsv': 'tsv', '.json': 'json', '.txt': 'text', '.yml': 'yaml', '.yaml': 'yaml' };
// Scope rules: first match wins. Recorded verbatim in crawler.scope so the exclusions are visible.
const SCOPE = [
  ['exclude', 'traces', 'traces/**'], ['exclude', 'docs', '**/*.md'], ['exclude', 'docs-assets', 'docs/**'],
  ['exclude', 'reference', 'reference/**'], ['exclude', 'repo-tooling', '.claude/**'], ['exclude', 'repo-tooling', '.github/**'],
  ['exclude', 'repo-tooling', '.kit/**'], ['exclude', 'repo-tooling', '.git*'], ['exclude', 'binary', '(binary content)'],
  ['crawl', 'code', '*.{h,hpp,hh,inc,c,cc,cpp,cxx,mm,m}'], ['crawl', 'code', '*.{py,mjs,js,sh,html}'], ['crawl', 'code', '(shebang scripts)'],
  ['crawl', 'build', 'CMakeLists.txt, *.cmake'], ['crawl', 'data', '*.{tsv,json,txt,yml,yaml}'], ['exclude', 'other', '**'],
];
const classify = (p) => {
  const e = extname(p).toLowerCase(), top = p.split('/')[0];
  if (top === 'traces') return ['exclude', 'traces'];
  if (e === '.md') return ['exclude', 'docs'];
  if (top === 'docs') return ['exclude', 'docs-assets'];
  if (top === 'reference') return ['exclude', 'reference'];
  if (['.claude', '.github', '.kit'].includes(top) || basename(p).startsWith('.git')) return ['exclude', 'repo-tooling'];
  if (isBinary(p)) return ['exclude', 'binary'];
  if (basename(p) === 'CMakeLists.txt' || e === '.cmake') return ['crawl', 'cmake'];
  if (LANG[e]) return ['crawl', LANG[e]];
  if (!e) { const s = shebang(p); if (s) return ['crawl', s.startsWith('python') ? 'python' : s === 'node' ? 'js' : 'sh']; }
  return ['exclude', 'other'];
};
const crawled = [], excludedBy = {};
const langOf = {};
for (const p of files) {
  const [d, x] = classify(p);
  if (d === 'crawl') { crawled.push(p); langOf[p] = x; continue; }
  const r = (excludedBy[x] ||= { reason: x, count: 0, byExt: {} });
  r.count++; const e = extname(p).toLowerCase() || '(none)'; r.byExt[e] = (r.byExt[e] || 0) + 1;
}
const crawledSet = new Set(crawled);

// ---------------------------------------------------------------- roles (path rules, then graph rules)
const ROLE_RULES = [
  ['gen-prefix', /(^|\/)gen_[^/]+$/, 'generator'], ['check-suffix', /_check\.[a-z]+$/, 'test'], ['probe-suffix', /_probe\.[a-z]+$/, 'probe'],
  ['bench-suffix', /_bench\.[a-z]+$/, 'bench'], ['scratch-prefix', /(^|\/)scratch_[^/]+$/, 'scratch'],
  ['gui-dir', /^src\/gui\//, 'gui'], ['src-dir', /^src\/.*\.(h|hpp|cpp|mm|c|inc)$/, 'product'], ['h2-dir', /^h2\//, 'product'],
  ['data-ext', /\.(tsv|json|txt|ya?ml)$/, 'data'], ['tests-dir', /^tests\//, 'test'],
  ['root-index', /^index\.html$/, 'doc'], ['build-file', /(^|\/)CMakeLists\.txt$|\.cmake$|\.sh$|^(install|verify)$/, 'build'], ['tools-dir', /^tools\//, 'tool'],
];
const roleOf = (p) => { for (const [id, re, role] of ROLE_RULES) if (re.test(p)) return { role, roleRule: `path/${id}` }; return {}; };

// ---------------------------------------------------------------- graph
const nodes = new Map(), edges = new Map();
const report = { unresolved: [], guarded: [], generated: [], missing: [], notes: [] };
const addNode = (id, extra) => { if (!nodes.has(id)) nodes.set(id, { id, ...extra }); return id; };
for (const p of crawled) {
  const buf = readFileSync(join(repo, p));
  addNode(`file:${p}`, { kind: 'file', path: p, lang: langOf[p], hash: 'sha256:' + createHash('sha256').update(buf).digest('hex'), loc: buf.toString('utf8').split('\n').length, ...roleOf(p) });
}
const addEdge = (src, dst, kind, ev, provenance = ev.type === 'config' ? 'config' : 'static') => {
  if (src === dst) return;
  const id = edgeId(src, dst, kind);
  const e = edges.get(id) || { id, src, dst, kind, provenance, count: 0, evidence: [] };
  e.evidence.push(ev); e.count = e.evidence.length; edges.set(id, e);
};
const ext = (name) => addNode(`ext:${name}`, { kind: 'external', path: name, hash: 'none' });
const missing = (path, reason, note) => {
  const id = `miss:${path}`;
  if (!nodes.has(id)) { addNode(id, { kind: 'missing', path, hash: 'none', missing: note ? { reason, note } : { reason } }); report.missing.push({ path, reason }); }
  return id;
};
const resolveRel = (from, ref) => posix.normalize(posix.join(posix.dirname(from), ref));
const inRepo = (p) => (crawledSet.has(p) ? `file:${p}` : null);

// ---- CMake first: generation rules tell us which missing headers are generated.
const BUILD = '${build}';
const genOutputs = new Map(); // basename -> miss id
const cmakeFiles = crawled.filter((p) => langOf[p] === 'cmake');
for (const p of cmakeFiles) {
  const text = readFileSync(join(repo, p), 'utf8').replace(/#[^\n]*/g, (m) => ' '.repeat(m.length));
  const lineAt = (i) => text.slice(0, i).split('\n').length;
  const vars = new Map([['CMAKE_CURRENT_SOURCE_DIR', [{ v: '', g: '' }]], ['CMAKE_SOURCE_DIR', [{ v: '', g: '' }]], ['CMAKE_CURRENT_BINARY_DIR', [{ v: BUILD, g: '' }]], ['CMAKE_BINARY_DIR', [{ v: BUILD, g: '' }]]]);
  const cond = [];
  const expand = (tok) => {
    let outs = [{ v: tok, g: '' }];
    for (let k = 0; k < 4; k++) outs = outs.flatMap(({ v, g }) => {
      const m = v.match(/\$\{([A-Za-z0-9_]+)\}/); if (!m) return [{ v, g }];
      const vals = vars.get(m[1]) || [{ v: `\${${m[1]}}`, g: '' }];
      return vals.map((x) => ({ v: v.replace(m[0], x.v), g: [g, x.g].filter(Boolean).join(' && ') }));
    });
    return outs.map(({ v, g }) => ({ v: v.replace(/^\//, ''), g }));
  };
  const re = /\b(if|elseif|else|endif|set|add_custom_command|add_custom_target|file)\s*\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g;
  let m;
  while ((m = re.exec(text))) {
    const [, cmd, body] = m; const args = body.trim().split(/\s+/).filter(Boolean);
    if (cmd === 'if') cond.push(args.join(' '));
    else if (cmd === 'elseif') { cond.pop(); cond.push(args.join(' ')); }
    else if (cmd === 'else') { const c = cond.pop(); cond.push(`NOT (${c})`); }
    else if (cmd === 'endif') cond.pop();
    else if (cmd === 'set' && args.length >= 2) {
      const g = cond.join(' && ');
      const val = expand(args[1]).map((x) => ({ v: x.v, g: [g, x.g].filter(Boolean).join(' && ') }));
      vars.set(args[0], g ? [...(vars.get(args[0]) || []), ...val] : val);
    } else if (cmd === 'file' && args[0] === 'GLOB_RECURSE') {
      const pats = args.slice(1).filter((a) => !/^[A-Z_]+$/.test(a) || a.includes('$'));
      vars.set(args[1], pats.flatMap((a) => expand(a)).map((x) => ({ v: `glob:${x.v.replace('/*.', '/**/*.')}`, g: x.g })));
    } else if (cmd === 'add_custom_command' || cmd === 'add_custom_target') {
      const sect = {}; let cur = 'HEAD';
      for (const a of args) { if (/^(OUTPUT|BYPRODUCTS|COMMAND|DEPENDS|COMMENT|WORKING_DIRECTORY|VERBATIM|ALL)$/.test(a)) { cur = a; continue; } (sect[cur] ||= []).push(a); }
      const outputs = [...(sect.OUTPUT || []), ...(sect.BYPRODUCTS || [])].flatMap(expand).filter((x) => x.v.startsWith(BUILD) || crawledSet.has(x.v));
      if (!outputs.length) continue;
      const toks = (sect.COMMAND || []).flatMap((t) => expand(t.replace(/^-D[A-Z_]+=/, '')));
      const scripts = toks.filter((x) => crawledSet.has(x.v) && /\.(py|cmake|sh|mjs)$/.test(x.v));
      const inputs = [...toks, ...(sect.DEPENDS || []).flatMap(expand)].filter((x) => !scripts.some((s) => s.v === x.v) && (crawledSet.has(x.v) || x.v.startsWith('glob:') || fileSet.has(x.v)));
      const key = `${cmd}@${lineAt(m.index)}`;
      for (const o of outputs) {
        const dst = o.v.startsWith(BUILD) ? missing(o.v, 'generated', `Build output of ${p} ${key}`) : `file:${o.v}`;
        genOutputs.set(basename(o.v), dst);
        report.generated.push({ output: o.v, by: scripts.map((s) => s.v), rule: `${p} ${key}` });
        for (const s of scripts) addEdge(`file:${s.v}`, dst, 'generates', { type: 'config', path: p, key });
        for (const i of inputs) {
          const src = i.v.startsWith('glob:') ? addNode(`art:${i.v.slice(5)}`, { kind: 'artifact', path: i.v.slice(5), hash: 'none' }) : inRepo(i.v);
          if (!src) continue;
          const ev = { type: 'config', path: p, key }; if (i.g) ev.guard = i.g;
          addEdge(src, dst, 'embeds', ev);
        }
      }
    }
  }
}

// ---- C/C++ includes
const STD = /^(c[a-z]+|algorithm|any|array|atomic|bit|bitset|chrono|complex|condition_variable|deque|exception|execution|filesystem|fstream|functional|future|initializer_list|iomanip|ios|iosfwd|iostream|istream|iterator|limits|list|locale|map|memory|memory_resource|mutex|new|numbers|numeric|optional|ostream|queue|random|ratio|regex|set|shared_mutex|span|sstream|stack|stdexcept|streambuf|string|string_view|system_error|thread|tuple|type_traits|typeinfo|unordered_map|unordered_set|utility|valarray|variant|vector|version|[a-z]+\.h|sys\/.*|mach\/.*)$/;
const PLATFORM = /^(windows\.h|dlfcn\.h|pthread\.h|unistd\.h|sys\/.*|mach\/.*|mach-o\/.*|Cocoa\/.*|Accelerate\/.*|WebKit\/.*|Foundation\/.*|AppKit\/.*|CoreFoundation\/.*|objbase\.h|shlobj\.h|wrl.*|WebView2.*)$/;
const subFor = (seg) => submodules.find((s) => basename(s).replace(/-/g, '') === seg.replace(/-/g, ''));
const resolveInclude = (from, inc) => {
  const cands = [resolveRel(from, inc), ...CFG.includeRoots.map((r) => posix.normalize(posix.join(r, inc))), posix.normalize(inc)];
  for (const c of cands) if (crawledSet.has(c)) return { path: c, how: c === cands[0] ? 'exact' : 'search' };
  const suffix = crawled.filter((c) => c.endsWith('/' + inc));
  return suffix.length === 1 ? { path: suffix[0], how: 'search' } : null;
};
const classifyMissingInclude = (from, inc) => {
  const norm = resolveRel(from, inc);
  const sub = submodules.find((s) => norm.startsWith(s + '/')) || subFor(inc.split('/')[0]);
  if (sub) return { id: ext(basename(sub)), how: 'search' };
  for (const [pre, pkg] of Object.entries(CFG.externalPrefixes)) if (inc.startsWith(pre)) return { id: missing(inc, 'external', `Expected from ${pkg}, fetched outside the repo`), how: 'search' };
  for (const pre of CFG.siblings) if (inc.startsWith(pre) || norm.startsWith(pre)) return { id: missing(inc, 'sibling', `Sibling repo under ${pre}`), how: 'search' };
  if (genOutputs.has(basename(inc))) return { id: genOutputs.get(basename(inc)), how: 'search' };
  report.unresolved.push({ from, include: inc });
  return { id: missing(inc, 'unknown'), how: 'search' };
};
for (const p of crawled.filter((x) => ['cpp', 'c', 'objcpp', 'objc'].includes(langOf[x]))) {
  const lines = readFileSync(join(repo, p), 'utf8').split('\n');
  const stack = []; let first = true;
  lines.forEach((ln, i) => {
    const pp = ln.match(/^\s*#\s*(if|ifdef|ifndef|elif|else|endif)\b\s*(.*?)\s*(\/\/.*|\/\*.*)?$/);
    if (pp) {
      const [, d, rest] = pp;
      if (d === 'ifndef' && first && /^#\s*define\s+\S+\s*$/.test((lines[i + 1] || '').trim())) stack.push(null); // include guard
      else if (d === 'if') stack.push(rest);
      else if (d === 'ifdef') stack.push(`defined(${rest})`);
      else if (d === 'ifndef') stack.push(`!defined(${rest})`);
      else if (d === 'elif') { stack.pop(); stack.push(rest); }
      else if (d === 'else') { const c = stack.pop(); stack.push(c === null ? null : `!(${c})`); }
      else stack.pop();
      first = false; return;
    }
    if (/^\s*#/.test(ln)) first = false;
    const m = ln.match(/^\s*#\s*(include|import)\s*([<"])([^>"]+)[>"]/);
    if (!m) return;
    const [, , delim, inc] = m;
    let dst, how;
    if (delim === '"') {
      const r = resolveInclude(p, inc);
      if (r) { dst = `file:${r.path}`; how = r.how; } else ({ id: dst, how } = classifyMissingInclude(p, inc));
    } else {
      how = 'search';
      const top = inc.split('/')[0].replace(/\.h(pp)?$/, '');
      if (PLATFORM.test(inc)) dst = ext('platform');
      else if (STD.test(inc)) dst = ext('std');
      else { const sub = subFor(top); dst = ext(sub ? basename(sub) : top); }
    }
    const guard = stack.filter((g) => g !== null).join(' && ');
    const site = { type: 'site', path: p, line: i + 1, resolution: how };
    if (guard) { site.guard = guard; report.guarded.push({ from: p, line: i + 1, include: inc, guard }); }
    addEdge(`file:${p}`, dst, 'include', site);
  });
}

// ---- literal paths (Python, shell, JS): a string naming a tracked file
const literalPaths = (p, lines, writeRe) => lines.forEach((ln, i) => {
  if (/^\s*(#|\/\/)/.test(ln)) return;
  for (const m of ln.matchAll(/['"]([A-Za-z0-9_.\/-]+\.[A-Za-z0-9]+)['"]/g)) {
    const lit = m[1]; if (lit.startsWith('http')) continue;
    const cand = [lit, resolveRel(p, lit), posix.normalize(lit.replace(/^\.\//, ''))].find((c) => crawledSet.has(c));
    if (!cand || cand === p) continue;
    const kind = writeRe.test(ln) ? 'generates' : ['tsv', 'json', 'text', 'yaml'].includes(langOf[cand]) ? 'data' : 'reference';
    addEdge(`file:${p}`, `file:${cand}`, kind, { type: 'site', path: p, line: i + 1, resolution: 'search' });
  }
});
const PY_STD = new Set('__future__ argparse ast bisect collections contextlib copy csv dataclasses datetime difflib enum fnmatch functools glob hashlib heapq html http io itertools json math operator os pathlib posixpath random re shutil socket socketserver statistics string struct subprocess sys tempfile textwrap threading time typing unittest urllib wave zlib'.split(' '));
const PYMOD = new Map(crawled.filter((x) => langOf[x] === 'python').map((x) => [basename(x, '.py'), x]));
for (const p of crawled.filter((x) => langOf[x] === 'python')) {
  const lines = readFileSync(join(repo, p), 'utf8').split('\n');
  lines.forEach((ln, i) => {
    const m = ln.match(/^\s*(?:from\s+([A-Za-z0-9_.]+)\s+import|import\s+([A-Za-z0-9_., ]+))/);
    if (!m) return;
    for (const mod of (m[1] ? [m[1]] : m[2].split(',').map((s) => s.trim().split(/\s+/)[0]))) {
      const local = PYMOD.get(mod.split('.')[0]);
      if (local && local !== p) addEdge(`file:${p}`, `file:${local}`, 'import', { type: 'site', path: p, line: i + 1, resolution: 'search' });
      else if (!local) addEdge(`file:${p}`, ext(PY_STD.has(mod.split('.')[0]) ? 'python-std' : `py:${mod.split('.')[0]}`), 'import', { type: 'site', path: p, line: i + 1, resolution: 'exact' });
    }
  });
  literalPaths(p, lines, /open\([^)]*['"]w|write_text|write_bytes/);
}
for (const p of crawled.filter((x) => langOf[x] === 'sh')) literalPaths(p, readFileSync(join(repo, p), 'utf8').split('\n'), /(^|\s)>\s*\S/);

// ---- JS/MJS imports and HTML refs
const JS_EXT = ['', '.mjs', '.js', '/index.mjs', '/index.js'];
const jsRef = (p, spec, line, kind) => {
  if (/^https?:/.test(spec)) return addEdge(`file:${p}`, ext(`web:${new URL(spec).host}`), kind, { type: 'site', path: p, line, resolution: 'exact' });
  if (spec.startsWith('.') || spec.startsWith('/')) {
    const base = spec.startsWith('/') ? spec.slice(1) : resolveRel(p, spec);
    const hit = JS_EXT.map((e) => base + e).find((c) => crawledSet.has(c));
    if (hit) return addEdge(`file:${p}`, `file:${hit}`, kind, { type: 'site', path: p, line, resolution: 'exact' });
    if (fileSet.has(base)) return; // points into an excluded file (counted in inventory)
    return addEdge(`file:${p}`, missing(base, 'unknown'), kind, { type: 'site', path: p, line, resolution: 'exact' });
  }
  const pkg = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
  addEdge(`file:${p}`, ext(pkg.startsWith('node:') ? 'node' : `npm:${pkg}`), kind, { type: 'site', path: p, line, resolution: 'exact' });
};
for (const p of crawled.filter((x) => langOf[x] === 'js' || langOf[x] === 'html')) {
  const lines = readFileSync(join(repo, p), 'utf8').split('\n');
  lines.forEach((ln, i) => {
    for (const m of ln.matchAll(/\bimport\s*(?:[\w*{}\s,]+\s*from\s*)?['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)|\brequire\(\s*['"]([^'"]+)['"]\s*\)/g)) jsRef(p, m[1] || m[2] || m[3], i + 1, 'import');
    if (langOf[p] === 'html') for (const m of ln.matchAll(/<(?:script|link|img|iframe)\b[^>]*\b(?:src|href)=["']([^"'#]+)["']/g)) jsRef(p, m[1], i + 1, 'reference');
  });
  if (langOf[p] === 'js') literalPaths(p, lines, /writeFileSync|writeFile\(/);
}

// ---- graph rules for roles: anything that generates a tracked or build file is a generator
for (const e of edges.values()) if (e.kind === 'generates') { const n = nodes.get(e.src); if (n && n.role !== 'generator') { n.role = 'generator'; n.roleRule = 'graph/generates-out'; } }

// ---------------------------------------------------------------- write
let commit = 'unknown', commitTime = '1970-01-01T00:00:00Z', dirty = false;
try { commit = git('rev-parse HEAD').trim(); commitTime = git('log -1 --format=%cI').trim(); dirty = git('status --porcelain').trim().length > 0; } catch {}
const excludedList = Object.values(excludedBy).sort((a, b) => (a.reason < b.reason ? -1 : 1)).map((x) => ({ ...x, byExt: Object.fromEntries(Object.entries(x.byExt).sort()) }));
const graph = {
  schema: 'loupe.graph/0.2',
  source: { repo: CFG.repo, commit, commitTime, dirty },
  crawler: {
    name: 'loupe-probe', version: '0.0.2', granularity: 'file',
    languages: [...new Set(Object.values(langOf))].sort(),
    dialect: { name: 'none', version: '0' },
    scope: {
      include: SCOPE.filter((r) => r[0] === 'crawl').map((r) => r[2]),
      exclude: SCOPE.filter((r) => r[0] === 'exclude').map((r) => `${r[2]} (${r[1]})`),
      resolution: 'heuristic',
      ...(CFG.siblings.length ? { siblings: CFG.siblings } : {}),
    },
    inventory: { files: files.length, crawled: crawled.length, excluded: excludedList },
  },
  nodes: [...nodes.values()], edges: [...edges.values()],
};
const gText = canonicalGraph(graph), gHash = sha256(gText);
const overlay = { schema: 'loupe.overlay/0.2', graph: { hash: gHash }, edges: [], roles: [], conditions: [] };
const oText = canonicalDoc(overlay);
const dirs = new Map();
for (const n of nodes.values()) {
  const key = n.kind === 'file' ? (posix.dirname(n.path) === '.' ? 'root' : posix.dirname(n.path)) : { external: 'external', artifact: 'artifacts', missing: 'missing' }[n.kind];
  if (!dirs.has(key)) dirs.set(key, []); dirs.get(key).push(n.id);
}
const slug = (s) => s.replace(/[^A-Za-z0-9_.-]+/g, '-');
const view = {
  schema: 'loupe.view/0.2', graph: { hash: gHash }, overlay: { hash: sha256(oText) },
  dialect: { name: 'none', version: '0' }, settings: { hubPlacement: 'group' }, exemptions: [],
  elements: [...dirs.keys()].sort().map((k) => ({ id: `sec:${slug(k)}`, primitive: 'section', label: k, claim: `Nodes under ${k}.`, by: 'agent:probe', members: dirs.get(k).sort() })),
};
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'graph.json'), gText);
writeFileSync(join(out, 'overlay.json'), oText);
writeFileSync(join(out, 'view.json'), canonicalDoc(view));
writeFileSync(join(out, 'probe-report.json'), JSON.stringify(report, null, 2) + '\n');
const kinds = {}; for (const e of edges.values()) kinds[e.kind] = (kinds[e.kind] || 0) + 1;
console.log(`${files.length} files, ${crawled.length} crawled; ${nodes.size} nodes, ${edges.size} edges ${JSON.stringify(kinds)}`);
