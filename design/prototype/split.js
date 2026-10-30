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
// `pad` is below the 24 px a fit leaves (render.js), so a fitted pane, which shows everything, never pans for that. The pane shows
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

// Readable (Julian, poll 2026-10-30, after the critic): a follow also zooms a pane in when the selection's files are
// drawn too small to read there (under READ.min px tall: a half-width Flow pane fits HORDE at about 0.24, files 5 px
// tall), to READ.to px, never past READ.maxK (the fit's own cap in render.js). Readable already, the zoom is kept.
export const READ = { min: 12, to: 22, maxK: 1.25 };

// Centre `rect` (screen, at zoom z) in the pane at scale k.
function zoomTo(z, rect, k, W, H, top) {
  const cx = (rect.x + rect.w / 2 - z.x) / z.k, cy = (rect.y + rect.h / 2 - z.y) / z.k;
  return { auto: false, k, x: W / 2 - cx * k, y: top + (H - top) / 2 - cy * k };
}

// What a pane frames for a selection, and how. A file or element: where it is (render.js map.locate), zoomed in to read
// when its files are too small. An edge: both ends when they fit together; else an end already in view (and readable)
// keeps the pane still, and with neither in view the pane goes to the source. (Centring the union of two far ends
// showed neither end: seen in the browser on the horde sample, 2026-10-30.)
export function followFor(m, sel, data, W, H, pad = 12, top = 0) {
  if (!m || !m.locate || !sel) return null;
  const z = m.zoom, pan = (r) => followPan(z, r, W, H, pad, top);
  const kRead = (r) => (r && r.h < READ.min && z.k < READ.maxK ? Math.min(z.k * READ.to / r.h, READ.maxK) : z.k);
  const fits = (r, s) => r && r.w * s <= W - 2 * pad && r.h * s <= H - top - 2 * pad;
  const e = sel.type === 'edge' && data.edgeById[sel.id];
  if (e) {
    const u = m.locate(sel), ends = [e.src, e.dst].map((id) => m.locate({ type: 'node', id }));
    const k = Math.max(...ends.map(kRead)), s = k / z.k;
    if (k === z.k) {
      if (fits(u, 1)) return pan(u);
      if (ends.some((x) => x && !pan(x))) return null;
      return pan(ends[0] || ends[1]);
    }
    const t = fits(u, s) ? u : ends[0] || ends[1];
    return t ? zoomTo(z, t, k, W, H, top) : null;
  }
  const r = m.locate(sel); if (!r) return null;
  // An element reads by its files: the smallest one drawn decides (a section box zoomed out stands for its files and
  // is itself the readable thing, so there locate gives the box for each file).
  const items = sel.type === 'element' ? elementFiles(data, sel.id).slice(0, 400).map((f) => m.locate({ type: 'node', id: f })).filter(Boolean) : [r];
  const k = items.length ? Math.max(...items.map(kRead)) : z.k;
  return k === z.k ? pan(r) : zoomTo(z, r, k, W, H, top);
}

// The files a selection names: a file, or an edge's two ends. render.js marks the stand-ins holding them; index.html
// and offMap ask whether one has no stand-in on the map.
export function selectionFiles(data, sel) {
  if (!sel) return [];
  if (sel.type === 'node') return [sel.id];
  const e = sel.type === 'edge' && data.edgeById[sel.id];
  return e ? [e.src, e.dst] : [];
}

// True when a selected file has no stand-in on this map: the isolate or the matrix put it 'elsewhere', counted only by
// the bar above the map (isolate) or the outside chip (matrix). The bars say so when this is true (index.html).
export function offMap(m, data, sel) {
  return !!(m && m.nodes && selectionFiles(data, sel).some((f) => m.nodes[f] && m.nodes[f].proxy === 'elsewhere'));
}

// Pointer routing in Both (critic H1: under pointer capture a pointerup's target is the canvas, so the pane must come
// from the element under the pointer, not e.target). `el` is that element; any object with closest() will do.
export function paneFor(el) { return el && el.closest && el.closest('#paneFlow') ? 'flow' : 'main'; }
// A selection that opens a frame's own list (holds, bundle, diffbox, unaccounted) remembers the Flow pane, so the panel
// reads Flow's frame; a file, edge or element is one thing in both panes and needs none.
export function tagSel(sel, view, pane) {
  return sel && view === 'both' && pane === 'flow' && ['holds', 'bundle', 'diffbox', 'unaccounted'].includes(sel.type) ? { ...sel, pane: 'flow' } : sel;
}
