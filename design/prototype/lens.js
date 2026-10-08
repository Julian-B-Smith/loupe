// Focus lenses (ADR 0019): membership computed deterministically from seeds plus a rule, never hand-listed.
// Pure: no DOM, no clock. The renderer collapses everything outside a lens into one counted container,
// so a lens is a view, never a crawl exclusion; the graph does not change.
//
// "operational" (Julian, 2026-10-08): what is reachable from the plugin's entry points.
// - Seeds are entry files, found by NAME in this prototype (*_entry.cpp/.h, *_clap.cpp). P1 replaces this with the
//   product build target's sources (compile_commands.json), which also sees platform conditions.
// - Seeds deliberately do NOT come from path roles: that made the first version self-confirming (critic, 2026-10-08:
//   upstream from role-seeds added zero files). Roles are only used afterwards, to report disagreements.
// - Only crawler edges (static, config) are followed. Agent-written overlay edges (runtime, annotated, inferred) must
//   not change what counts as operational or what is reported as a leak (0016; checks are never agent-owned).
// - `embeds` runs from the embedded file to the file it is compiled into, so it is followed backwards (the header
//   depends on what it embeds). `generates` is never followed; its sources are reported as build-time code.
// - Nothing #includes a .cpp, but the build compiles it: when a header is reached, its same-stem .cpp/.cc/.c/.mm is
//   reached too. A stand-in for build-target sources until P1.

const FORWARD = new Set(['include', 'import', 'reference', 'data', 'config', 'call', 'instantiate', 'inherit', 'audio', 'mod', 'param']);
const CRAWLED = new Set(['static', 'config']);
const NON_OPERATIONAL = new Set(['test', 'tool', 'probe', 'bench', 'scratch']);
const by = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export const LENSES = {
  operational: { label: 'Operational', seedPattern: /(_entry\.(cpp|h|hpp)|_clap\.cpp)$/, productRoles: ['product', 'gui'] }
};

export function computeLens(data, name) {
  const def = LENSES[name];
  if (!def) return null;
  const node = id => data.nodes[id] || {};
  const dep = {}, genInto = {};
  let ignored = 0;
  data.edges.forEach(e => {
    if (!CRAWLED.has(e.provenance)) { ignored++; return; }
    if (e.kind === 'embeds') (dep[e.dst] = dep[e.dst] || []).push(e.src);
    else if (FORWARD.has(e.kind)) (dep[e.src] = dep[e.src] || []).push(e.dst);
    if (e.kind === 'generates') (genInto[e.dst] = genInto[e.dst] || []).push(e.src);
  });
  const impl = {};
  data.nodeIds.forEach(id => { const m = /^(.+)\.(cpp|cc|c|mm)$/.exec(node(id).path || ''); if (m && node(id).kind === 'file') (impl[m[1]] = impl[m[1]] || []).push(id); });
  // Sorted seeds and sorted neighbours: membership and every report list are independent of input order.
  const seeds = data.nodeIds.filter(id => node(id).kind === 'file' && def.seedPattern.test(node(id).path || '')).sort(by);
  const inside = new Set(seeds), stack = seeds.slice();
  while (stack.length) {
    const x = stack.pop(), h = /^(.+)\.(h|hpp|hh)$/.exec(node(x).path || '');
    [...(dep[x] || []), ...(h ? impl[h[1]] || [] : [])].sort(by).forEach(y => { if (!inside.has(y)) { inside.add(y); stack.push(y); } });
  }
  const buildTime = [...new Set([...inside].flatMap(id => genInto[id] || []))].filter(id => !inside.has(id)).sort(by);
  // Findings: where path roles and entry-point reachability disagree.
  const leaks = [...inside].filter(id => NON_OPERATIONAL.has(node(id).role)).sort(by);
  const unshipped = data.nodeIds.filter(id => !inside.has(id) && def.productRoles.includes(node(id).role)).sort(by);
  let insideEdges = 0, outsideEdges = 0;
  const crossing = [];
  data.edges.forEach(e => {
    const a = inside.has(e.src), b = inside.has(e.dst);
    if (a && b) insideEdges++; else if (a || b) crossing.push(e.id); else outsideEdges++;
  });
  crossing.sort(by);
  const outsideRoles = {};
  data.nodeIds.forEach(id => { if (!inside.has(id)) { const r = node(id).role || 'other'; outsideRoles[r] = (outsideRoles[r] || 0) + 1; } });
  return { name, label: def.label, seeds, inside, buildTime, leaks, unshipped, crossing, outsideRoles, ignoredAgentEdges: ignored,
    counts: { insideFiles: inside.size, outsideFiles: data.nodeIds.length - inside.size, insideEdges, crossing: crossing.length, outsideEdges } };
}
