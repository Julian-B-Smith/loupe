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

  // ---- 1. the spine: columns are the stages, in declared order; an item sits in the first stage that names it
  const pos = {}, stack = [], unresolved = [];
  const stages = sp.map((st, i) => {
    stack[i] = 0;
    const named = [], fresh = [];
    for (const x of st.ids) {
      const ends = nodeOf[x] ? [nodeOf[x]] : edgeOf[x] ? [edgeOf[x].src, edgeOf[x].dst] : null; // an edge names src, then dst (src above dst)
      if (!ends) { unresolved.push({ stage: i, id: x }); continue; }
      for (const id of ends) {
        if (!named.includes(id)) named.push(id);
        if (!pos[id]) { pos[id] = { col: i, side: 0, depth: 0, row: stack[i]++ }; fresh.push(id); }
      }
    }
    return { i, text: st.stage, ids: st.ids, named, fresh, refs: fresh.length ? [] : named };
  });
  const nCols = sp.length, band = Math.max(1, ...stack);

  // ---- 2. off-path items hang off the spine by a declared edge (BFS rounds; chosen from the placed set at round start)
  const nbrs = {};
  ids.forEach(id => { nbrs[id] = []; });
  data.edges.forEach(e => { if (e.src === e.dst) return; nbrs[e.src].push({ other: e.dst, e, into: true }); nbrs[e.dst].push({ other: e.src, e, into: false }); });
  const taken = new Set(); // `${col}:${side}:${depth}`
  for (;;) {
    const round = [];
    for (const id of ids) {
      if (pos[id]) continue;
      const c = nbrs[id].filter(n => pos[n.other]).sort((a, b) => pos[a.other].col - pos[b.other].col || cmp(a.e.id, b.e.id));
      if (c.length) round.push([id, c[0]]);
    }
    if (!round.length) break;
    for (const [id, n] of round) {
      const nb = pos[n.other];
      // Above when the edge goes into the neighbour, below when it comes out. Hanging off another off-path item, it goes
      // one row further out on that item's own side: the edge direction then no longer says which side (ambiguity 1).
      const side = nb.side === 0 ? (n.into ? -1 : 1) : nb.side;
      let depth = nb.side === 0 ? 1 : nb.depth + 1;
      while (taken.has(`${nb.col}:${side}:${depth}`)) depth++;
      taken.add(`${nb.col}:${side}:${depth}`);
      pos[id] = { col: nb.col, side, depth, row: side < 0 ? -depth : band - 1 + depth };
    }
  }
  // Rules 2 and 3 meet here: an item with no declared edge belongs in the tray, but a container's box must hold its own
  // node, and a tray column after the last stage would stretch the box across the whole diagram. So an edgeless item
  // that has a placed container relative (its declared parent, or, for a container, one of its members) hangs below the
  // earliest-column relative instead; only an edgeless item with no placed relative goes to the tray (ambiguity 2).
  const parentOf = {}, kids = {};
  ids.forEach(id => { const p = data.nodes[id].declared && data.nodes[id].declared.parent; if (p != null && nodeOf[p]) { parentOf[id] = nodeOf[p]; (kids[nodeOf[p]] = kids[nodeOf[p]] || []).push(id); } });
  const members = id => [id].concat(...(kids[id] || []).map(members));
  for (let moved = true; moved;) {
    moved = false;
    for (const id of ids) {
      if (pos[id] || nbrs[id].length) continue;
      const rel = (parentOf[id] ? [parentOf[id]] : []).concat(members(id).slice(1)).filter(x => pos[x]).sort((a, b) => pos[a].col - pos[b].col || cmp(a, b));
      if (!rel.length) continue;
      const col = pos[rel[0]].col; let depth = 1;
      while (taken.has(`${col}:1:${depth}`)) depth++;
      taken.add(`${col}:1:${depth}`);
      pos[id] = { col, side: 1, depth, row: band - 1 + depth }; moved = true;
    }
  }
  const tray = ids.filter(id => !pos[id]);

  // ---- 3. rows are one global integer line; the tray is one more column after the last stage
  const placed = ids.filter(id => pos[id]);
  const rMin = Math.min(0, ...placed.map(id => pos[id].row)), rMax = Math.max(band - 1, ...placed.map(id => pos[id].row));
  tray.forEach((id, k) => { pos[id] = { col: nCols, side: 0, depth: 0, row: rMin + k, tray: true }; });
  const rLast = Math.max(rMax, rMin + tray.length - 1), cLast = tray.length ? nCols : nCols - 1;

  // ---- 4. containers: boxes over their node and all descendants; nested boxes sit inside their parent's
  const depthOf = id => (parentOf[id] ? 1 + depthOf(parentOf[id]) : 0);
  const boxes = Object.keys(kids).sort(cmp).map(id => {
    const m = members(id), ps = m.map(x => pos[x]);
    return { id, members: m, parent: parentOf[id] || null, depth: depthOf(id), kids: (kids[id] || []).filter(k => kids[k]),
      c0: Math.min(...ps.map(p => p.col)), c1: Math.max(...ps.map(p => p.col)), r0: Math.min(...ps.map(p => p.row)), r1: Math.max(...ps.map(p => p.row)) };
  });
  const box = {}; boxes.forEach(b => { box[b.id] = b; });
  // Margins a box needs on each side, deepest first, so a nested box that shares an edge with its parent leaves room.
  const need = b => {
    if (b.l != null) return b;
    const k = b.kids.map(x => need(box[x])), most = (same, m) => Math.max(0, ...k.filter(same).map(x => x[m]));
    b.l = G.pad + most(x => x.c0 === b.c0, 'l'); b.r = G.pad + most(x => x.c1 === b.c1, 'r');
    b.t = G.hdr + G.pad + most(x => x.r0 === b.r0, 't'); b.b = G.pad + most(x => x.r1 === b.r1, 'b');
    return b;
  };
  boxes.forEach(need);
  const colL = [], colR = [], rowT = {}, rowB = {};
  boxes.forEach(b => { colL[b.c0] = Math.max(colL[b.c0] || 0, b.l); colR[b.c1] = Math.max(colR[b.c1] || 0, b.r); rowT[b.r0] = Math.max(rowT[b.r0] || 0, b.t); rowB[b.r1] = Math.max(rowB[b.r1] || 0, b.b); });
  const X = [], Y = {};
  X[0] = G.margin + (colL[0] || 0);
  for (let c = 1; c <= cLast; c++) X[c] = X[c - 1] + G.w + G.gapX + (colR[c - 1] || 0) + (colL[c] || 0);
  Y[rMin] = G.head + G.margin + (rowT[rMin] || 0);
  for (let r = rMin + 1; r <= rLast; r++) Y[r] = Y[r - 1] + G.h + G.gapY + (rowB[r - 1] || 0) + (rowT[r] || 0);
  ids.forEach(id => { const p = pos[id]; p.x = X[p.col]; p.y = Y[p.row]; p.w = G.w; p.h = G.h; });
  boxes.forEach(b => { b.x = X[b.c0] - b.l; b.y = Y[b.r0] - b.t; b.w = X[b.c1] + G.w + b.r - b.x; b.h = Y[b.r1] + G.h + b.b - b.y; });

  // ---- 5. a container whose box overlaps one that is not its ancestor or descendant is reported in `overlaps`, not hidden
  // (map.spine.overlaps; not map.layout.overlaps, which conserve() reads as sections dragged on top of each other and
  // would break a meter that is otherwise balanced: every node and edge is drawn). A node standing inside a box it is
  // not a member of is reported the same way in `intrusions`: the box would claim it. Both are consequences of the
  // declared placement, never repaired.
  const overlaps = [], intrusions = [], rel = (a, b) => a.members.includes(b.id) || b.members.includes(a.id);
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) if (!rel(boxes[i], boxes[j]) && hit(boxes[i], boxes[j])) overlaps.push([boxes[i].id, boxes[j].id]);
  for (const b of boxes) for (const id of ids) if (!b.members.includes(id) && hit(b, pos[id])) intrusions.push([b.id, id]);

  const stageX = c => X[c] + G.w / 2, ruleY = G.head - 4;
  const bandBox = { x: 0, y: Y[0] - 6, h: Y[band - 1] + G.h + 6 - (Y[0] - 6) };
  const W = X[cLast] + G.w + (colR[cLast] || 0) + G.margin, H = Y[rLast] + G.h + (rowB[rLast] || 0) + G.margin;
  bandBox.w = W;
  const tr = tray.length ? { x: X[nCols] - 8, y: Y[rMin] - 22, w: G.w + 16, h: (Y[rMin + tray.length - 1] + G.h + 8) - (Y[rMin] - 22), ids: tray } : null;
  stages.forEach(s => { s.x = stageX(s.i); });
  return { w: W, h: H, geom: G, ruleY, stages, pos, boxes, tray: tr, band: bandBox, overlaps, intrusions, unresolved,
    counts: { columns: nCols, spine: ids.filter(id => pos[id].side === 0 && !pos[id].tray).length, above: rMin < 0 ? -rMin : 0, below: rLast - (band - 1) > 0 ? rLast - (band - 1) : 0, band, tray: tray.length, boxes: boxes.length, overlaps: overlaps.length, intrusions: intrusions.length } };
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
  under += `<rect x="0" y="${f1(lay.band.y)}" width="${f1(lay.band.w)}" height="${f1(lay.band.h)}" style="fill:${v('surface-group-nested')};opacity:${v('opacity-dim')}"><title>The declared signal path: each stage, in declared order, left to right</title></rect>`;
  under += `<line x1="0" y1="${lay.ruleY}" x2="${f1(lay.w)}" y2="${lay.ruleY}" style="stroke:${v('ink-muted')};stroke-width:${v('stroke-edge-emph')}"/>`;
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
    under += `<g data-container="${esc(b.id)}"><rect x="${f1(b.x)}" y="${f1(b.y)}" width="${f1(b.w)}" height="${f1(b.h)}" rx="6" style="fill:${v('surface-group')};fill-opacity:.55;stroke:${v('ink-faint')};stroke-width:1px"/>` +
      `<text x="${f1(b.x + 8)}" y="${f1(b.y + 13)}" style="font:600 10.5px/1 ${v('font-mono')};fill:${v('ink-muted')}">${esc(cut(n.path + mult, Math.floor((b.w - 16) / 6.3)))}<title>${esc(n.path + mult)}</title></text></g>`;
  });
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
