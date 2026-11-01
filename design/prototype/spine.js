// The "Signal path" view for structure snapshots (ROADMAP Q-015; Julian, poll 2026-10-31: "spine from the spec").
// layoutSpine(data) is pure and deterministic: no DOM, no clock, no randomness. Only the declared stage order
// (graph.declaration.signalPath), the declared edges, the declared scope and the declared parents decide where anything
// goes: nothing is inferred. What the declaration does not decide is not guessed: it goes to the "undecided" strip with
// its reason. renderSpine(container, data, state, lay) draws that layout as SVG and returns an element map shaped like
// renderWorks's, so conserve() (standins.js) checks it the same way as every other view.
import { SPEC } from './render.js';
import { SPECS } from './specs.js';

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const v = n => `var(--loupe-${n})`;
const f1 = n => Math.round(n * 10) / 10;

// PROPOSAL, awaiting the design review (nothing here is in tokens.json or a loupe-spec block yet): which existing edge
// slot each declared edge kind takes. audio is slot 3 as everywhere; control/modulation reuse the param and mod slots
// (SPEC.slot.role); event takes the call slot; observation takes the reference slot. A kind outside this list does not
// borrow any of them: it draws in the neutral ink below and its title says so.
export const DECLARED_EDGE_SLOT = { audio: 'edge-3', control: 'edge-4', modulation: 'edge-5', event: 'edge-1', observation: 'edge-8' };
export const UNKNOWN_KIND_INK = 'ink-muted';
// The declared dash is read from the edge loupe-spec block (schema 0.4; Julian, 2026-11-01). It is deliberately NOT added to
// SPEC.dash: the matrix sizes its marks from the longest dash period in that table (DASH_PERIOD, render.js), and a 22 px
// period would shrink every mark in every matrix. Distinct from every SPEC.dash value (static none, config 10 4, runtime
// 0.1 3.6, annotated 9 3 1.5 3, inferred 4 3.5, gap 2 4): a long dash then two dots, a shape no other provenance uses
// (compared by shape in the test, not by string).
export const DECLARED_DASH = SPECS.edge.dashes.declared;
// An edge's dash is its OWN provenance's (critic M3): an overlay `inferred` edge must never draw as declared.
export const dashOf = e => (e.provenance === 'declared' ? DECLARED_DASH : SPEC.dash[e.provenance] ?? SPEC.dash.inferred);

// Geometry, in world units. Only layout constants: every visual value (colour, stroke, dash) comes from tokens.
// Everything that borders a box is a multiple of 8 (pad 8, header 24) and gutters are rounded up to a multiple of 8, so lanes
// at 12 + 8k from a gutter's edge are always 4 away from any box border and 12 or more from either block (arrowhead room).
const G = { w: 164, h: 28, gapX: 30, gapY: 12, pad: 8, hdr: 24, margin: 24, head: 46 };
const LANE = 8;            // spacing of the parallel edge lanes in a gutter
const ARROW = { len: 7, h: 5 }; // the arrowhead; ends on one block side are at least ARROW.h apart, the last run is at least ARROW.len
const LONG = 8;            // an edge crossing this many columns runs in the dedicated lane above or below every row
const SEP = 3;             // parallel runs of different edges are at least this far apart; runs stay this far off any box border
const up8 = x => Math.ceil(x / 8) * 8;

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

// One zoom step that never moves the wrong way: zooming out (f < 1) can only lower k (to the floor, or to where it is if that
// is already below the floor, as the fit of a wide diagram is); zooming in stops at the ceiling.
export const stepZoom = (k, f, floor = 0.12, ceil = 4) => (f < 1 ? Math.max(Math.min(floor, k), k * f) : Math.min(ceil, k * f));

export const UNDECIDED_LABEL = 'placement not decided by the declaration';

export function layoutSpine(data) {
  const sp = data.graph.declaration.signalPath;
  const ids = data.nodeIds, nodeOf = {};
  ids.forEach(id => { nodeOf[data.nodes[id].declared.id] = id; });
  const edgeOf = {};
  data.edges.forEach(e => { const d = (e.evidence || []).find(x => x.type === 'declaration'); if (d) edgeOf[d.id] = e; });
  const ext = id => (data.nodes[id].declared || {}).scope === 'external';
  const path = id => data.nodes[id].declared.id;
  // A stage names blocks by declared id, edges by declared edge id; `refs` (Loupe ids, when the adapter wrote them) win.
  const resolve = x => (nodeOf[x] ? [nodeOf[x]] : data.nodes[x] ? [x] : edgeOf[x] ? [edgeOf[x].src, edgeOf[x].dst] : data.edgeById[x] ? [data.edgeById[x].src, data.edgeById[x].dst] : null);

  // ---- 1. the spine: columns are the stages, in declared order; a block sits in the first stage that names it,
  // whatever its scope (an external block named by a stage stays on the spine: Julian, poll 2026-11-01)
  const pos = {}, stack = [], unresolved = [];
  const stages = sp.map((st, i) => {
    stack[i] = 0;
    const named = [], fresh = [];
    // `refs` (Loupe ids), when the adapter wrote them, are the whole truth: an empty array is a stage that names nothing drawn.
    (st.refs || st.ids).forEach(x => {
      const ends = resolve(x); // an edge names src, then dst (src above dst)
      if (!ends) { unresolved.push({ stage: i, id: x }); return; }
      for (const id of ends) {
        if (!named.includes(id)) named.push(id);
        if (!pos[id]) { pos[id] = { col: i, side: 0, depth: 0, row: stack[i]++, region: 'C', round: 0 }; fresh.push(id); }
      }
    });
    // A stage that names a block placed by an earlier stage draws a mark on it (also when it adds blocks of its own).
    return { i, text: st.stage, ids: st.ids, named, fresh, nothing: named.length === 0, refs: named.filter(id => !fresh.includes(id)) };
  });
  const nCols = sp.length, band = Math.max(1, ...stack);

  const nbrs = {};
  ids.forEach(id => { nbrs[id] = []; });
  data.edges.forEach(e => { if (e.src === e.dst) return; nbrs[e.src].push({ other: e.dst, e, into: true }); nbrs[e.dst].push({ other: e.src, e, into: false }); });
  const parentOf = {}, kids = {};
  ids.forEach(id => { const p = data.nodes[id].declared && data.nodes[id].declared.parent; if (p != null && nodeOf[p]) { parentOf[id] = nodeOf[p]; (kids[nodeOf[p]] = kids[nodeOf[p]] || []).push(id); } });
  const members = id => [id].concat(...(kids[id] || []).map(members));

  // ---- 2. rails: an off-path external block leaves the columns ("frame the spine"). Only declared scope and the direction
  // of its declared edges decide, counting edges to engine blocks and to blocks ON the spine (they are on the declared path:
  // Julian, 2026-11-01); an edge to another off-path external block does not decide. Out of it and nothing the other way:
  // Inputs (LEFT). Into it and nothing out: Outputs (RIGHT), or Observers (BOTTOM) when every such edge is an observation.
  // No such edge, or edges both ways: the declaration does not say, so it is undecided, not given a side.
  const rail = {}, undecided = {}, hint = {}, foundIn = {};
  const counted = n => !ext(n.other) || !!pos[n.other]; // pos holds only the spine here
  for (const id of ids.filter(id => !pos[id] && ext(id))) {
    const es = nbrs[id].filter(counted), outs = es.filter(n => n.into), ins = es.filter(n => !n.into);
    if (!es.length) undecided[id] = 'external block with no declared edge to an engine block or to a block on the signal path: the declaration does not say whether it is an input, an output or an observer';
    else if (outs.length && ins.length) undecided[id] = `external block with declared edges both out of it (${outs.length}) and into it (${ins.length}), counting edges to engine blocks and to blocks on the signal path: neither only an input nor only an output`;
    else if (outs.length) rail[id] = 'L';
    else rail[id] = ins.every(n => n.e.kind === 'observation') ? 'B' : 'R';
  }

  // ---- 3. off-path engine blocks hang off the spine (BFS rounds, chosen from the placed set at round start): the column
  // is the LOWER MEDIAN of the columns of its placed neighbours (one per neighbour; its lowest edge id), above when the
  // edge to the neighbour at that column goes into it, below when it comes out. Railed and undecided blocks are not
  // columns. In one column they stack by the declared stage order of the neighbour they hang from, then by id (M2).
  const taken = new Set(); // `${col}:${side}:${depth}`
  const hang = (col, side, depth) => { while (taken.has(`${col}:${side}:${depth}`)) depth++; taken.add(`${col}:${side}:${depth}`); return { col, side, depth, region: 'C' }; };
  for (let round = 1; ; round++) {
    const batch = [];
    for (const id of ids) {
      if (pos[id] || rail[id] || undecided[id]) continue;
      const per = new Map();
      for (const n of nbrs[id]) if (pos[n.other] && (!per.has(n.other) || cmp(n.e.id, per.get(n.other).e.id) < 0)) per.set(n.other, n);
      if (!per.size) continue;
      const cs = [...per.values()].sort((a, b) => pos[a.other].col - pos[b.other].col || cmp(a.e.id, b.e.id));
      const med = pos[cs[Math.floor((cs.length - 1) / 2)].other].col;
      const at = cs.filter(n => pos[n.other].col === med);
      batch.push({ id, n: at[0], at, med, dirs: new Set(nbrs[id].filter(n => at.some(a => a.other === n.other)).map(n => n.into)) });
    }
    if (!batch.length) break;
    batch.sort((a, b) => pos[a.n.other].col - pos[b.n.other].col || pos[a.n.other].row - pos[b.n.other].row || cmp(path(a.id), path(b.id)));
    for (const { id, n, at, med, dirs } of batch) {
      const nb = pos[n.other];
      if (nb.side === 0 && dirs.size > 1) { // on the spine, with edges both ways: only the lowest edge id would choose the side
        undecided[id] = `engine block whose side is decided only by an edge-id tie-break: its declared edges to the block(s) in its column (${[...new Set(at.map(x => path(x.other)))].sort().join(', ')}) run both into and out of it`; hint[id] = med; foundIn[id] = round; continue;
      }
      // Above when the edge goes into the neighbour, below when it comes out. Hanging off another off-path block, it goes
      // one row further out on that block's own side: the edge direction then no longer says which side (ambiguity 1).
      const h = hang(nb.col, nb.side === 0 ? (n.into ? -1 : 1) : nb.side, nb.side === 0 ? 1 : nb.depth + 1);
      pos[id] = { ...h, row: h.side < 0 ? -h.depth : band - 1 + h.depth, round, via: n.other };
    }
  }
  // An engine block with no placed neighbour: its column may come from its members (a container: their earliest column) or,
  // for a non-container, its parent; its side comes from nothing, so it is undecided and keeps only that column as a hint.
  const colOf = x => (pos[x] ? pos[x].col : hint[x]), fromMembers = new Set();
  for (let moved = true; moved;) {
    moved = false;
    for (const id of ids) {
      if (pos[id] || rail[id] || undecided[id] || hint[id] != null) continue;
      const mem = members(id).slice(1).map(colOf).filter(c => c != null), par = parentOf[id] != null && colOf(parentOf[id]) != null ? [colOf(parentOf[id])] : [];
      const rel = mem.length ? mem : par;
      if (!rel.length) continue;
      hint[id] = Math.min(...rel); if (mem.length) fromMembers.add(id); moved = true;
    }
  }
  for (const id of ids) if (!pos[id] && !rail[id] && !undecided[id]) {
    undecided[id] = hint[id] != null
      ? `engine block with no declared edge to a block in a column: its column (stage ${hint[id] + 1}) comes from its ${fromMembers.has(id) ? "members' earliest column" : "parent's column"}, but nothing in the declaration puts it on a side`
      : 'engine block with no declared edge to a block in a column and no member or parent in one: nothing in the declaration places it';
  }

  // ---- 4. rows are one global integer line. Rails: LEFT before column 0, RIGHT after the last column. Two strips under
  // everything, each block in the column of its earliest engine neighbour (or its hint), else the next free one to the
  // right: Observers (every edge into the block an observation) and, last, the undecided strip.
  const colRows = Object.values(pos).map(p => p.row);
  const rMin = Math.min(0, ...colRows);
  const early = id => { const c = nbrs[id].filter(n => !ext(n.other)).map(n => colOf(n.other)).filter(c => c != null); return hint[id] != null ? hint[id] : c.length ? Math.min(...c) : Infinity; };
  const sorted = list => list.sort((a, b) => early(a) - early(b) || cmp(path(a), path(b)));
  const L = sorted(ids.filter(id => rail[id] === 'L')), R = sorted(ids.filter(id => rail[id] === 'R'));
  const B = sorted(ids.filter(id => rail[id] === 'B')), U = sorted(ids.filter(id => undecided[id]));
  const hasL = L.length > 0, hasR = R.length > 0;
  let rLast = Math.max(band - 1, ...colRows, rMin + L.length - 1, rMin + R.length - 1);
  let cEnd = nCols - 1;
  const stripCols = list => { let prev = -1; const out = {}; list.forEach(id => { prev = Math.max(Number.isFinite(early(id)) ? early(id) : 0, prev + 1); out[id] = prev; cEnd = Math.max(cEnd, prev); }); return out; };
  const bCol = stripCols(B), uCol = stripCols(U);
  const rB = rLast + 1, rU = rLast + (B.length ? 2 : 1);
  if (B.length || U.length) rLast = U.length ? rU : rB;
  const cR = cEnd + 1, cMin = hasL ? -1 : 0, cMax = hasR ? cR : cEnd;
  L.forEach((id, k) => { pos[id] = { col: -1, side: 0, depth: 0, row: rMin + k, region: 'L' }; });
  R.forEach((id, k) => { pos[id] = { col: cR, side: 0, depth: 0, row: rMin + k, region: 'R' }; });
  B.forEach(id => { pos[id] = { col: bCol[id], side: 0, depth: 0, row: rB, region: 'B' }; });
  U.forEach(id => { pos[id] = { col: uCol[id], side: 0, depth: 0, row: rU, region: 'U' }; });

  // ---- 5. containers: one box per container per region its members stand in (columns, a rail, a strip), over its
  // members there; nested boxes sit inside their parent's. A container whose own node is in another region gets a
  // dashed "continued" box in this one, with the same header; one box is never stretched across regions.
  const depthOf = id => (parentOf[id] ? 1 + depthOf(parentOf[id]) : 0);
  const boxes = [], box = {};
  for (const id of Object.keys(kids).sort(cmp)) {
    const m = members(id);
    for (const region of ['C', 'L', 'R', 'B', 'U']) {
      const mine = m.filter(x => pos[x].region === region);
      if (!mine.length) continue;
      const ps = mine.map(x => pos[x]);
      const b = { key: id + '|' + region, id, region, continued: pos[id].region !== region, members: m, mine, parent: parentOf[id] || null, depth: depthOf(id),
        c0: Math.min(...ps.map(p => p.col)), c1: Math.max(...ps.map(p => p.col)), r0: Math.min(...ps.map(p => p.row)), r1: Math.max(...ps.map(p => p.row)) };
      boxes.push(b); box[b.key] = b;
    }
  }
  boxes.forEach(b => { b.kids = (kids[b.id] || []).filter(k => box[k + '|' + b.region]).map(k => k + '|' + b.region); });
  // Margins a box needs on each side, deepest first, so a nested box that shares an edge with its parent leaves room.
  const need = b => {
    if (b.l != null) return b;
    const k = b.kids.map(x => need(box[x])), most = (same, m) => Math.max(0, ...k.filter(same).map(x => x[m]));
    b.l = G.pad + most(x => x.c0 === b.c0, 'l'); b.r = G.pad + most(x => x.c1 === b.c1, 'r');
    b.t = G.hdr + G.pad + most(x => x.r0 === b.r0, 't'); b.b = G.pad + most(x => x.r1 === b.r1, 'b');
    return b;
  };
  boxes.forEach(need);
  const colL = {}, colR = {}, rowT = {}, rowB = {};
  boxes.forEach(b => { colL[b.c0] = Math.max(colL[b.c0] || 0, b.l); colR[b.c1] = Math.max(colR[b.c1] || 0, b.r); rowT[b.r0] = Math.max(rowT[b.r0] || 0, b.t); rowB[b.r1] = Math.max(rowB[b.r1] || 0, b.b); });
  if (B.length) rowT[rB] = Math.max(rowT[rB] || 0, 24);  // room for each strip's label
  if (U.length) rowT[rU] = Math.max(rowT[rU] || 0, 32);

  // ---- 6. edges run orthogonally through the gutters, so no edge can cross a block (blocks stand only in grid cells; the
  // vertical gutters between columns and the horizontal gutters between rows are empty). An edge leaves its source
  // sideways into the vertical gutter, runs along it, turns into a row gutter, runs along that, and comes down the
  // destination's gutter to enter sideways. Every vertical run has its own lane (x) in its gutter and every horizontal
  // run its own lane (y) in its row gutter wherever two would overlap, so no two edges share a stretch of line; a gutter
  // widens to hold its lanes. Lanes are the first free one in edge-id order (interval colouring on the doubled row axis
  // 2r for a row, 2r+1 for the gutter below it, and on the column axis). A run across LONG or more columns goes in the
  // dedicated lane above or below every row, and is tagged at both ends with the block at the far end. Each stub (the
  // sideways step) has its own height at its block side, at least ARROW.h from the next: a row grows taller to hold them.
  const desc = [], hLoad = {};
  for (const e of data.edges) {
    const a = pos[e.src], b = pos[e.dst], d = { e, a, b };
    if (e.src === e.dst) { d.sa = d.sb = 'r'; d.g1 = d.g2 = a.col; }
    else if (a.col === b.col) { d.sa = d.sb = 'r'; d.g1 = d.g2 = a.col; }
    else if (b.col > a.col) { d.sa = 'r'; d.sb = 'l'; d.g1 = a.col; d.g2 = b.col - 1; }
    else { d.sa = 'l'; d.sb = 'r'; d.g1 = a.col - 1; d.g2 = b.col; }
    if (d.g1 !== d.g2) {
      const top = rMin - 1, bot = rLast;
      if (Math.abs(a.col - b.col) >= LONG) { d.long = true; d.hg = Math.abs(a.row - top) + Math.abs(b.row - top) <= Math.abs(a.row - bot) + Math.abs(b.row - bot) ? top : bot; }
      else if (a.row !== b.row) d.hg = b.row > a.row ? a.row : a.row - 1;
      else d.hg = (hLoad[a.row - 1] || 0) <= (hLoad[a.row] || 0) ? a.row - 1 : a.row;
      hLoad[d.hg] = (hLoad[d.hg] || 0) + 1;
    }
    desc.push(d);
  }
  const lanes = (segs) => { // interval colouring per key; returns lane count per key
    const last = {}, count = {};
    segs.sort((p, q) => cmp(p.key, q.key) || p.lo - q.lo || cmp(p.id, q.id) || p.part - q.part);
    for (const s of segs) { const ls = (last[s.key] = last[s.key] || []); let k = ls.findIndex(h => h < s.lo); if (k < 0) k = ls.length; ls[k] = s.hi; s.lane = k; count[s.key] = ls.length; }
    return count;
  };
  const vs = [], hs = [];
  for (const d of desc) {
    const ra = 2 * d.a.row, rb = 2 * d.b.row, id = d.e.id;
    if (d.hg == null) vs.push({ key: d.g1, lo: Math.min(ra, rb), hi: Math.max(ra, rb), id, part: 0, d, at: 'v' });
    else {
      const hd = 2 * d.hg + 1;
      vs.push({ key: d.g1, lo: Math.min(ra, hd), hi: Math.max(ra, hd), id, part: 1, d, at: 'v1' });
      vs.push({ key: d.g2, lo: Math.min(hd, rb), hi: Math.max(hd, rb), id, part: 2, d, at: 'v2' });
      hs.push({ key: d.hg, lo: Math.min(d.g1, d.g2), hi: Math.max(d.g1, d.g2), id, part: 0, d });
    }
  }
  const nv = lanes(vs), nh = lanes(hs);
  // stub heights: one slot per stub end in its (row, gutter), shared by the blocks on both sides of that gutter
  const ends = {}, rowEnds = {};
  for (const d of desc) { (ends[d.a.row + ':' + d.g1] = ends[d.a.row + ':' + d.g1] || []).push({ id: d.e.id, end: 'a', d }); (ends[d.b.row + ':' + d.g2] = ends[d.b.row + ':' + d.g2] || []).push({ id: d.e.id, end: 'b', d }); }
  for (const [k, list] of Object.entries(ends)) { const row = +k.split(':')[0]; rowEnds[row] = Math.max(rowEnds[row] || 0, list.length); list.sort((p, q) => cmp(p.id, q.id) || cmp(p.end, q.end)); list.forEach((s, j) => { s.d['j' + s.end] = j; s.d['n' + s.end] = list.length; }); }
  const RH = {}; for (let r = rMin; r <= rLast; r++) RH[r] = Math.max(G.h, ARROW.h * (rowEnds[r] || 0) + 6);

  // ---- 7. coordinates
  const X = {}, Y = {}, gapAt = c => (c === 0 && hasL) || c === cR ? G.gapX + 40 : G.gapX; // rails stand apart from the columns
  X[cMin] = up8(Math.max(G.margin, LANE * (nv[cMin - 1] || 0) + 16)) + (colL[cMin] || 0);
  for (let c = cMin + 1; c <= cMax; c++) X[c] = X[c - 1] + G.w + up8(Math.max(gapAt(c) + (colR[c - 1] || 0) + (colL[c] || 0), LANE * (nv[c - 1] || 0) + 16));
  Y[rMin] = G.head + up8(Math.max(G.margin, LANE * (nh[rMin - 1] || 0) + 16)) + (rowT[rMin] || 0);
  for (let r = rMin + 1; r <= rLast; r++) Y[r] = Y[r - 1] + RH[r - 1] + up8(Math.max(G.gapY + (rowB[r - 1] || 0) + (rowT[r] || 0), LANE * (nh[r - 1] || 0) + 16));
  ids.forEach(id => { const p = pos[id]; p.x = X[p.col]; p.y = Y[p.row]; p.w = G.w; p.h = RH[p.row]; });
  boxes.forEach(b => { b.x = X[b.c0] - b.l; b.y = Y[b.r0] - b.t; b.w = X[b.c1] + G.w + b.r - b.x; b.h = Y[b.r1] + RH[b.r1] + b.b - b.y; });
  const vx = (g, lane) => (g < cMin ? 0 : X[g] + G.w) + 12 + LANE * lane;
  const hy = (hg, lane) => (hg < rMin ? G.head : Y[hg] + RH[hg]) + 12 + LANE * lane;
  const stubY = (row, j, n) => Y[row] + 3 + (RH[row] - 6) * (j + 0.5) / n;
  const room = (c, side) => (side === 'r' ? (c < cMax ? X[c + 1] : X[c] + G.w + G.margin + 8 * (nv[c] || 0)) - (X[c] + G.w) : X[c] - (c > cMin ? X[c - 1] + G.w : 0));
  const routes = {}, tags = [];
  for (const d of desc) {
    const { e, a, b } = d, xa = d.sa === 'r' ? a.x + a.w : a.x, xb = d.sb === 'r' ? b.x + b.w : b.x, ya = stubY(a.row, d.ja, d.na), yb = stubY(b.row, d.jb, d.nb);
    const lane = at => vs.find(s => s.id === e.id && s.at === at).lane;
    let pts;
    if (d.hg == null) { const x = vx(d.g1, lane('v')); pts = [[xa, ya], [x, ya], [x, yb], [xb, yb]]; }
    else {
      const x1 = vx(d.g1, lane('v1')), x2 = vx(d.g2, lane('v2')), yh = hy(d.hg, hs.find(s => s.id === e.id).lane);
      pts = [[xa, ya], [x1, ya], [x1, yh], [x2, yh], [x2, yb], [xb, yb]];
    }
    routes[e.id] = pts.filter((p, i) => i === 0 || p[0] !== pts[i - 1][0] || p[1] !== pts[i - 1][1]).map(p => [f1(p[0]), f1(p[1])]);
    if (d.long) {
      tags.push({ edge: e.id, end: 'a', far: e.dst, x: f1(xa), y: f1(ya), side: d.sa, room: room(a.col, d.sa) });
      tags.push({ edge: e.id, end: 'b', far: e.src, x: f1(xb), y: f1(yb), side: d.sb, room: room(b.col, d.sb) });
    }
  }

  // ---- 8. a container whose box overlaps one that is not its ancestor or descendant is reported in `overlaps`, not hidden
  // (map.spine.overlaps; not map.layout.overlaps, which conserve() reads as sections dragged on top of each other and
  // would break a meter that is otherwise balanced). A node standing inside a box it is not a member of is reported the
  // same way in `intrusions`, and drawn with a mark: the box would claim it. Both are consequences of the declared
  // placement, never repaired.
  const overlaps = [], intrusions = [], rel = (a, b) => a.members.includes(b.id) || b.members.includes(a.id);
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) if (!rel(boxes[i], boxes[j]) && hit(boxes[i], boxes[j])) overlaps.push([boxes[i].key, boxes[j].key]);
  for (const b of boxes) for (const id of ids) if (!b.members.includes(id) && hit(b, pos[id])) intrusions.push([b.key, id]);

  const ruleY = G.head - 4, span = { x: X[0] - 16, w: X[cEnd] + G.w + 16 - (X[0] - 16) };
  const band0 = Y[0] - 8, bandBox = { x: span.x, w: span.w, y: band0, h: Y[band - 1] + RH[band - 1] + 8 - band0 };
  const W = X[cMax] + G.w + up8(Math.max((colR[cMax] || 0) + G.margin, LANE * (nv[cMax] || 0) + 16)), H = Y[rLast] + RH[rLast] + up8(Math.max((rowB[rLast] || 0) + G.margin, LANE * (nh[rLast] || 0) + 16));
  const rails = { L: hasL ? { x: X[-1], ids: L } : null, R: hasR ? { x: X[cR], ids: R } : null,
    B: B.length ? { y: Y[rB] - 8, x: X[0] - 16, ids: B } : null };
  const strip = U.length ? { x: X[0] - 16, y: Y[rU] - rowT[rU], w: X[Math.max(...U.map(id => pos[id].col))] + G.w + 16 - (X[0] - 16), h: rowT[rU] + RH[rU] + 8, ids: U } : null;
  stages.forEach(s => { s.x = X[s.i] + G.w / 2; });
  const inC = ids.filter(id => pos[id].region === 'C'), below = Math.max(0, ...inC.map(id => pos[id].row)) - (band - 1);
  return { w: W, h: H, geom: G, ruleY, stages, pos, boxes, tags, laneEdges: desc.filter(d => d.long).map(d => d.e.id), rowHeight: RH, rails, strip, undecided: U.map(id => ({ id, reason: undecided[id], hint: hint[id] ?? null, round: foundIn[id] ?? null })), routes, band: bandBox, span, overlaps, intrusions, unresolved,
    counts: { columns: nCols, spine: inC.filter(id => pos[id].side === 0).length, above: -Math.min(0, ...inC.map(id => pos[id].row)), below, band,
      left: L.length, right: R.length, bottom: B.length, undecided: U.length,
      boxes: boxes.length, continued: boxes.filter(b => b.continued).length, overlaps: overlaps.length, intrusions: new Set(intrusions.map(p => p[1])).size, maxLanesV: Math.max(0, ...Object.values(nv)), maxLanesH: Math.max(0, ...Object.values(nh)), laneEdges: desc.filter(d => d.long).length } };
}

// Geometry faults of the drawn routes, by edge id (first reason found). A route is faulty if a run enters a block other than
// its two ends; lies on, or within SEP of, another edge's parallel run (over more than a few units); runs along a box border
// (within SEP); arrives in a run shorter than the arrowhead; or ends within ARROW.h of another end on the same block side.
// renderSpine marks an edge drawn only when it has none (critic H2).
export function routeFaults(lay, edges) {
  const faults = {}, segs = [], endsAt = {};
  const add = (id, why) => { faults[id] = faults[id] || why; };
  for (const e of edges) {
    const pts = lay.routes[e.id];
    if (!pts || pts.length < 2) { add(e.id, 'no route'); continue; }
    for (let i = 1; i < pts.length; i++) {
      const [x1, y1] = pts[i - 1], [x2, y2] = pts[i];
      if (x1 !== x2 && y1 !== y2) { add(e.id, 'a run is neither horizontal nor vertical'); continue; }
      segs.push({ id: e.id, h: y1 === y2, c: y1 === y2 ? y1 : x1, lo: y1 === y2 ? Math.min(x1, x2) : Math.min(y1, y2), hi: y1 === y2 ? Math.max(x1, x2) : Math.max(y1, y2) });
      for (const [nid, p] of Object.entries(lay.pos)) {
        if (nid === e.src || nid === e.dst) continue;
        if (Math.min(x2, x1) < p.x + p.w - 0.01 && Math.max(x1, x2) > p.x + 0.01 && Math.min(y1, y2) < p.y + p.h - 0.01 && Math.max(y1, y2) > p.y + 0.01) add(e.id, `runs through ${nid}`);
      }
    }
    const last = pts[pts.length - 1], prev = pts[pts.length - 2];
    if (Math.abs(last[0] - prev[0]) + Math.abs(last[1] - prev[1]) < ARROW.len) add(e.id, 'its last run is shorter than the arrowhead');
    for (const [pt, nid] of [[pts[0], e.src], [last, e.dst]]) { const n = lay.pos[nid], k = nid + (Math.abs(pt[0] - n.x) < 0.06 ? 'L' : 'R'); (endsAt[k] = endsAt[k] || []).push({ id: e.id, y: pt[1] }); }
  }
  for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
    const p = segs[i], q = segs[j];
    if (p.id === q.id || p.h !== q.h || Math.abs(p.c - q.c) >= SEP) continue;
    if (Math.min(p.hi, q.hi) - Math.max(p.lo, q.lo) > 3) { const why = Math.abs(p.c - q.c) < 0.05 ? 'shares a line with' : 'runs too close to'; add(p.id, `${why} ${q.id}`); add(q.id, `${why} ${p.id}`); }
  }
  for (const s of segs) for (const b of lay.boxes) {
    const [bc, bs] = s.h ? [[b.y, b.y + b.h], [b.x, b.x + b.w]] : [[b.x, b.x + b.w], [b.y, b.y + b.h]];
    if (bc.some(c => Math.abs(c - s.c) < SEP) && Math.min(s.hi, bs[1]) - Math.max(s.lo, bs[0]) > 3) add(s.id, `runs along the border of box ${b.key}`);
  }
  for (const list of Object.values(endsAt)) { list.sort((p, q) => p.y - q.y); for (let i = 1; i < list.length; i++) if (list[i].y - list[i - 1].y < ARROW.h - 0.01) { add(list[i].id, 'ends too close to another end on its block side'); add(list[i - 1].id, 'ends too close to another end on its block side'); } }
  return faults;
}

// The note the node panel carries for a block whose placement the declaration does not decide (pure: tested headless).
export const undecidedNote = (lay, id) => {
  const u = lay.undecided.find(x => x.id === id);
  return u ? `<div class="card"><span class="t">${esc(UNDECIDED_LABEL[0].toUpperCase() + UNDECIDED_LABEL.slice(1))}</span><span class="s">${esc(u.reason)}</span></div>` : '';
};

const cut = (s, n) => (s.length > n ? s.slice(0, Math.max(1, n - 1)) + '…' : s);

// The key for this view (every meaning has its own pattern, critic M4). Pure HTML over tokens; the provenance strip stays
// when the key is closed ("the provenance legend is always on screen").
export function spineLegendHtml(closed = false) {
  const line = (ink, dash, cap) => `<svg width="30" height="10" aria-hidden="true"><line x1="1" y1="5" x2="29" y2="5" style="stroke:${v(ink)};stroke-width:2px;stroke-dasharray:${dash};${cap ? 'stroke-linecap:round' : ''}"/></svg>`;
  const boxSw = (fill, stroke, dash, w = 1.25) => `<svg width="30" height="12" aria-hidden="true"><rect x="1" y="1" width="28" height="10" rx="3" style="fill:${v(fill)};stroke:${v(stroke)};stroke-width:${w}px;stroke-dasharray:${dash}"/></svg>`;
  const provs = [['declared', DECLARED_DASH], ['static', SPEC.dash.static], ['config', SPEC.dash.config], ['runtime', SPEC.dash.runtime], ['annotated', SPEC.dash.annotated], ['inferred', SPEC.dash.inferred]];
  const strip = `<div class="strip">${provs.map(([p, d]) => `<span title="${p}">${line('ink-muted', d)}</span>`).join('')}</div>`;
  if (closed) return strip;
  const lk = (sw, t) => `<div class="lk">${sw}${esc(t)}</div>`;
  return `<div class="col">${Object.entries(DECLARED_EDGE_SLOT).map(([k, c]) => lk(line(c, 'none'), k + ' edge')).join('')}${lk(line(UNKNOWN_KIND_INK, 'none'), 'edge of another kind')}</div>
    <div class="col">${provs.map(([p, d]) => lk(line('ink-muted', d), p + ' (line pattern = provenance)')).join('')}</div>
    <div class="col">${lk(boxSw('surface-node', 'ink-muted', 'none'), 'block')}${lk(boxSw('surface-node', 'ink-muted', SPEC.dash.gap), 'slot: reserved, not built')}${lk(boxSw('surface-group-nested', 'ink-muted', 'none'), 'external block')}
      ${lk(boxSw('surface-group', 'ink-faint', 'none', 1), 'box: a declared parent')}${lk(boxSw('surface-group', 'ink-faint', SPEC.dash.config, 1), 'dashed box: continues a parent whose own block stands elsewhere')}
      ${lk(boxSw('surface-group-nested', 'ink-faint', 'none', 0), 'shaded band: the declared signal path, stage by stage')}${lk(`<svg width="30" height="12" aria-hidden="true"><circle cx="9" cy="6" r="5" style="fill:${v('state-warn')}"/></svg>`, 'marked block: inside a box it is not a member of')}
      ${lk(`<svg width="30" height="12" aria-hidden="true"><rect x="5" y="1" width="20" height="10" rx="3" style="fill:none;stroke:${v('ink-muted')};stroke-width:1px;stroke-dasharray:${SPEC.dash.runtime};stroke-linecap:round"/></svg>`, 'dotted chip: a later stage names this block again')}
      ${lk(boxSw('none', 'state-warn', 'none', 1.5), UNDECIDED_LABEL)}
      ${lk(`<svg width="30" height="12" aria-hidden="true"><circle cx="9" cy="6" r="4" style="fill:${v('state-warn')}"/></svg>`, 'warn dot on a stage label: the stage names nothing drawn')}
      ${lk('<span></span>', 'A small tag at each end of a long edge names the block at its far end.')}
      ${lk('<span></span>', 'Inputs / Outputs: every declared edge to the engine goes out of / into the block. Observers: only observation edges go in.')}
      ${lk('<span></span>', 'Off-path blocks stack in a column by the declared stage order of the neighbour they hang from, then by id.')}</div>${strip}`;
}

export function renderSpine(container, data, state, lay) {
  let layer = container.querySelector(':scope > .spine');
  if (!layer) { layer = document.createElement('div'); layer.className = 'spine'; container.appendChild(layer); }
  const Wd = container.clientWidth || 800, Hd = container.clientHeight || 600;
  const zs = state.zoom || { auto: true };
  // Fit shows the whole diagram; opening (zoom auto) is a readable 100% at stage 1, one row of stages (Julian, 2026-11-01).
  const fit = (() => { const k = Math.min((Wd - 48) / lay.w, (Hd - 120) / lay.h, 1.1); return { k, x: (Wd - lay.w * k) / 2, y: (Hd - 96 - lay.h * k) / 2 }; })();
  // Stage 1's blocks must be fully in view: header first (y 12) if they fit under it, else they are centred.
  const s1 = lay.stages[0].fresh.map(id => lay.pos[id]), top = Math.min(...s1.map(p => p.y)), bot = Math.max(...s1.map(p => p.y + p.h));
  const openY = bot + 12 <= Hd - 96 ? 12 : Math.min(12, (Hd - 96) / 2 - (top + bot) / 2);
  const z = zs.auto ? { k: 1, x: 12, y: openY } : { k: zs.k, x: zs.x, y: zs.y };
  const sel = state.selection, selNode = sel && sel.type === 'node' ? sel.id : null, selEdge = sel && sel.type === 'edge' ? sel.id : null;
  const hov = state.hover && state.hover.type === 'edge' ? state.hover.id : null; // hovering an edge lights its whole route, as selecting does
  const map = { zoom: z, lod: 'detail', nodes: {}, edges: {}, elements: {}, layout: { spine: true, folds: {} }, drawn: new Set(), settled: true };
  const P = lay.pos, nm = id => data.nodes[id];
  const colW = lay.stages.map((s, i) => (i + 1 < lay.stages.length ? lay.stages[i + 1].x : s.x + lay.geom.w + 40) - s.x);

  let defs = '', under = '', over = '';
  for (const [k, slot] of [...Object.entries(DECLARED_EDGE_SLOT), ['unknown', UNKNOWN_KIND_INK]]) defs += `<marker id="sp-${k}" viewBox="0 0 ${ARROW.len} ${ARROW.h}" refX="${ARROW.len - 0.3}" refY="${ARROW.h / 2}" markerWidth="${ARROW.len}" markerHeight="${ARROW.h}" markerUnits="userSpaceOnUse" orient="auto"><path d="M0 .3L${ARROW.len} ${ARROW.h / 2}L0 ${ARROW.h - 0.3}z" style="fill:${v(slot)}"/></marker>`;

  // The spine itself: a band behind the rows of the signal path, and the rule with one tick and one label per stage.
  // A tick or label jumps the view to its column (data-sstage; not data-stage, which is the pipeline nav's).
  under += `<rect x="${f1(lay.band.x)}" y="${f1(lay.band.y)}" width="${f1(lay.band.w)}" height="${f1(lay.band.h)}" style="fill:${v('surface-group-nested')};opacity:${v('opacity-dim')}"><title>The declared signal path: each stage, in declared order, left to right</title></rect>`;
  under += `<line x1="${f1(lay.span.x)}" y1="${lay.ruleY}" x2="${f1(lay.span.x + lay.span.w)}" y2="${lay.ruleY}" style="stroke:${v('ink-muted')};stroke-width:${v('stroke-edge-emph')}"/>`;
  lay.stages.forEach((s, i) => {
    const fitN = Math.max(8, Math.floor((colW[i] - 8) / 5.8)), tx = s.x - colW[i] / 2 + 4 + lay.geom.w / 2;
    under += `<g data-sstage="${i}" style="cursor:pointer"><title>${esc(`${i + 1}. ${s.text}`)}</title><line x1="${f1(s.x)}" y1="${lay.ruleY - 5}" x2="${f1(s.x)}" y2="${lay.ruleY}" style="stroke:${v('ink-muted')};stroke-width:${v('stroke-edge-emph')}"/>` +
      `<text x="${f1(tx)}" y="${lay.ruleY - 22}" style="font:600 10px/1 ${v('font-ui')};fill:${v('ink')}">${i + 1}</text>` +
      `<text x="${f1(tx)}" y="${lay.ruleY - 9}" style="font:500 10px/1 ${v('font-ui')};fill:${v('ink-muted')}">${esc(cut(s.text, fitN))}</text>` +
      // A stage that names nothing drawn (every id dropped or unknown) is not skipped: its label shows with a warn mark.
      (s.nothing ? `<g data-nothing="${i}"><title>${esc(`stage ${i + 1} names nothing drawn`)}</title><circle cx="${f1(tx - 8)}" cy="${lay.ruleY - 25}" r="5" style="fill:${v('state-warn')}"/><text x="${f1(tx - 8)}" y="${lay.ruleY - 22}" text-anchor="middle" style="font:700 8px/1 ${v('font-ui')};fill:${v('ink')}">!</text></g>` : '') + `</g>`;
  });

  // Containers, outermost first so a nested box draws over its parent. The header band carries id and multiplicity.
  [...lay.boxes].sort((a, b) => a.depth - b.depth || (a.id < b.id ? -1 : 1)).forEach(b => {
    const n = nm(b.id), d = n.declared || {}, mult = d.multiplicity ? ' × ' + d.multiplicity : '';
    // A continued box (this container's own node stands in another region) takes the config pattern: the same container, one more place.
    under += `<g data-container="${esc(b.key)}"><rect x="${f1(b.x)}" y="${f1(b.y)}" width="${f1(b.w)}" height="${f1(b.h)}" rx="6" style="fill:${v('surface-group')};fill-opacity:.55;stroke:${v('ink-faint')};stroke-width:1px;stroke-dasharray:${b.continued ? SPEC.dash.config : 'none'}"/>` +
      `<text x="${f1(b.x + 8)}" y="${f1(b.y + 13)}" style="font:600 10.5px/1 ${v('font-mono')};fill:${v('ink-muted')}">${esc(cut(n.declared.id + mult, Math.floor((b.w - 16) / 6.3)))}<title>${esc(n.declared.id + mult + (b.continued ? ' (continued: its own block stands elsewhere)' : ''))}</title></text></g>`;
  });
  const railText = (x, y, t, tip) => `<text x="${f1(x)}" y="${f1(y)}" style="font:600 10px/1 ${v('font-ui')};fill:${v('ink-muted')}">${esc(t)}<title>${esc(tip)}</title></text>`;
  if (lay.rails.L) under += railText(lay.rails.L.x, lay.ruleY - 9, 'Inputs', 'External blocks every declared edge of which to an engine block goes out of the block into the engine');
  if (lay.rails.R) under += railText(lay.rails.R.x, lay.ruleY - 9, 'Outputs', 'External blocks every declared edge of which to an engine block comes into the block from the engine');
  if (lay.rails.B) under += railText(lay.rails.B.x, lay.rails.B.y, 'Observers', 'External blocks every declared edge into which, from an engine block, is an observation');
  if (lay.strip) under += `<g data-undecided="1"><rect x="${f1(lay.strip.x)}" y="${f1(lay.strip.y)}" width="${f1(lay.strip.w)}" height="${f1(lay.strip.h)}" rx="6" style="fill:none;stroke:${v('state-warn')};stroke-width:1.5px"/><text x="${f1(lay.strip.x + 8)}" y="${f1(lay.strip.y + 14)}" style="font:600 10.5px/1 ${v('font-ui')};fill:${v('ink-muted')}">${esc(UNDECIDED_LABEL[0].toUpperCase() + UNDECIDED_LABEL.slice(1))}<title>Each block's reason is in its tooltip. No side is picked for them.</title></text></g>`;

  // Edges: orthogonal routes (layoutSpine), coloured by kind, dashed by the edge's OWN provenance. An edge counts as drawn
  // only if its route passes the geometry check (no block entered, no line shared); otherwise it is accounted as unrouted
  // and conserve() reports it. data-edge is on a group with a wider invisible stroke so thin lines click.
  const faults = routeFaults(lay, data.edges);
  for (const e of data.edges) {
    const on = selEdge === e.id || hov === e.id, known = !!DECLARED_EDGE_SLOT[e.kind], slot = known ? DECLARED_EDGE_SLOT[e.kind] : UNKNOWN_KIND_INK;
    const ink = on ? 'accent' : slot, w = on ? v('stroke-hub') : v('stroke-edge');
    const pts = lay.routes[e.id] || [], d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join('');
    const ed = e.declared || {};
    const tip = `${e.kind}${known ? '' : ' (kind not in the list: neutral colour)'}${ed.label ? ': ' + ed.label : ''} · ${e.provenance}${SPEC.dash[e.provenance] == null && e.provenance !== 'declared' ? ' (unknown provenance)' : ''}${ed.cites && ed.cites.length ? ' · ' + ed.cites.join(', ') : ''} · ${nm(e.src).declared.id} → ${nm(e.dst).declared.id}${e.src === e.dst ? ' (between its instances)' : ''}${faults[e.id] ? ' · NOT ROUTED CLEANLY: ' + faults[e.id] : ''}`;
    over += `<g data-edge="${esc(e.id)}" style="cursor:pointer"><title>${esc(tip)}</title><path d="${d}" style="fill:none;stroke:transparent;stroke-width:9px;pointer-events:stroke"/>` +
      `<path d="${d}" style="fill:none;stroke:${v(ink)};stroke-width:${w};stroke-dasharray:${dashOf(e)};pointer-events:none" marker-end="url(#sp-${known ? e.kind : 'unknown'})"/></g>`;
    map.edges[e.id] = faults[e.id] ? { via: 'unrouted' } : { via: 'drawn' };
  }

  // Long edges run in the dedicated lane above or below every row (still drawn, still counted): a small tag at each end names
  // the block at the FAR end, so the lane can be followed without tracing it. Cut to the room in the gutter; full in the title.
  for (const t of lay.tags) {
    const far = nm(t.far).declared.id, arrow = t.end === 'a' ? '→ ' : '← ', fit = Math.max(4, Math.floor((t.room - 10) / 5.6)), txt = esc(cut(arrow + far, fit)), w = Math.min(t.room - 6, txt.length * 5.6 + 6), x = t.side === 'r' ? t.x + 3 : t.x - 3 - w;
    over += `<g data-lanetag="${esc(t.edge)}" data-end="${t.end}" style="pointer-events:none"><title>${esc(`${t.end === 'a' ? 'goes to' : 'comes from'} ${far}`)}</title><rect x="${f1(x)}" y="${f1(t.y - 11)}" width="${f1(w)}" height="9" rx="2" style="fill:${v('surface-panel')};opacity:.9"/><text x="${f1(x + 3)}" y="${f1(t.y - 4)}" style="font:500 8.5px/1 ${v('font-mono')};fill:${v('ink-muted')}">${txt}</text></g>`;
  }

  // Nodes: a slot (a reserved, unbuilt place) draws with the gap dash, a block solid; external scope sits on the muted
  // surface. A later stage that names the block again leaves a dotted chip on it; a block inside a box it is not a member
  // of carries a warn-coloured mark with the box(es) in its title.
  const chips = {}; lay.stages.forEach(s => s.refs.forEach(id => (chips[id] = chips[id] || []).push(s.i)));
  const inBox = {}; lay.intrusions.forEach(([k, id]) => (inBox[id] = inBox[id] || []).push(nm(k.split('|')[0]).declared.id));
  for (const id of data.nodeIds) {
    const p = P[id], n = nm(id), d = n.declared || {}, on = selNode === id, slot = n.kind === 'slot', ext = d.scope === 'external', cs = chips[id] || [];
    const why = lay.undecided.find(u => u.id === id);
    over += `<g data-node="${esc(id)}" style="cursor:pointer"><title>${esc(`${n.declared.id}${slot ? ' (slot: reserved, not built)' : ''}${ext ? ' (external)' : ''}${d.label ? ': ' + d.label : ''}${d.cites && d.cites.length ? ' · ' + d.cites.join(', ') : ''}${why ? ' · PLACEMENT NOT DECIDED: ' + why.reason : ''}`)}</title>` +
      `<rect x="${f1(p.x)}" y="${f1(p.y)}" width="${p.w}" height="${p.h}" rx="5" style="fill:${v(ext ? 'surface-group-nested' : 'surface-node')};stroke:${v(on ? 'accent' : 'ink-muted')};stroke-width:${on ? 2 : 1.25}px;stroke-dasharray:${slot ? SPEC.dash.gap : 'none'}"/>` +
      `<text x="${f1(p.x + 8)}" y="${f1(p.y + p.h / 2 + 3.5)}" style="font:500 11px/1 ${v('font-mono')};fill:${v(ext ? 'ink-muted' : 'ink')}">${esc(cut(n.declared.id, Math.floor((p.w - 14 - cs.length * 26) / 6.6)))}</text></g>`;
    cs.forEach((si, k) => { over += `<g data-ref="${si}" data-refnode="${esc(id)}" style="pointer-events:none"><title>${esc(`stage ${si + 1} names ${n.declared.id} again`)}</title><rect x="${f1(p.x + p.w - 28 - 26 * k)}" y="${f1(p.y + 6)}" width="22" height="16" rx="4" style="fill:${v('surface-node')};stroke:${v('ink-muted')};stroke-width:1px;stroke-dasharray:${SPEC.dash.runtime};stroke-linecap:round"/><text x="${f1(p.x + p.w - 17 - 26 * k)}" y="${f1(p.y + 17.5)}" text-anchor="middle" style="font:600 9.5px/1 ${v('font-ui')};fill:${v('ink-muted')}">${si + 1}</text></g>`; });
    if (inBox[id]) over += `<g data-intrusion="${esc(id)}" style="pointer-events:none"><title>${esc(`inside ${[...new Set(inBox[id])].join(', ')}'s box, not a member of it`)}</title><circle cx="${f1(p.x)}" cy="${f1(p.y)}" r="6" style="fill:${v('state-warn')};stroke:${v('surface-node')};stroke-width:1px"/><text x="${f1(p.x)}" y="${f1(p.y + 3.2)}" text-anchor="middle" style="font:700 9px/1 ${v('font-ui')};fill:${v('ink')}">!</text></g>`;
    map.nodes[id] = { state: 'drawn' };
  }

  layer.innerHTML = `<svg class="sp-svg" width="100%" height="100%" style="position:absolute;left:0;top:0"><defs>${defs}</defs><g transform="translate(${f1(z.x)} ${f1(z.y)}) scale(${z.k})">${under}${over}</g></svg>`;
  map.spine = { overlaps: lay.overlaps, intrusions: lay.intrusions, counts: lay.counts, fit, faults };
  return map;
}
