// Focus lenses (ADR 0019): membership computed deterministically from seeds plus a rule, never hand-listed.
// Pure: no DOM, no clock. The renderer collapses everything outside a lens into one counted container,
// so a lens is a view, never a crawl exclusion; the graph does not change.
//
// "operational" (Julian, 2026-10-08): what is reachable from the plugin's entry points.
// - Seeds (Q-009): when the graph has build targets, what the product targets build: every MODULE or SHARED library
//   (not named like a test, probe, bench or generator) and the libraries it links, transitively. An executable or
//   utility a product depends on is built first, not shipped, so it is not followed. Without targets (a 0.2 graph such
//   as the c64cfdbc probe) seeds fall back to entry files found by NAME (*_entry.cpp/.h, *_clap.cpp); `seedSource`
//   says which, and the panel says so.
// - With the build, a compiled source (.c/.cc/.cpp/.mm...) is in focus only if a product target compiles it. One the
//   lens reaches through another edge (a GUI bridge call, a reference) but no product compiles in the crawled
//   configurations is `notBuilt`: platform-only code (hypersaw_gui_win.cpp on macOS) is classified by the build, not
//   reported as unshipped. Without targets the same-stem rule below stands in.
// - Seeds deliberately do NOT come from path roles: that made the first version self-confirming (critic, 2026-10-08:
//   upstream from role-seeds added zero files). Roles are only used afterwards, to report disagreements.
// - Only crawler edges (static, config) are followed. Agent-written overlay edges (runtime, annotated, inferred) must
//   not change what counts as operational or what is reported as a leak (0016; checks are never agent-owned).
// - `embeds` runs from the embedded file to the file it is compiled into, so it is followed backwards (the header
//   depends on what it embeds). A `generates` edge whose evidence says `as: input` (0.3.2) is followed backwards the
//   same way: the factory presets and gui2.html are compiled into the product. Its program side (`as: program`, a
//   target, or any generates edge in a graph too old to say) is build-time: the class `buildTime` holds those sources and
//   everything they reach in turn, so a generator's own imports and data are build-time too, never lab code.
// - Nothing #includes a .cpp, but the build compiles it: when a header is reached, its same-stem .cpp/.cc/.c/.mm is
//   reached too. A stand-in for build-target sources until P1.

const FORWARD = new Set(['include', 'import', 'reference', 'data', 'config', 'call', 'instantiate', 'inherit', 'audio', 'mod', 'param']);
const CRAWLED = new Set(['static', 'config']);
const NON_OPERATIONAL = new Set(['test', 'tool', 'probe', 'bench', 'scratch']);
const COMPILED = /\.(c|cc|cpp|cxx|c\+\+|m|mm)$/i; // the same list as crawler/dialect.ts
// Kept in step with crawler/dialect.ts (DSP_TARGET, the product closure); tools/lens.test.mjs compares the two on HORDE.
// These are the dsp-plugin dialect's product rules, applied to any graph: a graph with no plugin library (an app) falls
// back to name seeds, and the panel says so. A lens per dialect waits until a second dialect exists.
const PRODUCT_TYPE = /^(MODULE|SHARED)_LIBRARY$/, LINKED_TYPE = /^(STATIC|SHARED|MODULE|OBJECT|INTERFACE)_LIBRARY$/;
const NOT_PRODUCT_NAME = /(_check|_test|_tests|_smoke)$|^test_|probe$|_bench$|^measure_|^gen_/;
const by = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export const LENSES = {
  operational: { label: 'Operational', seedPattern: /(_entry\.(cpp|h|hpp)|_clap\.cpp)$/, productRoles: ['product', 'gui'] }
};

// The product targets: plugin libraries and what they link, followed through `depends` edges to libraries only.
// Crawled edges only, the same filter as computeLens: an agent edge never makes a target product.
export function productTargets(data) {
  const node = id => data.nodes[id] || {}, dep = {};
  data.edges.forEach(e => { if (e.kind === 'depends' && CRAWLED.has(e.provenance)) (dep[e.src] = dep[e.src] || []).push(e.dst); });
  const out = new Set(), work = data.nodeIds.filter(id => node(id).kind === 'target' && PRODUCT_TYPE.test(node(id).targetType || '') && !NOT_PRODUCT_NAME.test(node(id).path || ''));
  while (work.length) { const t = work.pop(); if (out.has(t)) continue; out.add(t); (dep[t] || []).forEach(d => { if (LINKED_TYPE.test(node(d).targetType || '')) work.push(d); }); }
  return out;
}

export function computeLens(data, name) {
  const def = LENSES[name];
  if (!def) return null;
  const node = id => data.nodes[id] || {};
  const push = (m, k, v) => { (m[k] = m[k] || []).push(v); };
  const dep = {}, inc = {}, btDep = {}, inputOf = {}, programOf = {}, makes = {}, builds = {}, needs = {}, anyBuilt = new Set();
  let ignored = 0;
  data.edges.forEach(e => {
    if (!CRAWLED.has(e.provenance)) { ignored++; return; }
    if (e.kind === 'embeds') push(dep, e.dst, e.src);
    else if (FORWARD.has(e.kind)) push(dep, e.src, e.dst);
    else if (e.kind === 'builds') { push(builds, e.src, e.dst); anyBuilt.add(e.dst); }
    else if (e.kind === 'depends') push(needs, e.src, e.dst);
    if (e.kind === 'include') push(inc, e.src, e.dst);
    // Build-time code is followed only through what it loads: its imports, includes and data. A path it merely names
    // (reference) or a call it makes is not part of it (critic M3: a string naming a test file made the test build-time).
    if (e.kind === 'include' || e.kind === 'import' || e.kind === 'data') push(btDep, e.src, e.dst);
    // An input is compiled into the output; a program (or a target, or a source whose side any evidence leaves open)
    // only runs at build time. Input needs EVERY piece of evidence to say so: mixed evidence takes the safe side (M4).
    if (e.kind === 'generates') {
      const ev = e.evidence || [], input = node(e.src).kind !== 'target' && ev.length > 0 && ev.every(x => x.as === 'input');
      push(input ? inputOf : programOf, e.dst, e.src); push(makes, e.src, e.dst);
    }
  });
  const products = productTargets(data), fromBuild = products.size > 0;
  const built = new Set([...products].flatMap(t => builds[t] || []));
  const impl = {};
  if (!fromBuild) data.nodeIds.forEach(id => { const m = /^(.+)\.(cpp|cc|c|mm)$/.exec(node(id).path || ''); if (m && node(id).kind === 'file') (impl[m[1]] = impl[m[1]] || []).push(id); });
  // Sorted seeds and sorted neighbours: membership and every report list are independent of input order.
  const seeds = fromBuild ? [...built].sort(by)
    : data.nodeIds.filter(id => node(id).kind === 'file' && def.seedPattern.test(node(id).path || '')).sort(by);
  // The product targets are in focus with what they build, so their builds and depends edges stay inside.
  const inside = new Set([...products, ...seeds]), notBuilt = new Set(), stack = seeds.slice();
  while (stack.length) {
    const x = stack.pop(), h = /^(.+)\.(h|hpp|hh)$/.exec(node(x).path || ''), included = new Set(inc[x] || []);
    [...(dep[x] || []), ...(inputOf[x] || []), ...(h ? impl[h[1]] || [] : [])].sort(by).forEach(y => {
      // An include overrides an earlier "not built": membership must not depend on which edge the walk met first
      // (critic round 2: adding a call edge once dropped a unity-included .cpp from the focus).
      if (inside.has(y) || (notBuilt.has(y) && !included.has(y))) return;
      // A compiled source the product reaches but does not compile stops here, unless the product #includes it (a
      // unity build compiles it inside the including file; the dialect's product-reach says the same, critic M1).
      if (fromBuild && node(y).kind === 'file' && COMPILED.test(node(y).path || '') && !built.has(y) && !included.has(y)) { notBuilt.add(y); return; }
      notBuilt.delete(y); inside.add(y); stack.push(y);
    });
  }
  // Not built here, also when nothing reaches it: a compiled source no target compiles in any crawled configuration
  // (win_only.cpp under if(WIN32), critic H1). The claim is the build's: no target lists it in these configurations.
  if (fromBuild) data.nodeIds.forEach(id => { if (node(id).kind === 'file' && COMPILED.test(node(id).path || '') && !anyBuilt.has(id) && !inside.has(id)) notBuilt.add(id); });
  // Build-time: the programs that make what is in focus, and the non-library targets the product waits on (HORDE's
  // build stamp, critic H3); then what they load, build, wait on, or are made from, outside the focus.
  const waitsOn = [...products].flatMap(t => (needs[t] || []).filter(d => !products.has(d)));
  const bt = new Set(), bq = [...[...inside].flatMap(id => programOf[id] || []), ...waitsOn].sort(by);
  while (bq.length) {
    const x = bq.pop(); if (bt.has(x) || inside.has(x)) continue;
    // `makes`: a build-time target's outputs, so the script it runs is found even when the product never includes them.
    bt.add(x); bq.push(...(btDep[x] || []), ...(builds[x] || []), ...(needs[x] || []), ...(makes[x] || []), ...(programOf[x] || []), ...(inputOf[x] || []));
  }
  const buildTime = [...bt].sort(by);
  // Findings: where path roles and the build disagree.
  const leaks = [...inside].filter(id => NON_OPERATIONAL.has(node(id).role)).sort(by);
  // A build-time file a rule calls product or gui is still reported: an embedded asset misread as a program must not
  // vanish from both the focus and the findings (critic round 2, N2).
  const unshipped = data.nodeIds.filter(id => !inside.has(id) && !notBuilt.has(id) && def.productRoles.includes(node(id).role)).sort(by);
  let insideEdges = 0, outsideEdges = 0;
  const crossing = [];
  data.edges.forEach(e => {
    const a = inside.has(e.src), b = inside.has(e.dst);
    if (a && b) insideEdges++; else if (a || b) crossing.push(e.id); else outsideEdges++;
  });
  crossing.sort(by);
  // The outside box counts by class first (build-time, not built here), then by role: build-time is its own class.
  const outsideRoles = {}, outsideClass = { buildTime: 0, notBuilt: 0 };
  data.nodeIds.forEach(id => {
    if (inside.has(id)) return;
    if (bt.has(id)) outsideClass.buildTime++; else if (notBuilt.has(id)) outsideClass.notBuilt++;
    else { const r = node(id).role || 'other'; outsideRoles[r] = (outsideRoles[r] || 0) + 1; }
  });
  return { name, label: def.label, seedSource: fromBuild ? 'build' : 'names', products: [...products].sort(by), seeds, inside, buildTime,
    notBuilt: [...notBuilt].sort(by), leaks, unshipped, crossing, outsideRoles, outsideClass, ignoredAgentEdges: ignored,
    counts: { insideFiles: inside.size, outsideFiles: data.nodeIds.length - inside.size, insideEdges, crossing: crossing.length, outsideEdges } };
}
