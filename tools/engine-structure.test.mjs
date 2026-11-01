// Tests for the engine-structure adapter (ROADMAP Q-015 criterion 2: same declaration, same bytes; nothing dropped
// goes unreported). Two layers: (1) the committed snapshot against HORDE's declaration read straight from git here,
// not through the adapter; (2) synthetic declarations passed to adapt() so each report path is proven to fire.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { adapt, FORMAT, DECL_PATH } from './engine-structure.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SNAP = join(ROOT, 'design/prototype/snapshots/engine2-structure');
let fails = 0, passes = 0;
const check = (name, ok, detail) => { if (ok) passes++; else { fails++; console.error(`FAIL ${name}${detail ? ': ' + detail : ''}`); } };
const snap = (f) => JSON.parse(readFileSync(join(SNAP, f), 'utf8'));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---- Layer 1: the committed snapshot vs the declaration at its pinned commit ----
const graph = snap('graph.json'), census = snap('census.json');
const horde = process.env.LOUPE_HORDE || join(homedir(), 'Documents/Claude/synthetic-worlds/horde');
let decl = null;
try { decl = JSON.parse(execFileSync('git', ['-C', horde, 'show', `${graph.source.commit}:${DECL_PATH}`], { encoding: 'utf8', maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'ignore'] })); } catch { /* no checkout or commit */ }
if (!decl) console.log(`engine-structure.test: SKIPPED the snapshot-vs-declaration checks: ${graph.source.commit} not readable in ${horde}`);
else {
  const nodeIds = new Set(graph.nodes.map((n) => n.id));
  const evIds = new Set(graph.edges.flatMap((e) => e.evidence.map((v) => v.id)));
  const missingItems = decl.items.filter((i) => !nodeIds.has('decl:' + i.id)).map((i) => i.id);
  const missingEdges = decl.edges.filter((e) => !evIds.has(e.id)).map((e) => e.id);
  check('every declared item is a node', missingItems.length === 0, missingItems.join(','));
  check('every declared edge is an edge (by declared id in evidence)', missingEdges.length === 0, missingEdges.join(','));
  check('node count equals declared item count', graph.nodes.length === decl.items.length);
  check('census.declared is the declaration\'s own counts', same(census.declared, decl.counts));
  check('census.carried equals census.declared', same(census.carried, census.declared), JSON.stringify(census.carried));
  check('every stage id resolves', census.stagesUnresolved.length === 0 && census.stagesResolved === decl.signal_path.reduce((a, s) => a + s.ids.length, 0));
  check('stages carry raw ids unchanged', same(graph.declaration.signalPath.map((s) => s.ids), decl.signal_path.map((s) => s.ids)));
  check('unplaced is empty', census.unplaced.length === 0, JSON.stringify(census.unplaced));
  check('unknownKeys are empty', Object.values(census.unknownKeys).every((a) => a.length === 0));
  const regen = adapt(decl, { commit: graph.source.commit, commitTime: graph.source.commitTime, blob: graph.declaration.blob });
  for (const f of ['graph.json', 'overlay.json', 'view.json', 'census.json']) check(`snapshot ${f} is what the adapter writes`, regen[f] === readFileSync(join(SNAP, f), 'utf8'));
}

// ---- Layer 2: synthetic declarations ----
const KINDS = ['audio', 'control', 'event', 'modulation', 'observation'];
const it = (id, extra = {}) => ({ id, label: id, parent: null, kind: 'block', scope: 'engine', multiplicity: null, cites: [], ...extra });
const ed = (id, from, to, kind = 'audio') => ({ id, from, to, kind, label: '', cites: [] });
const base = () => ({ format: FORMAT, spec: {}, counts: {}, edge_kinds: [...KINDS], items: [it('a'), it('b')], edges: [ed('a->b', 'a', 'b')], signal_path: [{ stage: 's', ids: ['a', 'a->b'] }] });
const run = (d) => adapt(d, { commit: 'c'.repeat(40), commitTime: '2026-01-01T00:00:00+00:00', blob: 'b'.repeat(40) });
const cen = (d) => JSON.parse(run(d)['census.json']);
const reported = (c, what, id) => c.unplaced.some((u) => u.what === what && (id === undefined || u.id === id));

{
  const c = cen(base());
  check('clean fixture: nothing unplaced', c.unplaced.length === 0, JSON.stringify(c.unplaced));
  check('clean fixture: all stage ids resolve', c.stagesResolved === 2 && c.stagesUnresolved.length === 0);
  const g = JSON.parse(run(base())['graph.json']);
  check('stage refs: item to decl:, edge to e:', same(g.declaration.signalPath[0].refs, ['decl:a', g.edges[0].id]) && same(g.declaration.signalPath[0].ids, ['a', 'a->b']));
  check('carried.scope comes from emitted nodes', cen(base()).carried.scope.engine === 2);
}
{
  const d = base(); d.zzz = 1; d.items[0].x = 1; d.edges[0].y = 1; d.signal_path[0].w = 1;
  const k = cen(d).unknownKeys;
  check('unknown key: top', same(k.top, ['zzz'])); check('unknown key: item', same(k.item, ['x']));
  check('unknown key: edge', same(k.edge, ['y'])); check('unknown key: stage', same(k.stage, ['w']));
}
{
  const d = base(); d.items.push(it('a', { label: 'second', scope: 'external' }));
  const g = JSON.parse(run(d)['graph.json']);
  check('carried.scope counts emitted nodes, not input items', same(cen(d).carried.scope, { engine: 2 }));
  check('duplicate item id: reported, first kept', reported(cen(d), 'item', 'a') && g.nodes.length === 2 && g.nodes.find((n) => n.id === 'decl:a').declared.label === 'a');
}
{
  const d = base(); d.edges.push(ed('a->b', 'a', 'b', 'control'));
  const c = cen(d);
  check('duplicate edge id: reported, both placed', reported(c, 'edge', 'a->b') && c.carried.edges.audio === 1 && c.carried.edges.control === 1);
}
{
  const d = base(); d.edges.push(ed('a->b#2', 'a', 'b'));
  const g = JSON.parse(run(d)['graph.json']);
  check('duplicate (from,to,kind): reported and evidence merged', reported(cen(d), 'edge', 'a->b#2') && g.edges.length === 1 && same(g.edges[0].evidence.map((v) => v.id), ['a->b', 'a->b#2']));
}
{
  const d = base(); d.items = [it('x', { parent: 'z' }), it('y', { parent: 'x' }), it('z', { parent: 'y' }), it('a'), it('b')];
  const out = run(d), c = JSON.parse(out['census.json']);
  const g = JSON.parse(out['graph.json']), v = JSON.parse(out['view.json']);
  // terminates (we got here); the cut is at the smallest id, whatever the declaration order
  check('parent cycle: reported', reported(c, 'parent', 'x'));
  check('parent cycle: cut leaves a chain with no cycle', g.nodes.find((n) => n.id === 'decl:x').declared.parent === null);
  const up = new Map(v.elements.map((e) => [e.id, e.parent]));
  let depthOk = true; for (const id of up.keys()) { let n = 0, at = id; while (at && n < 100) { at = up.get(at); n++; } if (n >= 100) depthOk = false; }
  check('parent cycle: view sections nest finitely', depthOk);
  const self = base(); self.items[0].parent = 'a';
  check('self-parent: reported and cut', reported(cen(self), 'parent', 'a'));
}
{
  const d = base(); d.items[0].parent = 'ghost';
  const g = JSON.parse(run(d)['graph.json']);
  check('unknown parent: reported, cut', reported(cen(d), 'parent', 'ghost') && g.nodes[0].declared.parent === null);
}
{
  const d = base(); d.signal_path.push({ stage: 't', ids: ['nope'] });
  const c = cen(d);
  check('unresolved stage id: listed and reported', same(c.stagesUnresolved, [{ id: 'nope', stage: 1 }]) && reported(c, 'stage', 'nope') && c.stagesResolved === 2);
}
{
  let threw = false; try { run({ ...base(), format: 'horde.engine-structure/2' }); } catch { threw = true; }
  check('wrong format throws', threw);
}
{
  const d = base(); d.edges.push(ed('a~>b', 'a', 'b', 'telepathy'));
  const c = cen(d);
  check('edge kind outside the list: reported, not carried', reported(c, 'edge', 'a~>b') && Object.values(c.carried.edges).reduce((a, b) => a + b, 0) === 1);
}
{
  const d = base(); d.edge_kinds = ['audio'];
  check('edge_kinds differing from the adapter\'s: reported', reported(cen(d), 'edge_kinds'));
  const e = base(); delete e.edge_kinds;
  check('edge_kinds absent: reported', reported(cen(e), 'edge_kinds'));
}
check('same input twice: identical bytes', same(run(base()), run(base())));

if (fails) { console.error(`engine-structure.test: ${fails} failed, ${passes} passed`); process.exit(1); }
console.log(`engine-structure.test: ${passes} checks pass`);
