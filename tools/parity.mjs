// Probe parity (ROADMAP Q-025, the P1a gate "everything the probe found is found again"). Deterministic, no model.
// Compares the regex probe's graph (tools/probe-crawl.mjs) with the crawler's graph of the SAME commit, edge by edge,
// and sorts every probe edge into exactly one class. Nothing is dropped: every probe edge lands in a class, and every
// class other than `same` lists its edges, so a reader can check each one.
//   node tools/parity.mjs <probe graph.json> <crawl graph.json> [--explained <json>] [--out report.json]
// No class reads source text: a probe edge the graphs cannot account for needs a written reason (critic round 2:
// a mask-based "only in a comment or string" class also swallowed real imports, whose specifier is a string).
//
// Classes, first that applies:
//   same      the crawl has the edge: same source, same target, same kind.
//   kind      same source and target, a twin kind (the probe's reference is often the crawl's data; embeds is generates).
//   resolved  one way only: the probe could not find the target (miss:X) and the crawl found it, at a path ending in
//             /X, and the crawl's node is not itself unknown (found by the build, next to the file, or from the root), e.g. a VST3 header the
//             build fetched. Never the reverse: a shorter crawl path may be another file (critic H3).
//   package   the probe folded the target into a package (ext:std, ext:clap, ext:py:shlex) and the crawl has an edge from
//             the same source into that package, by the probe's own package rule (copied below) or the crawl's
//             standard-library lists; for a folded standard library, on one of the probe's own lines.
//   expanded  the probe's source is a glob node (art:...); the crawl has the edge from files the glob matches.
//   explained listed by hand in an explanations file (--explained), each with its reason and pinned to a commit: what
//             no graph fact can show (a configuration the crawl did not run, text that is not code, a probe error).
//   lost      none of the above. The gate: zero, or each one explained in the committed parity report.
import { readFileSync, writeFileSync } from 'node:fs';
import { posix } from 'node:path';
import { canonicalDoc } from './canon.mjs';
import { PY_STD, NODE_BUILTINS } from '../crawler/langs.ts';

const by = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
// A twin says the same edge more precisely, never the opposite: a probe reference the crawl sees as data or as a write
// is the same use; a probe write the crawl sees as a read is not (critic L5), so generates has no twin but itself.
// An import has no twin either: a reference to the same file elsewhere in the source is not the import (critic L2).
const KIND_TWINS = { reference: ['data', 'generates', 'import'], data: ['reference'], embeds: ['generates'], import: [], include: [], generates: [] };
// The probe's package rule for angle includes (tools/probe-crawl.mjs, STD and PLATFORM), copied so parity judges the
// probe by its own rule. If the probe's rule changes, change it here too.
const STD = /^(c[a-z]+|algorithm|any|array|atomic|bit|bitset|chrono|complex|condition_variable|deque|exception|execution|filesystem|fstream|functional|future|initializer_list|iomanip|ios|iosfwd|iostream|istream|iterator|limits|list|locale|map|memory|memory_resource|mutex|new|numbers|numeric|optional|ostream|queue|random|ratio|regex|set|shared_mutex|span|sstream|stack|stdexcept|streambuf|string|string_view|system_error|thread|tuple|type_traits|typeinfo|unordered_map|unordered_set|utility|valarray|variant|vector|version|[a-z]+\.h|sys\/.*|mach\/.*)$/;
const PLATFORM = /^(windows\.h|dlfcn\.h|pthread\.h|unistd\.h|sys\/.*|mach\/.*|mach-o\/.*|Cocoa\/.*|Accelerate\/.*|WebKit\/.*|Foundation\/.*|AppKit\/.*|CoreFoundation\/.*|objbase\.h|shlobj\.h|wrl.*|WebView2.*)$/;
const pkgOfInclude = (p) => PLATFORM.test(p) ? 'platform' : STD.test(p) ? 'std' : p.split('/')[0].replace(/\.h(pp)?$/, '');
// A crawl node inside a submodule says so in its note; the probe named such a package after the submodule's folder.
const pkgOfNode = (n) => { const m = /in submodule (\S+) /.exec((n.missing && n.missing.note) || ''); return m ? posix.basename(m[1]) : pkgOfInclude(n.path); };
const norm = (s) => s.replace(/-/g, '');

export function parity(probe, crawl, explained = {}) {
  const path = (id) => id.replace(/^(file|miss|ext|art):/, '');
  const out = new Map();
  for (const e of crawl.edges) (out.get(e.src) || out.set(e.src, []).get(e.src)).push(e);
  const crawlNode = new Map(crawl.nodes.map((n) => [n.id, n]));
  const twin = (k, x) => x === k || (KIND_TWINS[k] || []).includes(x);
  // A crawl target that is itself unknown never counts as finding the probe's edge (critic MED-2).
  const known = (id) => crawlNode.get(id)?.missing?.reason !== 'unknown';
  const C = { same: [], kind: [], resolved: [], package: [], expanded: [], explained: [], lost: [] };
  for (const e of [...probe.edges].sort((a, b) => by(a.src, b.src) || by(a.dst, b.dst) || by(a.kind, b.kind))) {
    const mine = out.get(e.src) || [], row = { src: e.src, dst: e.dst, kind: e.kind }, p = path(e.dst);
    if (mine.some((x) => x.dst === e.dst && x.kind === e.kind)) { C.same.push(row); continue; }
    const k = mine.find((x) => x.dst === e.dst && twin(e.kind, x.kind));
    if (k) { C.kind.push({ ...row, crawlKind: k.kind }); continue; }
    if (e.dst.startsWith('miss:')) {
      const r = mine.filter((x) => twin(e.kind, x.kind) && known(x.dst) && path(x.dst).endsWith('/' + p)).map((x) => x.dst).sort(by);
      if (r.length) { C.resolved.push({ ...row, crawlDst: r[0] }); continue; }
    }
    const probeLines = new Set((e.evidence || []).map((v) => v.line));
    if (e.dst.startsWith('ext:')) {
      const want = e.kind === 'include' ? (x) => crawlNode.get(x.dst) && !x.dst.startsWith('file:') && norm(pkgOfNode(crawlNode.get(x.dst))) === norm(p)
        : p === 'python-std' || (p.startsWith('py:') && PY_STD.has(p.slice(3))) ? (x) => x.dst === 'ext:python-std' && (x.evidence || []).some((v) => probeLines.has(v.line))
        : p.startsWith('npm:') && NODE_BUILTINS.has(p.slice(4)) ? (x) => x.dst === 'ext:node'
        : (x) => x.dst === e.dst;
      const hit = mine.filter((x) => twin(e.kind, x.kind) && known(x.dst) && want(x)).map((x) => x.dst).sort(by);
      if (hit.length) { C.package.push({ ...row, crawlDst: hit[0] }); continue; }
    }
    if (e.src.startsWith('art:')) {
      // Placeholders first: replacing ** after * would rewrite the regex just produced.
      const re = new RegExp('^file:' + path(e.src).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*\//g, '\u0001').replace(/\*/g, '\u0002').replace(/\u0001/g, '(?:.*/)?').replace(/\u0002/g, '[^/]*') + '$');
      const from = crawl.edges.filter((x) => re.test(x.src) && x.dst === e.dst && twin(e.kind, x.kind)).map((x) => x.src).sort(by);
      if (from.length) { C.expanded.push({ ...row, crawlFrom: from.length }); continue; }
    }
    const why = explained[`${e.src} ${e.kind} ${e.dst}`];
    if (why) { C.explained.push({ ...row, why }); continue; }
    C.lost.push(row);
  }
  const counts = Object.fromEntries(Object.entries(C).map(([k, v]) => [k, v.length]));
  const { same, ...listed } = C;
  return { schema: 'loupe.parity/0.0-internal', probe: { commit: probe.source.commit, edges: probe.edges.length }, crawl: { commit: crawl.source.commit, edges: crawl.edges.length },
    sameCommit: probe.source.commit === crawl.source.commit, counts, ...listed };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const a = process.argv.slice(2), opt = (k) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : null; };
  const [p, c] = a.filter((x, i) => !x.startsWith('--') && !(i > 0 && a[i - 1].startsWith('--')));
  if (!p || !c) { console.error('usage: node tools/parity.mjs <probe graph.json> <crawl graph.json> [--explained <json>] [--out report.json]'); process.exit(2); }
  const r = parity(JSON.parse(readFileSync(p, 'utf8')), JSON.parse(readFileSync(c, 'utf8')), opt('--explained') ? JSON.parse(readFileSync(opt('--explained'), 'utf8')).explained : {});
  if (opt('--out')) writeFileSync(opt('--out'), canonicalDoc(r));
  console.log(JSON.stringify({ sameCommit: r.sameCommit, ...r.counts }));
  process.exit(r.sameCommit && r.lost.length === 0 ? 0 : 1);
}
