// Flow and Design side by side (ADR 0030; ROADMAP Q-031; Julian, poll 2026-10-30). The Both view draws two panes, each
// a render() of its own state with its own zoom, its own frame and its own conservation meter. Pure: no DOM, no store.
// index.html owns the panes, the divider and the pointer; render.js gives each frame a `locate` the follow rule reads.

export const PANES = ['flow', 'design'];

// The state a pane renders and is metered with. Flow is canonical (ADR 0006): it is handed none of the Design view's
// interpretation, so nothing composed in Design (lens, isolate, matrix, collapse, folds, moved sections) reaches it.
// render() already ignores these in the Flow view; stress.test.mjs proves that byte for byte, and this strip keeps the
// pane canonical even if a later render() change forgets to. Selection, hover, the diff, dimmed kinds, stage and theme
// are shared by both panes.
export function paneState(s, pane) {
  if (pane === 'design') return { ...s, view: 'design', morph: undefined };
  return { ...s, view: 'flow', morph: undefined, zoom: s.flowZoom || { auto: true },
    lens: null, isolate: null, isoOpen: [], matrix: null, collapsed: [], unfolded: [], offsets: {} };
}

// The header meter in Both shows the worse pane: a broken pane is never hidden behind a balanced one.
const RANK = { balanced: 0, stale: 1, broken: 2 };
export function worse(a, b) { return (RANK[b.c.status] || 0) > (RANK[a.c.status] || 0) ? b : a; }

// The files an element makes its claim about: what Flow, which draws files only, frames when the element is selected.
export function elementFiles(data, id) {
  const el = data.elements[id];
  if (!el) return data.nodes[id] ? [id] : [];
  const files = new Set(), add = (n) => { if (data.nodes[n]) files.add(n); };
  const secFiles = (s) => data.descendants(s).forEach((d) => (data.elements[d].members || []).forEach(add));
  switch (el.primitive) {
    case 'section': secFiles(id); break;
    case 'twins': el.members.forEach(secFiles); break;
    case 'bus': el.edges.forEach((x) => { const e = data.edgeById[x]; if (e) { add(e.src); add(e.dst); } }); break;
    case 'band': data.nodeIds.forEach(add); break;
    default: (el.steps || []).concat(el.node ? [el.node] : [], el.members || [], el.cycle || []).forEach(add);
  }
  return [...files];
}

// The follow rule (Julian, poll 2026-10-30): when a selection is not in a pane's frame, that pane pans to it, its zoom
// unchanged. Per axis: a rect that fits must sit inside the pane by `pad`; one larger than the pane must cover the
// pane's middle. Only a failing axis moves, and it centres the rect. Returns the new zoom, or null when nothing moves.
// `pad` is below the 24 px a fit leaves (render.js), so a fitted pane, which shows everything, never pans. The pane shows
// y from `top` (below its meter: render.js zoom.padTop) to H (above the legend: the caller passes H less padBottom).
export function followPan(zoom, rect, W, H, pad = 12, top = 0) {
  if (!rect || !zoom) return null;
  const axis = (p, size, L, o) => {
    const ok = size <= L - 2 * pad ? p >= pad && p + size <= L - pad : p <= L / 2 && p + size >= L / 2;
    return ok ? o : o + (L / 2 - (p + size / 2));
  };
  const x = axis(rect.x, rect.w, W, zoom.x), y = axis(rect.y - top, rect.h, H - top, zoom.y);
  if (x === zoom.x && y === zoom.y) return null;
  return { auto: false, k: zoom.k, x, y };
}

// What a pane frames for a selection. A file or element: where it is (render.js map.locate). An edge: both ends when
// they fit together; else an end already in view keeps the pane still, and with neither in view the pane goes to the
// source. (Centring the union of two far ends showed neither end: seen in the browser on the horde sample, 2026-10-30.)
export function followFor(m, sel, data, W, H, pad = 12, top = 0) {
  if (!m || !m.locate || !sel) return null;
  const pan = (r) => followPan(m.zoom, r, W, H, pad, top);
  const e = sel.type === 'edge' && data.edgeById[sel.id];
  if (!e) return pan(m.locate(sel));
  const r = m.locate(sel);
  if (r && r.w <= W - 2 * pad && r.h <= H - top - 2 * pad) return pan(r);
  const ends = [e.src, e.dst].map((id) => m.locate({ type: 'node', id }));
  if (ends.some((x) => x && !pan(x))) return null;
  return pan(ends[0] || ends[1]);
}
