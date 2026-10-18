// Deterministic tests for focus lenses (design/prototype/lens.js, ADR 0019) and for the layout in every mode.
// The layout smoke test exists because a lens bug once threw inside designLayout and only a browser saw it.
// Run: node tools/lens.test.mjs
import { readFileSync } from 'node:fs';
import { indexSnapshot } from '../design/prototype/snapshot.js';
import { computeLens } from '../design/prototype/lens.js';
import { layout } from '../design/prototype/layout.js';
import { conserve } from '../design/prototype/standins.js';

let failed = 0;
const check = (name, cond) => { console.log(`${cond ? 'pass' : 'FAIL'}  ${name}`); if (!cond) failed++; };
const load = (dir) => {
  const j = (f) => { try { return JSON.parse(readFileSync(dir + f, 'utf8')); } catch { return null; } };
  return indexSnapshot({ graph: j('graph.json'), overlay: j('overlay.json'), view: j('view.json'), stages: j('stages.sample.json'), diff: j('diff.sample.json'), hashes: {} });
};

const horde = load('schema/examples/horde-probe/');
const L = computeLens(horde, 'operational'), c = L.counts, path = (id) => horde.nodes[id].path;
check('edges partition: inside + crossing + outside = all', c.insideEdges + c.crossing + c.outsideEdges === horde.edges.length);
check('files partition: inside + outside = all', c.insideFiles + c.outsideFiles === horde.nodeIds.length);
check('every seed is in focus', L.seeds.every((s) => L.inside.has(s)));
check('seeds come from entry files, not roles', L.seeds.length === 6 && L.seeds.every((s) => /_entry\.|_clap\.cpp$/.test(path(s))));
// HORDE at c64cfdbc, entry-point definition (Julian, 2026-10-08).
check('HORDE: 38 files in focus', c.insideFiles === 38);
check('HORDE: reachability adds files beyond the seeds', [...L.inside].filter((id) => id.startsWith('file:')).length > L.seeds.length);
check('HORDE: compiled-in presets are in focus (embeds followed backwards)', [...L.inside].some((id) => path(id).includes('presets/factory')));
check('HORDE: no test/tool/probe/bench file reachable from entry points', L.leaks.length === 0);
check('HORDE: 11 product-named files not shipped, incl. all h2 cores', L.unshipped.length === 11 && L.unshipped.filter((id) => path(id).startsWith('h2/cores/')).length === 5);
// Build-time is transitive (Q-009): the three generators, and what they read (gen_depends_header.py reads the tsv).
check('HORDE: build-time = the three generators and what they read', ['tools/build_stamp.cmake', 'tools/embed_file.py', 'tools/gen_depends_header.py', 'src/param_presentation.tsv'].every((p) => L.buildTime.includes('file:' + p)) && L.buildTime.every((id) => !L.inside.has(id)));
check('a graph without build targets says its seeds came from names', L.seedSource === 'names' && L.products.length === 0);
check('unknown lens is null', computeLens(horde, 'nope') === null);

// Shuffled input order must give identical membership and reports.
const shuffled = load('schema/examples/horde-probe/');
shuffled.nodeIds = shuffled.nodeIds.slice().reverse(); shuffled.edges = shuffled.edges.slice().reverse();
const S = computeLens(shuffled, 'operational');
check('input order does not change the lens', JSON.stringify([...S.inside].sort()) === JSON.stringify([...L.inside].sort())
  && JSON.stringify([S.leaks, S.unshipped, S.buildTime, S.crossing]) === JSON.stringify([L.leaks, L.unshipped, L.buildTime, L.crossing]));

// Planted edges from an entry file to a test file: a crawled edge is a leak; an agent-written one changes nothing.
const test = horde.nodeIds.find((id) => horde.nodes[id].role === 'test'), entry = L.seeds[0];
const plant = (provenance) => { const d = load('schema/examples/horde-probe/'); d.edges = d.edges.concat({ id: 'plant', src: entry, dst: test, kind: 'include', provenance, origin: provenance === 'static' ? 'graph' : 'overlay' }); return computeLens(d, 'operational'); };
check('a planted crawled entry → test include is reported as a leak', plant('static').leaks.includes(test));
const inf = plant('inferred');
check('a planted agent (inferred) edge changes neither membership nor leaks', !inf.inside.has(test) && inf.leaks.length === 0 && inf.ignoredAgentEdges === 1);

// ---- The fixture (critic H1): win_only.cpp sits under if(WIN32); nothing reaches it, and it must still be "not built
// here", never unshipped. The stamp target the plugin waits on, and the script it runs, are build-time.
{
  const F = load('design/prototype/snapshots/cmake-basic-crawl/'), K = computeLens(F, 'operational');
  check('fixture: seeds from the build; the plugin and the engine it links are the products', K.seedSource === 'build' && JSON.stringify(K.products) === '["target:engine","target:plugin"]');
  check('fixture: win_only.cpp (if(WIN32), reached by nothing) is not built here, not unshipped', K.notBuilt.includes('file:src/win_only.cpp') && !K.unshipped.includes('file:src/win_only.cpp'));
  check('fixture: the stamp utility the plugin waits on, and its CMake script, are build-time', K.buildTime.includes('target:stamp') && K.buildTime.includes('file:tools/stamp.cmake') && !K.products.includes('target:stamp'));
}
// ---- Seeds from the build (Q-009): the HORDE crawl at 1e6aae79, Release, Unix Makefiles, dsp-plugin dialect.
{
  const dir = 'design/prototype/snapshots/horde-crawl/', H = load(dir), B = computeLens(H, 'operational'), bc = B.counts;
  const P = (p) => 'file:' + p, has = (p) => B.inside.has(P(p));
  check('crawl: seeds come from the build, not from names', B.seedSource === 'build' && B.products.includes('target:HYPERSAW_clap') && B.seeds.length > 6);
  check('crawl: product targets are the plugin libraries and what they link, not the executables they wait on',
    B.products.length === 13 && !B.products.some((t) => /build-helper|build_stamp/.test(t)) && B.products.every((t) => /LIBRARY$/.test(H.nodes[t].targetType)));
  check('crawl: partitions hold', bc.insideEdges + bc.crossing + bc.outsideEdges === H.edges.length && bc.insideFiles + bc.outsideFiles === H.nodeIds.length);
  check('crawl: what a command reads is compiled in: gui2.html and the 45 factory presets are in focus',
    has('src/gui/gui2.html') && [...B.inside].filter((id) => id.includes('presets/factory/')).length === 45);
  check('crawl: what a command runs is build-time: embed_file.py, gen_depends_header.py and the auv2 build helpers',
    ['tools/embed_file.py', 'tools/gen_depends_header.py'].every((p) => B.buildTime.includes(P(p))) && B.buildTime.includes('target:HYPERSAW_auv2-build-helper') && !has('tools/embed_file.py'));
  // Probe parity (critic H3): the probe's three generators are found again, the build stamp through add_custom_target
  // and the utility target the impl waits on.
  check('crawl: the probe\'s three build-time generators are all found again, the build stamp included',
    ['tools/build_stamp.cmake', 'tools/embed_file.py', 'tools/gen_depends_header.py'].every((p) => B.buildTime.includes(P(p))) && B.buildTime.includes('target:hypersaw_build_stamp'));
  // Criterion 2: the build classifies platform code. hypersaw_gui_win.cpp is reached by a GUI bridge call, but no product
  // target compiles it in the crawled configuration, so it is not built here, never "unshipped".
  check('crawl: hypersaw_gui_win.cpp is not built in the crawled configuration, and not reported as unshipped',
    B.notBuilt.includes(P('src/gui/hypersaw_gui_win.cpp')) && !B.unshipped.includes(P('src/gui/hypersaw_gui_win.cpp')) && !has('src/gui/hypersaw_gui_win.cpp'));
  // Criterion 4: the probe's 11 product-named-but-unshipped files, re-checked against the build at 1e6aae79.
  const engines = ['station_core', 'strata_core', 'svf_core', 'swarmalator_core', 'osc_preset'].map((x) => P(`src/${x}.h`));
  // All ten share one build fact: no product target builds or reaches them. The engines are reached by test compiles
  // only (so the dialect calls them test); the h2 cores by nothing the build compiles (h2 has no product build yet).
  check('crawl: the five src/ engines are confirmed not in the product: only test compiles reach them', engines.every((id) => !B.inside.has(id) && H.nodes[id].roleRule === 'dsp-plugin:build/reached-only-by-tests'));
  const h2 = H.nodeIds.filter((id) => id.startsWith('file:h2/cores/'));
  check('crawl: the five h2/cores files are confirmed not in the product, and no rule calls them product any more',
    h2.length === 5 && h2.every((id) => !B.inside.has(id) && H.nodes[id].role !== 'product'));
  check('crawl: the one product-named file left unshipped is the legacy gui.html (embedded only with HYPERSAW_GUI2=OFF, not crawled)',
    JSON.stringify(B.unshipped) === JSON.stringify([P('src/gui/gui.html')]));
  check('crawl: no file a rule calls test, tool, probe or bench is in the product', B.leaks.length === 0);
  check('crawl: the outside box counts build-time and not-built as their own classes', B.outsideClass.buildTime === B.buildTime.length && B.outsideClass.notBuilt === B.notBuilt.length && B.notBuilt.length === 15);
  check('crawl: every not-built file is a compiled source no target in the crawl compiles, or one the product reaches', B.notBuilt.every((id) => /\.(c|cc|cpp|mm)$/.test(H.nodes[id].path)
    && (!H.edges.some((e) => e.kind === 'builds' && e.dst === id) || H.edges.some((e) => B.inside.has(e.src) && e.dst === id))));
  // The crawler's dialect and the lens use one product rule; this keeps the two copies in step.
  const ptFiles = H.nodeIds.filter((id) => H.nodes[id].roleRule === 'dsp-plugin:build/product-target');
  check('crawl: every file the dialect calls product-target is a lens seed, and every file seed is product or gui', ptFiles.length > 0 && ptFiles.every((id) => B.seeds.includes(id))
    && B.seeds.filter((id) => H.nodes[id].kind === 'file').every((id) => ['product', 'gui'].includes(H.nodes[id].role)));
  const shuffledH = load(dir); shuffledH.nodeIds = shuffledH.nodeIds.slice().reverse(); shuffledH.edges = shuffledH.edges.slice().reverse();
  const SH = computeLens(shuffledH, 'operational');
  check('crawl: input order does not change the lens', JSON.stringify([[...SH.inside].sort(), SH.buildTime, SH.notBuilt, SH.unshipped, SH.crossing]) === JSON.stringify([[...B.inside].sort(), B.buildTime, B.notBuilt, B.unshipped, B.crossing]));
  // The lens reads `as`, not names: flip gui2.html's side and it becomes build-time; drop `as` (an older graph) and every
  // generates source is treated as build-time, the conservative reading.
  const flip = (f) => { const d = load(dir); d.edges.forEach((e) => { if (e.kind === 'generates') e.evidence = e.evidence.map((x) => f(e, { ...x })); }); return computeLens(d, 'operational'); };
  const F = flip((e, x) => { if (e.src === P('src/gui/gui2.html')) x.as = 'program'; return x; });
  check('crawl: a generates source marked program is build-time, not in focus (as is what decides)', !F.inside.has(P('src/gui/gui2.html')) && F.buildTime.includes(P('src/gui/gui2.html')));
  const O = flip((e, x) => { delete x.as; return x; });
  check('crawl: without as, no generates source enters the focus', ![...O.inside].some((id) => id.includes('presets/factory/')) && !O.inside.has(P('src/gui/gui2.html')));
  // Critic plants, kept: a .cpp a product source #includes (a unity build) is in focus (M1); an edge whose evidence is
  // mixed takes the build-time side (M4); a path build-time code only names is not build-time (M3); an overlay
  // `depends` never makes a target product (L5).
  const plantH = (f) => { const d = load(dir); f(d); return computeLens(d, 'operational'); };
  const U = plantH((d) => { d.nodeIds.push('file:src/unity_part.cpp'); d.nodes['file:src/unity_part.cpp'] = { id: 'file:src/unity_part.cpp', kind: 'file', path: 'src/unity_part.cpp' };
    d.edges.push({ id: 'pu', src: P('src/hypersaw_clap.cpp'), dst: 'file:src/unity_part.cpp', kind: 'include', provenance: 'static', origin: 'graph' }); });
  check('plant: a .cpp a product source includes is in focus, not "not built"', U.inside.has('file:src/unity_part.cpp') && !U.notBuilt.includes('file:src/unity_part.cpp'));
  // Monotone (critic round 2, N1): one more crawled edge to the unity part, met first, must not drop it from the focus.
  const U2 = plantH((d) => { d.nodeIds.push('file:src/unity_part.cpp'); d.nodes['file:src/unity_part.cpp'] = { id: 'file:src/unity_part.cpp', kind: 'file', path: 'src/unity_part.cpp' };
    d.edges.push({ id: 'pu', src: P('src/hypersaw_clap.cpp'), dst: 'file:src/unity_part.cpp', kind: 'include', provenance: 'static', origin: 'graph' });
    for (const s0 of B.seeds) d.edges.push({ id: 'pc' + s0, src: s0, dst: 'file:src/unity_part.cpp', kind: 'call', provenance: 'static', origin: 'graph' }); });
  check('plant: adding call edges to a unity-included .cpp keeps it in focus (membership does not depend on walk order)', U2.inside.has('file:src/unity_part.cpp') && !U2.notBuilt.includes('file:src/unity_part.cpp'));
  // An embedded GUI asset misread as a program (N2) is build-time, but still reported as a disagreement, never hidden.
  const E2 = plantH((d) => { const e = d.edges.find((x) => x.kind === 'generates' && x.src === P('src/gui/gui2.html')); e.evidence = e.evidence.map((x) => ({ ...x, as: 'program' })); });
  check('plant: a gui file the build treats as a program is build-time and still listed as unshipped', E2.buildTime.includes(P('src/gui/gui2.html')) && E2.unshipped.includes(P('src/gui/gui2.html')));
  const M = plantH((d) => { const e = d.edges.find((x) => x.kind === 'generates' && x.src === P('tools/embed_file.py')); e.evidence = e.evidence.concat({ ...e.evidence[0], as: 'input' }); });
  check('plant: a generates edge with mixed evidence stays build-time', !M.inside.has(P('tools/embed_file.py')) && M.buildTime.includes(P('tools/embed_file.py')));
  const testFile = H.nodeIds.find((id) => H.nodes[id].role === 'test' && !B.buildTime.includes(id));
  const R = plantH((d) => d.edges.push({ id: 'pr', src: P('tools/embed_file.py'), dst: testFile, kind: 'reference', provenance: 'static', origin: 'graph' }));
  check('plant: a file build-time code only names (a reference) is not build-time', !R.buildTime.includes(testFile));
  const Q = plantH((d) => d.edges.push({ id: 'pd', src: 'target:HYPERSAW_clap', dst: 'target:hypersaw_build_stamp', kind: 'depends', provenance: 'inferred', origin: 'overlay' }));
  const lib = 'target:labs', withLib = (prov) => plantH((d) => { d.nodeIds.push(lib); d.nodes[lib] = { id: lib, kind: 'target', path: 'labs', targetType: 'STATIC_LIBRARY' };
    d.edges.push({ id: 'pd2', src: 'target:HYPERSAW_clap', dst: lib, kind: 'depends', provenance: prov, origin: prov === 'config' ? 'graph' : 'overlay' }); });
  check('plant: an agent-written depends edge never makes a library product; a crawled one does', !withLib('inferred').products.includes(lib) && withLib('config').products.includes(lib) && Q.products.length === B.products.length);
  // An agent-written edge never changes membership, with build seeds too.
  const T2 = H.nodeIds.find((id) => H.nodes[id].role === 'test');
  const d2 = load(dir); d2.edges = d2.edges.concat({ id: 'plant', src: B.seeds.find((x) => x.startsWith('file:')), dst: T2, kind: 'include', provenance: 'inferred', origin: 'overlay' });
  const A2 = computeLens(d2, 'operational');
  check('crawl: an agent (inferred) edge changes neither membership nor leaks', !A2.inside.has(T2) && A2.leaks.length === 0 && A2.ignoredAgentEdges === 1);
}

for (const [name, dir] of [['horde-probe', 'schema/examples/horde-probe/'], ['horde-sample', 'design/prototype/snapshots/horde-sample/'], ['horde-crawl', 'design/prototype/snapshots/horde-crawl/']]) {
  const d = load(dir), sec = d.sections[0];
  const modes = [{}, { lens: 'operational' }, { isolate: sec }, { isolate: sec, lens: 'operational' }, { lens: 'operational', unfolded: d.sections }, { lens: 'operational', collapsed: [sec] }, { diff: { side: 'after' }, lens: 'operational' }];
  let ok = true;
  for (const m of modes) { try { const P = layout(d, { view: 'design', settings: {}, ...m }); if (!P.bounds) ok = false; } catch (e) { ok = false; console.log('   ', name, JSON.stringify(m), e.message); } }
  check(`${name}: layout runs in every mode`, ok);
  // The outside box sits clear of every placed file and block (it once landed on the loose grid of a sectionless crawl).
  const P = layout(d, { view: 'design', settings: {}, lens: 'operational' }), o = P.lensOut;
  const hit = (r) => r && o && r.x < o.x + o.w && o.x < r.x + r.w && r.y < o.y + o.h && o.y < r.y + r.h;
  check(`${name}: the lens's outside box overlaps no file, fold or block`, !!o && !Object.values(P.nodes).some(hit) && !Object.values(P.folds || {}).some(hit) && !hit(P.loose) && !Object.values(P.sections).some(hit));
}
// A 0.3 graph (targets, builds/depends/generates, configs) through the viewer's layout: every node placed or proxied.
{
  const d = load('schema/examples/cmake-basic-0.3/'), P = layout(d, { view: 'design', settings: {} });
  const lost = d.nodeIds.filter((id) => !P.nodes[id] && !P.proxy[id]);
  check(`cmake-basic-0.3: every node, targets included, is placed (lost: ${lost.join(', ') || 'none'})`, lost.length === 0 && d.nodeIds.some((id) => id.startsWith('target:')));
  const F = layout(d, { view: 'flow', settings: {} });
  check('cmake-basic-0.3: the flow view places every node too', d.nodeIds.every((id) => F.nodes[id] || F.proxy[id]));
}
// No-overlap rule (0020, Q-010): checked by the viewer's meter, since loupe-check has no geometry.
for (const [name, dir] of [['horde-probe', 'schema/examples/horde-probe/'], ['horde-sample', 'design/prototype/snapshots/horde-sample/']]) {
  const d = load(dir), tops = d.sections.filter((s) => !d.parentOf[s]);
  const lay = (offsets) => layout(d, { view: 'design', settings: {}, offsets });
  const P0 = lay({});
  check(`${name}: the default layout has no overlapping top-level sections`, P0.overlaps.length === 0);
  const [a, b] = tops, ra = P0.sections[a] || P0.folds[a], rb = P0.sections[b] || P0.folds[b];
  const onto = lay({ [b]: { dx: ra.x - rb.x + 5, dy: ra.y - rb.y + 5 } });
  check(`${name}: a section dragged onto another is reported`, onto.overlaps.some((p) => p.includes(a) && p.includes(b)));
  const meter = (P) => conserve(d, {}, { nodes: {}, edges: {}, layout: P, settled: true }).unaccounted.filter((u) => u.startsWith('overlap:'));
  check(`${name}: the meter turns an overlap into an unaccounted entry`, meter(onto).length > 0 && meter(P0).length === 0);
  const far = lay({ [b]: { dx: 0, dy: Math.max(...Object.values(P0.sections).map((r) => r.y + r.h)) + 400 } });
  check(`${name}: a drag into empty space is no overlap`, far.overlaps.length === 0);
}
// A centered hub sits between levels, outside every section, so a dragged section can cover it (critic M3).
{
  const d = load('design/prototype/snapshots/horde-sample/'), tops = d.sections.filter((s) => !d.parentOf[s]);
  const lay = (offsets) => layout(d, { view: 'design', settings: { hubPlacement: 'center' }, offsets });
  const P0 = lay({}), hub = (d.byPrimitive.hub || []).map((id) => d.elements[id].node).find((n) => P0.nodes[n]);
  check('horde-sample: centered hubs overlap nothing by default', P0.overlaps.length === 0);
  const t = tops.find((x) => d.home[hub] == null || !d.descendants(x).includes(d.home[hub])) || tops[0];
  const r = P0.sections[t], h = P0.nodes[hub];
  const P1 = lay({ [t]: { dx: h.x - r.x + 2, dy: h.y - r.y + 2 } });
  check('horde-sample: a section dragged over a centered hub is reported', P1.overlaps.some((p) => p[0] === t && p[1] === hub));
}
// Loose nodes (Q-017): a node homed in no section is laid out in its own block, never lost; a lens keeps only its files;
// a section dragged onto the block is an overlap.
{
  const d = load('schema/examples/horde-sample/');
  const top = d.sections.filter((x) => !d.parentOf[x])[0];
  const homed = d.elements[top].members.slice(0, 2);
  d.elements[top].members = d.elements[top].members.slice(2); for (const m of homed) delete d.home[m];
  const P = layout(d, { view: 'design', settings: {} });
  check('a node homed in no section is placed, in the loose block', homed.every((m) => P.nodes[m]) && P.loose && P.loose.members.length === 2);
  const r = P.sections[top], q = P.loose;
  const P2 = layout(d, { view: 'design', settings: {}, offsets: { [top]: { dx: q.x - r.x + 4, dy: q.y - r.y + 4 } } });
  check('a section dragged onto the loose block is an overlap', P2.overlaps.some((p) => p[0] === top && /Not-in-a-section/.test(p[1])));
  // A removed file that was loose keeps its ghost in the loose block (critic, Q-017).
  const crawl = load('design/prototype/snapshots/cmake-basic-crawl/');
  crawl.diff = { removed: [{ id: 'file:src/gone.cpp', home: null }] };
  check('a removed file that was loose keeps its ghost in the loose block', !!layout(crawl, { view: 'design', settings: {}, diff: { side: 'after' } }).nodes['file:src/gone.cpp']);
  const empty = load('schema/examples/horde-probe/'); empty.view.elements = []; 
  const E = indexSnapshot({ graph: empty.graph, overlay: empty.overlay, view: { ...empty.view, elements: [] }, stages: null, diff: null, hashes: {} });
  const PE = layout(E, { view: 'design', settings: {} });
  check('an empty view (a fresh crawl): every node is placed, or folded into the loose block\'s fold row', E.nodeIds.every((id) => PE.nodes[id] || PE.foldOf[id] === 'loose'));
  check('a large loose block folds: the most connected files shown, the rest in one fold row (Julian, 2026-10-16)', !!PE.folds.loose && Object.keys(PE.nodes).length <= 60 + E.nodeIds.filter((id) => id).length && PE.folds.loose.members.length === E.nodeIds.length - Object.keys(PE.nodes).filter((id) => E.nodes[id]).length);
  const PU = layout(E, { view: 'design', settings: {}, unfolded: ['loose'] });
  check('unfolding the loose block shows every file', E.nodeIds.every((id) => PU.nodes[id]) && !PU.folds.loose);
  check('with no sections the loose block is a square-ish grid, not a tall column', PU.loose.w > PU.loose.h / 3);
  const PL = layout(E, { view: 'design', settings: {}, lens: 'operational' });
  const LZ = computeLens(E, 'operational');
  check('under a lens, the loose block holds only the lens\'s files', PL.loose.members.every((m) => LZ.inside.has(m)) && PL.loose.members.length === LZ.counts.insideFiles);
}
console.log(failed ? `${failed} failed` : 'all lens cases behave');
process.exit(failed ? 1 : 0);
