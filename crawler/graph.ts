// graph.json emitter of the P1a crawler (ROADMAP Q-016). Turns the build layer's facts and the syntax layer's facts
// into a canonical `loupe.graph/0.3.1` graph, with the inventory that accounts for every tracked file.
//
// The one rule, applied here: every fact the layers produced lands somewhere. A membership is a `builds` edge, a
// target dependency a `depends` edge, a custom command's outputs `generates` edges, an include an `include` edge with
// one site per directive; what cannot be an edge (a computed include, a census-skipped line, an unreadable file, a
// source no target claims) is listed in `crawler.notEvaluated`. Every tracked file is a node except binary content,
// which the inventory counts by extension (Julian, 2026-10-16: hiding is a view lens, 0019, not a crawl exclusion).
//
// Mapping choices recorded in docs/graph-schema.md ("From the build layer's facts to 0.3"). Still open there, and
// kept as the example made them: a custom command's DEPENDS (script and data alike) each `generates` its outputs;
// a TARGET-form command with no outputs makes no edge.
// TypeScript is run by Node's built-in type stripping: only erasable syntax here.
import { execFileSync } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, extname, basename } from 'node:path';
import { canonicalGraph, canonicalDoc, sha256, edgeId } from '../tools/canon.mjs';

const by = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const LANG: Record<string, string> = { '.c': 'c', '.h': 'cpp', '.cc': 'cpp', '.cpp': 'cpp', '.cxx': 'cpp', '.hh': 'cpp', '.hpp': 'cpp', '.hxx': 'cpp',
  '.inl': 'cpp', '.ipp': 'cpp', '.tpp': 'cpp', '.inc': 'cpp', '.m': 'objc', '.mm': 'objcpp', '.cmake': 'cmake', '.py': 'python', '.js': 'js', '.mjs': 'js',
  '.ts': 'ts', '.sh': 'sh', '.json': 'json', '.md': 'markdown', '.txt': 'text', '.csv': 'csv', '.tsv': 'tsv', '.yml': 'yaml', '.yaml': 'yaml', '.html': 'html' };
const langOf = (p: string) => (basename(p) === 'CMakeLists.txt' ? 'cmake' : LANG[extname(p).toLowerCase()] || 'text');

// The repo's public identity: host/owner/name from the origin remote, and nothing else. Only a scheme URL
// (https://, ssh://, git://) or the scp form user@host:path, with a dotted host and a relative path, qualifies;
// userinfo is cut at the LAST '@' (a password may contain '@'). Anything else (a local path, ~/x, C:/x, a host with an
// absolute path) is 'local': the doctrine forbids machine identity in output (critic, 2026-10-16).
export function repoNameOf(url: string): string {
  const u = url.trim();
  let m = /^(?:https?|ssh|git|git\+ssh):\/\/(?:.*@)?([A-Za-z0-9.-]+\.[A-Za-z]{2,})(?::\d+)?\/([^\s?#]+?)(?:\.git)?\/?$/.exec(u);
  if (!m) m = /^[A-Za-z0-9._-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,}):(?!\/)([^\s]+?)(?:\.git)?\/?$/.exec(u);
  if (!m || /(^|\/)\.\.?(\/|$)/.test(m[2])) return 'local';
  return `${m[1]}/${m[2]}`;
}
function repoName(repo: string): string {
  try { return repoNameOf(execFileSync('git', ['-C', repo, 'remote', 'get-url', 'origin'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString()); }
  catch { return 'local'; }
}
const git = (repo: string, args: string[]) => execFileSync('git', ['-C', repo, ...args], { stdio: ['ignore', 'pipe', 'ignore'] }).toString();

export function emitGraph(repoIn: string, build: any, syntax: any) {
  let repo = repoIn; try { repo = realpathSync(repoIn); } catch {}
  // Mode from the index: 160000 is a submodule (a gitlink, not a file here), 120000 a symlink (following it would make
  // the hash depend on this machine). Both are counted in the inventory, never read.
  const entries = git(repo, ['ls-files', '-s', '-z', '--', '.']).split('\0').filter(Boolean).map((l) => { const t = l.indexOf('\t'); return { mode: l.slice(0, 6), path: l.slice(t + 1) }; });
  const tracked = entries.map((e) => e.path).sort(by);
  const special = new Map(entries.filter((e) => e.mode === '160000' || e.mode === '120000').map((e) => [e.path, e.mode === '160000' ? 'submodule' : 'symlink']));
  let commit: string, commitTime: string, dirty: boolean;
  try { commit = git(repo, ['rev-parse', 'HEAD']).trim(); commitTime = git(repo, ['log', '-1', '--format=%cI']).trim(); dirty = git(repo, ['status', '--porcelain', '--', '.']).trim().length > 0; }
  catch { throw new Error(`crawl: ${repoIn} has no commit to crawl (a graph names the commit it describes)`); }

  const nodes = new Map<string, any>(), edges = new Map<string, any>(), notEvaluated: { what: string; reason: string }[] = [];
  const binary: Record<string, number> = {}, specialCount: Record<string, Record<string, number>> = {};
  const binaryPaths = new Set<string>();
  // ---- inventory: every tracked file is a node, except binary content (a NUL byte in the first 8000 bytes)
  for (const p of tracked) {
    const sp = special.get(p);
    if (sp) { const e = extname(p).toLowerCase() || '(none)'; (specialCount[sp] ||= {})[e] = ((specialCount[sp] || {})[e] || 0) + 1; continue; }
    let buf: Buffer;
    try { buf = readFileSync(join(repo, p)); } catch { notEvaluated.push({ what: p, reason: 'tracked but not readable on disk' }); continue; }
    if (buf.subarray(0, 8000).includes(0)) { const e = extname(p).toLowerCase() || '(none)'; binary[e] = (binary[e] || 0) + 1; binaryPaths.add(p); continue; }
    const text = buf.toString('utf8');
    nodes.set('file:' + p, { id: 'file:' + p, kind: 'file', path: p, lang: langOf(p), hash: 'sha256:' + createHash('sha256').update(buf).digest('hex'),
      loc: text.length === 0 ? 0 : text.split('\n').length - (text.endsWith('\n') ? 1 : 0) });
  }
  const unreadable = notEvaluated.length;
  const binaryCount = Object.values(binary).reduce((a, b) => a + b, 0);

  const allCfgs = build.configurations.map((c: any) => c.name).sort(by);
  const narrow = (cs: Iterable<string> | null | undefined) => { if (!cs) return undefined; const s = [...new Set(cs)].sort(by); return s.length && s.length < allCfgs.length ? s : undefined; };
  // Ids for paths the build reports: a repo file, a build output (missing: generated), or a file outside the repo.
  const genOut = new Set<string>();
  for (const m of build.membership) if (m.generated) genOut.add(m.source);
  for (const pc of build.perConfiguration) for (const c of pc.customCommands) for (const o of [...c.outputs, ...c.byproducts]) genOut.add(o);
  const missing = (path: string, reason: string, note?: string) => {
    const id = 'miss:' + path;
    if (!nodes.has(id)) nodes.set(id, { id, kind: 'missing', path, hash: 'none', missing: note ? { reason, note } : { reason } });
    return id;
  };
  const nodeFor = (p: string) => nodes.has('file:' + p) ? 'file:' + p
    : genOut.has(p) || p.startsWith('${build}/') ? missing(p, 'generated')
    : p.startsWith('${external}/') ? missing(p, 'external', 'a source outside the repo, listed by the build')
    : binaryPaths.has(p) ? missing(p, 'unknown', 'a tracked binary file: counted in the inventory, not a node')
    : special.has(p) ? missing(p, 'unknown', `a tracked ${special.get(p)}: counted in the inventory, not read`)
    : missing(p, 'unknown', 'listed by the build but not a tracked file');
  const addEdge = (src: string, dst: string, kind: string, provenance: string, ev: any, configs?: string[] | null, site = false) => {
    const id = edgeId(src, dst, kind);
    const e = edges.get(id) || { id, src, dst, kind, provenance, evidence: [] as any[], cfg: new Set<string>(), all: false };
    // The same fact seen in several configurations is one piece of evidence, not several (configs says where).
    const same = e.evidence.find((x: any) => JSON.stringify({ ...x, configs: undefined }) === JSON.stringify({ ...ev, configs: undefined }));
    if (!same) e.evidence.push(ev);
    else if (site && same.configs) { if (ev.configs) same.configs = [...new Set([...same.configs, ...ev.configs])].sort(by); else delete same.configs; }
    if (configs && configs.length) for (const c of configs) e.cfg.add(c); else e.all = true;
    edges.set(id, e);
  };

  // ---- targets: one node each; configs where it exists in only some configurations
  const tseen = new Map<string, { types: Set<string>; cs: string[] }>();
  for (const pc of build.perConfiguration) for (const t of pc.targets) { const x = tseen.get(t.name) || { types: new Set(), cs: [] }; x.types.add(t.type); x.cs.push(pc.name); tseen.set(t.name, x); }
  for (const [name, x] of [...tseen].sort((a, b) => by(a[0], b[0]))) {
    const n: any = { id: 'target:' + name, kind: 'target', path: name, hash: 'none', targetType: [...x.types].sort(by).join('|') };
    if (x.types.size > 1) notEvaluated.push({ what: `target ${name}`, reason: `its type differs between configurations: ${[...x.types].sort(by).join(', ')}` });
    const c = narrow(x.cs); if (c) n.configs = c;
    nodes.set(n.id, n);
  }
  // Build evidence cites the CMake file and line that define the target (File API backtrace), not a guess.
  const defIn = new Map<string, { file: string; line: number }>();
  for (const pc of build.perConfiguration) for (const t of pc.targets) if (t.definedIn && !defIn.has(t.name)) defIn.set(t.name, t.definedIn);
  const tev = (t: string, what: string) => { const d = defIn.get(t); return { type: 'config', path: d ? d.file : 'CMakeLists.txt', key: `target ${t} ${what}${d ? ` (defined at line ${d.line})` : ' (definition not located)'}`, resolution: 'build' }; };
  // ---- builds: a target lists or compiles a source
  for (const m of build.membership)
    addEdge('target:' + m.target, nodeFor(m.source), 'builds', 'config', tev(m.target, 'sources'), m.configs);
  // ---- depends: target dependencies, per configuration
  const deps = new Map<string, string[]>();
  for (const pc of build.perConfiguration) for (const t of pc.targets) for (const d of t.dependencies) { const k = t.name + '\u0000' + d; deps.set(k, [...(deps.get(k) || []), pc.name]); }
  for (const [k, cs] of deps) { const [a, b] = k.split('\u0000'); addEdge('target:' + a, 'target:' + b, 'depends', 'config', tev(a, 'dependencies'), cs); }
  // ---- generates. Each tracked DEPENDS of a custom command -> each OUTPUT and BYPRODUCT; a TARGET-form command's
  // outputs come from its target; a `name:` DEPENDS is a target, or another command's output (matched by path), else
  // it is listed. A command that yields no edge at all is listed too: nothing the build reported is dropped (critic).
  for (const pc of build.perConfiguration) for (const c of pc.customCommands) {
    const ev = { type: 'config', path: c.file, key: `add_custom_command line ${c.line}`, resolution: 'build' };
    const outs = [...c.outputs, ...c.byproducts];
    let made = 0;
    for (const o of outs) {
      const dst = nodeFor(o);
      if (c.target && tseen.has(c.target)) { addEdge('target:' + c.target, dst, 'generates', 'config', ev, [pc.name]); made++; }
      for (const d of c.depends) {
        if (!d.startsWith('name:')) { addEdge(nodeFor(d), dst, 'generates', 'config', ev, [pc.name]); made++; continue; }
        const nm = d.slice(5), out = [...genOut].filter((g) => g === nm || g.endsWith('/' + nm)).sort(by)[0];
        if (tseen.has(nm)) { addEdge('target:' + nm, dst, 'generates', 'config', ev, [pc.name]); made++; }
        else if (out) { addEdge(nodeFor(out), dst, 'generates', 'config', ev, [pc.name]); made++; }
        else notEvaluated.push({ what: `${c.file}:${c.line}`, reason: `custom command depends on "${nm}", which is neither a target nor a known output` });
      }
    }
    if (!made) notEvaluated.push({ what: `${c.file}:${c.line}`, reason: outs.length ? 'custom command with outputs but nothing it depends on in the build'
      : `custom command with no OUTPUT or BYPRODUCTS${c.target ? ` (${c.stage || 'TARGET'} step of ${c.target})` : ''}: makes no file Loupe can see` });
  }
  // ---- include: one edge per (file, target) pair, one site per directive. An include holds where its file is
  // compiled (Julian, 2026-10-16): a site with no configs of its own takes its file's; each site keeps its own configs
  // and the edge's are their union. A file no compile reaches keeps its edges, listed once as textual only.
  const fileInfo = new Map<string, any>((syntax.files || []).map((f: any) => [f.path, f]));
  const textual = new Set<string>();
  for (const i of syntax.includes) {
    const dst = i.to.startsWith('file:') ? i.to : missing(i.to.slice(5), i.missing || 'generated',
      i.missing === 'external' ? 'outside the repo (angle include or absolute path)' : i.missing === 'unknown' ? 'not found next to the file or on any include path' : undefined);
    const fi = fileInfo.get(i.from);
    const cs = i.configs || (fi && fi.configs) || undefined;
    if (fi && fi.inCompile === false) textual.add(i.from);
    const site: any = { type: 'site', path: i.from, line: i.line, resolution: i.resolution };
    if (i.guard) site.guard = i.guard;
    if (i.via) site.via = i.via;
    const n = narrow(cs); if (n) site.configs = n;
    addEdge('file:' + i.from, dst, 'include', 'static', site, n, true);
  }
  for (const f of [...textual].sort(by)) notEvaluated.push({ what: f, reason: 'in no compile of any configuration: its includes are textual only' });
  // ---- what cannot be an edge
  for (const c of syntax.computed) notEvaluated.push({ what: `${c.from}:${c.line}`, reason: `computed include ${c.text}: needs macro evaluation` });
  for (const s of syntax.skipped) notEvaluated.push({ what: `${s.from}:${s.line}`, reason: `include-like line not read: ${s.reason}` });
  for (const p of syntax.problems) notEvaluated.push({ what: p.line ? `${p.from}:${p.line}` : p.from, reason: p.text });
  for (const u of build.unclaimedSources || []) notEvaluated.push({ what: u, reason: 'tracked source claimed by no target in any declared configuration (may be platform-only)' });
  if (!build.declared) notEvaluated.push({ what: 'configurations', reason: 'none declared in .loupe/config.json: one default configure stands for all' });

  // A generated missing node needs a generates edge or a note (G6).
  for (const n of nodes.values()) if (n.kind === 'missing' && n.missing.reason === 'generated' && !n.missing.note && ![...edges.values()].some((e) => e.dst === n.id && e.kind === 'generates'))
    n.missing.note = 'a build output (the build lists it as generated)';

  const edgeList = [...edges.values()].map((e) => {
    const out: any = { id: e.id, src: e.src, dst: e.dst, kind: e.kind, provenance: e.provenance, evidence: e.evidence, count: e.evidence.length };
    const c = e.all ? undefined : narrow(e.cfg); if (c) out.configs = c;
    return out;
  });
  const fileCount = [...nodes.values()].filter((n) => n.kind === 'file').length;
  const graph = {
    schema: 'loupe.graph/0.3.1',
    source: { repo: repoName(repo), commit, commitTime, dirty },
    crawler: {
      name: 'loupe-crawler', version: '0.1.0', granularity: 'file',
      languages: [...new Set([...nodes.values()].filter((n) => n.kind === 'file').map((n) => n.lang))].sort(by),
      dialect: { name: 'none', version: '0' },
      scope: { include: ['every tracked file'], exclude: ['binary content (binary)', 'git submodules (submodule)', 'symlinks (symlink)', 'tracked files not readable on disk (unreadable)'], resolution: 'build' },
      inventory: { files: tracked.length, crawled: fileCount, excluded: [
        ...(binaryCount ? [{ reason: 'binary', count: binaryCount, byExt: Object.fromEntries(Object.entries(binary).sort()) }] : []),
        ...Object.entries(specialCount).sort().map(([reason, byExt]) => ({ reason, count: Object.values(byExt).reduce((a, b) => a + b, 0), byExt: Object.fromEntries(Object.entries(byExt).sort()) })),
        ...(unreadable ? [{ reason: 'unreadable', count: unreadable }] : []) ] },
      configurations: build.configurations.map((c: any) => ({ name: c.name, args: c.args, ...(c.buildType != null ? { buildType: c.buildType } : {}) })),
      // One entry per fact: the same command seen in every configuration is listed once.
      notEvaluated: [...new Map(notEvaluated.map((n) => [n.what + '\u0000' + n.reason, n])).values()].sort((a, b) => by(a.what, b.what) || by(a.reason, b.reason)),
    },
    nodes: [...nodes.values()],
    edges: edgeList,
  };
  const gText = canonicalGraph(graph);
  // An empty overlay and view bound to this graph, so the snapshot is complete and checkable before any agent runs.
  const overlay = { schema: 'loupe.overlay/0.2', graph: { hash: sha256(gText) }, edges: [], roles: [], conditions: [] };
  const oText = canonicalDoc(overlay);
  const view = { schema: 'loupe.view/0.2', graph: { hash: sha256(gText) }, overlay: { hash: sha256(oText) }, dialect: { name: 'none', version: '0' }, settings: { hubPlacement: 'group' }, elements: [], exemptions: [] };
  return { graph: gText, overlay: oText, view: canonicalDoc(view) };
}
