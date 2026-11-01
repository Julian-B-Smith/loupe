// The "Signal path" view (design/prototype/spine.js, ROADMAP Q-015). Properties of the layout, stated in Julian's words
// and checked against the declaration directly (graph.declaration.signalPath, node `declared` fields, edge endpoints and
// kinds), not by re-running the layout's algorithm; the few facts only the layout can supply (a block's BFS round, the
// neighbour it hangs from) are checked for consistency with the declaration. Then a few small synthetic snapshots put
// blocks on the branches the real snapshot does not reach (Outputs, an isolated block).
// Run: node tools/spine.test.mjs
import { readFileSync } from 'node:fs';
import { deepStrictEqual } from 'node:assert';
import { indexSnapshot } from '../design/prototype/snapshot.js';
import { SPEC } from '../design/prototype/render.js';
import { layoutSpine, renderSpine, spineLegendHtml, stepZoom, DECLARED_EDGE_SLOT, DECLARED_DASH, UNDECIDED_LABEL } from '../design/prototype/spine.js';
import { conserve } from '../design/prototype/standins.js';

let failed = 0;
const check = (name, cond, why = '') => { console.log(`${cond ? 'pass' : 'FAIL'}  ${name}${!cond && why ? ' — ' + why : ''}`); if (!cond) failed++; };
const dir = 'design/prototype/snapshots/engine2-structure/';
const j = (f) => JSON.parse(readFileSync(dir + f, 'utf8'));
const build = (graph, overlay = null) => indexSnapshot({ graph, overlay, view: { elements: [] }, stages: null, diff: null, hashes: {} });
const load = () => build(j('graph.json'), j('overlay.json'));
const data = load();
globalThis.document = { createElement: () => ({}) };
const stage = (d, lay, state = { view: 'spine', stage: 2, settings: {}, zoom: { auto: true } }) => {
  const layer = { innerHTML: '' }, container = { querySelector: () => layer, appendChild() {}, clientWidth: 1440, clientHeight: 900 };
  const map = renderSpine(container, d, state, lay);
  return { map, html: layer.innerHTML, c: conserve(d, state, map) };
};

// ---- the declaration, read straight from the snapshot's graph
const G = data.graph, SP = G.declaration.signalPath;
const byPath = new Map(G.nodes.map((n) => [n.path, n.id]));
const declEdge = new Map(G.edges.map((e) => [e.evidence[0].id, e]));
const named = (x) => (byPath.has(x) ? [byPath.get(x)] : declEdge.has(x) ? [declEdge.get(x).src, declEdge.get(x).dst] : []);
const scope = (id) => G.nodes.find((n) => n.id === id).declared.scope;
const pathOf = (id) => G.nodes.find((n) => n.id === id).path;
const parentOf = new Map(G.nodes.filter((n) => n.declared.parent != null).map((n) => [n.id, byPath.get(n.declared.parent)]));
const descendants = (id) => [...parentOf].filter(([, p]) => p === id).flatMap(([c]) => [c, ...descendants(c)]);
const containers = [...new Set(parentOf.values())];
const ids = G.nodes.map((n) => n.id);

const lay = layoutSpine(data);
const P = lay.pos;

check('same input, same layout (deep-equal, twice, from fresh loads)', (() => { try { deepStrictEqual(layoutSpine(load()), layoutSpine(load())); return true; } catch { return false; } })());
check(`every node is placed exactly once (${ids.length} nodes)`, Object.keys(P).length === ids.length && ids.every((id) => P[id] && Number.isFinite(P[id].x) && Number.isFinite(P[id].y)));
check(`every stage has a column (${SP.length} stages, distinct and increasing)`, lay.stages.length === SP.length && lay.stages.every((s, i) => s.i === i && (i === 0 || s.x > lay.stages[i - 1].x)));

// A spine block sits in the column of the first stage that names it, whatever its scope.
const first = new Map();
SP.forEach((st, i) => st.ids.forEach((x) => named(x).forEach((id) => { if (!first.has(id)) first.set(id, i); })));
const wrongSpine = [...first].filter(([id, i]) => P[id].col !== i || P[id].side !== 0 || P[id].region !== 'C');
check(`every spine block (${first.size}) is in the column of the first stage that names it, external ones too`, wrongSpine.length === 0, wrongSpine.slice(0, 3).map(([id, i]) => `${id} wants ${i} has ${P[id].col}`).join(', '));
check('items of one column stack in the order its stage names them', SP.every((st, i) => { const fresh = []; st.ids.forEach((x) => named(x).forEach((id) => { if (first.get(id) === i && !fresh.includes(id)) fresh.push(id); })); return fresh.every((id, k) => P[id].row === k); }));

// ---- external blocks off the path: a rail only where the declared direction says so, else undecided
const engineEdges = (id, g = G) => g.edges.filter((e) => e.src !== e.dst && (e.src === id ? scope(e.dst) !== 'external' : e.dst === id && scope(e.src) !== 'external'));
const offExt = ids.filter((id) => !first.has(id) && scope(id) === 'external');
const on = (r) => offExt.filter((id) => P[id].region === r);
const inputsOk = on('L').every((id) => { const es = engineEdges(id); return es.length > 0 && es.every((e) => e.src === id); });
const outputsOk = on('R').every((id) => { const es = engineEdges(id); return es.length > 0 && es.every((e) => e.dst === id) && !es.every((e) => e.kind === 'observation'); });
const observersOk = on('B').every((id) => { const es = engineEdges(id); return es.length > 0 && es.every((e) => e.dst === id && e.kind === 'observation'); });
check(`every block on Inputs (${on('L').length}) has a declared edge out of it into the engine and none into it`, inputsOk);
check(`every block on Outputs (${on('R').length}) has declared edges into it from the engine only, not all observations`, outputsOk);
check(`every block on Observers (${on('B').length}) has only observation edges into it from the engine`, observersOk);
check('an off-path external block is on a rail or undecided, never in a column', offExt.every((id) => ['L', 'R', 'B', 'U'].includes(P[id].region)));
check('rails stand outside the columns: Inputs before column 0, Outputs after the last stage, Observers under every column row', (() => {
  const maxRow = Math.max(...ids.filter((id) => P[id].region === 'C').map((id) => P[id].row));
  return on('L').every((id) => P[id].col < 0) && on('R').every((id) => P[id].col >= SP.length) && on('B').every((id) => P[id].row > maxRow);
})());

// ---- undecided: each reason is true of the declaration
const U = lay.undecided;
const hintOf = new Map(U.map((u) => [u.id, u.hint]));
const colT = (id) => (P[id].region === 'C' ? P[id].col : hintOf.get(id) ?? null);
const reasonTrue = (u) => {
  const id = u.id, es = engineEdges(id);
  if (scope(id) === 'external') return !first.has(id) && (es.length === 0 || (es.some((e) => e.src === id) && es.some((e) => e.dst === id)));
  const cn = G.edges.filter((e) => e.src !== e.dst && (e.src === id || e.dst === id)).map((e) => ({ o: e.src === id ? e.dst : e.src, out: e.src === id }));
  if (/tie-break/.test(u.reason)) { const at = cn.filter((x) => P[x.o].region === 'C' && P[x.o].side === 0 && P[x.o].col === u.hint); return at.some((x) => cn.some((y) => y.o === x.o && y.out !== x.out)); }
  const rel = descendants(id).map(colT).filter((c) => c != null), par = parentOf.has(id) && colT(parentOf.get(id)) != null ? [colT(parentOf.get(id))] : [];
  const want = rel.length ? Math.min(...rel) : par.length ? par[0] : null;
  return !cn.some((x) => P[x.o].region === 'C') && (u.hint ?? null) === want;
};
const badU = U.filter((u) => !reasonTrue(u));
check(`every undecided block's reason is true of the declaration (${U.length}: ${U.map((u) => pathOf(u.id)).join(', ')})`, U.length > 0 && badU.length === 0, badU.slice(0, 3).map((u) => pathOf(u.id)).join(', '));
check('no block is decidable but left undecided: every external off-path block with a one-way declared direction is on a rail', offExt.every((id) => { const es = engineEdges(id); const oneWay = es.length > 0 && (es.every((e) => e.src === id) || es.every((e) => e.dst === id)); return !oneWay || P[id].region !== 'U'; }));
check('undecided blocks stand in their own strip under every other row, with their reason in the markup', (() => {
  const maxRow = Math.max(...ids.filter((id) => P[id].region !== 'U').map((id) => P[id].row));
  const { html } = stage(data, lay);
  return U.every((u) => P[u.id].region === 'U' && P[u.id].row > maxRow && html.includes('PLACEMENT NOT DECIDED: ' + u.reason.replace(/&/g, '&amp;').replace(/>/g, '&gt;'))) && html.includes(UNDECIDED_LABEL[0].toUpperCase() + UNDECIDED_LABEL.slice(1));
})());

// ---- off-path engine blocks: the lower median of the columns of their placed neighbours
const col = (id) => P[id].col;
const nbrsC = (id) => [...new Set(G.edges.filter((e) => e.src !== e.dst && (e.src === id || e.dst === id)).map((e) => (e.src === id ? e.dst : e.src)))].filter((o) => P[o].region === 'C');
const hung = ids.filter((id) => P[id].region === 'C' && !first.has(id));
const lowerMedian = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor((s.length - 1) / 2)]; };
const badMed = [], badRound = [], badSide = [];
for (const id of hung) {
  const r = P[id].round, early = nbrsC(id).filter((o) => P[o].round != null && P[o].round < r);
  if (!(r >= 1) || !early.length) { badRound.push(id); continue; }
  if (r !== 1 + Math.min(...nbrsC(id).filter((o) => P[o].round != null).map((o) => P[o].round))) badRound.push(id);
  if (col(id) !== lowerMedian(early.map(col))) badMed.push(`${pathOf(id)} wants ${lowerMedian(early.map(col))} has ${col(id)}`);
  const via = P[id].via, at = early.filter((o) => col(o) === col(id));
  if (!at.includes(via)) { badSide.push(id); continue; }
  if (P[via].side === 0) {
    const dirs = new Set(G.edges.filter((e) => e.src !== e.dst && at.some((o) => (e.src === id && e.dst === o) || (e.dst === id && e.src === o))).map((e) => (e.src === id ? -1 : 1)));
    if (dirs.size !== 1 || P[id].side !== [...dirs][0]) badSide.push(id);
  } else if (P[id].side !== P[via].side || P[id].depth <= P[via].depth) badSide.push(id);
}
check(`every off-path engine block (${hung.length}) is at the lower-median column of the neighbours placed before it`, hung.length > 0 && badMed.length === 0 && badRound.length === 0, badMed.slice(0, 3).concat(badRound.slice(0, 3).map(pathOf)).join(', '));
check('its side is the direction of its declared edges to the neighbour that sets its column (one way only), or that neighbour\'s side one row further out', badSide.length === 0, badSide.slice(0, 3).map(pathOf).join(', '));
const ring1 = hung.filter((id) => P[id].round === 1), groups = new Map();
ring1.forEach((id) => { const k = col(id) + ':' + P[id].side; groups.set(k, [...(groups.get(k) || []), id]); });
const stackBad = [...groups.values()].filter((g) => { const want = [...g].sort((a, b) => P[P[a].via].row - P[P[b].via].row || (pathOf(a) < pathOf(b) ? -1 : 1)); const have = [...g].sort((a, b) => P[a].depth - P[b].depth); return want.join() !== have.join() || have.some((id, k) => P[id].depth !== k + 1); });
check(`blocks hanging off one spine column stack by the declared stage order of the block they hang from, then by id (${groups.size} groups)`, stackBad.length === 0);

// ---- boxes: one per container per region its members stand in; a container whose own node stands elsewhere is continued
const R = (id) => P[id];
const enc = (o, a) => a.x >= o.x - 0.01 && a.y >= o.y - 0.01 && a.x + a.w <= o.x + o.w + 0.01 && a.y + a.h <= o.y + o.h + 0.01;
const touch = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const regionsOf = (c) => [...new Set([c, ...descendants(c)].map((d) => P[d].region))];
const wantBoxes = containers.flatMap((c) => regionsOf(c).map((r) => c + '|' + r));
const boxOf = new Map(lay.boxes.map((b) => [b.key, b]));
check(`one box per container per region it stands in (${wantBoxes.length} boxes for ${containers.length} containers)`, lay.boxes.length === wantBoxes.length && wantBoxes.every((k) => boxOf.has(k)));
const notEnc = lay.boxes.flatMap((b) => [b.id, ...descendants(b.id)].filter((d) => P[d].region === b.region && !enc(b, R(d))).map((d) => `${b.key}:${d}`));
check('every box encloses its container\'s own node (if it stands there) and all its descendants\' nodes in its region', notEnc.length === 0, notEnc.slice(0, 3).join(', '));
const split = containers.filter((c) => regionsOf(c).length > 1);
check(`a container standing in several regions has one own box and dashed continued boxes, never one box stretched across (${split.length}: ${split.map(pathOf).join(', ')})`, lay.boxes.every((b) => b.continued === (P[b.id].region !== b.region)) && split.every((c) => regionsOf(c).every((r) => boxOf.get(c + '|' + r).continued === (P[c].region !== r))));
const stretched = lay.boxes.filter((b) => ids.some((id) => P[id].region !== b.region && [b.id, ...descendants(b.id)].includes(id) && touch(b, R(id))));
check('no box covers a member standing in another region', stretched.length === 0, stretched.slice(0, 3).map((b) => b.key).join(', '));
const notNest = lay.boxes.filter((b) => parentOf.has(b.id) && boxOf.has(parentOf.get(b.id) + '|' + b.region)).filter((b) => !enc(boxOf.get(parentOf.get(b.id) + '|' + b.region), b));
check('every nested box lies inside its parent\'s box in the same region', notNest.length === 0, notNest.slice(0, 3).map((b) => b.key).join(', '));
const clash = []; for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) if (touch(R(ids[a]), R(ids[b]))) clash.push(`${ids[a]} / ${ids[b]}`);
check('no two node boxes overlap', clash.length === 0, clash.slice(0, 3).join(', '));
const relC = (a, b) => [a, ...descendants(a)].includes(b) || [b, ...descendants(b)].includes(a);
const want = []; for (let a = 0; a < lay.boxes.length; a++) for (let b = a + 1; b < lay.boxes.length; b++) { const A = lay.boxes[a], B = lay.boxes[b]; if (!relC(A.id, B.id) && touch(A, B)) want.push([A.key, B.key].sort().join('~')); }
const got = lay.overlaps.map((p) => [...p].sort().join('~'));
check(`every box overlap is reported in layout.overlaps (${want.length} found)`, want.length === got.length && want.every((w) => got.includes(w)));
const wantIn = lay.boxes.flatMap((b) => ids.filter((id) => ![b.id, ...descendants(b.id)].includes(id) && touch(b, R(id))).map((id) => b.key + '|' + id));
check(`every node standing inside a box it is not a member of is reported in layout.intrusions (${wantIn.length} pairs)`, wantIn.length === lay.intrusions.length && wantIn.every((w) => lay.intrusions.some((p) => p.join('|') === w)));

// ---- edge geometry, measured here on the drawn polylines (not through spine.js's own check)
const segsOf = (e) => { const pts = lay.routes[e.id], out = []; for (let i = 1; i < pts.length; i++) out.push({ id: e.id, a: pts[i - 1], b: pts[i] }); return out; };
const geo = { orth: [], through: [], shared: [], ends: [] };
for (const e of data.edges) {
  const pts = lay.routes[e.id], S = P[e.src], D = P[e.dst];
  if (!pts || pts.length < 2) { geo.orth.push(e.id); continue; }
  const side = (p, n) => (Math.abs(p[0] - n.x) < 0.06 || Math.abs(p[0] - (n.x + n.w)) < 0.06) && p[1] > n.y && p[1] < n.y + n.h;
  if (!side(pts[0], S) || !side(pts[pts.length - 1], D)) geo.ends.push(e.id);
  for (const s of segsOf(e)) {
    if (s.a[0] !== s.b[0] && s.a[1] !== s.b[1]) geo.orth.push(e.id);
    const len = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]), n = Math.max(1, Math.ceil(len / 2));
    for (let k = 0; k <= n; k++) {
      const x = s.a[0] + (s.b[0] - s.a[0]) * k / n, y = s.a[1] + (s.b[1] - s.a[1]) * k / n;
      for (const id of ids) { if (id === e.src || id === e.dst) continue; const r = P[id]; if (x > r.x + 0.5 && x < r.x + r.w - 0.5 && y > r.y + 0.5 && y < r.y + r.h - 0.5) geo.through.push(`${e.id} through ${id}`); }
    }
  }
}
const allSegs = data.edges.flatMap(segsOf);
for (let a = 0; a < allSegs.length; a++) for (let b = a + 1; b < allSegs.length; b++) {
  const p = allSegs[a], q = allSegs[b]; if (p.id === q.id) continue;
  const ph = p.a[1] === p.b[1], qh = q.a[1] === q.b[1]; if (ph !== qh) continue;
  const f = ph ? 1 : 0, g = ph ? 0 : 1; // f: the shared coordinate, g: the running one
  if (Math.abs(p.a[f] - q.a[f]) > 0.05) continue;
  const ov = Math.min(Math.max(p.a[g], p.b[g]), Math.max(q.a[g], q.b[g])) - Math.max(Math.min(p.a[g], p.b[g]), Math.min(q.a[g], q.b[g]));
  if (ov > 3) geo.shared.push(`${p.id} / ${q.id}`);
}
const opp = G.edges.filter((e) => e.src !== e.dst && G.edges.some((o) => o.src === e.dst && o.dst === e.src && o.id > e.id));
check(`every edge route is orthogonal and starts and ends on its own blocks' sides (${data.edges.length} edges)`, geo.orth.length === 0 && geo.ends.length === 0, [...geo.orth, ...geo.ends].slice(0, 3).join(', '));
check('no edge passes through a block it does not end at', geo.through.length === 0, geo.through.slice(0, 3).join(', '));
check('no two edges share a stretch of line longer than a few units', geo.shared.length === 0, geo.shared.slice(0, 3).join(', '));
check(`opposite edges between one pair of blocks run on distinct lines (${opp.length} pairs)`, opp.length > 0 && opp.every((e) => { const o = G.edges.find((x) => x.src === e.dst && x.dst === e.src); return JSON.stringify(lay.routes[e.id]) !== JSON.stringify(lay.routes[o.id]); }));
const self = G.edges.find((e) => e.src === e.dst), sp0 = lay.routes[self.id];
check('the self-edge is a loop on its own block (leaves and returns to the same side)', sp0.length >= 4 && sp0[0][0] === sp0[sp0.length - 1][0] && sp0[0][1] !== sp0[sp0.length - 1][1]);

// ---- render with a stub DOM
const { map, html, c } = stage(data, lay);
check(`the meter balances: ${c.accounted} of ${c.edges.total} edges, ${c.nodes.placed} of ${c.nodes.total} nodes accounted`, c.status === 'balanced' && c.accounted === data.edges.length && c.nodes.placed === data.nodeIds.length, c.unaccounted.slice(0, 3).join(', '));
check('an edge whose route breaks the geometry rule is NOT counted drawn (conserve() reports it)', (() => {
  const bad = JSON.parse(JSON.stringify(lay)), e = data.edges.find((x) => x.src !== x.dst), S = P[e.src], D = P[e.dst];
  bad.routes[e.id] = [[S.x + S.w, S.y + S.h / 2], [D.x, D.y + D.h / 2]]; // a straight run: not orthogonal
  const t = stage(data, bad);
  return t.c.status === 'broken' && t.c.unaccounted.includes(e.id);
})());
const count = (re) => (html.match(re) || []).length;
check('the markup carries a data-edge for every edge and a data-node for every node, once each', count(/data-edge="/g) === data.edges.length && count(/data-node="/g) === data.nodeIds.length && data.edges.every((e) => html.includes(`data-edge="${e.id}"`)) && data.nodeIds.every((id) => html.includes(`data-node="${id}"`)));
check('every edge kind has a token slot, and the markup holds no literal colour', G.edges.every((e) => DECLARED_EDGE_SLOT[e.kind]) && !/#[0-9a-f]{3,8}\b|rgb\(|hsl\(/i.test(html));
check('every block inside a box it is not a member of carries a mark with a title saying so', (() => {
  const nodes = [...new Set(lay.intrusions.map((p) => p[1]))];
  return nodes.length > 0 && nodes.every((id) => { const m = html.split(`data-intrusion="${id}"`)[1]; return m && /<title>inside [^<]*'s box, not a member of it<\/title>/.test(m.split('</g>')[0]); }) && count(/data-intrusion="/g) === nodes.length;
})());
// A later stage that names a block again leaves one mark per block it names (stage 45 names `output` again beside the new makeup).
const seen = new Set(), refsByStage = SP.map((st) => { const out = []; st.ids.forEach((x) => named(x).forEach((id) => { if (seen.has(id) && !out.includes(id)) out.push(id); })); st.ids.forEach((x) => named(x).forEach((id) => seen.add(id))); return out; });
check(`a later stage names a placed block again: one dotted chip per block per stage (${refsByStage.reduce((n, r) => n + r.length, 0)} chips)`, refsByStage.every((r, i) => count(new RegExp(`data-ref="${i}"`, 'g')) === r.length) && refsByStage.some((r) => r.length));
check('stage `output->makeup` carries a chip on the already-placed output', (() => { const i = SP.findIndex((s) => s.ids.includes('output->makeup')); return i >= 0 && new RegExp(`data-ref="${i}" data-refnode="${byPath.get('output')}"`).test(html); })());

// ---- one dash per meaning, each edge its own provenance, unknown kinds neutral
const dashes = Object.values(SPEC.dash);
check('the declared dash is its own pattern, distinct from every existing provenance dash', !dashes.includes(DECLARED_DASH) && SPEC.dash.static === 'none');
check('the declared edges draw with the declared dash', data.edges.every((e) => e.provenance === 'declared') && count(new RegExp(`stroke-dasharray:${DECLARED_DASH.replace(/ /g, ' ')};pointer-events:none`, 'g')) === data.edges.length);
{
  const g2 = JSON.parse(JSON.stringify(G)); g2.edges[0].provenance = 'inferred'; g2.edges[1].kind = 'weird';
  const d2 = build(g2, null), l2 = layoutSpine(d2), t = stage(d2, l2);
  const grp = (e) => t.html.split(`data-edge="${e.id}"`)[1].split('</g>')[0];
  check('an edge of another provenance draws with ITS dash, never the declared one', grp(g2.edges[0]).includes(`stroke-dasharray:${SPEC.dash.inferred}`) && !grp(g2.edges[0]).includes(DECLARED_DASH));
  check('an edge of an unknown kind takes the neutral ink and says so, not observation\'s slot', grp(g2.edges[1]).includes('marker-end="url(#sp-unknown)"') && grp(g2.edges[1]).includes('--loupe-ink-muted') && grp(g2.edges[1]).includes('kind not in the list'));
}
const key = spineLegendHtml(), closed = spineLegendHtml(true);
check('the key names every meaning, and the provenance strip stays when it is closed', ['declared', 'static', 'config', 'runtime', 'annotated', 'inferred', 'slot: reserved', 'external block', 'box: a declared parent', 'dashed box', 'shaded band', 'marked block', 'dotted chip', UNDECIDED_LABEL, 'Inputs', 'Outputs', 'Observers', 'stage order', 'edge of another kind'].every((t) => key.includes(t)) && (closed.match(/<span title=/g) || []).length === 6 && !closed.includes('class="col"'));
check('slot nodes, continued boxes, the undecided strip and reference chips use four different patterns', new Set([SPEC.dash.gap, SPEC.dash.config, SPEC.dash.runtime]).size === 3 && html.includes(`stroke-dasharray:${SPEC.dash.config}`) && html.includes(`stroke-dasharray:${SPEC.dash.gap}`) && html.includes(`stroke-dasharray:${SPEC.dash.runtime}`) && /data-undecided[^>]*><rect[^>]*--loupe-state-warn[^>]*stroke-width:1.5px"\/>/.test(html) && !/data-undecided[^>]*><rect[^>]*stroke-dasharray/.test(html));

// ---- the camera: opens readable at stage 1, fit shows the whole, zooming out never zooms in
check('opens at about 100% at stage 1; fit is a separate, smaller camera over the whole diagram', map.zoom.k >= 0.8 && map.zoom.x >= 0 && map.zoom.x < 100 && map.spine.fit.k < 0.3 && lay.w * map.spine.fit.k + map.spine.fit.x <= 1440 + 0.5 && lay.h * map.spine.fit.k + map.spine.fit.y <= 900 + 0.5);
check('zooming out never zooms in (also below the usual floor), zooming in stops at the ceiling', [0.05, 0.1, 0.12, 0.2, 1, 3.9].every((k) => stepZoom(k, 0.8, Math.min(0.12, 0.14)) <= k) && stepZoom(0.1, 0.8, 0.12) <= 0.1 && stepZoom(0.14, 0.5, 0.12) === 0.12 && stepZoom(3.9, 1.25) === 4 && stepZoom(1, 1.25) === 1.25);

// ---- synthetic snapshots: the branches the engine2 snapshot does not reach
const syn = () => {
  const N = (id, scp, parent = null, kind = 'block') => ({ id: 'decl:' + id, kind, path: id, hash: 'none', declared: { label: id, scope: scp, multiplicity: null, cites: [], parent } });
  const E = (a, b, kind = 'audio') => ({ id: `e:${a}>${b}:${kind}`, src: 'decl:' + a, dst: 'decl:' + b, kind, provenance: 'declared', evidence: [{ type: 'declaration', path: 'x', id: `${a}->${b}`, cites: [] }] });
  const nodes = [N('a', 'engine'), N('b', 'engine'), N('c', 'engine'), N('src_ext', 'external'), N('sink_ext', 'external'), N('watch_ext', 'external'), N('both_ext', 'external'), N('lone_ext', 'external'),
    N('hang', 'engine'), N('h2', 'engine'), N('aa1', 'engine'), N('zz1', 'engine'), N('twoway', 'engine'), N('alone', 'engine'), N('sink2_ext', 'external')];
  const edges = [E('a', 'b'), E('b', 'c'), E('src_ext', 'a'), E('c', 'sink_ext'), E('b', 'watch_ext', 'observation'), E('a', 'both_ext'), E('both_ext', 'b'), E('hang', 'b'), E('h2', 'a'), E('aa1', 'b'), E('zz1', 'b'),
    E('b', 'twoway'), E('twoway', 'b'), E('c', 'sink2_ext'), E('b', 'sink2_ext', 'control')];
  const graph = { schema: 'loupe.graph/0.4-draft', source: { repo: 'x', commit: 'c', commitTime: 't', dirty: false }, declaration: { signalPath: [{ stage: 'one', ids: ['a->b'] }, { stage: 'two', ids: ['c'] }] }, nodes, edges };
  return build(graph, null);
};
{
  const d = syn(), l = layoutSpine(d), p = l.pos, why = Object.fromEntries(l.undecided.map((u) => [u.id.slice(5), u.reason]));
  check('synthetic: a block every engine edge into which comes from the engine stands on Outputs, an observer under Observers, an input on Inputs', p['decl:sink_ext'].region === 'R' && p['decl:sink2_ext'].region === 'R' && p['decl:watch_ext'].region === 'B' && p['decl:src_ext'].region === 'L');
  check('synthetic: an external block with edges both ways, and one with no edge, are undecided with a true reason', why.both_ext && /both out of it/.test(why.both_ext) && why.lone_ext && /no declared edge to an engine block/.test(why.lone_ext) && p['decl:both_ext'].region === 'U' && p['decl:lone_ext'].region === 'U');
  check('synthetic: an isolated engine block is undecided with no column; one whose edges run both ways to its neighbour is undecided on a tie-break', why.alone && /nothing in the declaration places it/.test(why.alone) && why.twoway && /tie-break/.test(why.twoway) && p['decl:hang'].region === 'C' && p['decl:hang'].side === -1);
  const order = ['h2', 'aa1', 'hang', 'zz1'];
  check('synthetic: blocks hanging in one column stack by the stage order of the block they hang from (a above b), then by id', order.every((id, k) => p['decl:' + id].side === -1 && p['decl:' + id].depth === k + 1), order.map((id) => p['decl:' + id].depth).join());
  const t = stage(d, l);
  check('synthetic: the meter balances and no route is faulty', t.c.status === 'balanced' && Object.keys(t.map.spine.faults).length === 0, JSON.stringify(t.map.spine.faults));
}

const K = lay.counts;
console.log(`layout: ${K.columns} columns, band ${K.band} rows, ${K.above} rows above, ${K.below} rows below; Inputs ${K.left}, Outputs ${K.right}, Observers ${K.bottom}; undecided ${K.undecided}; ${K.boxes} boxes (${K.continued} continued); ${K.overlaps} box overlaps, ${K.intrusions} marked blocks; edge faults: ${geo.orth.length + geo.ends.length} not orthogonal/on-block, ${geo.through.length} through a block, ${geo.shared.length} shared lines; lanes up to ${K.maxLanesV} wide, ${K.maxLanesH} high`);
if (failed) { console.error(`${failed} check(s) failed`); process.exit(1); }
