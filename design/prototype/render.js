// render(container, data, state) draws the map and returns the element map.
// Draws in screen space: boxes scale with zoom, strokes and text stay a fixed size.
// No structural decisions here: grouping, bundling and membership come from view.json via layout().
import { layout, L, hubPlacement } from './layout.js';
import { counterflow, conformity } from './standins.js';

export const SPEC = {
  dash: { static: 'none', config: '10 4', runtime: '0.1 3.6', annotated: '9 3 1.5 3', inferred: '4 3.5', gap: '2 4' },
  cap: { runtime: 'round' },
  slot: { role: { audio: 3, param: 4, mod: 5 }, kind: { call: 1, instantiate: 1, include: 2, import: 2, inherit: 2, audio: 3, test: 6, data: 7, config: 7, reference: 8 } },
  glyph: { role: { audio: 'arrow-filled', mod: 'arrow-filled', param: 'dot' }, kind: { call: 'arrow-filled', instantiate: 'arrow-filled', include: 'arrow-hollow', import: 'arrow-hollow', inherit: 'arrow-hollow', test: 'arrow-hollow', data: 'dot', config: 'dot', reference: 'dot' } },
  lod: [{ name: 'overview', maxScale: 0.32 }, { name: 'structure', maxScale: 0.6 }, { name: 'detail', maxScale: null }],
  motion: { duration: 600, maxTotal: 900, crossFadeAbove: 300 },
  node: { inset: 8 }
};
export const slotOf = e => SPEC.slot.role[e.role] || SPEC.slot.kind[e.kind] || 8;
export const glyphOf = e => SPEC.glyph.role[e.role] || SPEC.glyph.kind[e.kind] || 'arrow-filled';
export const lodFor = k => (SPEC.lod.find(l => l.maxScale != null && k < l.maxScale) || SPEC.lod[SPEC.lod.length - 1]).name;

const NS = 'http://www.w3.org/2000/svg';
const v = n => `var(--loupe-${n})`;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => { const c = 1 - t; return 1 - c * c * c * (1 - 0.6 * t); };
const mid = r => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
const f1 = n => Math.round(n * 10) / 10;

let CW = 0;
function charW() {
  if (CW) return CW;
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.font = '500 11px "Martian Mono"';
  const w = ctx.measureText('abcdefghijklmnopqrstuvwxyz_').width / 27;
  if (document.fonts && document.fonts.check('500 11px "Martian Mono"')) CW = w;
  return w || 7.2;
}
const fit = (s, px, cw) => { const n = Math.floor(px / cw); return n < 3 ? '' : s.length <= n ? s : s.slice(0, n - 1) + '…'; };

const caches = new WeakMap();
function memo(data, key, fn) {
  let c = caches.get(data); if (!c) caches.set(data, (c = {}));
  return c[key] || (c[key] = fn());
}
function getLayout(data, state, view) {
  const key = ['L', view, (state.collapsed || []).join(','), hubPlacement(data, state), state.diff ? 'd' : '', view === 'design' ? JSON.stringify(state.offsets || {}) : '',
    view === 'design' ? [(state.unfolded || []).join(','), state.isolate || '', (state.isoOpen || []).join(','), state.lens || ''].join('/') : ''].join('|');
  return memo(data, key, () => layout(data, { ...state, view }));
}

function hull(pts) {
  pts = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  pts.forEach(p => { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); });
  pts.slice().reverse().forEach(p => { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); });
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
const rectPts = (r, p) => [[r.x - p, r.y - p], [r.x + r.w + p, r.y - p], [r.x - p, r.y + r.h + p], [r.x + r.w + p, r.y + r.h + p]];
const union = rs => { rs = rs.filter(Boolean); if (!rs.length) return null; const x = Math.min(...rs.map(r => r.x)), y = Math.min(...rs.map(r => r.y)); return { x, y, w: Math.max(...rs.map(r => r.x + r.w)) - x, h: Math.max(...rs.map(r => r.y + r.h)) - y }; };

export function elementBounds(data, D, id) {
  const el = data.elements[id];
  if (!el) return D.nodes[id] || null;
  const nodesOf = ids => ids.map(n => D.nodes[n] || (D.proxy[n] && D.sections[D.proxy[n]]));
  switch (el.primitive) {
    case 'section': return D.sections[id];
    case 'lane': return D.lanes[id] && D.lanes[id].mode === 'inline' ? union([D.lanes[id], D.sections[D.lanes[id].section]]) : union(nodesOf(el.steps));
    case 'bus': return union(el.edges.map(e => data.edgeById[e]).filter(Boolean).flatMap(e => nodesOf([e.src, e.dst])));
    case 'hub': return union(nodesOf([el.node]));
    case 'set': case 'overlap': return union(nodesOf(el.members).concat(el.primitive === 'overlap' ? el.sets.map(s => D.sections[s]) : []));
    case 'twins': return union(el.members.map(m => D.sections[m]).concat(D.plates[id]));
    case 'band': return union(D.levels);
    case 'loop': return union(nodesOf(el.cycle));
  }
  return null;
}

function related(data, focus) {
  if (!focus) return null;
  const s = new Set();
  const nbrs = id => { s.add(id); data.edges.forEach(e => { if (e.src === id) s.add(e.dst); if (e.dst === id) s.add(e.src); }); };
  if (focus.type === 'node') nbrs(focus.id);
  else if (focus.type === 'edge') { const e = data.edgeById[focus.id]; if (e) { s.add(e.src); s.add(e.dst); } }
  else {
    const el = data.elements[focus.id]; if (!el) return null;
    const p = el.primitive;
    if (p === 'section') data.descendants(el.id).forEach(d => data.elements[d].members.forEach(m => s.add(m)));
    else if (p === 'set' || p === 'overlap') el.members.forEach(m => s.add(m));
    else if (p === 'bus') el.edges.forEach(id => { const e = data.edgeById[id]; if (e) { s.add(e.src); s.add(e.dst); } });
    else if (p === 'lane') el.steps.forEach(m => s.add(m));
    else if (p === 'twins') el.members.forEach(sec => data.descendants(sec).forEach(d => data.elements[d].members.forEach(m => s.add(m))));
    else if (p === 'hub') nbrs(el.node);
    else if (p === 'loop') el.cycle.forEach(m => s.add(m));
    else return null;
  }
  return s;
}

function edgePath(a, b) {
  const am = mid(a), bm = mid(b);
  if (Math.abs(am.x - bm.x) < Math.max(a.w, b.w) * 0.6) {
    const x1 = a.x + a.w, x2 = b.x + b.w, bend = 16 + Math.min(56, Math.abs(bm.y - am.y) * 0.22);
    return `M${f1(x1)} ${f1(am.y)}C${f1(x1 + bend)} ${f1(am.y)} ${f1(x2 + bend)} ${f1(bm.y)} ${f1(x2)} ${f1(bm.y)}`;
  }
  const fwd = bm.x > am.x, x1 = fwd ? a.x + a.w : a.x, x2 = fwd ? b.x : b.x + b.w;
  const dx = Math.max(24, Math.abs(x2 - x1) * 0.45) * (fwd ? 1 : -1);
  return `M${f1(x1)} ${f1(am.y)}C${f1(x1 + dx)} ${f1(am.y)} ${f1(x2 - dx)} ${f1(bm.y)} ${f1(x2)} ${f1(bm.y)}`;
}
const bezMid = d => { const n = d.match(/-?[\d.]+/g).map(Number); const t = 0.5, c = 1 - t; return { x: c * c * c * n[0] + 3 * c * c * t * n[2] + 3 * c * t * t * n[4] + t * t * t * n[6], y: c * c * c * n[1] + 3 * c * c * t * n[3] + 3 * c * t * t * n[5] + t * t * t * n[7] }; };

export function markerDefs(uid) {
  let s = '';
  for (let n = 0; n <= 8; n++) {
    const c = n ? v('edge-' + n) : v('ink-muted');
    s += `<marker id="${uid}-${n}-arrow-filled" viewBox="0 0 9 8" refX="8.6" refY="4" markerWidth="9" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto"><path d="M0 .4L9 4L0 7.6z" style="fill:${c}"/></marker>`;
    s += `<marker id="${uid}-${n}-arrow-hollow" viewBox="-1 -1 11 10" refX="8.6" refY="4" markerWidth="11" markerHeight="10" markerUnits="userSpaceOnUse" orient="auto"><path d="M0 .6L8.4 4L0 7.4z" style="fill:${v('surface-canvas')};stroke:${c};stroke-width:1.25px;stroke-linejoin:round"/></marker>`;
    s += `<marker id="${uid}-${n}-dot" viewBox="0 0 8 8" refX="6.5" refY="4" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto"><circle cx="4" cy="4" r="2.8" style="fill:${c}"/></marker>`;
  }
  for (let n = 1; n <= 8; n++) {
    const c = v('tier-' + n);
    s += `<marker id="${uid}-t${n}-arrow-filled" viewBox="0 0 9 8" refX="8.6" refY="4" markerWidth="9" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto"><path d="M0 .4L9 4L0 7.6z" style="fill:${c}"/></marker>`;
    s += `<marker id="${uid}-t${n}-arrow-hollow" viewBox="-1 -1 11 10" refX="8.6" refY="4" markerWidth="11" markerHeight="10" markerUnits="userSpaceOnUse" orient="auto"><path d="M0 .6L8.4 4L0 7.4z" style="fill:${v('surface-canvas')};stroke:${c};stroke-width:1.25px;stroke-linejoin:round"/></marker>`;
    s += `<marker id="${uid}-t${n}-dot" viewBox="0 0 8 8" refX="6.5" refY="4" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto"><circle cx="4" cy="4" r="2.8" style="fill:${c}"/></marker>`;
  }
  return `<defs>${s}</defs>`;
}
export function edgeStyle(e, emph, tier) {
  const p = e.provenance;
  return `stroke:${tier ? v('tier-' + tier) : v('edge-' + slotOf(e))};stroke-width:${emph ? v('stroke-edge-emph') : v('stroke-edge')};stroke-dasharray:${SPEC.dash[p] || 'none'};stroke-linecap:${SPEC.cap[p] || 'butt'};fill:none`;
}

let UID = 0;
export function render(container, data, state) {
  let svg = container.querySelector(':scope > svg[data-loupe]');
  if (!svg) {
    svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('data-loupe', 'l' + (++UID));
    svg.style.cssText = 'display:block;width:100%;height:100%;user-select:none;-webkit-user-select:none';
    container.appendChild(svg);
  }
  const uid = svg.getAttribute('data-loupe');
  const W = container.clientWidth || 800, H = container.clientHeight || 600;
  const D = getLayout(data, state, 'design'), F = getLayout(data, state, 'flow');
  const morph = state.morph != null ? state.morph : state.view === 'design' ? 1 : 0;
  const em = ease(morph), designish = morph >= 0.5, decor = clamp((morph - 0.6) / 0.4);
  const zs = state.zoom || { auto: true };

  // zoom
  let z;
  if (zs.auto) {
    const padB = zs.padBottom || 0, pad = zs.pad ?? 24;
    const fitB = b => { const k = Math.min((W - pad * 2) / b.w, (H - pad * 2 - padB) / b.h, zs.maxK || 1.25); return { k, x: (W - b.w * k) / 2 - b.x * k, y: (H - padB - b.h * k) / 2 - b.y * k }; };
    let fb = zs.focus ? elementBounds(data, D, zs.focus) : null;
    if (fb) fb = { x: fb.x - 28, y: fb.y - 34, w: fb.w + 56, h: fb.h + 62 };
    const zd = fitB(fb || D.bounds), zf = fitB(F.bounds);
    z = { k: lerp(zf.k, zd.k, em), x: lerp(zf.x, zd.x, em), y: lerp(zf.y, zd.y, em) };
  } else z = { k: zs.k, x: zs.x, y: zs.y };
  const lod = lodFor(z.k);
  const ovw = designish && lod === 'overview', detail = lod === 'detail';
  // At overview a node is stood in for by its top section, or, when isolated, by its nearest ancestor that is laid out.
  const drawnTop = id => { let s = data.home[id], best = null; while (s) { if (D.sections[s]) best = s; s = data.parentOf[s]; } return best; };
  const S = r => ({ x: r.x * z.k + z.x, y: r.y * z.k + z.y, w: r.w * z.k, h: r.h * z.k });
  const cw = charW();

  // stagger by group
  const tops = data.sections.filter(s => !data.parentOf[s]);
  const topIdx = {}; tops.forEach((t, i) => { topIdx[t] = i; });
  const tierOf = sec => ((topIdx[data.topOf(sec)] ?? 0) % 8) + 1;
  const hoverTier = (e, emph) => (emph && state.hover && data.home[e.src] ? tierOf(data.home[e.src]) : null);
  const G = tops.length, M = SPEC.motion;
  const stag = G > 1 ? (M.maxTotal - M.duration) / (G - 1) : 0;
  const big = data.nodeIds.length > M.crossFadeAbove;
  const tOf = id => {
    if (morph <= 0 || morph >= 1) return morph;
    if (big) return morph < 0.5 ? 0 : 1;
    const gi = topIdx[data.topOf(data.home[id])] ?? 0;
    return ease(clamp((morph * M.maxTotal - gi * stag) / M.duration));
  };
  const designRect = id => D.nodes[id] || (D.proxy[id] && D.sections[D.proxy[id]]) || null;
  const nodeRect = id => {
    const d = designRect(id), f = F.nodes[id];
    if (!d && !f) return null; if (!d) return S(f); if (!f) return S(d);
    const t = tOf(id);
    return S({ x: lerp(f.x, d.x, t), y: lerp(f.y, d.y, t), w: lerp(f.w, d.w, t), h: lerp(f.h, d.h, t) });
  };

  // focus
  const focus = state.hover || state.selection;
  const rel = related(data, focus);
  const selNode = state.selection && state.selection.type === 'node' ? state.selection.id : null;
  const hovNode = state.hover && state.hover.type === 'node' ? state.hover.id : null;
  const focEl = focus && focus.type === 'element' ? focus.id : null;
  const isDim = id => !!(rel && !rel.has(id));
  const dimK = new Set(state.dimmedKinds || []);

  // diff
  const df = state.diff && data.diff ? data.diff : null, side = state.diff && state.diff.side;
  const diffOf = {};
  if (df) {
    (df.added || []).forEach(id => { diffOf[id] = side === 'before' ? 'ghost-added' : 'added'; });
    (df.changed || []).forEach(id => { diffOf[id] = 'changed'; });
    if (side !== 'before') (df.stale || []).forEach(id => { diffOf[id] = 'stale'; });
    (df.removed || []).forEach(n => { diffOf[n.id] = side === 'before' ? null : 'removed'; });
  }
  const removedById = {}; ((df && df.removed) || []).forEach(n => { removedById[n.id] = n; });
  const nodeInfo = id => data.nodes[id] || (removedById[id] && { ...removedById[id], label: removedById[id].path.split('/').pop().replace(/\.(cpp|hpp|h)$/, '') });

  // drawn: every stand-in this frame actually draws (section ids, fold:<sec>, port keys, 'elsewhere'). conserve() checks node
  // proxies against it, so a proxy pointing at something not on screen reads as broken instead of balanced.
  const map = { zoom: z, lod, nodes: {}, edges: {}, elements: {}, layout: D, drawn: new Set(), settled: morph <= 0 || morph >= 1 };
  const bg = [], eg = [], ng = [], lg = [];
  const routeStep = {};
  const setMarks = [];
  const busOf = {};
  (data.byPrimitive.bus || []).forEach(b => data.elements[b].edges.forEach(e => { busOf[e] = b; }));
  const pill = (x, y, text, o = {}) => {
    const w = text.length * (o.cw || cw * 0.92) + 14, ax = o.anchor === 'middle' ? x - w / 2 : o.anchor === 'end' ? x - w : x;
    return `<g ${o.attr || ''}>${o.title ? `<title>${esc(o.title)}</title>` : ''}<rect x="${f1(ax)}" y="${f1(y - 8.5)}" width="${f1(w)}" height="17" rx="8.5" style="fill:${o.fill || v('surface-panel')};stroke:${o.stroke || v('rule')};stroke-width:1px;stroke-dasharray:${o.dash || 'none'}"/><text x="${f1(ax + w / 2)}" y="${f1(y + 3.5)}" text-anchor="middle" style="font:${v('type-count')};fill:${o.ink || v('ink-muted')}">${esc(text)}</text></g>`;
  };
  const badge = (x, y, kind) => {
    const c = { pass: 'state-ok', warn: 'state-warn', fail: 'state-bad' }[kind], g = { pass: '✓', warn: '!', fail: '✕' }[kind];
    return `<g><circle cx="${f1(x)}" cy="${f1(y)}" r="7.5" style="fill:${v(c)};stroke:${v('surface-canvas')};stroke-width:1.5px"/><text x="${f1(x)}" y="${f1(y + 3.5)}" text-anchor="middle" style="font:700 10px/1 ${v('font-ui')};fill:${v('surface-node')}">${g}</text></g>`;
  };
  const halo = c => `paint-order:stroke;stroke:${v(c)};stroke-width:4px;stroke-linejoin:round`;
  const auditOf = el => state.stage === 4 ? { confirmed: 'pass', challenged: 'fail' }[el.status] : null;

  // ---------- 1. backgrounds
  if (decor > 0) {
    bg.push(`<g style="opacity:${decor}">`);
    const band = (data.byPrimitive.band || []).map(id => data.elements[id])[0];
    if (band && D.levels.length && !D.iso) {
      map.elements[band.id] = 'drawn';
      D.levels.forEach((lv, i) => {
        const r = S(lv);
        bg.push(`<g data-el="${band.id}" data-level="${i}" style="cursor:move"><title>${esc(lv.label)} · drag to move the level</title><rect x="${f1(r.x)}" y="${f1(r.y)}" width="${f1(r.w)}" height="${f1(r.h)}" style="fill:${v('surface-page')}"/><line x1="${f1(r.x)}" x2="${f1(r.x + r.w)}" y1="${f1(r.y)}" y2="${f1(r.y)}" style="stroke:${v('rule')};stroke-width:${v('stroke-group')}"/><line x1="${f1(r.x)}" x2="${f1(r.x + r.w)}" y1="${f1(r.y + r.h)}" y2="${f1(r.y + r.h)}" style="stroke:${v('rule')};stroke-width:${v('stroke-group')}"/></g>`);
        if (L.bandHead * z.k >= 17) lg.push(`<text data-el="${band.id}" data-level="${i}" x="${f1(r.x + 12)}" y="${f1(r.y + 14)}" style="cursor:move;font:${v('type-eyebrow')};letter-spacing:${v('tracking-eyebrow')};text-transform:uppercase;fill:${v('ink-faint')}">${esc(lv.label)} · level ${i + 1} of ${D.levels.length}</text>`);
      });
      const a = auditOf(band); if (a) { const r = S(D.levels[0]); lg.push(badge(r.x + r.w - 10, r.y + 10, a)); }
    }
    if (D.gutter) {
      const r = S(D.gutter);
      bg.push(`<g data-level="gutter" style="cursor:move"><title>Outside layers · drag to move</title><rect x="${f1(r.x)}" y="${f1(r.y)}" width="${f1(r.w)}" height="${f1(r.h)}" style="fill:transparent"/><line x1="${f1(r.x)}" x2="${f1(r.x)}" y1="${f1(r.y)}" y2="${f1(r.y + r.h)}" style="stroke:${v('rule')};stroke-width:${v('stroke-group')};stroke-dasharray:3 3"/></g>`);
      if (L.bandHead * z.k >= 17) lg.push(`<text data-level="gutter" x="${f1(r.x + 12)}" y="${f1(r.y + 14)}" style="cursor:move;font:${v('type-eyebrow')};letter-spacing:${v('tracking-eyebrow')};text-transform:uppercase;fill:${v('ink-faint')}">${esc(D.gutter.label)}</text>`);
    }
    // sets
    let slot = 0;
    const setSlot = {};
    (data.byPrimitive.set || []).forEach(id => {
      const el = data.elements[id]; setSlot[id] = Math.min(4, ++slot);
      const rs = el.members.map(m => D.nodes[m] && S(D.nodes[m])).filter(Boolean);
      if (!rs.length || ovw) return;
      map.elements[id] = 'drawn';
      const c = v('set-' + setSlot[id]), on = focEl === id;
      const homes = new Set(el.members.filter(m => D.nodes[m]).map(m => data.home[m]));
      if (homes.size > 1) {
        // Members in different sections: a hull would sweep across unrelated boxes. Mark each member instead.
        rs.forEach(r => {
          setMarks.push(`<rect data-el="${id}" x="${f1(r.x - 4)}" y="${f1(r.y - 4)}" width="${f1(r.w + 8)}" height="${f1(r.h + 8)}" rx="7" style="fill:${c};stroke:${on ? v('accent') : c};stroke-width:${on ? 1.5 : 3}px"><title>${esc(el.label + ': ' + el.claim)}</title></rect>`);
          if (detail) lg.push(pill(r.x - 4, r.y - 4, el.label, { stroke: c, fill: v('surface-node'), ink: v('ink-muted'), cw: cw * 0.85, attr: `data-el="${id}" style="cursor:pointer"`, title: el.label + ' · ' + el.members.length + ' files: ' + el.claim }));
        });
        return;
      }
      const pts = hull(rs.flatMap(r => rectPts(r, 7)));
      bg.push(`<polygon data-el="${id}" points="${pts.map(p => p.map(f1).join(',')).join(' ')}" style="fill:${c};stroke:${on ? v('accent') : c};stroke-width:${on ? 1.5 : 10}px;stroke-linejoin:round"><title>${esc(el.label + ': ' + el.claim)}</title></polygon>`);
      const top = pts.reduce((a, b) => (b[1] > a[1] || (b[1] === a[1] && b[0] < a[0]) ? b : a));
      lg.push(`<text data-el="${id}" x="${f1(top[0] + 4)}" y="${f1(top[1] + 13)}" style="font:${v('type-count')};fill:${v('ink-muted')};${halo('surface-canvas')}">${esc(el.label)} · ${el.members.length}</text>`);
    });
    // sections
    const secs = Object.entries(D.sections).sort((a, b) => a[1].depth - b[1].depth);
    secs.forEach(([id, s]) => {
      const el = data.elements[id], r = S(s);
      if (!el) return;
      map.elements[id] = 'drawn'; map.drawn.add(id);
      const on = focEl === id, fillC = s.depth % 2 ? 'surface-group-nested' : 'surface-group';
      const tn = tierOf(id), strokeC = on ? 'accent' : s.depth ? 'none' : 'tier-' + tn;
      bg.push(`<rect data-el="${id}" x="${f1(r.x)}" y="${f1(r.y)}" width="${f1(r.w)}" height="${f1(r.h)}" rx="${s.depth ? 6 : 8}" style="fill:${v(fillC)};stroke:${strokeC === 'none' ? 'none' : v(strokeC)};stroke-width:${on ? v('stroke-hub') : v('stroke-group')}"/>`);
      if (r.h >= 12) { const rad = Math.min(s.depth ? 6 : 8, r.w / 2, r.h / 2), hh = Math.min(4, r.h * 0.2), cid = `${uid}-clip-${id.replace(/[^a-z0-9]/gi, '_')}`; bg.push(`<clipPath id="${cid}"><rect x="${f1(r.x)}" y="${f1(r.y)}" width="${f1(r.w)}" height="${f1(r.h)}" rx="${f1(rad)}"/></clipPath><rect clip-path="url(#${cid})" x="${f1(r.x)}" y="${f1(r.y)}" width="${f1(r.w)}" height="${f1(hh)}" style="fill:${v(s.depth ? 'tier-' + tn + '-soft' : 'tier-' + tn)};pointer-events:none"/>`); }
      const files = data.filesIn(id);
      const isTwin = (data.byPrimitive.twins || []).some(t => data.elements[t].members.includes(id));
      const countText = s.collapsed || ovw ? `${files} files · ${internalCount(data, id)} inside` : `${files} files`;
      const hs = (s.collapsed ? s.h : L.header) * z.k;
      const big = detail && r.w >= 100 && hs >= 27;
      const gFont = big ? v('type-group-label') : v('type-group-label-compact'), cFont = big ? v('type-count') : v('type-count-compact');
      const gcw = big ? 8.2 : 6.9, ccw = big ? cw * 0.92 : cw * 0.82;
      const countW = countText.length * ccw;
      const labelW = el.label.length * gcw;
      const showCount = !isTwin && (s.collapsed || ovw ? r.w > countW + 60 : r.w >= labelW + countW + 52);
      const label = fit(el.label, r.w - 20 - (showCount ? countW + 30 : isTwin && detail ? 52 : 22), gcw) || (r.w > 26 ? el.label.slice(0, 1) + '…' : '');
      const ty = r.y + (big ? Math.min(19, hs * 0.66) : Math.min(13.5, Math.max(10, hs * 0.7)));
      const headerFits = ovw || hs >= 15;
      if (ovw && !isTwin) {
        const short = r.w - 14 >= countText.length * ccw ? countText : r.w - 14 >= (files + ' files').length * ccw ? files + ' files' : String(files);
        const ol = fit(el.label, r.w - 14, gcw) || el.label.slice(0, 1) + '…';
        lg.push(`<g data-el="${id}" style="cursor:pointer"><title>${esc(el.label + ' · ' + countText)}</title><text x="${f1(r.x + 7)}" y="${f1(r.y + 14)}" style="font:${gFont};fill:${v('ink')};${halo(fillC)}">${esc(ol)}</text><text x="${f1(r.x + 7)}" y="${f1(r.y + 26)}" style="font:${cFont};fill:${v('ink-faint')};${halo(fillC)}">${esc(short)}</text></g>`);
        const a0 = auditOf(el); if (a0) lg.push(badge(r.x + r.w, r.y, a0));
        return;
      }
      if (headerFits) lg.push(`<g data-el="${id}" style="cursor:pointer"><text x="${f1(r.x + (big ? 10 : 7))}" y="${f1(ty)}" style="font:${gFont};letter-spacing:${v('tracking-group-label')};fill:${v('ink')};${halo(fillC)}">${esc(label)}</text>${showCount ? `<text x="${f1(r.x + r.w - 24)}" y="${f1(ty)}" text-anchor="end" style="font:${cFont};fill:${v('ink-faint')};${halo(fillC)}">${countText}</text>` : ''}</g>`);
      if (big && !ovw && !isTwin) lg.push(`<g data-collapse="${id}" style="cursor:pointer"><title>${s.collapsed ? 'Expand' : 'Collapse'}</title><rect x="${f1(r.x + r.w - 20)}" y="${f1(ty - 10)}" width="14" height="14" rx="3" style="fill:transparent"/><text x="${f1(r.x + r.w - 13)}" y="${f1(ty + 0.5)}" text-anchor="middle" style="font:500 13px/1 ${v('font-ui')};fill:${v('ink-muted')}">${s.collapsed ? '+' : '−'}</text></g>`);
      const a = auditOf(el); if (a) lg.push(badge(r.x + r.w, r.y, a));
    });
    // twins plates
    (data.byPrimitive.twins || []).forEach(id => {
      const p = D.plates[id], el = data.elements[id];
      if (!p || ovw) return;
      map.elements[id] = 'drawn';
      const r = S(p), on = focEl === id, conf = memo(data, 'conf:' + id, () => conformity(data, id));
      const sx = r.x - 5;
      const lastTop = S({ x: 0, y: p.rowTops[p.rowTops.length - 1], w: 0, h: 0 }).y + 12;
      bg.push(`<line x1="${f1(sx)}" x2="${f1(sx)}" y1="${f1(r.y + r.h / 2)}" y2="${f1(lastTop)}" style="stroke:${v('ink-faint')};stroke-width:${v('stroke-group')}"/>`);
      p.rowTops.forEach(t => { const yy = S({ x: 0, y: t, w: 0, h: 0 }).y + 12; bg.push(`<line x1="${f1(sx)}" x2="${f1(r.x)}" y1="${f1(yy)}" y2="${f1(yy)}" style="stroke:${v('ink-faint')};stroke-width:${v('stroke-group')}"/>`); });
      bg.push(`<rect data-el="${id}" x="${f1(r.x)}" y="${f1(r.y)}" width="${f1(r.w)}" height="${f1(r.h)}" rx="4" style="fill:${v('surface-panel')};stroke:${on ? v('accent') : v('ink-faint')};stroke-width:${on ? v('stroke-hub') : v('stroke-group')}"/>`);
      if (r.h >= 26) {
        lg.push(`<text data-el="${id}" x="${f1(r.x + 10)}" y="${f1(r.y + 14)}" style="font:${v('type-caption')};fill:${v('ink-muted')}">${esc(el.label)} · ${el.members.length} twins · ${el.interface.length} ports</text>`);
        if (r.h >= 40) { let cx = r.x + 10; el.interface.forEach(pt => { const w = pt.name.length * cw * 0.92 + 12; if (cx + w > r.x + r.w - 6) return; lg.push(`<rect x="${f1(cx)}" y="${f1(r.y + r.h - 20)}" width="${f1(w)}" height="15" rx="3" style="fill:${v('surface-node')};stroke:${v('rule')};stroke-width:1px"/><text x="${f1(cx + 6)}" y="${f1(r.y + r.h - 9)}" style="font:${v('type-count')};fill:${v('ink-muted')}">${esc(pt.name)}</text>`); cx += w + 6; }); }
      }
      el.members.forEach(sec => {
        const s = D.sections[sec]; if (!s || s.collapsed) return;
        const sr = S(s), marks = detail && sr.w >= 120 ? conf[sec] || [] : [];
        marks.forEach((c, i) => {
          const x = sr.x + sr.w - 14 - (marks.length - 1 - i) * 15, y = sr.y + Math.min(17, Math.max(13, sr.h * 0.6)) - 9.5;
          const col = { ok: 'state-ok', warn: 'state-warn', bad: 'state-bad' }[c];
          lg.push(`<g><title>${esc(el.interface[i].name + ': ' + { ok: 'matches through a static edge', warn: 'matches only through overlay edges', bad: 'no matching edge' }[c])}</title><rect x="${f1(x - 6)}" y="${f1(y)}" width="12" height="12" rx="2" style="fill:${v('surface-node')};stroke:${v(col)};stroke-width:1.25px"/><text x="${f1(x)}" y="${f1(y + 9.5)}" text-anchor="middle" style="font:700 9px/1 ${v('font-ui')};fill:${v(col)}">${{ ok: '✓', warn: '~', bad: '✕' }[c]}</text></g>`);
        });
      });
      const a = auditOf(el); if (a) lg.push(badge(r.x + r.w, r.y, a));
    });
    // lanes
    (data.byPrimitive.lane || []).forEach(id => {
      const el = data.elements[id], P = D.lanes[id];
      if (!P || ovw) return;
      const prov = (el.source && el.source.provenance) || 'static', dash = SPEC.dash[prov] || 'none', on = focEl === id;
      const stepEdges = data.edges.filter(e => el.steps.includes(e.dst));
      const spineSlot = stepEdges.length ? slotOf(stepEdges[0]) : 1;
      if (P.mode === 'inline') {
        if (D.sections[P.section] && D.sections[P.section].collapsed) return;
        map.elements[id] = 'drawn';
        const r = S(P), n = L.laneNotch * z.k, pt = L.lanePoint * z.k;
        bg.push(`<polygon data-el="${id}" points="${f1(r.x)},${f1(r.y)} ${f1(r.x + r.w / 2)},${f1(r.y + n)} ${f1(r.x + r.w)},${f1(r.y)} ${f1(r.x + r.w)},${f1(r.y + r.h - pt)} ${f1(r.x + r.w / 2)},${f1(r.y + r.h)} ${f1(r.x)},${f1(r.y + r.h - pt)}" style="fill:${v('lane-fill')};stroke:${on ? v('accent') : v('lane-edge')};stroke-width:${on ? v('stroke-hub') : v('stroke-group')};stroke-dasharray:${dash};stroke-linejoin:round"/>`);
        const gw = L.laneGutter * z.k, sx = r.x + gw / 2 + 1, dr = Math.min(8, gw / 2 - 2);
        const ys = el.steps.map(s => D.nodes[s] && mid(S(D.nodes[s])).y).filter(y => y != null);
        if (ys.length > 1) bg.push(`<line x1="${f1(sx)}" x2="${f1(sx)}" y1="${f1(ys[0])}" y2="${f1(ys[ys.length - 1])}" style="stroke:${v('edge-' + spineSlot)};stroke-width:${v('stroke-edge-emph')};stroke-dasharray:${dash}"/>`);
        ys.forEach((y, i) => lg.push(dr >= 6.5 ? `<g><circle cx="${f1(sx)}" cy="${f1(y)}" r="${f1(dr)}" style="fill:${v('surface-panel')};stroke:${v('lane-edge')};stroke-width:${v('stroke-group')}"/><text x="${f1(sx)}" y="${f1(y + 3)}" text-anchor="middle" style="font:${dr >= 7.5 ? v('type-count') : v('type-count-compact')};fill:${v('ink')}">${i + 1}</text></g>` : `<circle cx="${f1(sx)}" cy="${f1(y)}" r="${f1(Math.max(2, dr))}" style="fill:${v('lane-edge')}"><title>Step ${i + 1}</title></circle>`));
        const lh = (L.laneHead - L.laneNotch) * z.k;
        if (lh >= 15 && lh < 34 && detail) lg.push(`<g data-el="${id}" style="cursor:pointer"><title>${esc(el.label)}</title><text x="${f1(r.x + 8)}" y="${f1(r.y + n + Math.min(13, lh * 0.72))}" style="font:${v('type-group-label-compact')};fill:${v('ink')}">${esc(fit(el.label + ' · ' + el.steps.length + ' steps', r.w - 16, 6.9))}</text></g>`);
        if (lh >= 34 && detail) {
          const src = prov === 'static' ? 'order from edges' : `order from ${prov}`;
          lg.push(`<g data-el="${id}" style="cursor:pointer"><text x="${f1(r.x + 10)}" y="${f1(r.y + n + 13)}" style="font:${v('type-group-label')};fill:${v('ink')}">${esc(fit(el.label, r.w - 70, 7.6))}</text><text x="${f1(r.x + r.w - 10)}" y="${f1(r.y + n + 13)}" text-anchor="end" style="font:${v('type-count')};fill:${v('ink-faint')}">${el.steps.length} steps</text><text x="${f1(r.x + 10)}" y="${f1(r.y + n + 27)}" style="font:${v('type-count')};fill:${v('ink-muted')}"><title>${esc(src + (el.source && el.source.evidence ? ': ' + el.source.evidence : ''))}</title>${esc(fit(src + (el.source && el.source.evidence ? ' · ' + el.source.evidence : ''), r.w - 20, cw * 0.92))}</text></g>`);
        }
      } else if (detail) {
        const rs = el.steps.map(s => D.nodes[s] && S(D.nodes[s]));
        if (rs.some(r => !r)) return;
        map.elements[id] = 'drawn';
        const pts = rs.map(r => [r.x + 10, r.y + r.h / 2]);
        bg.push(`<polyline data-el="${id}" points="${pts.map(p => p.map(f1).join(',')).join(' ')}" style="fill:none;stroke:${v('lane-fill')};stroke-width:7px;stroke-linejoin:round;stroke-linecap:round;opacity:.85"/>`);
        bg.push(`<polyline points="${pts.map(p => p.map(f1).join(',')).join(' ')}" style="fill:none;stroke:${on ? v('accent') : v('lane-edge')};stroke-width:${v('stroke-group')};stroke-dasharray:${dash};stroke-linejoin:round"/>`);
        rs.forEach((r, i) => { routeStep[el.steps[i]] = true; lg.push(`<g data-el="${id}" style="cursor:pointer"><title>${esc(el.label + ' · step ' + (i + 1) + ' of ' + rs.length)}</title><circle cx="${f1(r.x + 10)}" cy="${f1(r.y + r.h / 2)}" r="6.5" style="fill:${v('lane-fill')};stroke:${v('lane-edge')};stroke-width:${v('stroke-group')}"/><text x="${f1(r.x + 10)}" y="${f1(r.y + r.h / 2 + 3)}" text-anchor="middle" style="font:${v('type-count-compact')};fill:${v('ink')}">${i + 1}</text></g>`); });
        if (on) { const r = rs[0]; lg.push(pill(r.x - 6, r.y - 12, `${el.label} · ${rs.length} steps`, { stroke: v('lane-edge'), ink: v('ink') })); }
      }
    });
    // overlaps (marks drawn with nodes)
    (data.byPrimitive.overlap || []).forEach(id => { if (!ovw) map.elements[id] = 'drawn'; });
    // loops: circular ring hull
    (data.byPrimitive.loop || []).forEach(id => {
      const el = data.elements[id];
      if (el.classification !== 'circular' || ovw) return;
      const rs = el.cycle.map(m => D.nodes[m] && S(D.nodes[m])).filter(Boolean);
      if (!rs.length) return;
      map.elements[id] = 'drawn';
      const pts = hull(rs.flatMap(r => rectPts(r, 9)));
      bg.push(`<polygon data-el="${id}" points="${pts.map(p => p.map(f1).join(',')).join(' ')}" style="fill:none;stroke:${focEl === id ? v('accent') : v('ring')};stroke-width:${v('stroke-edge-emph')};stroke-linejoin:round"/>`);
      const top = pts.reduce((a, b) => (b[1] > a[1] || (b[1] === a[1] && b[0] < a[0]) ? b : a));
      lg.push(pill(top[0], top[1] + 2, `cycle · ${el.cycle.length} files`, { stroke: v('ring'), ink: v('ink'), attr: `data-el="${id}"`, title: el.claim }));
    });
    bg.push('</g>');
  }

  // ---------- 2. edges
  const endpoint = id => {
    if (designish && D.lens && !D.lens.inside.has(id)) return { key: 'o:lens', rect: S(D.lensOut) };
    if (ovw) { const t = drawnTop(id); if (t) return { key: 's:' + t, rect: S(D.sections[t]) }; }
    if (designish) {
      if (D.nodes[id]) return { key: 'n:' + id, rect: nodeRect(id), node: id };
      const fs = D.foldOf[id]; if (fs) return { key: 'f:' + fs, rect: S(D.folds[fs]) };
      const p = D.proxy[id]; if (p) return { key: 's:' + p, rect: S(D.sections[p]) };
      return null;
    }
    const r = nodeRect(id); return r ? { key: 'n:' + id, rect: r, node: id } : null;
  };
  const singles = [], bundles = {}, onRail = [];
  const iso = designish ? D.iso : null, elsewhere = { edges: 0, files: 0 };
  const lensSeen = designish && D.lens ? { in: 0, cross: 0, out: 0 } : null;
  const portEnd = (side, id) => { const k = iso.portOf[side][id], P = k && iso.ports[k]; return P ? { key: 'p:' + k, rect: S(P) } : null; };
  data.edges.forEach(e => {
    let a, b;
    if (iso) {
      const si = iso.inside.has(e.src), di = iso.inside.has(e.dst);
      // One rule: an edge with no end in the isolated section is not drawn, so it is folded into the elsewhere count.
      if (!si && !di) { map.edges[e.id] = { via: 'folded', bundle: 'elsewhere' }; elsewhere.edges++; return; }
      a = si ? endpoint(e.src) : portEnd('in', e.src); b = di ? endpoint(e.dst) : portEnd('out', e.dst);
    } else { a = endpoint(e.src); b = endpoint(e.dst); }
    // Record how this frame routed the edge relative to the lens box; conserve() checks it against the lens's own counts.
    if (lensSeen && a && b) { const oa = a.key === 'o:lens', ob = b.key === 'o:lens'; lensSeen[oa && ob ? 'out' : oa || ob ? 'cross' : 'in']++; }
    if (!a || !b) return;
    if (a.key === b.key) { map.edges[e.id] = { via: 'collapsed', group: a.key.slice(2) }; return; }
    const bus = busOf[e.id];
    if (designish && bus && D.rails[bus] && a.node && b.node) { onRail.push(e); map.edges[e.id] = { via: 'bus', bus }; return; }
    let key = null, ra = a.rect, rb = b.rect;
    if ('sfpo'.includes(a.key[0]) || 'sfpo'.includes(b.key[0])) key = a.key + '>' + b.key;
    else if (designish && lod === 'structure' && data.home[e.src] !== data.home[e.dst]) {
      key = 's:' + data.home[e.src] + '>s:' + data.home[e.dst];
      ra = S(D.sections[data.home[e.src]]); rb = S(D.sections[data.home[e.dst]]);
    }
    if (key) { (bundles[key] = bundles[key] || { ra, rb, edges: [] }).edges.push(e); }
    else singles.push({ e, ra, rb });
  });
  Object.entries(bundles).forEach(([key, b]) => {
    if (b.edges.length === 1) { singles.push({ e: b.edges[0], ra: b.ra, rb: b.rb }); return; }
    b.edges.forEach(e => { map.edges[e.id] = { via: 'folded', bundle: key }; });
    const slots = new Set(b.edges.map(slotOf)), provs = new Set(b.edges.map(e => e.provenance));
    const slot = slots.size === 1 ? [...slots][0] : 0, prov = provs.size === 1 ? [...provs][0] : 'static';
    const anyFocus = rel && b.edges.some(e => rel.has(e.src) && rel.has(e.dst));
    const dim = rel && !anyFocus;
    const d = edgePath(b.ra, b.rb), m = bezMid(d);
    const c = slot ? v('edge-' + slot) : v('ink-muted');
    eg.push(`<path data-bundle="${esc(key)}" d="${d}" style="stroke:${c};stroke-width:${v('stroke-edge-emph')};stroke-dasharray:${SPEC.dash[prov]};fill:none;opacity:${dim ? v('opacity-dim') : 1}" marker-end="url(#${uid}-${slot}-arrow-filled)"><title>${b.edges.length} edges folded · ${[...provs].join(', ')}</title></path>`);
    lg.push(`<g style="opacity:${dim ? v('opacity-dim') : 1}">${pill(m.x, m.y, '×' + b.edges.length, { anchor: 'middle', stroke: c, ink: v('ink'), title: b.edges.length + ' edges folded into one line' + (provs.size > 1 ? ' · mixed provenance: ' + [...provs].join(', ') : '') })}</g>`);
  });
  const edgeTitle = e => `${(nodeInfo(e.src) || {}).label} → ${(nodeInfo(e.dst) || {}).label} · ${e.kind}${e.role ? ' / ' + e.role : ''} · ${e.provenance}${e.condition ? ' · ' + e.condition.condition : ''}`;
  const edgeFocus = e => {
    if (!rel) return { emph: false, dim: false };
    const nodeF = focus.type === 'node' ? (e.src === focus.id || e.dst === focus.id) : focus.type === 'edge' ? e.id === focus.id : rel.has(e.src) && rel.has(e.dst);
    return { emph: nodeF, dim: !nodeF };
  };
  singles.forEach(({ e, ra, rb }) => {
    const { emph, dim } = edgeFocus(e), off = dimK.has(e.role || e.kind);
    // No bus fade here: a single always draws. (A fade to 0 once counted an edge as drawn that was invisible; review v4 B2.)
    const op = dim || off ? 0.22 : 1;
    map.edges[e.id] = { via: 'drawn' };
    eg.push(`<path data-edge="${e.id}" d="${edgePath(ra, rb)}" style="${edgeStyle(e, emph, hoverTier(e, emph))};opacity:${f1(op * 100) / 100}" marker-end="url(#${uid}-${hoverTier(e, emph) ? 't' + hoverTier(e, emph) : slotOf(e)}-${glyphOf(e)})"><title>${esc(edgeTitle(e))}</title></path>`);
  });
  // rails
  if (decor > 0 && !ovw) {
    eg.push(`<g style="opacity:${decor}">`);
    (data.byPrimitive.bus || []).forEach(id => {
      const R = D.rails[id], el = data.elements[id];
      if (!R) return;
      map.elements[id] = 'drawn';
      const mine = onRail.filter(e => busOf[e.id] === id);
      if (!mine.length) return;
      const slot = slotOf({ role: el.contract && el.contract.role, kind: mine[0].kind });
      const c = v('edge-' + slot), on = focEl === id || (state.hover && state.hover.id === id);
      const anyRel = rel && mine.some(e => rel.has(e.src) && rel.has(e.dst));
      const gOp = rel && !anyRel && !on ? 0.22 : 1;
      eg.push(`<g data-el="${id}" style="opacity:${gOp}">`);
      const exits = new Set();
      if (R.o === 'v') {
        const rx = R.x * z.k + z.x, y1 = R.y1 * z.k + z.y, y2 = R.y2 * z.k + z.y;
        eg.push(`<line x1="${f1(rx)}" x2="${f1(rx)}" y1="${f1(y1 - 6)}" y2="${f1(y2 + 6)}" style="stroke:${c};stroke-width:${on ? 4.5 : v('stroke-rail')};stroke-linecap:round"/>`);
        mine.forEach(e => {
          const a = nodeRect(e.src), b = nodeRect(e.dst), ay = mid(a).y, by = mid(b).y, { emph } = edgeFocus(e);
          const ax = a.x + a.w <= rx ? a.x + a.w : a.x, bx = b.x >= rx ? b.x : b.x + b.w;
          eg.push(`<path data-edge="${e.id}" d="M${f1(ax)} ${f1(ay)}H${f1(rx)}" style="${edgeStyle(e, emph, hoverTier(e, emph))}"><title>${esc(edgeTitle(e))}</title></path><circle cx="${f1(rx)}" cy="${f1(ay)}" r="3" style="fill:${c}"/>`);
          if (!exits.has(e.dst)) { exits.add(e.dst); eg.push(`<path d="M${f1(rx)} ${f1(by)}H${f1(bx)}" style="stroke:${c};stroke-width:${v('stroke-edge-emph')};fill:none" marker-end="url(#${uid}-${slot}-${glyphOf(e)})"/><circle cx="${f1(rx)}" cy="${f1(by)}" r="2.5" style="fill:${v('surface-canvas')};stroke:${c};stroke-width:1.25px"/>`); }
        });
        lg.push(`<g style="opacity:${decor * gOp}">${pill(rx, y2 + 20, `${el.label} · ${mine.length}`, { anchor: 'middle', stroke: c, ink: v('ink'), attr: `data-el="${id}" style="cursor:pointer"`, title: el.contract && el.contract.signature })}${on && el.contract ? pill(rx, y2 + 40, el.contract.signature, { anchor: 'middle', stroke: c, ink: v('ink'), fill: v('surface-node') }) : ''}</g>`);
      } else {
        const ry = R.y * z.k + z.y, x1 = R.x1 * z.k + z.x, x2 = R.x2 * z.k + z.x;
        eg.push(`<line x1="${f1(x1 - 6)}" x2="${f1(x2 + 6)}" y1="${f1(ry)}" y2="${f1(ry)}" style="stroke:${c};stroke-width:${on ? 4.5 : v('stroke-rail')};stroke-linecap:round"/>`);
        mine.forEach(e => {
          const a = nodeRect(e.src), b = nodeRect(e.dst), ax = mid(a).x, { emph } = edgeFocus(e);
          const ay = a.y + a.h < ry ? a.y + a.h : a.y;
          eg.push(`<path data-edge="${e.id}" d="M${f1(ax)} ${f1(ay)}V${f1(ry)}" style="${edgeStyle(e, emph, hoverTier(e, emph))}"><title>${esc(edgeTitle(e))}</title></path><circle cx="${f1(ax)}" cy="${f1(ry)}" r="3" style="fill:${c}"/>`);
          if (!exits.has(e.dst)) {
            exits.add(e.dst);
            const bx = mid(b).x;
            if (b.y > ry) eg.push(`<path d="M${f1(bx)} ${f1(ry)}V${f1(b.y)}" style="stroke:${c};stroke-width:${v('stroke-edge-emph')};fill:none" marker-end="url(#${uid}-${slot}-${glyphOf(e)})"/>`);
            else { eg.push(`<path d="M${f1(b.x - 18)} ${f1(ry)}H${f1(b.x)}" style="stroke:${c};stroke-width:${v('stroke-edge-emph')};fill:none" marker-end="url(#${uid}-${slot}-${glyphOf(e)})"/><path d="M${f1(b.x + b.w + 18)} ${f1(ry)}H${f1(b.x + b.w)}" style="stroke:${c};stroke-width:${v('stroke-edge-emph')};fill:none" marker-end="url(#${uid}-${slot}-${glyphOf(e)})"/>`); }
          }
        });
        lg.push(`<g style="opacity:${decor * gOp}">${pill(x1 - 6, ry - 14, `${el.label} · ${mine.length}`, { stroke: c, ink: v('ink'), attr: `data-el="${id}" style="cursor:pointer"`, title: el.contract && el.contract.signature })}${on && el.contract ? pill(x1 - 6, ry - 34, el.contract.signature, { stroke: c, ink: v('ink'), fill: v('surface-node') }) : ''}</g>`);
      }
      eg.push('</g>');
    });
    D.tethers.forEach(t => {
      const a = nodeRect(t.node), s = D.sections[t.section]; if (!a || !s) return;
      const r = S(s);
      eg.push(`<path d="M${f1(mid(a).x)} ${f1(a.y + a.h)}V${f1(r.y)}" style="stroke:${v('hub')};stroke-width:1px;stroke-dasharray:1 3;stroke-linecap:round;fill:none"><title>Home: ${esc(data.elements[t.section].label)}</title></path>`);
    });
    // intentional and unclassified loops: a return arc
    (data.byPrimitive.loop || []).forEach(id => {
      const el = data.elements[id];
      if (el.classification === 'circular') return;
      const rs = el.cycle.map(m => D.nodes[m] && S(D.nodes[m])).filter(Boolean);
      if (rs.length < 1) return;
      map.elements[id] = 'drawn';
      const first = rs[0], last = rs[rs.length - 1];
      const x = Math.max(...rs.map(r => r.x + r.w)), out = x + 40;
      const y1 = mid(last).y, y2 = mid(first).y;
      const intent = el.classification === 'intentional';
      const ce = data.edges.find(e => el.cycle.includes(e.src) && el.cycle.includes(e.dst));
      const slot = ce ? slotOf(ce) : 5;
      const c = intent ? v('edge-' + slot) : v('loop-unclassified');
      const on = focEl === id;
      eg.push(`<path data-el="${id}" d="M${f1(last.x + last.w)} ${f1(y1)}C${f1(out + 8)} ${f1(y1)} ${f1(out + 8)} ${f1(y2)} ${f1(first.x + first.w)} ${f1(y2)}" style="stroke:${on ? v('accent') : c};stroke-width:${v('stroke-edge-emph')};stroke-dasharray:${intent ? 'none' : '2 3'};fill:none" marker-end="url(#${uid}-${intent ? slot : 0}-arrow-filled)"><title>${esc(el.claim)}</title></path>`);
      const my = (y1 + y2) / 2, gx = out + 2;
      lg.push(intent
        ? `<g data-el="${id}"><title>Feedback through a state element${el.evidence ? ': ' + esc(el.evidence) : ''}</title><rect x="${f1(gx - 13)}" y="${f1(my - 9)}" width="26" height="18" rx="3" style="fill:${v('surface-panel')};stroke:${v('ink')};stroke-width:1px"/><text x="${f1(gx)}" y="${f1(my + 4)}" text-anchor="middle" style="font:500 11px/1 ${v('font-mono')};fill:${v('ink')}">z⁻¹</text></g>`
        : `<g data-el="${id}"><title>Loop not yet classified; raised in dialogue</title><circle cx="${f1(gx)}" cy="${f1(my)}" r="8" style="fill:${v('surface-panel')};stroke:${v('loop-unclassified')};stroke-width:1.25px;stroke-dasharray:2 2"/><text x="${f1(gx)}" y="${f1(my + 3.5)}" text-anchor="middle" style="font:700 10px/1 ${v('font-ui')};fill:${v('loop-unclassified')}">?</text></g>`);
    });
    eg.push('</g>');
  }

  // ---------- 3. nodes
  const hubs = {}; (data.byPrimitive.hub || []).forEach(h => { hubs[data.elements[h].node] = h; });
  const overlapOf = {}; (data.byPrimitive.overlap || []).forEach(o => data.elements[o].members.forEach(m => { (overlapOf[m] = overlapOf[m] || []).push(o); }));
  const fanIn = id => data.edges.filter(e => e.dst === id).length;
  const cfOf = {}; if (designish && detail) memo(data, 'cf', () => counterflow(data)).forEach(f => { cfOf[f.node] = f; });
  const ids = data.nodeIds.concat(df ? (df.removed || []).map(n => n.id) : []);
  ids.forEach(id => {
    const n = nodeInfo(id);
    if (iso && !iso.inside.has(id)) {
      const k = iso.portOf.in[id] || iso.portOf.out[id];
      if (!k) elsewhere.files++;
      map.nodes[id] = { state: k ? 'port' : 'elsewhere', proxy: k || 'elsewhere' }; return;
    }
    // Lens before overview: an outside file's home section is not laid out, so only the outside box can stand in.
    if (designish && D.lens && !D.lens.inside.has(id)) { map.nodes[id] = { state: 'outside', proxy: 'lens-outside' }; return; }
    if (ovw && !D.proxy[id]) { map.nodes[id] = { state: 'lod', proxy: drawnTop(id) }; return; }
    if (designish && !D.nodes[id] && D.foldOf[id]) { map.nodes[id] = { state: 'folded', proxy: 'fold:' + D.foldOf[id] }; return; }
    if (designish && !D.nodes[id]) { map.nodes[id] = { state: 'collapsed', proxy: D.proxy[id] || null }; return; }
    const r = nodeRect(id); if (!r) return;
    const dm = diffOf[id];
    const ghost = dm === 'removed' || dm === 'ghost-added';
    map.nodes[id] = { state: ghost ? 'ghost' : 'drawn' };
    if (!data.nodes[id]) delete map.nodes[id];
    const sel = id === selNode, hov = id === hovNode, relN = rel && rel.has(id) && !sel && !hov;
    const dim = isDim(id) && !sel && !hov;
    const hub = designish && hubs[id] && decor > 0;
    const strokeC = sel || hov || relN || (focEl && rel && rel.has(id)) ? 'accent' : ghost ? (dm === 'removed' ? 'diff-removed' : 'ink-faint') : hub ? 'hub' : 'rule';
    const sw = sel || hov ? v('stroke-hub') : hub ? v('stroke-hub') : v('stroke-group');
    let g = `<g data-node="${esc(id)}" style="opacity:${dim ? v('opacity-dim') : 1};cursor:pointer"><title>${esc(n.path)}${hub ? ' · fan-in ' + fanIn(id) : ''}</title>`;
    if (sel) g += `<rect x="${f1(r.x - 4)}" y="${f1(r.y - 4)}" width="${f1(r.w + 8)}" height="${f1(r.h + 8)}" rx="7" style="fill:${v('accent-soft')}"/>`;
    if (hub) g += `<rect x="${f1(r.x - 3.5)}" y="${f1(r.y - 3.5)}" width="${f1(r.w + 7)}" height="${f1(r.h + 7)}" rx="6.5" style="fill:${v('hub-soft')};stroke:${v('hub')};stroke-width:${v('stroke-hub')};opacity:${decor}"/>`;
    if (designish && overlapOf[id] && decor > 0) g += `<rect x="${f1(r.x - 3)}" y="${f1(r.y - 3)}" width="${f1(r.w + 6)}" height="${f1(r.h + 6)}" rx="6" style="fill:${v('set-1')};stroke:${v('set-1')};stroke-width:4px;opacity:${decor}"/>`;
    g += `<rect width="${f1(r.w)}" height="${f1(r.h)}" x="${f1(r.x)}" y="${f1(r.y)}" rx="4" style="fill:${ghost ? v('surface-canvas') : v('surface-node')};stroke:${v(strokeC)};stroke-width:${sw};stroke-dasharray:${ghost ? '3 2.5' : 'none'}"/>`;
    if (dm && !ghost) g += `<rect width="${f1(r.w)}" height="${f1(r.h)}" x="${f1(r.x)}" y="${f1(r.y)}" rx="4" style="fill:${v('diff-' + dm + '-soft')}"/>`;
    if (dm === 'removed') g += `<rect width="${f1(r.w)}" height="${f1(r.h)}" x="${f1(r.x)}" y="${f1(r.y)}" rx="4" style="fill:${v('diff-removed-soft')}"/>`;
    const tier = r.w < 34 || r.h < 8 ? 0 : (detail || !designish) && r.w >= 60 && r.h >= 14 ? 2 : 1;
    const showLabel = tier === 2, ncw = tier === 2 ? cw : cw * 0.8, nin = tier === 2 ? SPEC.node.inset : 4;
    if (tier) {
      const marks = [];
      if (tier === 2 && designish && decor > 0) {
        if (hub) marks.push({ kind: 'fanin', t: String(fanIn(id)) });
        if (overlapOf[id]) marks.push({ kind: 'overlap', t: '∩' + data.elements[overlapOf[id][0]].sets.length });
        if (cfOf[id]) marks.push({ kind: 'cf', t: '↑' + cfOf[id].edges.length });
      }
      let mx = r.x + r.w - 5;
      marks.forEach(m => { m.w = m.kind === 'fanin' ? m.t.length * cw + 2 : m.t.length * cw * 0.9 + 10; m.x = mx - m.w; mx = m.x - 4; });
      const lead = tier === 2 && routeStep[id] ? 20 : nin;
      const reserve = r.x + r.w - mx - 5 + (marks.length ? 4 : 0);
      marks.forEach(m => {
        const cy = r.y + r.h / 2;
        if (m.kind === 'fanin') g += `<text x="${f1(m.x + m.w)}" y="${f1(cy + 3.5)}" text-anchor="end" style="font:${v('type-count')};fill:${v('hub')};opacity:${decor}">${m.t}</text>`;
        else if (m.kind === 'overlap') { const o = data.elements[overlapOf[id][0]]; g += `<g style="opacity:${decor}"><title>${esc('Overlap: ' + o.sets.map(x => data.elements[x].label).join(' ∩ '))}</title><rect x="${f1(m.x)}" y="${f1(cy - 7)}" width="${f1(m.w)}" height="14" rx="7" style="fill:${v('set-1')};stroke:${v('rule')};stroke-width:1px"/><text x="${f1(m.x + m.w / 2)}" y="${f1(cy + 3.5)}" text-anchor="middle" style="font:${v('type-count')};fill:${v('ink')}">${m.t}</text></g>`; }
        else { const f = cfOf[id], est = f.status === 'established', pend = f.status === 'pending'; g += `<g style="opacity:${decor}" ${f.exemption ? `data-el="${f.exemption}"` : ''}><title>${esc(`↑${f.edges.length} counterflow · ${est ? 'exempt' : pend ? 'pending' : 'flagged'}: ${f.edges.length} edges point up a level`)}</title><rect x="${f1(m.x)}" y="${f1(cy - 7)}" width="${f1(m.w)}" height="14" rx="7" style="fill:${v('surface-panel')};stroke:${est ? v('ink-faint') : v('state-warn')};stroke-width:1.25px;stroke-dasharray:${pend ? '3 2' : 'none'}"/><text x="${f1(m.x + m.w / 2)}" y="${f1(cy + 3.5)}" text-anchor="middle" style="font:${v('type-count')};fill:${est ? v('ink-muted') : v('ink')}">${m.t}</text></g>`; }
      });
      g += `<text x="${f1(r.x + lead)}" y="${f1(r.y + r.h / 2 + (tier === 2 ? 4 : 3))}" style="font:${tier === 2 ? v('type-node-label') : v('type-node-label-compact')};letter-spacing:${v('tracking-node-label')};fill:${ghost ? v('ink-faint') : v('ink')};text-decoration:${dm === 'removed' ? 'line-through' : 'none'}">${esc(fit(n.label, r.w - lead - nin - reserve, ncw))}</text>`;
    }
    if (dm) {
      const key = dm === 'ghost-added' ? 'added' : dm, gl = { added: '+', changed: '~', stale: '⧗', removed: '−' }[key];
      g += `<g><title>${{ added: 'Added since the last run', changed: 'Changed since the last run', stale: 'Explainer anchored to an older version', removed: 'Removed since the last run' }[key]}${dm === 'ghost-added' ? ' (not in the previous run)' : ''}</title><rect x="${f1(r.x + r.w - 7)}" y="${f1(r.y + r.h - 7)}" width="13" height="13" rx="3" style="fill:${v('surface-node')};stroke:${v('diff-' + key)};stroke-width:1.25px;opacity:${dm === 'ghost-added' ? 0.6 : 1}"/><text x="${f1(r.x + r.w - 0.5)}" y="${f1(r.y + r.h + 3)}" text-anchor="middle" style="font:700 10px/1 ${v('font-ui')};fill:${v('diff-' + key)}">${gl}</text></g>`;
    }
    ng.push(g + '</g>');
  });

  // ---------- 4. labels: counterflow flags, pins
  const pins = {};
  const addPin = (id, html) => { (pins[id] = pins[id] || []).push(html); };
  const ST = data.stages;
  if (ST && state.stage === 3) ST.dialogue.forEach(q => addPin(q.node, (x, y) => `<g data-node="${esc(q.node)}"><title>${esc(q.question)}</title><rect x="${f1(x - 7.5)}" y="${f1(y - 7.5)}" width="15" height="15" rx="3" style="fill:${q.answer ? v('surface-panel') : v('state-warn')};stroke:${q.answer ? v('ink-faint') : v('state-warn')};stroke-width:1px"/><text x="${f1(x)}" y="${f1(y + 3.5)}" text-anchor="middle" style="font:700 10px/1 ${v('font-ui')};fill:${q.answer ? v('ink-muted') : v('surface-node')}">?</text></g>`));
  if (ST && state.stage === 4) ST.audit.forEach(a => addPin(a.nodes[0], (x, y) => `<g><title>${esc(a.by + ': ' + a.text)}</title>${badge(x, y, { confirmed: 'pass', challenged: 'fail', open: 'warn' }[a.verdict])}</g>`));
  if (ST && state.stage === 6) {
    const tour = ST.tours[(state.tour && state.tour.index) || 0], cur = (state.tour && state.tour.step) || 0;
    if (tour) tour.steps.forEach((s, i) => addPin(s.node, (x, y) => `<g><title>${esc(s.text)}</title><circle cx="${f1(x)}" cy="${f1(y)}" r="8.5" style="fill:${i === cur ? v('accent') : v('ink')};stroke:${v('surface-canvas')};stroke-width:1.5px"/><text x="${f1(x)}" y="${f1(y + 3.5)}" text-anchor="middle" style="font:${v('type-count')};fill:${v('surface-node')}">${i + 1}</text></g>`));
  }
  Object.entries(pins).forEach(([id, list]) => {
    let r = null;
    if (iso && !iso.inside.has(id)) { const k = iso.portOf.in[id] || iso.portOf.out[id]; r = k ? S(iso.ports[k]) : null; }
    else if (designish && D.lens && !D.lens.inside.has(id)) r = S(D.lensOut);
    else if (designish && !D.nodes[id] && !ovw && D.foldOf[id]) r = S(D.folds[D.foldOf[id]]);
    else if (designish && !D.nodes[id]) { const p = ovw ? drawnTop(id) : D.proxy[id]; if (p && D.sections[p]) r = S(D.sections[p]); }
    else if (ovw) { const t = drawnTop(id); r = t && S(D.sections[t]); }
    else r = nodeRect(id);
    if (!r) return;
    list.forEach((fn, i) => lg.push(fn(r.x + r.w - 4 - i * 18, r.y - 1)));
  });

  // ---------- 5. fold rows, isolate rails
  if (designish && !ovw) Object.entries(D.folds).forEach(([sec, f]) => {
    const r = S(f), n = f.members.length, ins = new Set(f.members);
    const ec = data.edges.filter(e => ins.has(e.src) || ins.has(e.dst)).length;
    const text = fit(`+${n} more · ${ec} edges`, r.w - 14, cw * 0.92), on = !!(selNode && D.foldOf[selNode] === sec);
    map.drawn.add('fold:' + sec);
    ng.push(`<g data-unfold="${esc(sec)}" style="cursor:pointer"><title>${esc(`${n} less-connected files folded here, with ${ec} edges. Click to show all.`)}</title><rect x="${f1(r.x)}" y="${f1(r.y)}" width="${f1(r.w)}" height="${f1(r.h)}" rx="4" style="fill:${v('surface-group-nested')};stroke:${v(on ? 'accent' : 'ink-faint')};stroke-width:${on ? v('stroke-hub') : v('stroke-group')};stroke-dasharray:4 3"/>${r.h >= 12 ? `<text x="${f1(r.x + 8)}" y="${f1(r.y + r.h / 2 + 3.5)}" style="font:${v('type-count')};fill:${v('ink-muted')}">${esc(text)}</text>` : ''}</g>`);
  });
  if (designish && D.lens) {
    const Z = D.lens, c = Z.counts, r = S(D.lensOut), ln = (y, t, font, ink) => `<text x="${f1(r.x + 12)}" y="${f1(y)}" style="font:${v(font)};fill:${v(ink)}">${esc(fit(t, r.w - 24, cw * 0.92))}</text>`;
    const on = !!(state.selection && state.selection.type === 'lensout');
    let g = `<g data-lensout="${esc(Z.name)}" style="cursor:pointer"><title>${esc(`Outside the ${Z.label} lens: ${c.outsideFiles} files and the ${c.outsideEdges} edges among them. ${c.crossing} edges cross into the lens, drawn with counts.`)}</title><rect x="${f1(r.x)}" y="${f1(r.y)}" width="${f1(r.w)}" height="${f1(r.h)}" rx="8" style="fill:${v('surface-group-nested')};stroke:${v(on ? 'accent' : 'ink-faint')};stroke-width:${on ? v('stroke-hub') : v('stroke-group')};stroke-dasharray:5 4"/>`;
    if (r.h >= 40) {
      g += ln(r.y + 18, `Outside ${Z.label.toLowerCase()} · ${c.outsideFiles} files`, 'type-group-label-compact', 'ink');
      g += ln(r.y + 34, `${c.outsideEdges} edges inside · ${c.crossing} crossing`, 'type-count', 'ink-faint');
      // Text keeps a fixed screen size while the box scales with zoom: draw only the role lines that fit.
      Object.entries(Z.outsideRoles).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).forEach(([role, n], i) => { const y = r.y + 52 + i * 16; if (y < r.y + r.h - 6) g += ln(y, `${role} · ${n}`, 'type-count', 'ink-muted'); });
    }
    ng.push(g + '</g>');
    map.drawn.add('lens-outside');
    map.lens = { ...c, name: Z.name, label: Z.label };
    map.lensCheck = lensSeen;
  }
  if (iso) {
    const box = S(D.sections[iso.sec]);
    Object.values(iso.ports).forEach(P => {
      const r = S(P), lab = P.kind === 'section' ? (data.elements[P.sec] ? data.elements[P.sec].label : P.sec) : P.kind === 'rest' ? `+${P.files} more files` : (nodeInfo(P.file) || {}).label || P.file;
      const tail = String(P.edges); // file count lives in the tooltip; the name gets the room
      const mark = P.kind === 'section' ? (P.open ? '−' : '+') : '';
      const cnt = `${tail}`, room = r.w - 16 - cnt.length * cw * 0.92 - (mark ? 14 : 0);
      const on = !!(selNode && (iso.portOf.in[selNode] === P.key || iso.portOf.out[selNode] === P.key));
      map.drawn.add(P.key);
      ng.push(`<g ${P.kind === 'file' ? `data-node="${esc(P.file)}"` : `data-port="${esc(P.key)}"`} style="cursor:pointer"><title>${esc(`${P.side === 'in' ? 'Input from' : 'Output to'} ${lab}: ${P.edges} edge${P.edges === 1 ? '' : 's'}${P.kind === 'section' ? ', ' + P.files + ' files. Click to ' + (P.open ? 'close' : 'list the files') : ''}`)}</title><rect x="${f1(r.x)}" y="${f1(r.y)}" width="${f1(r.w)}" height="${f1(r.h)}" rx="${P.kind === 'section' ? 9 : 4}" style="fill:${v(P.kind === 'section' ? 'surface-panel' : P.kind === 'rest' ? 'surface-group-nested' : 'surface-node')};stroke:${v(on ? 'accent' : P.kind === 'file' ? 'rule' : 'ink-faint')};stroke-width:${on ? v('stroke-hub') : v('stroke-group')};stroke-dasharray:${P.kind === 'rest' ? '4 3' : 'none'}"/>${r.h >= 12 ? `<text x="${f1(r.x + 8 + (mark ? 12 : 0))}" y="${f1(r.y + r.h / 2 + 3.5)}" style="font:${P.kind === 'section' ? v('type-group-label-compact') : v('type-node-label')};fill:${v('ink')}">${esc(fit(lab, room, P.kind === 'section' ? 6.9 : cw))}</text><text x="${f1(r.x + r.w - 8)}" y="${f1(r.y + r.h / 2 + 3.5)}" text-anchor="end" style="font:${v('type-count')};fill:${v('ink-faint')}">${cnt}</text>${mark ? `<text x="${f1(r.x + 9)}" y="${f1(r.y + r.h / 2 + 4)}" style="font:500 13px/1 ${v('font-ui')};fill:${v('ink-muted')}">${mark}</text>` : ''}` : ''}</g>`);
    });
    ['in', 'out'].forEach(side => {
      const ps = Object.values(iso.ports).filter(p => p.side === side); if (!ps.length) return;
      const r = S(ps[0]);
      lg.push(`<text x="${f1(side === 'in' ? r.x : r.x + r.w)}" y="${f1(r.y - 10)}" text-anchor="${side === 'in' ? 'start' : 'end'}" style="font:${v('type-eyebrow')};letter-spacing:${v('tracking-eyebrow')};text-transform:uppercase;fill:${v('ink-faint')}">${side === 'in' ? 'Inputs' : 'Outputs'} · ${ps.filter(p => p.kind === 'section').length}</text>`);
    });
    if (elsewhere.edges || elsewhere.files) map.drawn.add('elsewhere');
    if (elsewhere.edges || elsewhere.files)
      lg.push(`<g data-exit="isolate" style="cursor:pointer">${pill(box.x + box.w / 2, box.y - 30, `Elsewhere: ${elsewhere.files} files · ${elsewhere.edges} edges not shown`, { anchor: 'middle', stroke: v('rule'), dash: '3 3', title: 'Files and edges that do not touch this section. Click to go back to the full map.' })}</g>`);
    map.elsewhere = elsewhere;
  }

  svg.innerHTML = markerDefs(uid) + `<g data-layer="backgrounds">${bg.join('')}</g><g data-layer="set-marks" style="opacity:${decor}">${setMarks.join('')}</g><g data-layer="edges">${eg.join('')}</g><g data-layer="nodes">${ng.join('')}</g><g data-layer="labels">${lg.join('')}</g>`;
  return map;
}

function internalCount(data, sec) {
  const files = new Set(data.descendants(sec).flatMap(s => data.elements[s].members));
  return data.edges.filter(e => files.has(e.src) && files.has(e.dst)).length;
}
