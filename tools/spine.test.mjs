// The "Signal path" view (design/prototype/spine.js, ROADMAP Q-015): layout properties on the committed engine2
// structure snapshot, each checked against the declaration directly (graph.declaration.signalPath, node `declared`
// fields, edge evidence), never through spine.js's own helpers, so the layout cannot grade itself.
// Run: node tools/spine.test.mjs
import { readFileSync } from 'node:fs';
import { deepStrictEqual } from 'node:assert';
import { indexSnapshot } from '../design/prototype/snapshot.js';
import { layoutSpine, renderSpine, DECLARED_EDGE_SLOT } from '../design/prototype/spine.js';
import { conserve } from '../design/prototype/standins.js';

let failed = 0;
const check = (name, cond, why = '') => { console.log(`${cond ? 'pass' : 'FAIL'}  ${name}${!cond && why ? ' — ' + why : ''}`); if (!cond) failed++; };
const dir = 'design/prototype/snapshots/engine2-structure/';
const j = (f) => JSON.parse(readFileSync(dir + f, 'utf8'));
const load = () => indexSnapshot({ graph: j('graph.json'), overlay: j('overlay.json'), view: j('view.json'), stages: null, diff: null, hashes: {} });
const data = load();

// ---- the declaration, read straight from the snapshot's graph
const G = data.graph, SP = G.declaration.signalPath;
const byPath = new Map(G.nodes.map((n) => [n.path, n.id]));
const declEdge = new Map(G.edges.map((e) => [e.evidence[0].id, e]));
const named = (x) => (byPath.has(x) ? [byPath.get(x)] : declEdge.has(x) ? [declEdge.get(x).src, declEdge.get(x).dst] : []);
const parentOf = new Map(G.nodes.filter((n) => n.declared.parent != null).map((n) => [n.id, byPath.get(n.declared.parent)]));
const descendants = (id) => [...parentOf].filter(([, p]) => p === id).flatMap(([c]) => [c, ...descendants(c)]);
const containers = [...new Set(parentOf.values())];

const lay = layoutSpine(data);
const P = lay.pos;

check('same input, same layout (deep-equal, twice, from fresh loads)', (() => { try { deepStrictEqual(layoutSpine(load()), layoutSpine(load())); return true; } catch { return false; } })());
check(`every node is placed exactly once (${G.nodes.length} nodes)`, Object.keys(P).length === G.nodes.length && G.nodes.every((n) => P[n.id] && Number.isFinite(P[n.id].x) && Number.isFinite(P[n.id].y)));
check(`every stage has a column (${SP.length} stages, distinct and increasing)`, lay.stages.length === SP.length && lay.stages.every((s, i) => s.i === i && (i === 0 || s.x > lay.stages[i - 1].x)));

// A spine item sits in the column of the first stage that names it.
const first = new Map();
SP.forEach((st, i) => st.ids.forEach((x) => named(x).forEach((id) => { if (!first.has(id)) first.set(id, i); })));
const wrongSpine = [...first].filter(([id, i]) => P[id].col !== i || P[id].side !== 0);
check(`every spine item (${first.size}) is in the column of the first stage that names it`, wrongSpine.length === 0, wrongSpine.slice(0, 3).map(([id, i]) => `${id} wants ${i} has ${P[id].col}`).join(', '));
const stageOrder = SP.every((st, i) => st.ids.every((x) => named(x).every((id) => P[id].col <= i)));
check('no stage names an item that sits in a later column than the stage', stageOrder);
// Within a column, items stack in the order the stage names them (an edge: src above dst).
const stackOk = SP.every((st, i) => { const fresh = []; st.ids.forEach((x) => named(x).forEach((id) => { if (first.get(id) === i && !fresh.includes(id)) fresh.push(id); })); return fresh.every((id, k) => P[id].row === k); });
check('items of one column stack in the order its stage names them', stackOk);

// Off-path: in the column of a neighbour by a declared edge (or, an edgeless item, of its declared parent or a member).
const nbrOf = (id) => G.edges.flatMap((e) => (e.src === id && e.dst !== id ? [e.dst] : e.dst === id && e.src !== id ? [e.src] : []));
const off = G.nodes.map((n) => n.id).filter((id) => !first.has(id) && !P[id].tray);
const badOff = off.filter((id) => { const ns = nbrOf(id); const rel = ns.length ? ns : [parentOf.get(id), ...descendants(id)].filter(Boolean); return !rel.some((r) => P[r].col === P[id].col); });
check(`every off-path item (${off.length}) is in the column of a declared neighbour`, badOff.length === 0, badOff.slice(0, 3).join(', '));
const sideBad = off.filter((id) => { const ns = G.edges.filter((e) => (e.src === id) !== (e.dst === id)); if (!ns.length || P[id].depth !== 1) return false; const spineEdge = ns.filter((e) => first.has(e.src === id ? e.dst : e.src) && P[e.src === id ? e.dst : e.src].col === P[id].col); if (!spineEdge.length) return false; return !spineEdge.some((e) => (e.src === id ? -1 : 1) === P[id].side); });
check('a first-ring off-path item is above when its edge goes into the spine item, below when it comes out', sideBad.length === 0, sideBad.slice(0, 3).join(', '));
check('the tray holds only items with no declared edge and no container', lay.tray === null ? true : lay.tray.ids.every((id) => !nbrOf(id).length && !parentOf.has(id) && !descendants(id).length));

// Boxes.
const R = (id) => P[id];
const enc = (o, a) => a.x >= o.x - 0.01 && a.y >= o.y - 0.01 && a.x + a.w <= o.x + o.w + 0.01 && a.y + a.h <= o.y + o.h + 0.01;
const boxOf = new Map(lay.boxes.map((b) => [b.id, b]));
check(`one box per container (${containers.length})`, lay.boxes.length === containers.length && containers.every((c) => boxOf.has(c)));
const notEnc = containers.flatMap((c) => [c, ...descendants(c)].filter((d) => !enc(boxOf.get(c), R(d))).map((d) => `${c}:${d}`));
check('every container box encloses its own node and all its descendants\' nodes', notEnc.length === 0, notEnc.slice(0, 3).join(', '));
const notNest = containers.filter((c) => parentOf.has(c)).filter((c) => !enc(boxOf.get(parentOf.get(c)), boxOf.get(c)));
check('every nested box lies inside its parent\'s box', notNest.length === 0, notNest.slice(0, 3).join(', '));
const touch = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const ids = G.nodes.map((n) => n.id), clash = [];
for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) if (touch(R(ids[a]), R(ids[b]))) clash.push(`${ids[a]} / ${ids[b]}`);
check('no two node boxes overlap', clash.length === 0, clash.slice(0, 3).join(', '));
// Overlaps are reported, not hidden: recomputed here from the boxes' own rectangles.
const rel = (a, b) => [a, ...descendants(a)].includes(b) || [b, ...descendants(b)].includes(a);
const want = []; for (let a = 0; a < containers.length; a++) for (let b = a + 1; b < containers.length; b++) { const A = boxOf.get(containers[a]), B = boxOf.get(containers[b]); if (!rel(A.id, B.id) && touch(A, B)) want.push([A.id, B.id].sort().join('|')); }
const got = lay.overlaps.map((p) => [...p].sort().join('|'));
check(`every box overlap is reported in layout.overlaps (${want.length} found)`, want.length === got.length && want.every((w) => got.includes(w)));
const wantIn = containers.flatMap((c) => ids.filter((id) => ![c, ...descendants(c)].includes(id) && touch(boxOf.get(c), R(id))).map((id) => c + '|' + id));
check(`every node standing inside a box it is not a member of is reported in layout.intrusions (${wantIn.length} found)`, wantIn.length === lay.intrusions.length && wantIn.every((w) => lay.intrusions.some((p) => p.join('|') === w)));

// Render with a stub DOM: the map must balance, and the markup must really carry every node and edge.
const layer = { innerHTML: '' };
globalThis.document = { createElement: () => ({}) };
const container = { querySelector: () => layer, appendChild() {}, clientWidth: 1440, clientHeight: 900 };
const state = { view: 'spine', stage: 2, settings: {}, zoom: { auto: true } };
const map = renderSpine(container, data, state, lay);
const c = conserve(data, state, map);
check(`the meter balances: ${c.accounted} of ${c.edges.total} edges, ${c.nodes.placed} of ${c.nodes.total} nodes accounted`, c.status === 'balanced' && c.accounted === data.edges.length && c.nodes.placed === data.nodeIds.length, c.unaccounted.slice(0, 3).join(', '));
const html = layer.innerHTML, count = (re) => (html.match(re) || []).length;
check('the markup carries a data-edge for every edge and a data-node for every node, once each', count(/data-edge="/g) === data.edges.length && count(/data-node="/g) === data.nodeIds.length && data.edges.every((e) => html.includes(`data-edge="${e.id}"`)) && data.nodeIds.every((id) => html.includes(`data-node="${id}"`)));
check('every edge kind has a token slot, and the markup holds no literal colour', G.edges.every((e) => DECLARED_EDGE_SLOT[e.kind]) && !/#[0-9a-f]{3,8}\b|rgb\(|hsl\(/i.test(html));
check('the self-edge is drawn as a loop (a curve, not a line)', (() => { const e = G.edges.find((x) => x.src === x.dst); const g = html.split(`data-edge="${e.id}"`)[1].split('</g>')[0]; return /C/.test(g) && !/L/.test(g.split('d="')[1].split('"')[0]); })());
check('a stage that adds no item is drawn as a reference mark, one per item it names', SP.every((st, i) => { const f = lay.stages[i]; return f.fresh.length || count(new RegExp(`data-ref="${i}"`, 'g')) === f.named.length; }) && lay.stages.some((s) => !s.fresh.length));

console.log(`layout: ${lay.counts.columns} columns, band ${lay.counts.band} rows, ${lay.counts.above} rows above, ${lay.counts.below} rows below, tray ${lay.counts.tray}, ${lay.counts.boxes} boxes, ${lay.counts.overlaps} box overlaps, ${lay.counts.intrusions} intrusions`);
if (failed) { console.error(`${failed} check(s) failed`); process.exit(1); }
