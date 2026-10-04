// layout(data, state) -> positions only, in world units. A simple placeholder engine;
// infrastructure replaces it. Reads structure from view.json and never invents it.
// Design rules it applies: band levels stack top to bottom; small sections stack in one column;
// a section alone in its level flows horizontally; files outside every level sit in a side gutter;
// twins hang from an interface plate; a lane inside one section wraps its steps in order.

export const L = {
  node: { w: 156, h: 24 }, pad: 14, header: 36, rowGap: 14, colGap: 150, stackGap: 40,
  levelGap: 110, hubGap: 140, bandHead: 34, bandPadX: 20, flowGap: 44,
  laneHead: 54, laneGutter: 34, laneNotch: 10, lanePoint: 16,
  plateH: 56, twinGap: 18, stackSlack: 1.15,
  foldAt: 12, foldSlack: 2,                 // fold a section past foldAt rows, but only when that hides more than foldSlack files
  railGap: 170, portW: 250, portGap: 10,    // isolate: side rails of ports
  flow: { colGap: 56, rowGap: 8 }
};

export function layout(data, state) {
  return state.view === 'flow' ? flowLayout(data, state) : designLayout(data, state);
}

function removedNodes(data, state) {
  return state.diff && data.diff ? data.diff.removed || [] : [];
}

function membersOf(data, state, sec) {
  return data.elements[sec].members.filter(m => data.nodes[m])
    .concat(removedNodes(data, state).filter(r => r.home === sec).map(r => r.id));
}

// Files some element makes a claim about (lane step, hub, set, overlap, loop) are never folded away:
// hiding them would hide the claim. Degree ranks the rest so a fold keeps the busiest files visible.
const foldInfo = new WeakMap();
function foldMeta(data) {
  let m = foldInfo.get(data); if (m) return m;
  const pinned = new Set(), deg = {};
  data.order.forEach(id => { const el = data.elements[id];
    (el.steps || []).concat(el.node ? [el.node] : [], el.primitive === 'section' ? [] : el.members || [], el.cycle || []).forEach(n => pinned.add(n));
    // Bus endpoints too: a bus edge landing on a fold row would leave its rail without an end.
    (el.primitive === 'bus' ? el.edges : []).forEach(x => { const e = data.edgeById[x]; if (e) { pinned.add(e.src); pinned.add(e.dst); } }); });
  data.edges.forEach(e => { deg[e.src] = (deg[e.src] || 0) + 1; deg[e.dst] = (deg[e.dst] || 0) + 1; });
  foldInfo.set(data, (m = { pinned, deg }));
  return m;
}

export function hubPlacement(data, state) {
  return (state.settings && state.settings.hubPlacement) || data.settings.hubPlacement || 'group';
}

function designLayout(data, state) {
  const N = L.node, collapsed = new Set(state.collapsed || []);
  const els = id => data.elements[id];
  const lanes = (data.byPrimitive.lane || []).map(els);
  const twinsEls = (data.byPrimitive.twins || []).map(els);
  // Isolate (state.isolate = section id): lay out only that section's subtree; everything else becomes ports.
  const iso = state.isolate && data.elements[state.isolate] ? state.isolate : null;
  const band = iso ? null : (data.byPrimitive.band || []).map(els)[0] || null;
  const hubs = (data.byPrimitive.hub || []).map(els);
  const centered = hubPlacement(data, state) === 'center' && band ? new Set(hubs.map(h => h.node)) : new Set();

  const unfolded = new Set(state.unfolded || []), FM = foldMeta(data);
  // While a re-run diff is shown, changed, added, stale and removed files keep their own rows (their marks are the point).
  const D0 = state.diff && data.diff ? data.diff : null;
  const pinned = D0 ? new Set([...FM.pinned, ...(D0.added || []), ...(D0.changed || []), ...(D0.stale || []), ...(D0.removed || []).map(r => r.id)]) : FM.pinned;
  const P = { view: 'design', nodes: {}, proxy: {}, folds: {}, foldOf: {}, sections: {}, lanes: {}, plates: {}, levels: [], gutter: null, rails: {}, tethers: [], colOf: {}, levelOf: {}, bounds: null, iso: null };

  // ---- one section, returns {w,h}; target is P or a scratch object for measuring
  function place(T, sec, x, y, depth, flowWidth) {
    const el = els(sec);
    if (collapsed.has(sec)) {
      const w = N.w + 2 * L.pad;
      T.sections[sec] = { x, y, w, h: L.header, depth, collapsed: true };
      data.descendants(sec).forEach(s => membersOf(data, state, s).forEach(m => { T.proxy[m] = sec; }));
      return { w, h: L.header };
    }
    const mem = membersOf(data, state, sec).filter(m => !centered.has(m));
    const twins = twinsEls.find(t => t.members.every(m => data.parentOf[m] === sec));
    const lane = lanes.find(l => l.steps.length >= 2 && l.steps.every(s => mem.includes(s)));
    let cy = y + L.header, w = N.w + 2 * L.pad;

    if (flowWidth) { // horizontal flow, wrapping
      const inner = Math.max(N.w, flowWidth - 2 * L.pad);
      const perRow = Math.max(1, Math.floor((inner + L.flowGap) / (N.w + L.flowGap)));
      mem.forEach((m, i) => {
        const r = Math.floor(i / perRow), c = i % perRow;
        T.nodes[m] = { x: x + L.pad + c * (N.w + L.flowGap), y: cy + r * (N.h + L.rowGap), w: N.w, h: N.h };
      });
      const rows = Math.max(1, Math.ceil(mem.length / perRow));
      cy += rows * (N.h + L.rowGap) - L.rowGap;
      w = flowWidth;
    } else {
      const steps = lane ? lane.steps : [];
      let rows = mem.filter(m => !steps.includes(m)), hidden = [];
      if (!unfolded.has(sec) && rows.length > L.foldAt) {
        const free = rows.filter(m => !pinned.has(m));
        const keepN = Math.max(0, L.foldAt - (rows.length - free.length));
        const keep = new Set(free.slice().sort((a, b) => (FM.deg[b] || 0) - (FM.deg[a] || 0) || (a < b ? -1 : a > b ? 1 : 0)).slice(0, keepN));
        const h = free.filter(m => !keep.has(m));
        if (h.length > L.foldSlack) { hidden = h; rows = rows.filter(m => pinned.has(m) || keep.has(m)); }
      }
      rows.forEach(m => { T.nodes[m] = { x: x + L.pad, y: cy, w: N.w, h: N.h }; cy += N.h + L.rowGap; });
      if (hidden.length) {
        T.folds[sec] = { x: x + L.pad, y: cy, w: N.w, h: N.h, members: hidden };
        hidden.forEach(m => { T.foldOf[m] = sec; });
        cy += N.h + L.rowGap;
      }
      if (lane) {
        const top = cy; cy += L.laneHead;
        steps.forEach(m => { T.nodes[m] = { x: x + L.pad + L.laneGutter, y: cy, w: N.w, h: N.h }; cy += N.h + L.rowGap; });
        cy += L.lanePoint - L.rowGap + 4;
        const lw = N.w + L.laneGutter + 6;
        T.lanes[lane.id] = { mode: 'inline', x: x + L.pad, y: top, w: lw, h: cy - top, section: sec };
        w = lw + 2 * L.pad; cy += L.rowGap;
      }
      if (mem.length || lane) cy -= L.rowGap;
    }

    const kids = data.children[sec] || [];
    if (twins) {
      const n = twins.members.length, cols = n <= 3 ? n : Math.ceil(Math.sqrt(n));
      const cw = N.w + 2 * L.pad, innerW = cols * cw + (cols - 1) * L.twinGap;
      cy += mem.length ? L.twinGap : 0;
      T.plates[twins.id] = { x: x + L.pad, y: cy, w: innerW, h: L.plateH, rowTops: [] };
      cy += L.plateH + L.twinGap;
      for (let r = 0; r * cols < n; r++) {
        const row = twins.members.slice(r * cols, r * cols + cols);
        let rowH = 0;
        row.forEach((m, c) => { const s = place(T, m, x + L.pad + c * (cw + L.twinGap), cy, depth + 1); rowH = Math.max(rowH, s.h); });
        row.forEach(m => { T.sections[m].h = rowH; });
        T.plates[twins.id].rowTops.push(cy);
        cy += rowH + L.twinGap;
      }
      cy -= L.twinGap;
      w = Math.max(w, innerW + 2 * L.pad);
    }
    kids.filter(k => !twins || !twins.members.includes(k)).forEach(k => {
      cy += L.rowGap + 4;
      const s = place(T, k, x + L.pad, cy, depth + 1);
      cy += s.h; w = Math.max(w, s.w + 2 * L.pad);
    });
    const h = cy + L.pad - y;
    T.sections[sec] = { x, y, w, h, depth };
    return { w, h };
  }
  const scratch = () => ({ nodes: {}, proxy: {}, folds: {}, foldOf: {}, sections: {}, lanes: {}, plates: {} });
  const measure = sec => place(scratch(), sec, 0, 0, 0);

  // ---- levels and columns
  const tops = iso ? [iso] : data.sections.filter(s => !data.parentOf[s]);
  const levelDefs = band ? band.levels.map(l => ({ label: l.label, members: l.members.filter(m => tops.includes(m)) })) : [{ label: null, members: tops }];
  const inLevel = new Set(levelDefs.flatMap(l => l.members));
  const outside = band ? tops.filter(t => !inLevel.has(t)) : [];

  const columnsFor = members => {
    const sizes = members.map(m => ({ id: m, ...measure(m), small: !(data.children[m] || []).length }));
    const tallest = Math.max(0, ...sizes.map(s => s.h));
    const cols = [];
    sizes.forEach(s => {
      const col = cols[cols.length - 1];
      if (col && s.small && col.small && col.h + L.stackGap + s.h <= tallest * L.stackSlack) { col.items.push(s); col.h += L.stackGap + s.h; col.w = Math.max(col.w, s.w); }
      else cols.push({ items: [s], h: s.h, w: s.w, small: s.small });
    });
    return cols;
  };
  const plan = levelDefs.map(l => ({ ...l, alone: band && l.members.length === 1, cols: columnsFor(l.members) }));
  const colWidth = cols => cols.reduce((a, c) => a + c.w, 0) + Math.max(0, cols.length - 1) * L.colGap;
  const contentW = Math.max(N.w * 4, ...plan.filter(l => !l.alone).map(l => colWidth(l.cols)));
  const x0 = band ? L.bandPadX : 0;

  let y = 0;
  plan.forEach((lv, i) => {
    const top = y, cy0 = y + (band ? L.bandHead : 0);
    let h = 0;
    const cols = [];
    if (lv.alone) {
      const s = place(P, lv.members[0], x0, cy0, 0, contentW);
      h = s.h; cols.push({ x: x0, w: contentW });
      data.descendants(lv.members[0]).forEach(d => { P.levelOf[d] = i; P.colOf[d] = 0; });
    } else {
      let cx = x0;
      lv.cols.forEach((col, ci) => {
        let cy = cy0;
        col.items.forEach(it => {
          const s = place(P, it.id, cx, cy, 0);
          data.descendants(it.id).forEach(d => { P.levelOf[d] = i; P.colOf[d] = ci; });
          cy += s.h + L.stackGap;
        });
        h = Math.max(h, cy - L.stackGap - cy0);
        cols.push({ x: cx, w: col.w });
        cx += col.w + L.colGap;
      });
    }
    const bottom = cy0 + h + (band ? 12 : 0);
    P.levels.push({ label: lv.label, x: 0, y: top, w: contentW + 2 * x0, h: bottom - top, cols });
    const next = plan[i + 1];
    const hubNext = next && hubs.some(hb => centered.has(hb.node) && next.members.includes(data.topOf(data.home[hb.node])));
    y = bottom + (hubNext ? L.hubGap : L.levelGap);
  });
  const levelsBottom = y - L.levelGap;

  // ---- outside layers gutter
  let right = contentW + 2 * x0;
  if (outside.length) {
    const gx = right + L.colGap;
    let gy = L.bandHead, gw = 0;
    outside.forEach(s => {
      const r = place(P, s, gx + 12, gy, 0);
      data.descendants(s).forEach(d => { P.levelOf[d] = -1; P.colOf[d] = 0; });
      gy += r.h + L.stackGap; gw = Math.max(gw, r.w);
    });
    P.gutter = { x: gx, y: 0, w: gw + 24, h: Math.max(levelsBottom, gy), label: 'Outside layers' };
    right = gx + gw + 24;
  }

  // ---- manual offsets (state.offsets: top-level section id -> {dx, dy}, world units). A view preference, not structure.
  // Keys: a top-level section id, 'level:<index>' for a band level, or 'gutter' for Outside layers.
  // A level or gutter offset carries every section in it.
  const raw = iso ? {} : state.offsets || {};
  const offs = {};
  tops.forEach(t => { offs[t] = { dx: (raw[t] || {}).dx || 0, dy: (raw[t] || {}).dy || 0 }; });
  const carry = (o, members) => members.forEach(m => { if (offs[m]) { offs[m].dx += o.dx || 0; offs[m].dy += o.dy || 0; } });
  plan.forEach((lv, i) => {
    const o = raw['level:' + i]; if (!o || (!o.dx && !o.dy)) return;
    const L0 = P.levels[i]; L0.x += o.dx || 0; L0.y += o.dy || 0; L0.cols.forEach(c => { c.x += o.dx || 0; });
    carry(o, lv.members);
  });
  if (raw.gutter && P.gutter) { P.gutter.x += raw.gutter.dx || 0; P.gutter.y += raw.gutter.dy || 0; carry(raw.gutter, outside); }
  const hasOffs = Object.keys(offs).some(k => offs[k] && (offs[k].dx || offs[k].dy));
  if (hasOffs) {
    tops.forEach(t => {
      const o = offs[t]; if (!o || (!o.dx && !o.dy)) return;
      const subtree = data.descendants(t), sh = r => { if (r) { r.x += o.dx; r.y += o.dy; } };
      subtree.forEach(s => { sh(P.sections[s]); sh(P.folds[s]); membersOf(data, state, s).forEach(m => { if (!centered.has(m)) sh(P.nodes[m]); }); });
      Object.values(P.lanes).forEach(ln => { if (ln.section && subtree.includes(ln.section)) sh(ln); });
      twinsEls.forEach(tw => { if (tw.members.every(m => subtree.includes(m))) { const p = P.plates[tw.id]; if (p) { sh(p); p.rowTops = p.rowTops.map(y => y + o.dy); } } });
    });
    // levels and the gutter stretch to hold their sections, so a moved section never leaves its level
    plan.forEach((lv, i) => {
      const rs = lv.members.map(m => P.sections[m]).filter(Boolean); if (!rs.length) return;
      const L0 = P.levels[i];
      const x1 = Math.min(L0.x, ...rs.map(r => r.x - x0)), y1 = Math.min(L0.y, ...rs.map(r => r.y - (band ? L.bandHead : 0)));
      const x2 = Math.max(L0.x + L0.w, ...rs.map(r => r.x + r.w + x0)), y2 = Math.max(L0.y + L0.h, ...rs.map(r => r.y + r.h + 12));
      Object.assign(L0, { x: x1, y: y1, w: x2 - x1, h: y2 - y1 });
    });
    if (P.gutter) {
      const rs = outside.map(m => P.sections[m]).filter(Boolean);
      const x1 = Math.min(P.gutter.x, ...rs.map(r => r.x - 12)), x2 = Math.max(P.gutter.x + P.gutter.w, ...rs.map(r => r.x + r.w + 12));
      P.gutter.x = x1; P.gutter.w = x2 - x1; P.gutter.h = Math.max(P.gutter.h, ...rs.map(r => r.y + r.h + 12)) - P.gutter.y;
    }
  }

  // ---- centered hubs: in the gap above their level, tethered to their home section
  hubs.filter(hb => centered.has(hb.node)).forEach(hb => {
    const lvIdx = P.levelOf[data.home[hb.node]], lv = P.levels[lvIdx];
    if (!lv) return;
    const prev = P.levels[lvIdx - 1];
    const gapTop = prev ? prev.y + prev.h : lv.y - L.hubGap;
    const cy = (gapTop + lv.y) / 2;
    P.nodes[hb.node] = { x: lv.x + lv.w / 2 - N.w / 2, y: cy - N.h / 2, w: N.w, h: N.h };
    P.tethers.push({ node: hb.node, section: data.home[hb.node] });
    P.levelOf[hb.node] = lvIdx;
  });

  // ---- bus rails
  const rectOf = id => P.nodes[id] || (P.proxy[id] && P.sections[P.proxy[id]]);
  const levelOfNode = id => P.levelOf[data.home[id]] ?? P.levelOf[id];
  const colOfNode = id => P.colOf[data.home[id]];
  const gutterUse = {};
  (data.byPrimitive.bus || []).map(els).forEach(bus => {
    const es = bus.edges.map(id => data.edgeById[id]).filter(e => e && rectOf(e.src) && rectOf(e.dst));
    if (!es.length) return;
    const mid = r => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
    const dst = bus.contract && bus.contract.dst;
    const srcLv = es.map(e => levelOfNode(e.src)), dstLv = dst ? levelOfNode(dst) : null;
    if (dst && dstLv > -1 && srcLv.every(l => l > -1 && l < dstLv)) {
      const lv = P.levels[dstLv], prev = P.levels[dstLv - 1];
      const hubR = P.nodes[dst];
      const ry = centered.has(dst) ? hubR.y + hubR.h / 2 : (prev.y + prev.h + lv.y) / 2;
      const xs = es.map(e => mid(rectOf(e.src)).x).concat(mid(rectOf(dst)).x);
      P.rails[bus.id] = { o: 'h', y: ry, x1: Math.min(...xs), x2: Math.max(...xs) };
    } else {
      const lvIdx = srcLv[0], lv = P.levels[lvIdx];
      if (!lv) return;
      const dstCols = es.map(e => colOfNode(e.dst)), srcCols = es.map(e => colOfNode(e.src));
      let c = Math.min(...dstCols);
      if (!(c > Math.max(...srcCols))) c = Math.max(...srcCols) + 1;
      c = Math.min(c, lv.cols.length);
      let gx = c < lv.cols.length ? lv.cols[c].x - L.colGap / 2 : lv.cols[lv.cols.length - 1].x + lv.cols[lv.cols.length - 1].w + L.colGap / 2;
      const sr = Math.max(...es.map(e => { const r = rectOf(e.src); return r.x + r.w; })), dl = Math.min(...es.map(e => rectOf(e.dst).x));
      if (dl > sr + 20) gx = (sr + dl) / 2;
      const key = lvIdx + ':' + c, k = gutterUse[key] = (gutterUse[key] || 0) + 1;
      const x = gx + [0, 9, -9, 18, -18][k - 1];
      const ys = es.flatMap(e => [mid(rectOf(e.src)).y, mid(rectOf(e.dst)).y]);
      P.rails[bus.id] = { o: 'v', x, y1: Math.min(...ys), y2: Math.max(...ys) };
    }
  });

  // ---- lanes across sections: a route through their steps
  lanes.forEach(l => { if (!P.lanes[l.id]) P.lanes[l.id] = { mode: 'route' }; });

  if (iso) P.iso = isolatePorts(data, state, iso, P.sections[iso]);
  const allR = Object.values(P.nodes).concat(P.iso ? Object.values(P.iso.ports) : []).concat(Object.values(P.sections), P.levels, P.gutter ? [P.gutter] : []);
  const minX = Math.min(0, ...allR.map(r => r.x)), minY = Math.min(0, ...allR.map(r => r.y));
  const maxX = Math.max(right, ...allR.map(r => r.x + r.w)), maxY = Math.max(levelsBottom, ...allR.map(r => r.y + r.h));
  P.bounds = { x: minX - 8, y: minY - 24, w: maxX - minX + 64, h: maxY - minY + 48 };
  return P;
}

function flowLayout(data, state) {
  const N = L.node, F = L.flow;
  const ids = data.nodeIds.concat(removedNodes(data, state).map(r => r.id));
  const inc = {};
  data.edges.forEach(e => { (inc[e.dst] = inc[e.dst] || []).push(e.src); });
  const rank = {}, visiting = {};
  const r = id => {
    if (rank[id] != null) return rank[id];
    if (visiting[id]) return 0;
    visiting[id] = true;
    rank[id] = Math.max(-1, ...(inc[id] || []).map(r)) + 1;
    return rank[id];
  };
  ids.forEach(r);
  const secOrder = {};
  data.sections.forEach((s, i) => { secOrder[s] = i; });
  const ord = id => secOrder[data.topOf(data.home[id])] ?? 999;
  const cols = {};
  ids.forEach(id => (cols[rank[id]] = cols[rank[id]] || []).push(id));
  const P = { view: 'flow', nodes: {}, proxy: {}, sections: {}, lanes: {}, plates: {}, levels: [], gutter: null, rails: {}, tethers: [], bounds: null };
  let maxY = 0;
  const keys = Object.keys(cols).map(Number).sort((a, b) => a - b);
  keys.forEach(k => {
    cols[k].sort((a, b) => ord(a) - ord(b) || a.localeCompare(b));
    cols[k].forEach((id, i) => {
      const y = i * (N.h + F.rowGap);
      P.nodes[id] = { x: k * (N.w + F.colGap), y, w: N.w, h: N.h };
      maxY = Math.max(maxY, y + N.h);
    });
  });
  P.bounds = { x: -16, y: -16, w: keys.length * (N.w + F.colGap) - F.colGap + 32, h: maxY + 32 };
  return P;
}

// Ports for an isolated section. An edge with one end inside becomes an input (left rail) or output (right rail)
// on a port for the outside file's home section; an open port (state.isoOpen holds its key) lists one port per file.
// Edges with neither end inside are not drawn but are counted by the renderer as "elsewhere".
// Order is deterministic: most edges first, then id.
function isolatePorts(data, state, iso, box) {
  const subtree = new Set(data.descendants(iso));
  // Members, plus any id homed in the subtree: re-run ghosts of removed files are homed but are not members.
  const inside = new Set([...subtree].flatMap(s => data.elements[s].members).concat(Object.keys(data.home).filter(id => subtree.has(data.home[id]))));
  const open = new Set(state.isoOpen || []);
  const groups = { in: {}, out: {} };
  data.edges.forEach(e => {
    const si = inside.has(e.src), di = inside.has(e.dst);
    if (si === di) return;
    const side = di ? 'in' : 'out', file = di ? e.src : e.dst, sec = data.home[file] || '(none)';
    const g = groups[side][sec] = groups[side][sec] || { sec, edges: 0, files: {} };
    g.edges++; g.files[file] = (g.files[file] || 0) + 1;
  });
  const ports = {}, portOf = { in: {}, out: {} };
  const byCount = (a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
  ['in', 'out'].forEach(side => {
    const x = side === 'in' ? box.x - L.railGap - L.portW : box.x + box.w + L.railGap;
    let y = box.y;
    Object.values(groups[side]).map(g => [g.sec, g.edges, g]).sort(byCount).forEach(([sec, edges, g]) => {
      const key = side + ':s:' + sec, isOpen = open.has(key), files = Object.entries(g.files).sort(byCount);
      ports[key] = { key, side, kind: 'section', sec, x, y, w: L.portW, h: L.node.h, edges, files: files.length, open: isOpen };
      y += L.node.h + L.portGap;
      // An open port folds like a long section: its busiest files get their own ports, the rest stay in one
      // "+N more" port until that is opened too (key side:all:sec).
      const allKey = side + ':all:' + sec, showAll = open.has(allKey);
      const listed = !isOpen ? [] : showAll || files.length <= L.foldAt + L.foldSlack ? files : files.slice(0, L.foldAt);
      const rest = isOpen ? files.slice(listed.length) : files;
      listed.forEach(([f, n]) => {
        const fk = side + ':f:' + f;
        ports[fk] = { key: fk, side, kind: 'file', file: f, parent: key, x: x + (side === 'in' ? 0 : 14), y, w: L.portW - 14, h: L.node.h, edges: n, files: 1 };
        portOf[side][f] = fk; y += L.node.h + 4;
      });
      if (isOpen && rest.length) {
        ports[allKey] = { key: allKey, side, kind: 'rest', sec, parent: key, x: x + (side === 'in' ? 0 : 14), y, w: L.portW - 14, h: L.node.h,
          edges: rest.reduce((a, [, n]) => a + n, 0), files: rest.length };
        rest.forEach(([f]) => { portOf[side][f] = allKey; }); y += L.node.h + 4;
      } else if (!isOpen) rest.forEach(([f]) => { portOf[side][f] = key; });
      if (isOpen) y += L.portGap;
    });
  });
  return { sec: iso, inside, ports, portOf };
}

