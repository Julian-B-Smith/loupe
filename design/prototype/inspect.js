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
