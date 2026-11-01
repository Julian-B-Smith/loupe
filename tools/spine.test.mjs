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

// ---- off-path external blocks stand on a rail, by scope and edge direction alone ("frame the spine", Julian 2026-11-01)
const scope = (id) => G.nodes.find((n) => n.id === id).declared.scope;
const engineEdges = (id) => G.edges.filter((e) => e.src !== e.dst && (e.src === id ? scope(e.dst) !== 'external' : e.dst === id && scope(e.src) !== 'external'));
const railOf = (id) => {
  const es = engineEdges(id), outs = es.filter((e) => e.src === id), ins = es.filter((e) => e.dst === id);
  if (!es.length) { const p = parentOf.get(id); return p && scope(p) === 'external' && !first.has(p) ? railOf(p) : 'L'; }
  if (outs.length) return 'L';
  return ins.every((e) => e.kind === 'observation') ? 'B' : 'R';
};
const offExt = G.nodes.map((n) => n.id).filter((id) => !first.has(id) && scope(id) === 'external');
const wantRail = Object.fromEntries(offExt.map((id) => [id, railOf(id)]));
const badRail = offExt.filter((id) => P[id].region !== wantRail[id]);
const tally = { L: 0, R: 0, B: 0 }; offExt.forEach((id) => tally[wantRail[id]]++);
check(`every off-path external block (${offExt.length}) is on the rail its declared edges say (left ${tally.L}, right ${tally.R}, bottom ${tally.B})`, offExt.length > 0 && badRail.length === 0, badRail.slice(0, 3).map((id) => `${id} wants ${wantRail[id]} has ${P[id].region}`).join(', '));
const lastStageCol = SP.length - 1, maxColRow = Math.max(...G.nodes.map((n) => n.id).filter((id) => P[id].region === 'C').map((id) => P[id].row));
check('no railed block sits in a column: left is before column 0, right after the last, the strip under every column row', offExt.every((id) => ({ L: P[id].col < 0, R: P[id].col > lastStageCol, B: P[id].row > maxColRow })[wantRail[id]]) && G.nodes.every((n) => (P[n.id].region === 'C') === (first.has(n.id) || (scope(n.id) !== 'external' && P[n.id].region !== 'T'))));
const both = offExt.filter((id) => engineEdges(id).some((e) => e.src === id) && engineEdges(id).some((e) => e.dst === id));
check(`the both-ways blocks are listed and on the left (${both.length}: ${both.map((id) => P[id] && G.nodes.find((n) => n.id === id).path).join(', ')})`, [...lay.bothWays].sort().join() === [...both].sort().join() && both.every((id) => P[id].region === 'L'));
// Rail order: by the column of the earliest engine neighbour, then id.
const pathOf = (id) => G.nodes.find((n) => n.id === id).path;
const earlyCol = (id) => { const c = engineEdges(id).map((e) => P[e.src === id ? e.dst : e.src]).filter((p) => p.region === 'C').map((p) => p.col); return c.length ? Math.min(...c) : parentOf.has(id) && wantRail[parentOf.get(id)] ? earlyCol(parentOf.get(id)) : Infinity; };
const railOrderOk = ['L', 'R'].every((r) => { const want = offExt.filter((id) => wantRail[id] === r).sort((a, b) => earlyCol(a) - earlyCol(b) || (pathOf(a) < pathOf(b) ? -1 : 1)); const have = offExt.filter((id) => wantRail[id] === r).sort((a, b) => P[a].row - P[b].row); return want.join() === have.join(); });
check('each rail is ordered by the column of its earliest engine neighbour, then id', railOrderOk);

// ---- off-path engine blocks: the lower median of the columns of the neighbours placed when its round starts
// (re-derived here from the declaration alone: spine columns first, then BFS rounds in node order).
const col = new Map([...first].map(([id, i]) => [id, i])), side = new Map([...first].map(([id]) => [id, 0]));
const engineOff = G.nodes.map((n) => n.id).filter((id) => !first.has(id) && scope(id) !== 'external');
const wantCol = new Map(), wantSide = new Map();
for (let more = true; more;) {
  more = false; const round = [];
  for (const id of engineOff) {
    if (col.has(id)) continue;
    const per = new Map();
    for (const e of G.edges) { if (e.src === e.dst || (e.src !== id && e.dst !== id)) continue; const o = e.src === id ? e.dst : e.src; if (col.has(o) && (!per.has(o) || e.id < per.get(o).e.id)) per.set(o, { o, e }); }
    if (!per.size) continue;
    const cs = [...per.values()].sort((a, b) => col.get(a.o) - col.get(b.o) || (a.e.id < b.e.id ? -1 : 1)), m = col.get(cs[Math.floor((cs.length - 1) / 2)].o), pick = cs.find((x) => col.get(x.o) === m);
    round.push([id, m, side.get(pick.o) === 0 ? (pick.e.src === id ? -1 : 1) : side.get(pick.o)]);
  }
  for (const [id, m, sd] of round) { col.set(id, m); side.set(id, sd); wantCol.set(id, m); wantSide.set(id, sd); more = true; }
}
const badMed = [...wantCol].filter(([id, m]) => P[id].col !== m || P[id].side !== wantSide.get(id));
check(`every off-path engine block (${wantCol.size}) is at the lower-median column of its placed neighbours, above/below by its edge`, wantCol.size > 0 && badMed.length === 0, badMed.slice(0, 3).map(([id, m]) => `${pathOf(id)} wants ${m}/${wantSide.get(id)} has ${P[id].col}/${P[id].side}`).join(', '));
const hung = engineOff.filter((id) => !wantCol.has(id) && P[id].region === 'C');
const badHung = hung.filter((id) => { const mem = descendants(id).filter((r) => col.has(r)), rel = mem.length ? mem : [parentOf.get(id)].filter((r) => r && col.has(r)); return !rel.length || P[id].col !== Math.min(...rel.map((r) => col.get(r))); });
check(`an engine block with no placed neighbour hangs at its own placed members' earliest column (a container), else its parent's (${hung.length}), else the tray`, badHung.length === 0 && (lay.tray === null || lay.tray.ids.every((id) => P[id].region === 'T' && !parentOf.has(id) && !descendants(id).length)), badHung.slice(0, 3).map(pathOf).join(', '));

// ---- boxes: one per container per region its members stand in; a container whose own node stands elsewhere is continued
const R = (id) => P[id];
const enc = (o, a) => a.x >= o.x - 0.01 && a.y >= o.y - 0.01 && a.x + a.w <= o.x + o.w + 0.01 && a.y + a.h <= o.y + o.h + 0.01;
const regionsOf = (c) => [...new Set([c, ...descendants(c)].map((d) => P[d].region))];
const wantBoxes = containers.flatMap((c) => regionsOf(c).map((r) => c + '|' + r));
const boxOf = new Map(lay.boxes.map((b) => [b.key, b]));
check(`one box per container per region it stands in (${wantBoxes.length} boxes for ${containers.length} containers)`, lay.boxes.length === wantBoxes.length && wantBoxes.every((k) => boxOf.has(k)));
const notEnc = lay.boxes.flatMap((b) => [b.id, ...descendants(b.id)].filter((d) => P[d].region === b.region && !enc(b, R(d))).map((d) => `${b.key}:${d}`));
check('every box encloses its container\'s own node (if it stands there) and all its descendants\' nodes in its region', notEnc.length === 0, notEnc.slice(0, 3).join(', '));
const contBad = lay.boxes.filter((b) => b.continued !== (P[b.id].region !== b.region));
const split = containers.filter((c) => regionsOf(c).length > 1);
check(`a container standing in several regions has one own box and dashed continued boxes, never one box stretched across (${split.length}: ${split.map(pathOf).join(', ')})`, contBad.length === 0 && split.every((c) => regionsOf(c).every((r) => boxOf.has(c + '|' + r) && boxOf.get(c + '|' + r).continued === (P[c].region !== r))));
const stretched = lay.boxes.filter((b) => G.nodes.some((n) => P[n.id].region !== b.region && [b.id, ...descendants(b.id)].includes(n.id) && touchR(b, R(n.id))));
function touchR(a, b) { return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h; }
check('no box covers a member standing in another region', stretched.length === 0, stretched.slice(0, 3).map((b) => b.key).join(', '));
const notNest = lay.boxes.filter((b) => parentOf.has(b.id) && boxOf.has(parentOf.get(b.id) + '|' + b.region)).filter((b) => !enc(boxOf.get(parentOf.get(b.id) + '|' + b.region), b));
check('every nested box lies inside its parent\'s box in the same region', notNest.length === 0, notNest.slice(0, 3).map((b) => b.key).join(', '));
const touch = touchR;
const ids = G.nodes.map((n) => n.id), clash = [];
for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) if (touch(R(ids[a]), R(ids[b]))) clash.push(`${ids[a]} / ${ids[b]}`);
check('no two node boxes overlap', clash.length === 0, clash.slice(0, 3).join(', '));
// Overlaps are reported, not hidden: recomputed here from the boxes' own rectangles.
const relC = (a, b) => [a, ...descendants(a)].includes(b) || [b, ...descendants(b)].includes(a);
const want = []; for (let a = 0; a < lay.boxes.length; a++) for (let b = a + 1; b < lay.boxes.length; b++) { const A = lay.boxes[a], B = lay.boxes[b]; if (!relC(A.id, B.id) && touch(A, B)) want.push([A.key, B.key].sort().join('~')); }
const got = lay.overlaps.map((p) => [...p].sort().join('~'));
check(`every box overlap is reported in layout.overlaps (${want.length} found)`, want.length === got.length && want.every((w) => got.includes(w)));
const wantIn = lay.boxes.flatMap((b) => ids.filter((id) => ![b.id, ...descendants(b.id)].includes(id) && touch(b, R(id))).map((id) => b.key + '|' + id));
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

const K = lay.counts;
console.log(`layout: ${K.columns} columns, band ${K.band} rows, ${K.above} rows above, ${K.below} rows below; rails left ${K.left} (${K.bothWays} both ways), right ${K.right}, bottom ${K.bottom}; tray ${K.tray}; ${K.boxes} boxes (${K.continued} continued); ${K.overlaps} box overlaps, ${K.intrusions} intrusions`);
if (failed) { console.error(`${failed} check(s) failed`); process.exit(1); }
