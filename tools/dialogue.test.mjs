// The HORDE dialogue test (ROADMAP Q-044): the agent-written snapshot keeps the crawl's graph byte for byte and balances
// the meter at every level of detail (criterion 1); an answer applied as Q-044 says passes loupe-check and the dialogue
// check (criterion 4); and the dialogue check fails each plant of criterion 5, plus the bypasses the critic found
// (2026-11-11). Run: node tools/dialogue.test.mjs
import { readFileSync, writeFileSync, mkdtempSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkDialogue, loadDialogueSnapshot, baselineOf, JULIAN, ASKER } from './dialogue-check.mjs';
import { check as loupeCheck } from './loupe-check.mjs';
import { canonicalDoc, sha256, edgeId } from './canon.mjs';

const svg = { setAttribute() {}, getAttribute: () => 'l1', style: {}, innerHTML: '' };
globalThis.document = { createElement: () => ({ getContext: () => ({ font: '', measureText: () => ({ width: 27 * 7.2 }) }) }), createElementNS: () => svg, fonts: null };
const container = { querySelector: () => svg, appendChild() {}, clientWidth: 1440, clientHeight: 900 };
const { indexSnapshot, dialogueStages } = await import('../design/prototype/snapshot.js');
const { render } = await import('../design/prototype/render.js');
const { conserve } = await import('../design/prototype/standins.js');

let failed = 0;
const check = (name, cond) => { console.log(`${cond ? 'pass' : 'FAIL'}  ${name}`); if (!cond) failed++; };
const DIR = 'design/prototype/snapshots/horde-structure/';
const SCHEMA = join(dirname(fileURLToPath(import.meta.url)), '..', 'schema');
const clone = (x) => structuredClone(x);
const base = loadDialogueSnapshot(DIR);

check('horde-structure: graph.json is byte-identical to horde-crawl\'s',
  readFileSync(DIR + 'graph.json').equals(readFileSync('design/prototype/snapshots/horde-crawl/graph.json')));
check('horde-structure: every node has a home section', (() => {
  const homed = new Set(base.view.elements.filter((e) => e.primitive === 'section').flatMap((e) => e.members));
  return base.graph.nodes.every((n) => homed.has(n.id));
})());
check('horde-structure: every element is the agent\'s and proposed',
  base.view.elements.every((e) => e.by === ASKER && e.status === 'proposed'));
// The baseline is pinned here, answered or not: it lives in the file answers are written to, so recomputing it after an
// answer would launder any change (critic R1). Re-baselining (a new round of questions) is this deliberate edit.
const BASELINE = 'sha256:64d484c82224187b6e3282dd4577acd4203f4fbf928d7859ea32c56899738fb8';
check('horde-structure: the baseline is the one pinned when brief loupe-005 was asked', sha256(canonicalDoc(base.dialogue.baseline)) === BASELINE);
if (base.dialogue.questions.every((q) => q.answer === null))
  check('horde-structure: nothing answered yet, so the baseline is the overlay and view as committed',
    canonicalDoc(base.dialogue.baseline) === canonicalDoc(baselineOf(base.overlay, base.view, base.dialogue.questions)));

const ZOOMS = [{ auto: true }, { k: 1, x: 0, y: 0 }, { k: 0.5, x: 0, y: 0 }, { k: 0.2, x: 0, y: 0 }];
const meter = (snap) => {
  const data = indexSnapshot({ graph: snap.graph, overlay: snap.overlay, view: snap.view, stages: { dialogue: dialogueStages(snap.dialogue) }, diff: null, hashes: {} });
  const bad = [];
  for (const zoom of ZOOMS) for (const lens of [null, 'operational']) for (const stage of [2, 3]) {
    const state = { view: 'design', stage, settings: {}, zoom, ...(lens ? { lens } : {}) };
    try { const c = conserve(data, state, render(container, data, state)); if (c.status === 'broken') bad.push(`${JSON.stringify(zoom)} ${lens || ''} stage ${stage}: ${c.unaccounted.slice(0, 2).join(', ')}`); }
    catch (e) { bad.push(`${JSON.stringify(zoom)} ${lens || ''} stage ${stage}: threw ${e.message}`); }
  }
  return bad;
};
const m0 = meter(base);
check(`horde-structure: renders and balances at every level of detail, lens on and off, stages 2 and 3${m0.length ? ' — ' + m0.join(' | ') : ''}`, m0.length === 0);
const e0 = checkDialogue(base);
check(`horde-structure: the dialogue check passes${e0.length ? ' — ' + e0.join(' | ') : ''}`, e0.length === 0);

// An answer from HORDE's session, applied as Q-044 says: an inferred edge naming that session, written canonically with
// the view rebound to the new overlay, so loupe-check judges it as it would a committed answer (critic M3).
const HORDE = 'agent:HYPERSAW (loupe-005)';
const SRC = 'file:h2/cores/scalpel/razor_core.h', DST = 'file:reference/scalpel/prototype/razor-core.js';
const ID = edgeId(SRC, DST, 'reference');
const rebind = (s) => { s.view.overlay = { hash: sha256(canonicalDoc(s.overlay)) }; return s; };
const answered = (prov, confirmation = null) => {
  const s = clone(base), q = s.dialogue.questions.find((x) => x.id === 'q3');
  const edge = { id: ID, src: SRC, dst: DST, kind: 'reference', provenance: prov,
    evidence: [{ type: 'inference', agent: HORDE, rationale: 'HORDE\'s answer to loupe-005 q3: the port of this prototype.' }] };
  if (prov === 'annotated') edge.evidence.push({ type: 'annotation', author: JULIAN, note: 'Confirmed in chat.', dialogue: 'q3' });
  s.overlay.edges.push(edge);
  Object.assign(q, { answer: 'Pairs you list', answeredBy: HORDE, confirmation, applied: { edges: [ID], elements: [], roles: [] } });
  // The view's overlay binding changes with the overlay; that is the answer's own change, not a view element.
  return rebind(s);
};
const onDisk = (s) => {
  const dir = mkdtempSync(join(tmpdir(), 'loupe-dialogue-'));
  try {
    copyFileSync(DIR + 'graph.json', join(dir, 'graph.json'));
    writeFileSync(join(dir, 'overlay.json'), canonicalDoc(s.overlay));
    writeFileSync(join(dir, 'view.json'), canonicalDoc(s.view));
    return loupeCheck(dir, { schemaDir: SCHEMA });
  } finally { rmSync(dir, { recursive: true }); }
};
const ok1 = answered('inferred');
const lc1 = onDisk(ok1);
check(`an answer from HORDE applied as inferred passes loupe-check with schema validation${lc1.errors.length ? ' — ' + lc1.errors.join(' | ') : ''}`,
  lc1.errors.length === 0 && !lc1.notes.some((n) => n.includes('skipped')));
check('… and the dialogue check', checkDialogue(ok1).length === 0);
const m1 = meter(ok1);
check(`… and keeps the meter balanced${m1.length ? ' — ' + m1.join(' | ') : ''}`, m1.length === 0);
const CONFIRM = { by: JULIAN, date: '2026-11-11', quote: 'yes, razor-core.js is the original' };
const ok2 = answered('annotated', CONFIRM);
check('the same answer, confirmed by Julian and annotated, passes loupe-check and the dialogue check',
  onDisk(ok2).errors.length === 0 && checkDialogue(ok2).length === 0);
const st = dialogueStages(ok1.dialogue).find((q) => q.id === 'q3');
check('the stage 3 stand-in keeps who answered, its effect, and that Julian has not confirmed',
  st.answeredBy === HORDE && st.effect.startsWith('Loupe adds one inferred edge') && st.confirmed === false);
check('the stage 3 stand-in shows Julian\'s own answer, with its confirmation recorded, as confirmed',
  dialogueStages({ questions: [{ ...ok1.dialogue.questions[0], answer: 'Still true', answeredBy: JULIAN, confirmation: CONFIRM }] })[0].confirmed === true);

// Plants: each must fail, and fail for the reason named.
const plant = (name, s, expect) => {
  const errs = checkDialogue(s);
  check(`plant caught: ${name}${errs.some((e) => e.includes(expect)) ? '' : ' — got: ' + (errs.join(' | ') || 'no error')}`, errs.some((e) => e.includes(expect)));
};
{ const s = clone(base); s.dialogue.questions[0].nodes.push('file:h2/no_such_file.h');
  plant('a question naming a node not in the graph', s, 'is not in the graph'); }
plant('an answer from HORDE entered as annotated without Julian\'s confirmation', answered('annotated'), 'Julian has not confirmed');
// Criterion 5's third plant, without the strawman (critic H1): an overlay edge that was there when the questions were
// asked is deleted and nothing lists it. The meter balances on what is left, so only the baseline can see the loss.
{ const s = clone(ok1); s.dialogue.baseline = baselineOf(s.overlay, s.view, s.dialogue.questions);
  s.overlay.edges = s.overlay.edges.filter((e) => e.id !== ID); s.dialogue.questions.forEach((q) => { q.applied = { edges: [], elements: [], roles: [] }; });
  rebind(s);
  check('the meter alone balances after that edge is deleted (why the baseline is needed)', meter(s).length === 0);
  plant('an answer that drops an edge present when the questions were asked', s, 'is gone'); }
{ const s = answered('inferred'); s.overlay.edges.at(-1).evidence[0].agent = ASKER;
  plant('an inferred edge that does not name HORDE\'s session as its source', s, 'does not name'); }
// Critic H2: an annotated edge that cites no question, and a view change on no one's word.
{ const s = clone(base);
  s.overlay.edges.push({ id: ID, src: SRC, dst: DST, kind: 'reference', provenance: 'annotated', evidence: [{ type: 'annotation', author: JULIAN, note: 'x' }] });
  plant('an annotated edge that no answered question applied', rebind(s), 'no answered question lists it'); }
{ const s = clone(base), el = s.view.elements.find((e) => e.id === 'sec:swarmfx'); el.parent = 'sec:horde2'; el.status = 'confirmed';
  plant('a section moved and confirmed with no answer behind it', s, 'no answered question lists it'); }
// Critic M4: the element's author, a self-answer, a confirmation without an answer, an unlisted role.
{ const s = clone(base), q = s.dialogue.questions.find((x) => x.id === 'q2'), el = s.view.elements.find((e) => e.id === 'sec:swarmfx');
  el.parent = 'sec:horde2'; Object.assign(q, { answer: 'Live, or moving to horde 2', answeredBy: HORDE, applied: { edges: [], elements: ['sec:swarmfx'], roles: [] } });
  plant('a section moved by HORDE\'s answer but still signed by the asking agent', s, `not by ${HORDE}`);
  el.by = HORDE; check('… and passes once it names HORDE\'s session', checkDialogue(s).length === 0); }
{ const s = clone(base); Object.assign(s.dialogue.questions[0], { answer: 'Still true', answeredBy: ASKER });
  plant('the asking agent answering its own question', s, 'the agent that asked it'); }
{ const s = clone(base); s.dialogue.questions[0].confirmation = CONFIRM;
  plant('a confirmation on an unanswered question', s, 'confirmed, but not answered'); }
{ const s = clone(base); s.overlay.roles.push({ edge: base.graph.edges[0].id, role: 'product' });
  plant('an overlay role no answer applied', rebind(s), 'no answered question lists it'); }
// Critic's confirming pass: R1 laundering, R2 Julian's word unrecorded, and the LOW holes.
{ const s = clone(base);
  s.overlay.edges.push({ id: ID, src: SRC, dst: DST, kind: 'reference', provenance: 'annotated', evidence: [{ type: 'annotation', author: JULIAN, note: 'x' }] });
  rebind(s); s.dialogue.baseline = baselineOf(s.overlay, s.view, s.dialogue.questions);
  check('plant caught: re-baselining after a change (the pinned digest no longer matches)', sha256(canonicalDoc(s.dialogue.baseline)) !== BASELINE); }
{ const s = answered('annotated'); s.dialogue.questions.find((x) => x.id === 'q3').answeredBy = JULIAN;
  plant('an answer recorded as Julian\'s with no confirmation in his words', s, 'needs its confirmation recorded'); }
{ const s = clone(base); s.dialogue.questions.pop();
  plant('an asked question deleted', s, 'is gone'); }
{ const s = answered('inferred'); s.dialogue.questions.find((x) => x.id === 'q3').question += ' (reworded)';
  plant('a question reworded after it was answered', s, 'not as it was asked'); }
{ const s = clone(base), q = s.dialogue.questions.find((x) => x.id === 'q2');
  s.view.elements = s.view.elements.filter((e) => e.id !== 'sec:fx-shared');
  s.view.elements.find((e) => e.id === 'sec:legacy').members.push('file:src/notch_core.h', 'file:src/time_core.h');
  s.view.elements.find((e) => e.id === 'sec:legacy').by = HORDE;
  Object.assign(q, { answer: 'Live, or moving to horde 2', answeredBy: HORDE, applied: { edges: [], elements: ['sec:fx-shared', 'sec:legacy'], roles: [] } });
  plant('a section removed on HORDE\'s unconfirmed answer', s, 'is removed, but Julian has not confirmed'); }
{ const s = clone(base); s.view.settings.hubPlacement = 'center';
  plant('the view\'s settings changed by no answer', s, 'settings or exemptions'); }
{ const s = clone(base); s.overlay.conditions.push({ edge: base.graph.edges[0].id, expr: 'x' });
  plant('an overlay condition no answer applied', rebind(s), 'no answered question lists it'); }
{ const s = answered('annotated', CONFIRM); s.dialogue.baseline = baselineOf(s.overlay, s.view, s.dialogue.questions);
  const q = s.dialogue.questions.find((x) => x.id === 'q4'), e = s.overlay.edges.find((x) => x.id === ID);
  e.provenance = 'inferred'; e.evidence = [{ type: 'inference', agent: HORDE, rationale: 'second round' }];
  Object.assign(q, { answer: 'As drawn', answeredBy: HORDE, applied: { edges: [ID], elements: [], roles: [] } });
  plant('a later unconfirmed answer overwriting an edge Julian annotated', rebind(s), 'was annotated by Julian'); }
plant('a snapshot missing the dialogue\'s fields reports, not throws', { ...clone(base), dialogue: { graph: base.dialogue.graph } }, 'malformed');

console.log(failed ? `\n${failed} FAILED` : '\nall dialogue checks passed');
process.exit(failed ? 1 : 0);
