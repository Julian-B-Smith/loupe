// Deterministic tests for "How it works" stories (design/prototype/story.js, ADR 0025).
// Run: node tools/story.test.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { indexSnapshot } from '../design/prototype/snapshot.js';
import { applyEdits, layoutStory, storyAccounting, storiesPath, cardHeight } from '../design/prototype/story.js';

let failed = 0;
const check = (name, cond) => { console.log(`${cond ? 'pass' : 'FAIL'}  ${name}`); if (!cond) failed++; };
const j = (p) => JSON.parse(readFileSync(p, 'utf8'));
const dir = 'schema/examples/horde-probe/';
const data = indexSnapshot({ graph: j(dir + 'graph.json'), overlay: j(dir + 'overlay.json'), view: j(dir + 'view.json'), stages: null, diff: null, hashes: {} });

check('stories path is derived from repo and commit', storiesPath(data.graph) === 'stories/horde-c64cfdbc.json');
check('the sample (commit "sample") has no stories path', storiesPath({ source: { repo: 'x/y', commit: 'sample' } }) === null);

// Every stories file: well formed, every file in its graph, every link between existing steps, every step cited.
for (const f of readdirSync('design/prototype/stories')) {
  const S = j('design/prototype/stories/' + f), ids = new Set(data.nodeIds);
  let ok = S.graph && S.graph.commit === data.graph.source.commit;
  for (const st of S.stories) {
    const sids = new Set(st.steps.map((s) => s.id));
    ok = ok && sids.size === st.steps.length && st.title && st.question;
    for (const s of st.steps) ok = ok && s.files.length > 0 && s.files.every((x) => ids.has(x)) && s.evidence.length > 0 && s.evidence.every((e) => e.path && e.line > 0);
    for (const l of st.links) ok = ok && sids.has(l.from) && sids.has(l.to) && ['audio', 'events', 'data', 'control'].includes(l.carries);
  }
  check(`${f}: steps cite evidence, files exist in the graph, links are well formed`, ok);
}

const S = j('design/prototype/stories/horde-c64cfdbc.json').stories[0];
const plain = applyEdits(S, {}), acc = storyAccounting(data, plain), c = acc.counts;
check('edges partition: among story files + crossing + outside = all', c.insideEdges + c.crossing + c.outsideEdges === data.edges.length);
check('files partition: on cards + not in story = all', c.insideFiles + c.outsideFiles === data.nodeIds.length);
check('agent steps are inferred until edited', plain.steps.every((s) => s.provenance === 'inferred' && !s.pinned));
check('same story, same layout', JSON.stringify(layoutStory(plain)) === JSON.stringify(layoutStory(applyEdits(S, {}))));
check('a story with an unknown file reports it', storyAccounting(data, { ...plain, steps: [{ id: 'z', files: ['file:nope.cpp'] }], links: [] }).unknownFiles[0] === 'file:nope.cpp');

const E = applyEdits(S, { steps: { s5: { label: 'Morph' }, s9: { pinned: true }, s8: { deleted: true } }, added: [{ id: 'u1', after: 's10', label: 'Limiter' }], pos: { s1: { dx: 10, dy: 0 } } });
const st = (id) => E.steps.find((s) => s.id === id);
check('an edited step becomes annotated; untouched steps stay inferred', st('s5').provenance === 'annotated' && st('s5').label === 'Morph' && st('s4').provenance === 'inferred');
check('pinning keeps the agent text and marks the step', st('s9').pinned && st('s9').provenance === 'inferred');
check('a deleted step and every link touching it are gone (no invented reroute)', !st('s8') && !E.links.some((l) => l.from === 's8' || l.to === 's8') && !E.links.some((l) => l.from === 's7' && l.to === 's9'));
check('an added step sits after its anchor, linked from it, annotated', E.steps.findIndex((s) => s.id === 'u1') === E.steps.findIndex((s) => s.id === 's10') + 1 && E.links.some((l) => l.from === 's10' && l.to === 'u1') && st('u1').provenance === 'annotated');
check('a drag offset moves only that step', layoutStory(E, { pos: { s1: { dx: 10, dy: 0 } } }).s1.x === layoutStory(E).s1.x + 10 && layoutStory(E, { pos: { s1: { dx: 10 } } }).s2.x === layoutStory(E).s2.x);
check('edits never mutate the agent story', S.steps.find((s) => s.id === 's5').label !== 'Morph' && S.steps.some((s) => s.id === 's8'));
// ADR 0025 audit rule: a link with no crawled edge between its steps' files states why it is claimed.
for (const story of j('design/prototype/stories/horde-c64cfdbc.json').stories) {
  const eff = applyEdits(story, {}), ac = storyAccounting(data, eff);
  const missing = eff.links.filter((l, i) => !ac.support[i] && !l.reason).map((l) => l.from + '>' + l.to);
  check(`${story.title}: every unsupported link states a reason`, missing.length === 0 || (console.log('    missing:', missing.join(' ')), false));
}
const O = applyEdits(S, { added: [{ id: 'u9', after: 'gone', label: 'Kept' }] });
check('an added step whose anchor is gone is kept, at the end, marked orphaned', O.steps[O.steps.length - 1].id === 'u9' && O.steps[O.steps.length - 1].orphan === true);
check('a card grows with its text', cardHeight({ label: 'x', does: 'y'.repeat(200), files: [] }) > cardHeight({ label: 'x', does: 'y', files: [] }));
check('a string offset from storage is treated as a number', layoutStory(plain, { pos: { s1: { dx: '10', dy: 0 } } }).s1.x === layoutStory(plain).s1.x + 10);
console.log(failed ? `${failed} failed` : 'all story cases behave');
process.exit(failed ? 1 : 0);
