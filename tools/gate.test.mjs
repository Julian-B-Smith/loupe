// The committed HORDE gate report (ROADMAP Q-025), checked in `./verify fast` without HORDE: the report must describe
// the committed graph, partition every probe edge, lose none, and every hand-written explanation must still be used.
// The gate itself (crawl HORDE twice, leak check, probe, parity) needs a HORDE checkout and runs in `./verify full`.
// Run: node tools/gate.test.mjs
import { readFileSync } from 'node:fs';
import { sha256 } from './canon.mjs';
import { parity } from './parity.mjs';

let failed = 0;
const check = (name, cond) => { console.log(`${cond ? 'pass' : 'FAIL'}  ${name}`); if (!cond) failed++; };
const dir = 'design/prototype/snapshots/horde-crawl/';
const graphText = readFileSync(dir + 'graph.json', 'utf8'), G = JSON.parse(graphText);
const gate = JSON.parse(readFileSync(dir + 'gate.json', 'utf8')), par = JSON.parse(readFileSync(dir + 'parity.json', 'utf8'));
const explFile = JSON.parse(readFileSync('tools/horde-parity-explained.json', 'utf8')), explained = explFile.explained;

check('the gate report describes the committed graph (same hash, same commit)', gate.graph.hash === sha256(graphText) && gate.commit === G.source.commit);
check('the written parity reasons were checked at the committed graph\'s commit', explFile.commit === G.source.commit);
check('the report was not made with a proposed config', gate.proposedConfig === false && G.source.dirty === false);
const unknown = G.nodes.filter((n) => n.kind === 'missing' && n.missing.reason === 'unknown').map((n) => n.id).sort();
check('the unknown-missing gate lists exactly the graph\'s unknown nodes', JSON.stringify(unknown) === JSON.stringify(gate.gates.unknownMissing.ids) && gate.gates.unknownMissing.pass === (unknown.length === 0));
const inv = G.crawler.inventory;
check('the inventory closes: every tracked file is a node or counted', inv.crawled + inv.excluded.reduce((n, x) => n + x.count, 0) === inv.files && gate.gates.inventoryCloses.pass);
const total = Object.values(par.counts).reduce((a, b) => a + b, 0);
check('parity: same commit, every probe edge in exactly one class', par.sameCommit && par.crawl.commit === G.source.commit && total === par.probe.edges);
check('parity: no probe edge lost', par.counts.lost === 0 && par.lost.length === 0);
const used = new Set(par.explained.map((x) => `${x.src} ${x.kind} ${x.dst}`));
check('every explanation in tools/horde-parity-explained.json is used, and each used one is there with its reason',
  Object.keys(explained).every((k) => used.has(k)) && par.explained.every((x) => explained[`${x.src} ${x.kind} ${x.dst}`] === x.why));
const waiting = JSON.parse(readFileSync('tools/horde-gate-waiting.json', 'utf8')).waiting;
check('every "waiting" entry names a gate failing in the committed report with exactly its ids (stale or widened fails here)',
  Object.entries(waiting).every(([k, w]) => gate.gates[k] && !gate.gates[k].pass && JSON.stringify([...(w.ids || [])].sort()) === JSON.stringify([...(gate.gates[k].ids || [])].sort())));
check('the committed byte-identity, leak and loupe-check gates held when the report was made', gate.gates.byteIdentical.pass && gate.gates.leakCheck.pass && gate.gates.loupeCheck.pass);

// Parity's classes, on a tiny pair of graphs: each class fires, and nothing is silently passed.
const src = (commit, nodes, edges) => ({ source: { commit }, nodes, edges });
const P = src('c', [], [
  { src: 'file:a.cpp', dst: 'file:b.h', kind: 'include' },                      // same
  { src: 'file:a.cpp', dst: 'ext:std', kind: 'include' },                       // package (vector)
  { src: 'file:a.py', dst: 'ext:py:shlex', kind: 'import', evidence: [{ type: 'site', path: 'a.py', line: 3 }] }, // package (python-std)
  { src: 'file:a.py', dst: 'ext:py:json', kind: 'import', evidence: [{ type: 'site', path: 'a.py', line: 9 }] },  // lost: no std import on line 9
  { src: 'art:d/**/*.json', dst: 'miss:out.h', kind: 'embeds' },                // expanded
  { src: 'file:a.py', dst: 'file:gone.txt', kind: 'reference' },                // lost
]);
const Cg = src('c', [{ id: 'miss:vector', kind: 'missing', path: 'vector', missing: { reason: 'external' } }], [
  { src: 'file:a.cpp', dst: 'file:b.h', kind: 'include' }, { src: 'file:a.cpp', dst: 'miss:vector', kind: 'include' },
  { src: 'file:a.py', dst: 'ext:python-std', kind: 'import', evidence: [{ type: 'site', path: 'a.py', line: 3 }] }, { src: 'file:d/x/p.json', dst: 'miss:out.h', kind: 'generates' },
]);
const R = parity(P, Cg);
check('parity classes: same, package (std and python-std on the probe\'s own line), expanded, and lost edges are lost', R.counts.same === 1 && R.counts.package === 2 && R.counts.expanded === 1
  && JSON.stringify(R.lost.map((x) => x.dst).sort()) === JSON.stringify(['ext:py:json', 'file:gone.txt']));
// The classes the critics found untested or loose: kind, resolved one way only and never into an unknown crawl node,
// package never into an unknown node, an import with no twin, and written reasons as the only way past the gate.
{
  const Pp = src('c', [], [
    { src: 'file:a.py', dst: 'file:t.json', kind: 'reference' },             // kind: crawl says data
    { src: 'file:a.cpp', dst: 'miss:sdk/i.h', kind: 'include' },             // resolved: crawl found it, longer
    { src: 'file:a.cpp', dst: 'miss:x/util.h', kind: 'include' },            // NOT resolved: crawl's path is shorter
    { src: 'file:a.cpp', dst: 'miss:foo.h', kind: 'include' },               // NOT resolved: crawl's node is unknown too
    { src: 'file:a.cpp', dst: 'ext:foundations', kind: 'include' },          // NOT package: crawl's node is unknown
    { src: 'file:a.mjs', dst: 'file:c.mjs', kind: 'import' },                // a real import the crawl lacks: lost
    { src: 'file:a.mjs', dst: 'file:d.mjs', kind: 'import' },                // NOT saved by a reference to the same file
    { src: 'file:a.py', dst: 'file:gen.h', kind: 'generates' },              // explained
  ]);
  const U = (id) => ({ id, kind: 'missing', path: id.slice(5), missing: { reason: 'unknown' } });
  const Cc = src('c', [U('miss:../x/foo.h'), U('miss:foundations/n.h')], [
    { src: 'file:a.py', dst: 'file:t.json', kind: 'data' }, { src: 'file:a.cpp', dst: 'miss:${build}/_deps/s/sdk/i.h', kind: 'include' },
    { src: 'file:a.cpp', dst: 'file:util.h', kind: 'include' }, { src: 'file:a.cpp', dst: 'miss:../x/foo.h', kind: 'include' },
    { src: 'file:a.cpp', dst: 'miss:foundations/n.h', kind: 'include' }, { src: 'file:a.mjs', dst: 'file:d.mjs', kind: 'reference' },
    { src: 'file:a.py', dst: 'file:gen.h', kind: 'reference' },
  ]);
  const Q = parity(Pp, Cc, { 'file:a.py generates file:gen.h': 'because' });
  const lostDst = Q.lost.map((x) => x.dst).sort();
  check('parity: a twin kind is kind; a longer crawl path resolves; a shorter one does not (critic H3)', Q.counts.kind === 1 && Q.counts.resolved === 1 && lostDst.includes('miss:x/util.h'));
  check('parity: neither resolved nor package accepts a crawl node that is itself unknown (critic MED-2)', lostDst.includes('miss:foo.h') && lostDst.includes('ext:foundations'));
  check('parity: a real import the crawl lacks is lost, and a reference to the same file does not save it (critic HIGH-1, L2)', lostDst.includes('file:c.mjs') && lostDst.includes('file:d.mjs'));
  check('parity: a write the crawl sees as a read is no twin; only a written reason saves it', Q.counts.explained === 1 && parity(Pp, Cc).lost.some((x) => x.dst === 'file:gen.h'));
  check('parity has no class that reads source text', !('notCode' in Q.counts));
}
check('parity on different commits is not parity', parity(P, { ...Cg, source: { commit: 'd' } }).sameCommit === false);

console.log(failed ? `${failed} failed` : 'all gate cases behave');
process.exit(failed ? 1 : 0);
