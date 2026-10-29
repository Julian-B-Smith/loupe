// What an element that stands for more than one edge holds (ADR 0029, Q-011). Pure: no DOM.
// The rule: a `×N` bundle opens to the exact edges the conservation meter attributes to it. Both read one record,
// map.edges[id] = { via: 'folded', bundle: key }, which render() writes as it folds; so the panel cannot list an edge
// the meter does not count there, or miss one it does. tools/render.test.mjs holds the drawn `×N` to the same list.

// The member edges of a bundle, in a stable order (source, then target, then id).
export function bundleEdges(data, map, key) {
  const by = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  return data.edges.filter((e) => { const m = map && map.edges[e.id]; return m && m.via === 'folded' && m.bundle === key; })
    .sort((a, b) => by(a.src, b.src) || by(a.dst, b.dst) || by(a.id, b.id));
}

// The two ends of a bundle key ('s:<section>>f:<fold>', 'p:<port>>n:<node>', ...) in words, for the panel heading.
// `o:` is two different boxes: the lens's outside box and the overview's loose block (critic M3), named whole.
const KIND = { s: 'section', f: 'folded files', p: 'port', n: 'file' }, WHOLE = { 'o:lens': 'outside the lens', 'o:loose': 'files in no section' };
export function bundleEnds(key) {
  const i = key.indexOf('>', 2);
  const side = (k) => (WHOLE[k] ? { kind: WHOLE[k], id: null } : { kind: KIND[k[0]] || k[0], id: k.slice(2), port: k[0] === 'p' });
  return i < 0 ? [side(key)] : [side(key.slice(0, i)), side(key.slice(i + 1))];
}

// Q-028: what any element that stands for several edges holds: the edges whose recorded ends name it (render() writes
// `ends` on every routed edge). Keys: 'f:<section>' a fold row, 'p:<port>' an isolate port, 's:<section>' a section
// box (collapsed or proxied), 'o:loose' the overview's loose block, 'elsewhere' the isolate view's elsewhere chip.
// Q-034: 't:<box>' a box's ↑out ↓in tab holds the folded edges with that box at an end (exactly what it counts: not the
// box's drawn or collapsed ones); 'c:<end>' a collector bar holds the edges whose lines end on it.
// Q-033: 'm:<bus>|<section>|<provenance>|<side>' a merged bus tap holds the bus edges render() marked with that tap.
export function heldEdges(data, map, key) {
  const by = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  const tab = key.startsWith('t:') ? key.slice(2) : null, bar = key.startsWith('c:') ? key.slice(2) : null, tap = key.startsWith('m:');
  const holds = (m) => (tab ? m.via === 'folded' && m.bundle !== 'elsewhere' && m.ends.includes(tab) : bar ? m.collector === bar : tap ? m.tap === key : m.ends.includes(key));
  return data.edges.filter((e) => { const m = map && map.edges[e.id]; return m && m.ends && holds(m); })
    .sort((a, b) => by(a.src, b.src) || by(a.dst, b.dst) || by(a.id, b.id));
}

// Q-035: the re-run diff on what stands for files. diffKindOf is the one place a file's diff kind is decided for a frame
// (render.js marks files from it): 'added' (or 'ghost-added' on the before side, an outline not yet in that run),
// 'changed', 'stale' (after side only) and 'removed' (after side only; on the before side a removed file is ordinary).
export const DIFF_KINDS = ['added', 'changed', 'stale', 'removed'];
export function diffKindOf(data, state) {
  const df = state.diff && data.diff ? data.diff : null, side = df && state.diff.side, out = {};
  if (!df) return out;
  (df.added || []).forEach((id) => { out[id] = side === 'before' ? 'ghost-added' : 'added'; });
  (df.changed || []).forEach((id) => { out[id] = 'changed'; });
  if (side !== 'before') (df.stale || []).forEach((id) => { out[id] = 'stale'; });
  (df.removed || []).forEach((n) => { out[n.id] = side === 'before' ? null : 'removed'; });
  return out;
}
// The files a stand-in holds (render() records each undrawn file's stand-in as map.nodes[id].proxy: a section id, a
// 'fold:<key>' row, 'loose', 'lens-outside', an isolate port), grouped by diff kind, each list sorted. A tally says
// these counts and its click lists these files, so the two cannot disagree; `files` is everything the stand-in holds.
export function diffHeld(data, map, state, proxy) {
  const kind = diffKindOf(data, state), out = { files: 0 };
  DIFF_KINDS.forEach((k) => { out[k] = []; });
  Object.entries(map.nodes).forEach(([id, m]) => {
    if (!m || m.proxy !== proxy || m.state === 'drawn' || m.state === 'ghost') return;
    out.files++;
    const k = kind[id] === 'ghost-added' ? 'added' : kind[id];
    if (k) out[k].push(id);
  });
  DIFF_KINDS.forEach((k) => out[k].sort());
  return out;
}
// The run's totals for the meter line: every kind the diff lists, whichever side is shown.
export function diffSummary(data) {
  const df = data.diff; if (!df) return null;
  const n = { added: (df.added || []).length, changed: (df.changed || []).length, stale: (df.stale || []).length, removed: (df.removed || []).length };
  return { ...n, text: `re-run +${n.added} ~${n.changed} ⧗${n.stale} −${n.removed}` };
}
