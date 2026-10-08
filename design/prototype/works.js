// renderWorks(container, data, state, story, acc, pos) draws the "How it works" view (ADR 0025) and returns an
// element map shaped like render()'s, so conserve() checks it the same way.
// Cards are HTML (editable text, wrapping); their frames and the links are SVG so line patterns stay exact.
// Provenance sets the frame's dash (same patterns as edges, Q7); what a link carries sets its colour.
import { SPEC } from './render.js';
import { CARD } from './story.js';

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const v = n => `var(--loupe-${n})`;
const f1 = n => Math.round(n * 10) / 10;
// Colour by what passes: audio and data use the edge slots of those roles/kinds; events and control stay neutral.
// events/control stay neutral inks: edge-1 is 'call' in the edge key, and a link is not a call (critic, 2026-10-08).
export const CARRIES = { audio: 'edge-3', data: 'edge-7', events: 'ink-muted', control: 'ink-faint' };
const OUT = { w: 300 };

export function renderWorks(container, data, state, story, acc, pos) {
  let layer = container.querySelector(':scope > .works');
  if (!layer) { layer = document.createElement('div'); layer.className = 'works'; container.appendChild(layer); }
  const W = container.clientWidth || 800, H = container.clientHeight || 600;
  const ps = Object.values(pos);
  const maxX = Math.max(0, ...ps.map(p => p.x + p.w)), maxY = Math.max(0, ...ps.map(p => p.y + p.h));
  const roles = Object.entries(acc.outsideRoles).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  const out = { x: maxX + 120, y: 0, w: OUT.w, h: 92 + roles.length * 20 };
  const bounds = { x: -40, y: -40, w: out.x + out.w + 80, h: Math.max(maxY, out.h) + 100 };
  const zs = state.zoom || { auto: true };
  const z = zs.auto ? (() => { const k = Math.min((W - 48) / bounds.w, (H - 120) / bounds.h, 1.1); return { k, x: (W - bounds.w * k) / 2 - bounds.x * k, y: (H - 96 - bounds.h * k) / 2 - bounds.y * k }; })() : { k: zs.k, x: zs.x, y: zs.y };

  const sel = state.selection, selStep = sel && sel.type === 'step' ? sel.id : null, selNode = sel && sel.type === 'node' ? sel.id : null;
  const map = { zoom: z, lod: 'detail', nodes: {}, edges: {}, elements: {}, layout: { works: true, folds: {} }, drawn: new Set(), settled: true };

  // ---- links (under the cards)
  const mid = (p, side) => ({ x: side === 'r' ? p.x + p.w : p.x, y: p.y + p.h / 2 });
  let svg = `<defs>${Object.entries(CARRIES).map(([k, c]) => `<marker id="wk-${k}" viewBox="0 0 9 8" refX="8.6" refY="4" markerWidth="9" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto"><path d="M0 .4L9 4L0 7.6z" style="fill:${v(c)}"/></marker>`).join('')}</defs>`;
  let pills = '';
  story.links.forEach((l, i) => {
    const A = pos[l.from], B = pos[l.to]; if (!A || !B) return;
    const sameBand = Math.abs(A.y - B.y) < CARD.h + CARD.gapY && B.x > A.x;
    const a = sameBand ? mid(A, 'r') : { x: A.x + A.w / 2, y: A.y + A.h }, b = sameBand ? mid(B, 'l') : { x: B.x + B.w / 2, y: B.y };
    const d = sameBand ? `M${f1(a.x)} ${f1(a.y)}C${f1(a.x + 48)} ${f1(a.y)} ${f1(b.x - 48)} ${f1(b.y)} ${f1(b.x)} ${f1(b.y)}`
      : `M${f1(a.x)} ${f1(a.y)}C${f1(a.x)} ${f1(a.y + 40)} ${f1(b.x)} ${f1(b.y - 40)} ${f1(b.x)} ${f1(b.y)}`;
    const supported = acc.support[i] > 0, c = CARRIES[l.carries] || 'ink-faint';
    // Never solid: a link is a claim written by the agent (inferred) or by Julian (annotated). A crawled edge between the
    // two steps' files is context for the tooltip, not proof of what the link says; solid would read as crawled (0016).
    const dash = SPEC.dash[l.provenance === 'annotated' ? 'annotated' : 'inferred'];
    svg += `<path data-link="${i}" d="${d}" style="fill:none;stroke:${v(c)};stroke-width:${v('stroke-edge-emph')};stroke-dasharray:${dash}" marker-end="url(#wk-${l.carries in CARRIES ? l.carries : 'control'})"><title>${esc(`${l.carries}${l.label ? ': ' + l.label : ''} · ${l.provenance === 'annotated' ? 'yours' : 'agent'} · ${supported ? acc.support[i] + ' crawled edge' + (acc.support[i] > 1 ? 's' : '') + ' between these steps\' files (context, not proof)' : 'no crawled edge between these steps\' files'}${l.reason ? ' · ' + l.reason : ''}`)}</title></path>`;
    if (l.label) { const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; pills += `<div class="wk-pill" style="left:${f1(m.x)}px;top:${f1(m.y)}px;border-color:${v(c)}">${esc(l.label)}</div>`; }
  });

  // ---- cards
  let cards = '';
  story.steps.forEach(s => {
    const p = pos[s.id], key = story.id + ':' + s.id, on = selStep === key;
    // The dash always says who wrote it; pinned is shown by colour only, so a pinned agent step still reads as inferred.
    const dash = SPEC.dash[s.provenance] || SPEC.dash.inferred, gap = !s.files.length;
    svg += `<rect x="${f1(p.x)}" y="${f1(p.y)}" width="${p.w}" height="${p.h}" rx="10" style="fill:${v(gap ? 'surface-group-nested' : 'surface-node')};stroke:${v(on ? 'accent' : s.pinned ? 'state-ok' : gap ? 'state-warn' : 'ink-faint')};stroke-width:${on || s.pinned ? 2 : 1.25}px;stroke-dasharray:${dash}"/>`;
    const files = s.files.map(f => {
      const known = !!data.nodes[f]; if (known) map.nodes[f] = { state: 'drawn' };
      const lab = known ? (data.nodes[f].path || f).split('/').pop() : f;
      return `<button class="wk-file${selNode === f ? ' on' : ''}${known ? '' : ' unknown'}" data-node="${esc(f)}" title="${esc(known ? data.nodes[f].path : f + ' (not in the graph)')}">${esc(lab)}</button>`;
    }).join('');
    const tag = [s.pinned ? 'pinned' : s.provenance, !s.files.length ? 'gap' : '', s.orphan ? 'orphaned' : ''].filter(Boolean).join(' · ');
    cards += `<div class="wk-card${on ? ' on' : ''}" data-step="${esc(key)}" style="left:${p.x}px;top:${p.y}px;width:${p.w}px;height:${p.h}px">
      <div class="wk-head"><span class="wk-concept">${esc(s.concept)}</span><span class="wk-tag wk-${s.pinned ? 'pinned' : esc(s.provenance)}">${esc(tag)}${s.evidence && s.evidence.length ? ' · ' + s.evidence.length + ' cited' : ''}</span></div>
      <div class="wk-label">${esc(s.label)}</div><div class="wk-does">${esc(s.does)}</div><div class="wk-files">${files}</div></div>`;
  });

  // ---- not in this story: every other file, and the edges that touch them, counted here
  const c = acc.counts, onOut = sel && sel.type === 'storyout';
  svg += `<rect x="${out.x}" y="${out.y}" width="${out.w}" height="${out.h}" rx="10" style="fill:${v('surface-group-nested')};stroke:${v(onOut ? 'accent' : 'ink-faint')};stroke-width:${onOut ? 2 : 1}px;stroke-dasharray:5 4"/>`;
  cards += `<div class="wk-out" data-storyout="1" style="left:${out.x}px;top:${out.y}px;width:${out.w}px;height:${out.h}px" title="Files this story does not use. Click to list them and every edge crossing into the story.">
    <div class="wk-label">Not in this story · ${c.outsideFiles} files</div>
    <div class="wk-does">${c.outsideEdges} edges among them · ${c.crossing} crossing into the story</div>
    ${roles.map(([r, n]) => `<div class="wk-role"><span>${esc(r)}</span><span>${n}</span></div>`).join('')}</div>`;
  map.drawn.add('story-outside');

  // ---- accounting for conserve(): nodes on cards are drawn, the rest stand behind the box; edges are folded into counts
  data.nodeIds.forEach(id => { if (!map.nodes[id]) map.nodes[id] = { state: 'outside', proxy: 'story-outside' }; });
  const seen = { in: 0, cross: 0, out: 0 }, onCard = id => map.nodes[id] && map.nodes[id].state === 'drawn';
  data.edges.forEach(e => {
    const a = onCard(e.src), b = onCard(e.dst), k = a && b ? 'in' : a || b ? 'cross' : 'out';
    seen[k]++; map.edges[e.id] = { via: 'folded', bundle: 'story-' + k };
  });
  map.lens = { ...c, name: 'story', label: 'Story' };
  map.lensCheck = seen;      // computed from what was drawn, compared by conserve() with storyAccounting's partition
  layer.innerHTML = `<div class="wk-world" style="transform:translate(${f1(z.x)}px,${f1(z.y)}px) scale(${z.k})"><svg class="wk-svg" width="${bounds.x + bounds.w}" height="${bounds.y + bounds.h}">${svg}</svg>${cards}${pills}</div>`;
  // Cards whose content is taller than laid out: the caller re-lays out once with these heights, so no text or file
  // chip is clipped while counted as drawn. Measured in unscaled px (scrollHeight ignores the CSS transform).
  const measured = {};
  layer.querySelectorAll('.wk-card').forEach(el => { const id = el.dataset.step.slice(el.dataset.step.lastIndexOf(':') + 1); if (el.scrollHeight > el.clientHeight + 1) measured[id] = el.scrollHeight + 2; });
  map.works = { story: story.id, out, cards: pos, measured };
  return map;
}
