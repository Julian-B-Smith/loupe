// Loads a snapshot folder and indexes it. Pure reading: no grouping, bundling or membership decisions.
// The working graph is graph.json plus overlay.json (overlay edges and roles added on top).

async function sha256(text) {
  if (!globalThis.crypto || !crypto.subtle) return null;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return 'sha256:' + [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export function stem(path, kind) {
  if (kind === 'external') return path;
  const parts = path.split('/');
  let base = parts[parts.length - 1];
  if (base.includes('*')) base = parts[parts.length - 2] + '/' + base;
  return base.replace(/\.(cpp|cc|cxx|hpp|hh|h|c|mjs|js|ts|tsx|jsx)$/, '');
}

export async function loadSnapshot(dir) {
  if (!dir.endsWith('/')) dir += '/';
  const get = async (name, optional) => {
    const r = await fetch(dir + name);
    if (!r.ok) { if (optional) return null; throw new Error(`Could not load ${dir}${name} (${r.status})`); }
    return r.text();
  };
  const [g, o, v, s, d] = await Promise.all([get('graph.json'), get('overlay.json', true), get('view.json'), get('stages.sample.json', true), get('diff.sample.json', true)]);
  const raw = { graph: JSON.parse(g), overlay: o ? JSON.parse(o) : null, view: JSON.parse(v), stages: s ? JSON.parse(s) : null, diff: d ? JSON.parse(d) : null };
  raw.hashes = { graph: await sha256(g), overlay: o ? await sha256(o) : null };
  return indexSnapshot(raw);
}

export function indexSnapshot(raw) {
  const { graph, overlay, view } = raw;
  const nodes = {};
  graph.nodes.forEach(n => { nodes[n.id] = { ...n, label: stem(n.path, n.kind) }; });
  const roles = {};
  ((overlay && overlay.roles) || []).forEach(r => { roles[r.edge] = r.role; });
  const conds = {};
  ((overlay && overlay.conditions) || []).forEach(c => { conds[c.edge] = c; });
  const edges = graph.edges.map(e => ({ ...e, origin: 'graph' }))
    .concat(((overlay && overlay.edges) || []).map(e => ({ ...e, origin: 'overlay' })))
    .map(e => ({ ...e, role: roles[e.id] || e.role || null, condition: conds[e.id] || null }));
  const edgeById = {};
  edges.forEach(e => { edgeById[e.id] = e; });

  const elements = {}, order = [];
  view.elements.forEach(el => { elements[el.id] = el; order.push(el.id); });
  const byPrimitive = {};
  order.forEach(id => { const p = elements[id].primitive; (byPrimitive[p] = byPrimitive[p] || []).push(id); });
  const sections = byPrimitive.section || [];
  const home = {}, children = {}, parentOf = {};
  sections.forEach(id => { children[id] = []; });
  sections.forEach(id => {
    const el = elements[id];
    el.members.forEach(m => { home[m] = id; });
    if (el.parent) { parentOf[id] = el.parent; children[el.parent].push(id); }
  });
  ((raw.diff && raw.diff.removed) || []).forEach(n => { home[n.id] = home[n.id] || n.home; });
  const topOf = sec => { while (sec && parentOf[sec]) sec = parentOf[sec]; return sec; };
  const descendants = sec => [sec].concat(...children[sec].map(descendants));
  const filesIn = sec => descendants(sec).reduce((a, s) => a + elements[s].members.filter(m => nodes[m]).length, 0);

  return {
    ...raw, nodes, nodeIds: graph.nodes.map(n => n.id), edges, edgeById, elements, order, byPrimitive,
    sections, home, children, parentOf, topOf, descendants, filesIn,
    settings: view.settings || {},
    stale: !!(raw.hashes.graph && view.graph && view.graph.hash !== raw.hashes.graph) ||
      !!(raw.hashes.overlay && view.overlay && view.overlay.hash !== raw.hashes.overlay)
  };
}
