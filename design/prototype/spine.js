// The "Signal path" view for structure snapshots (ROADMAP Q-015; Julian, poll 2026-10-31: "spine from the spec").
// layoutSpine(data) is pure and deterministic: no DOM, no clock, no randomness. Only the declared stage order
// (graph.declaration.signalPath), the declared edges and the declared parents decide where anything goes: nothing is
// inferred. renderSpine(container, data, state, lay) draws that layout as SVG and returns an element map shaped like
// renderWorks's, so conserve() (standins.js) checks it the same way as every other view.
import { SPEC } from './render.js';

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const v = n => `var(--loupe-${n})`;
const f1 = n => Math.round(n * 10) / 10;

// PROPOSAL, awaiting the design review (nothing here is in tokens.json or a loupe-spec block yet): which existing edge
// slot each declared edge kind takes. audio is slot 3 as everywhere; control/modulation reuse the param and mod slots
// (SPEC.slot.role); event takes the call slot; observation takes the reference slot. Provenance `declared` reuses the
// solid pattern (SPEC.dash.static) until the review gives it its own.
export const DECLARED_EDGE_SLOT = { audio: 'edge-3', control: 'edge-4', modulation: 'edge-5', event: 'edge-1', observation: 'edge-8' };
export const DECLARED_DASH = SPEC.dash.static;

// Geometry, in world units. Only layout constants: every visual value (colour, stroke, dash) comes from tokens.
const G = { w: 164, h: 28, gapX: 30, gapY: 12, pad: 8, hdr: 18, margin: 24, head: 46 };

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inside = (o, a) => a.x >= o.x - 0.01 && a.y >= o.y - 0.01 && a.x + a.w <= o.x + o.w + 0.01 && a.y + a.h <= o.y + o.h + 0.01;

export function layoutSpine(data) {
  const sp = data.graph.declaration.signalPath;
  const ids = data.nodeIds, nodeOf = {};
  ids.forEach(id => { nodeOf[data.nodes[id].path] = id; });
  const edgeOf = {};
  data.edges.forEach(e => { const d = (e.evidence || []).find(x => x.type === 'declaration'); if (d) edgeOf[d.id] = e; });
  const ext = id => (data.nodes[id].declared || {}).scope === 'external';

  // ---- 1. the spine: columns are the stages, in declared order; a block sits in the first stage that names it,
  // whatever its scope (an external block named by a stage stays on the spine: Julian, poll 2026-11-01)
  const pos = {}, stack = [], unresolved = [];
  const stages = sp.map((st, i) => {
    stack[i] = 0;
    const named = [], fresh = [];
    for (const x of st.ids) {
      const ends = nodeOf[x] ? [nodeOf[x]] : edgeOf[x] ? [edgeOf[x].src, edgeOf[x].dst] : null; // an edge names src, then dst (src above dst)
      if (!ends) { unresolved.push({ stage: i, id: x }); continue; }
      for (const id of ends) {
        if (!named.includes(id)) named.push(id);
        if (!pos[id]) { pos[id] = { col: i, side: 0, depth: 0, row: stack[i]++, region: 'C' }; fresh.push(id); }
      }
    }
    return { i, text: st.stage, ids: st.ids, named, fresh, refs: fresh.length ? [] : named };
  });
  const nCols = sp.length, band = Math.max(1, ...stack);

  const nbrs = {};
  ids.forEach(id => { nbrs[id] = []; });
  data.edges.forEach(e => { if (e.src === e.dst) return; nbrs[e.src].push({ other: e.dst, e, into: true }); nbrs[e.dst].push({ other: e.src, e, into: false }); });
  const parentOf = {}, kids = {};
  ids.forEach(id => { const p = data.nodes[id].declared && data.nodes[id].declared.parent; if (p != null && nodeOf[p]) { parentOf[id] = nodeOf[p]; (kids[nodeOf[p]] = kids[nodeOf[p]] || []).push(id); } });
  const members = id => [id].concat(...(kids[id] || []).map(members));

  // ---- 2. rails: an off-path external block leaves the columns ("frame the spine"). Only declared scope and the direction
  // of its declared edges to engine blocks decide: out of it into the engine is an input (LEFT), into it from the engine
  // is an output (RIGHT), into it and every such edge an observation is an observer (BOTTOM), both ways is LEFT and listed.
  const rail = {}, bothWays = [];
  const offExt = ids.filter(id => !pos[id] && ext(id));
  for (const id of offExt) {
    const es = nbrs[id].filter(n => !ext(n.other)), outs = es.filter(n => n.into), ins = es.filter(n => !n.into);
    if (!es.length) continue;
    if (outs.length) { rail[id] = 'L'; if (ins.length) bothWays.push(id); }
    else rail[id] = ins.every(n => n.e.kind === 'observation') ? 'B' : 'R';
  }
  // No edge to an engine block: with its parent's rail if the parent is external and railed, else LEFT.
  const pending = new Set(offExt.filter(id => !rail[id]));
  while (pending.size) for (const id of [...pending]) {
    const pr = parentOf[id];
    if (pr && pending.has(pr)) continue;
    rail[id] = (pr && rail[pr]) || 'L'; pending.delete(id);
  }

  // ---- 3. off-path engine blocks hang off the spine (BFS rounds, chosen from the placed set at round start): the column
  // is the LOWER MEDIAN of the columns of its placed neighbours (one per neighbour; its lowest edge id), above when the
  // edge to the neighbour at that column goes into it, below when it comes out. Railed blocks are not columns.
  const taken = new Set(); // `${col}:${side}:${depth}`
  const hang = (id, col, side, depth) => { while (taken.has(`${col}:${side}:${depth}`)) depth++; taken.add(`${col}:${side}:${depth}`); return { col, side, depth, region: 'C' }; };
  for (;;) {
    const round = [];
    for (const id of ids) {
      if (pos[id] || rail[id]) continue;
      const per = new Map();
      for (const n of nbrs[id]) if (pos[n.other] && (!per.has(n.other) || cmp(n.e.id, per.get(n.other).e.id) < 0)) per.set(n.other, n);
      if (!per.size) continue;
      const cs = [...per.values()].sort((a, b) => pos[a.other].col - pos[b.other].col || cmp(a.e.id, b.e.id));
      const med = pos[cs[Math.floor((cs.length - 1) / 2)].other].col;
      round.push([id, cs.find(n => pos[n.other].col === med)]);
    }
    if (!round.length) break;
    for (const [id, n] of round) {
      const nb = pos[n.other];
      // Above when the edge goes into the neighbour, below when it comes out. Hanging off another off-path block, it goes
      // one row further out on that block's own side: the edge direction then no longer says which side (ambiguity 1).
      const h = hang(id, nb.col, nb.side === 0 ? (n.into ? -1 : 1) : nb.side, nb.side === 0 ? 1 : nb.depth + 1);
      pos[id] = { ...h, row: h.side < 0 ? -h.depth : band - 1 + h.depth };
    }
  }
  // Rules 2 and 3 of the first draft still meet here: an engine block with no placed neighbour belongs in the tray, but
  // a container's box must hold its own node, and a tray column would stretch the box across the diagram. So it hangs
  // below the earliest-column placed relative (its declared parent, or one of its members); only a block with none goes
  // to the tray (ambiguity 2).
  for (let moved = true; moved;) {
    moved = false;
    for (const id of ids) {
      if (pos[id] || rail[id]) continue;
      // A container hangs at the earliest column of its own placed descendants (its box must not reach back to its parent's
      // earliest column: that stretched noise and sub across the diagram); only a non-container falls back to its parent.
      const mem = members(id).slice(1).filter(x => pos[x]), rel = (mem.length ? mem : parentOf[id] && pos[parentOf[id]] ? [parentOf[id]] : []).sort((a, b) => pos[a].col - pos[b].col || cmp(a, b));
      if (!rel.length) continue;
      const h = hang(id, pos[rel[0]].col, 1, 1);
      pos[id] = { ...h, row: band - 1 + h.depth }; moved = true;
    }
  }
  const tray = ids.filter(id => !pos[id] && !rail[id]);

  // ---- 4. rows are one global integer line. Rails: LEFT before column 0, RIGHT after the last column, BOTTOM one row
  // under everything with its blocks in the column of their earliest engine neighbour (the next free one to the right).
  const colRows = Object.values(pos).map(p => p.row);
  const rMin = Math.min(0, ...colRows);
  const early = id => { const c = nbrs[id].filter(n => !ext(n.other) && pos[n.other]).map(n => pos[n.other].col); return c.length ? Math.min(...c) : parentOf[id] && rail[parentOf[id]] ? early(parentOf[id]) : Infinity; };
  const onRail = r => ids.filter(id => rail[id] === r).sort((a, b) => early(a) - early(b) || cmp(data.nodes[a].path, data.nodes[b].path));
  const L = onRail('L'), R = onRail('R'), B = onRail('B');
  const hasL = L.length > 0, hasR = R.length > 0;
  let rLast = Math.max(band - 1, ...colRows, rMin + L.length - 1, rMin + R.length - 1, rMin + tray.length - 1);
  let cEnd = nCols - 1, prev = -1;
  const bCol = {};
  B.forEach(id => { prev = Math.max(Number.isFinite(early(id)) ? early(id) : 0, prev + 1); bCol[id] = prev; cEnd = Math.max(cEnd, prev); });
  const rB = rLast + 1;
  if (B.length) rLast = rB;
  const cR = cEnd + 1, cT = cEnd + (hasR ? 2 : 1), cMin = hasL ? -1 : 0, cMax = tray.length ? cT : hasR ? cR : cEnd;
  L.forEach((id, k) => { pos[id] = { col: -1, side: 0, depth: 0, row: rMin + k, region: 'L' }; });
  R.forEach((id, k) => { pos[id] = { col: cR, side: 0, depth: 0, row: rMin + k, region: 'R' }; });
  B.forEach(id => { pos[id] = { col: bCol[id], side: 0, depth: 0, row: rB, region: 'B' }; });
  tray.forEach((id, k) => { pos[id] = { col: cT, side: 0, depth: 0, row: rMin + k, region: 'T' }; });

  // ---- 5. containers: one box per container per region its members stand in (columns, a rail, the strip, the tray), over
  // its members there; nested boxes sit inside their parent's. A container whose own node is in another region gets a
  // dashed "continued" box in this one, with the same header; one box is never stretched across regions.
  const depthOf = id => (parentOf[id] ? 1 + depthOf(parentOf[id]) : 0);
  const boxes = [], box = {};
  for (const id of Object.keys(kids).sort(cmp)) {
    const m = members(id);
    for (const region of ['C', 'L', 'R', 'B', 'T']) {
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
  if (B.length) rowT[rB] = Math.max(rowT[rB] || 0, 20); // room for the strip's label
  const X = {}, Y = {}, gapAt = c => (c === 0 && hasL) || c === cR || c === cT ? G.gapX + 40 : G.gapX; // rails stand apart from the columns
  X[cMin] = G.margin + (colL[cMin] || 0);
  for (let c = cMin + 1; c <= cMax; c++) X[c] = X[c - 1] + G.w + gapAt(c) + (colR[c - 1] || 0) + (colL[c] || 0);
  Y[rMin] = G.head + G.margin + (rowT[rMin] || 0);
  for (let r = rMin + 1; r <= rLast; r++) Y[r] = Y[r - 1] + G.h + G.gapY + (rowB[r - 1] || 0) + (rowT[r] || 0);
  ids.forEach(id => { const p = pos[id]; p.x = X[p.col]; p.y = Y[p.row]; p.w = G.w; p.h = G.h; });
  boxes.forEach(b => { b.x = X[b.c0] - b.l; b.y = Y[b.r0] - b.t; b.w = X[b.c1] + G.w + b.r - b.x; b.h = Y[b.r1] + G.h + b.b - b.y; });

  // ---- 6. a container whose box overlaps one that is not its ancestor or descendant is reported in `overlaps`, not hidden
  // (map.spine.overlaps; not map.layout.overlaps, which conserve() reads as sections dragged on top of each other and
  // would break a meter that is otherwise balanced: every node and edge is drawn). A node standing inside a box it is
  // not a member of is reported the same way in `intrusions`: the box would claim it. Both are consequences of the
  // declared placement, never repaired.
  const overlaps = [], intrusions = [], rel = (a, b) => a.members.includes(b.id) || b.members.includes(a.id);
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) if (!rel(boxes[i], boxes[j]) && hit(boxes[i], boxes[j])) overlaps.push([boxes[i].key, boxes[j].key]);
  for (const b of boxes) for (const id of ids) if (!b.members.includes(id) && hit(b, pos[id])) intrusions.push([b.key, id]);

  const ruleY = G.head - 4, span = { x: X[0] - G.gapX / 2, w: X[cEnd] + G.w + G.gapX / 2 - (X[0] - G.gapX / 2) };
  const band0 = Y[0] - 6, bandBox = { x: span.x, w: span.w, y: band0, h: Y[band - 1] + G.h + 6 - band0 };
  const W = X[cMax] + G.w + (colR[cMax] || 0) + G.margin, H = Y[rLast] + G.h + (rowB[rLast] || 0) + G.margin;
  const tr = tray.length ? { x: X[cT] - 8, y: Y[rMin] - 22, w: G.w + 16, h: (Y[rMin + tray.length - 1] + G.h + 8) - (Y[rMin] - 22), ids: tray } : null;
  const rails = { L: hasL ? { x: X[-1], ids: L } : null, R: hasR ? { x: X[cR], ids: R } : null, B: B.length ? { y: Y[rB] - 8, x: X[0] - G.gapX / 2, ids: B } : null };
  stages.forEach(s => { s.x = X[s.i] + G.w / 2; });
  const inC = ids.filter(id => pos[id].region === 'C'), below = Math.max(0, ...inC.map(id => pos[id].row)) - (band - 1);
  return { w: W, h: H, geom: G, ruleY, stages, pos, boxes, tray: tr, rails, bothWays, band: bandBox, span, overlaps, intrusions, unresolved,
    counts: { columns: nCols, spine: inC.filter(id => pos[id].side === 0).length, above: -Math.min(0, ...inC.map(id => pos[id].row)), below, band,
      left: L.length, right: R.length, bottom: B.length, bothWays: bothWays.length, tray: tray.length,
      boxes: boxes.length, continued: boxes.filter(b => b.continued).length, overlaps: overlaps.length, intrusions: intrusions.length } };
}

// Where the segment from the centre of one rect to the centre of another leaves the first and enters the second.
const clip = (A, B) => {
  const ax = A.x + A.w / 2, ay = A.y + A.h / 2, bx = B.x + B.w / 2, by = B.y + B.h / 2, dx = bx - ax, dy = by - ay;
  const t = r => Math.min(dx ? (r.w / 2) / Math.abs(dx) : Infinity, dy ? (r.h / 2) / Math.abs(dy) : Infinity);
  return { a: { x: ax + dx * t(A), y: ay + dy * t(A) }, b: { x: bx - dx * t(B), y: by - dy * t(B) } };
};
const cut = (s, n) => (s.length > n ? s.slice(0, Math.max(1, n - 1)) + '…' : s);

export function renderSpine(container, data, state, lay) {
  let layer = container.querySelector(':scope > .spine');
  if (!layer) { layer = document.createElement('div'); layer.className = 'spine'; container.appendChild(layer); }
  const Wd = container.clientWidth || 800, Hd = container.clientHeight || 600;
  const zs = state.zoom || { auto: true };
  const z = zs.auto ? (() => { const k = Math.min((Wd - 48) / lay.w, (Hd - 120) / lay.h, 1.1); return { k, x: (Wd - lay.w * k) / 2, y: (Hd - 96 - lay.h * k) / 2 }; })() : { k: zs.k, x: zs.x, y: zs.y };
  const sel = state.selection, selNode = sel && sel.type === 'node' ? sel.id : null, selEdge = sel && sel.type === 'edge' ? sel.id : null;
  const map = { zoom: z, lod: 'detail', nodes: {}, edges: {}, elements: {}, layout: { spine: true, folds: {} }, drawn: new Set(), settled: true };
  const P = lay.pos, nm = id => data.nodes[id];
  const colW = lay.stages.map((s, i) => (i + 1 < lay.stages.length ? lay.stages[i + 1].x : s.x + lay.geom.w + 40) - s.x);

  let defs = '', under = '', over = '';
  for (const [k, slot] of Object.entries(DECLARED_EDGE_SLOT)) defs += `<marker id="sp-${k}" viewBox="0 0 9 8" refX="8.6" refY="4" markerWidth="9" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto"><path d="M0 .4L9 4L0 7.6z" style="fill:${v(slot)}"/></marker>`;

  // The spine itself: a band behind the rows of the signal path, and the rule with one tick and one label per stage.
  under += `<rect x="${f1(lay.band.x)}" y="${f1(lay.band.y)}" width="${f1(lay.band.w)}" height="${f1(lay.band.h)}" style="fill:${v('surface-group-nested')};opacity:${v('opacity-dim')}"><title>The declared signal path: each stage, in declared order, left to right</title></rect>`;
  under += `<line x1="${f1(lay.span.x)}" y1="${lay.ruleY}" x2="${f1(lay.span.x + lay.span.w)}" y2="${lay.ruleY}" style="stroke:${v('ink-muted')};stroke-width:${v('stroke-edge-emph')}"/>`;
  lay.stages.forEach((s, i) => {
    const fit = Math.max(8, Math.floor((colW[i] - 8) / 5.8));
    under += `<g data-stage="${i}"><title>${esc(`${i + 1}. ${s.text}`)}</title><line x1="${f1(s.x)}" y1="${lay.ruleY - 5}" x2="${f1(s.x)}" y2="${lay.ruleY}" style="stroke:${v('ink-muted')};stroke-width:${v('stroke-edge-emph')}"/>` +
      `<text x="${f1(s.x - colW[i] / 2 + 4 + lay.geom.w / 2)}" y="${lay.ruleY - 22}" style="font:600 10px/1 ${v('font-ui')};fill:${v('ink')}">${i + 1}</text>` +
      `<text x="${f1(s.x - colW[i] / 2 + 4 + lay.geom.w / 2)}" y="${lay.ruleY - 9}" style="font:500 10px/1 ${v('font-ui')};fill:${v('ink-muted')}">${esc(cut(s.text, fit))}</text></g>`;
    // A stage that names only items already placed adds no box: a thin mark from its tick to each of them.
    for (const id of s.refs) under += `<line data-ref="${i}" x1="${f1(s.x)}" y1="${lay.ruleY}" x2="${f1(P[id].x + P[id].w / 2)}" y2="${f1(P[id].y)}" style="stroke:${v('ink-faint')};stroke-width:1px;stroke-dasharray:${SPEC.dash.gap}"><title>${esc(`stage ${i + 1} names ${nm(id).path} again`)}</title></line>`;
  });

  // Containers, outermost first so a nested box draws over its parent. The header band carries id and multiplicity.
  [...lay.boxes].sort((a, b) => a.depth - b.depth || (a.id < b.id ? -1 : 1)).forEach(b => {
    const n = nm(b.id), d = n.declared || {}, mult = d.multiplicity ? ' × ' + d.multiplicity : '';
    // A continued box (this container's own node stands in another region) is dashed: the same container, one more place.
    under += `<g data-container="${esc(b.key)}"><rect x="${f1(b.x)}" y="${f1(b.y)}" width="${f1(b.w)}" height="${f1(b.h)}" rx="6" style="fill:${v('surface-group')};fill-opacity:.55;stroke:${v('ink-faint')};stroke-width:1px;stroke-dasharray:${b.continued ? SPEC.dash.gap : 'none'}"/>` +
      `<text x="${f1(b.x + 8)}" y="${f1(b.y + 13)}" style="font:600 10.5px/1 ${v('font-mono')};fill:${v('ink-muted')}">${esc(cut(n.path + mult, Math.floor((b.w - 16) / 6.3)))}<title>${esc(n.path + mult + (b.continued ? ' (continued: its own block stands elsewhere)' : ''))}</title></text></g>`;
  });
  const railText = (x, y, t, tip) => `<text x="${f1(x)}" y="${f1(y)}" style="font:600 10px/1 ${v('font-ui')};fill:${v('ink-muted')}">${esc(t)}<title>${esc(tip)}</title></text>`;
  if (lay.rails.L) under += railText(lay.rails.L.x, lay.ruleY - 9, 'Inputs', 'External blocks whose declared edges go out of them into the engine (both ways: here too)');
  if (lay.rails.R) under += railText(lay.rails.R.x, lay.ruleY - 9, 'Outputs', 'External blocks the engine\'s declared edges go into');
  if (lay.rails.B) under += railText(lay.rails.B.x, lay.rails.B.y, 'Observers: external blocks only observation edges go into', 'External blocks every declared edge into which is an observation');
  if (lay.tray) under += `<g data-tray="1"><rect x="${f1(lay.tray.x)}" y="${f1(lay.tray.y)}" width="${f1(lay.tray.w)}" height="${f1(lay.tray.h)}" rx="6" style="fill:none;stroke:${v('ink-faint')};stroke-width:1px;stroke-dasharray:${SPEC.dash.gap}"/><text x="${f1(lay.tray.x + 8)}" y="${f1(lay.tray.y + 13)}" style="font:600 10.5px/1 ${v('font-ui')};fill:${v('ink-muted')}">Tray: no declared edge to the path</text></g>`;

  // Edges: one line each, coloured by kind. data-edge is on a group with a wider invisible stroke so thin lines click.
  for (const e of data.edges) {
    const A = P[e.src], B = P[e.dst], on = selEdge === e.id, slot = DECLARED_EDGE_SLOT[e.kind] || 'edge-8';
    const ink = on ? 'accent' : slot, w = on ? v('stroke-hub') : v('stroke-edge');
    const d = e.src === e.dst
      ? `M${f1(A.x + A.w - 26)} ${f1(A.y)}C${f1(A.x + A.w - 26)} ${f1(A.y - 22)} ${f1(A.x + A.w - 4)} ${f1(A.y - 22)} ${f1(A.x + A.w - 4)} ${f1(A.y)}`
      : (() => { const c = clip(A, B); return `M${f1(c.a.x)} ${f1(c.a.y)}L${f1(c.b.x)} ${f1(c.b.y)}`; })();
    const tip = `${e.kind}${e.label ? ': ' + e.label : ''} · ${e.provenance} · ${nm(e.src).path} → ${nm(e.dst).path}${e.src === e.dst ? ' (between its instances)' : ''}`;
    over += `<g data-edge="${esc(e.id)}" style="cursor:pointer"><title>${esc(tip)}</title><path d="${d}" style="fill:none;stroke:transparent;stroke-width:9px;pointer-events:stroke"/>` +
      `<path d="${d}" style="fill:none;stroke:${v(ink)};stroke-width:${w};stroke-dasharray:${DECLARED_DASH};pointer-events:none" marker-end="url(#sp-${DECLARED_EDGE_SLOT[e.kind] ? e.kind : 'observation'})"/></g>`;
    map.edges[e.id] = { via: 'drawn' };
  }

  // Nodes: a slot (a reserved, unbuilt place) draws with the gap dash, a block solid; external scope sits on the muted surface.
  for (const id of data.nodeIds) {
    const p = P[id], n = nm(id), d = n.declared || {}, on = selNode === id, slot = n.kind === 'slot', ext = d.scope === 'external';
    over += `<g data-node="${esc(id)}" style="cursor:pointer"><title>${esc(`${n.path}${slot ? ' (slot: reserved, not built)' : ''}${ext ? ' (external)' : ''}${d.label ? ': ' + d.label : ''}${d.cites && d.cites.length ? ' · ' + d.cites.join(', ') : ''}`)}</title>` +
      `<rect x="${f1(p.x)}" y="${f1(p.y)}" width="${p.w}" height="${p.h}" rx="5" style="fill:${v(ext ? 'surface-group-nested' : 'surface-node')};stroke:${v(on ? 'accent' : 'ink-muted')};stroke-width:${on ? 2 : 1.25}px;stroke-dasharray:${slot ? SPEC.dash.gap : 'none'}"/>` +
      `<text x="${f1(p.x + 8)}" y="${f1(p.y + p.h / 2 + 3.5)}" style="font:500 11px/1 ${v('font-mono')};fill:${v(ext ? 'ink-muted' : 'ink')}">${esc(cut(n.path, Math.floor((p.w - 14) / 6.6)))}</text></g>`;
    map.nodes[id] = { state: 'drawn' };
  }

  layer.innerHTML = `<svg class="sp-svg" width="100%" height="100%" style="position:absolute;left:0;top:0"><defs>${defs}</defs><g transform="translate(${f1(z.x)} ${f1(z.y)}) scale(${z.k})">${under}${over}</g></svg>`;
  map.spine = { overlaps: lay.overlaps, intrusions: lay.intrusions, counts: lay.counts };
  return map;
}
