// Deterministic tests for focus lenses (design/prototype/lens.js, ADR 0019) and for the layout in every mode.
// The layout smoke test exists because a lens bug once threw inside designLayout and only a browser saw it.
// Run: node tools/lens.test.mjs
import { readFileSync } from 'node:fs';
import { indexSnapshot } from '../design/prototype/snapshot.js';
import { computeLens } from '../design/prototype/lens.js';
import { layout } from '../design/prototype/layout.js';

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
check('HORDE: 3 build-time generators found', L.buildTime.length === 3);
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

for (const [name, dir] of [['horde-probe', 'schema/examples/horde-probe/'], ['horde-sample', 'design/prototype/snapshots/horde-sample/']]) {
  const d = load(dir), sec = d.sections[0];
  const modes = [{}, { lens: 'operational' }, { isolate: sec }, { isolate: sec, lens: 'operational' }, { lens: 'operational', unfolded: d.sections }, { lens: 'operational', collapsed: [sec] }, { diff: { side: 'after' }, lens: 'operational' }];
  let ok = true;
  for (const m of modes) { try { const P = layout(d, { view: 'design', settings: {}, ...m }); if (!P.bounds) ok = false; } catch (e) { ok = false; console.log('   ', name, JSON.stringify(m), e.message); } }
  check(`${name}: layout runs in every mode`, ok);
}
console.log(failed ? `${failed} failed` : 'all lens cases behave');
process.exit(failed ? 1 : 0);
