// The HORDE dialogue test (ROADMAP Q-044). horde-structure is the Structure pass on HORDE's 8c9521db crawl with
// HORDE's answers to brief loupe-005 applied (response-005) and Julian's choice for q4 recorded. This checks that
// the snapshot is that crawl, byte for byte (criterion 1, as Julian amended it 2026-11-12); that it passes
// loupe-check, the dialogue check and the meter as answered (criterion 4); and that the dialogue check fails each plant
// of criterion 5, plus the bypasses the critic found (2026-11-11). Run: node tools/dialogue.test.mjs
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
const gate = JSON.parse(readFileSync(DIR + 'gate.json', 'utf8'));
const HORDE = 'agent:HYPERSAW (response-005)';
const q = (s, id) => s.dialogue.questions.find((x) => x.id === id);
const el = (s, id) => s.view.elements.find((e) => e.id === id);
const rebind = (s) => { s.view.overlay = { hash: sha256(canonicalDoc(s.overlay)) }; return s; };

// ---- criterion 1: the crawl it stands on
check('horde-structure: graph.json is the gate run\'s graph at the commit q1 named',
  sha256(readFileSync(DIR + 'graph.json', 'utf8')) === gate.graph.hash && gate.commit === base.dialogue.commit
  && base.graph.source.commit === gate.commit);
check('horde-structure: its gate report is kept beside it and says which P1a gates fail (horde-crawl keeps the gated crawl)',
  gate.pass === false && Object.entries(gate.gates).filter(([, v]) => !v.pass).map(([k]) => k).sort().join() === 'probeParity,unknownMissing');
check('horde-structure: every node has a home section', (() => {
  const homed = new Set(base.view.elements.filter((e) => e.primitive === 'section').flatMap((e) => e.members));
  return base.graph.nodes.every((n) => homed.has(n.id));
})());
// The baseline is pinned here: it lives in the file answers are written to, so recomputing it after an answer would
// launder any change (critic R1). A new round of questions re-pins it, deliberately, in this line.
const BASELINE = 'sha256:889afa317f227ef37b671d96f12d0c5b9b5fc06897ed5ebd34172b3ada9ffbe2';
check('horde-structure: the baseline is the one pinned when the pass was rerun on 8c9521db', sha256(canonicalDoc(base.dialogue.baseline)) === BASELINE);
// The rerun itself is committed (critic round 2, H1), so the pin is checked against a state a commit holds.
{ const bv = JSON.parse(readFileSync(DIR + 'baseline.view.json', 'utf8')), bo = JSON.parse(readFileSync(DIR + 'baseline.overlay.json', 'utf8'));
  check('horde-structure: baseline.view.json and baseline.overlay.json give exactly the pinned baseline',
    sha256(canonicalDoc(baselineOf(bo, bv, base.dialogue.questions))) === BASELINE);
  check('horde-structure: the rerun is the agent\'s alone (every element agent:structure, proposed) on the same graph',
    bv.elements.every((e) => e.by === ASKER && e.status === 'proposed') && bv.graph.hash === base.view.graph.hash); }

// ---- criterion 4: as answered
const onDisk = (s) => {
  const dir = mkdtempSync(join(tmpdir(), 'loupe-dialogue-'));
  try {
    copyFileSync(DIR + 'graph.json', join(dir, 'graph.json'));
    writeFileSync(join(dir, 'overlay.json'), canonicalDoc(s.overlay));
    writeFileSync(join(dir, 'view.json'), canonicalDoc(s.view));
    return loupeCheck(dir, { schemaDir: SCHEMA });
  } finally { rmSync(dir, { recursive: true }); }
};
const lc0 = loupeCheck(DIR, { schemaDir: SCHEMA });
check(`horde-structure as answered: loupe-check passes with schema validation${lc0.errors.length ? ' — ' + lc0.errors.join(' | ') : ''}`,
  lc0.errors.length === 0 && !lc0.notes.some((n) => n.includes('skipped')));
const e0 = checkDialogue(base);
check(`horde-structure as answered: the dialogue check passes${e0.length ? ' — ' + e0.join(' | ') : ''}`, e0.length === 0);
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
check(`horde-structure as answered: renders and balances at every level of detail, lens on and off, stages 2 and 3${m0.length ? ' — ' + m0.join(' | ') : ''}`, m0.length === 0);
const q3edges = q(base, 'q3').applied.edges;
// The scope of Julian's q4 confirmation (the top-level split only; poll, 2026-11-12) is pinned here, like the baseline:
// it lives in the file answers are written to (critic, confirming pass P1).
const Q4_CONFIRMED = 'sec:docs,sec:fx-shared,sec:gui3,sec:hypersaw,sec:hypersaw10,sec:legacy,sec:records,sec:reference,sec:swarmfx,sec:unwired';
const Q4_AGENT = 'sec:h2-checks,sec:h2-specs,sec:hs-checks,sec:specs,sec:t-auhost,sec:t-bench,sec:t-checks,sec:t-gen,sec:t-golden,sec:t-lab,sec:t-other,sec:t-preview,sec:t-probes,sec:verification';
check('q4: what Julian confirmed and what stays Loupe\'s are the pinned lists',
  [...q(base, 'q4').applied.elements].sort().join() === Q4_CONFIRMED && [...q(base, 'q4').confirmation.elements].sort().join() === Q4_CONFIRMED
  && [...q(base, 'q4').applied.agentElements].sort().join() === Q4_AGENT && !q(base, 'q4').confirmation.claims);
check('q3\'s edges are inferred, name HORDE\'s session, and are in the overlay',
  q3edges.length === 11 && q3edges.every((id) => { const e = base.overlay.edges.find((x) => x.id === id); return e && e.provenance === 'inferred' && e.evidence.some((v) => v.agent === HORDE); }));
check('q4 is Julian\'s, confirmed in Julian\'s words, and Loupe\'s allocations under it stay the agent\'s and proposed; no answer from HORDE is confirmed',
  q(base, 'q4').answeredBy === JULIAN && q(base, 'q4').confirmation.quote.length > 0
  && q(base, 'q4').applied.agentElements.length > 0 && q(base, 'q4').applied.agentElements.every((id) => el(base, id).by === ASKER && el(base, id).status === 'proposed')
  && base.dialogue.questions.filter((x) => x.answeredBy === HORDE).every((x) => x.confirmation === null));
const st = dialogueStages(base.dialogue);
check('the stage 3 stand-in keeps who answered, the effect, and that only q4 is confirmed',
  st.find((x) => x.id === 'q3').answeredBy === HORDE && st.find((x) => x.id === 'q3').effect.startsWith('Loupe adds one inferred edge')
  && st.filter((x) => x.confirmed).map((x) => x.id).join() === 'q4');
const CONFIRM = { by: JULIAN, date: '2026-11-12', quote: 'yes' };
{ // Julian confirms q3: its edges may then become annotated, citing q3.
  const s = clone(base); q(s, 'q3').confirmation = CONFIRM;
  for (const e of s.overlay.edges) if (q3edges.includes(e.id)) { e.provenance = 'annotated'; e.evidence.push({ type: 'annotation', author: JULIAN, note: 'Confirmed in chat.', dialogue: 'q3' }); }
  rebind(s);
  check('q3 confirmed by Julian and its edges annotated passes loupe-check and the dialogue check', onDisk(s).errors.length === 0 && checkDialogue(s).length === 0);
}

// ---- plants: each must fail, for the reason named
const plant = (name, s, expect) => {
  const errs = checkDialogue(s);
  check(`plant caught: ${name}${errs.some((e) => e.includes(expect)) ? '' : ' — got: ' + (errs.join(' | ') || 'no error')}`, errs.some((e) => e.includes(expect)));
};
const ID = q3edges[0];
{ const s = clone(base); q(s, 'q1').nodes.push('file:h2/no_such_file.h');
  plant('a question naming a node not in the graph', s, 'is not in the graph'); }
{ const s = clone(base), e = s.overlay.edges.find((x) => x.id === ID); e.provenance = 'annotated'; e.evidence.push({ type: 'annotation', author: JULIAN, note: 'x', dialogue: 'q3' });
  plant('an answer from HORDE entered as annotated without Julian\'s confirmation', rebind(s), 'Julian has not confirmed'); }
// Criterion 5's third plant (critic H1): an overlay edge present at the baseline is deleted and nothing lists it. The
// meter balances on what is left, so only the baseline sees the loss.
{ const s = clone(base); s.dialogue.baseline = baselineOf(s.overlay, s.view, s.dialogue.questions);
  s.overlay.edges = s.overlay.edges.filter((e) => e.id !== ID); q(s, 'q3').applied.edges = q3edges.filter((x) => x !== ID);
  rebind(s);
  check('the meter alone balances after that edge is deleted (why the baseline is needed)', meter(s).length === 0);
  plant('an answer that drops an edge present at the baseline', s, 'is gone'); }
{ const s = clone(base); s.overlay.edges.find((x) => x.id === ID).evidence[0].agent = ASKER;
  plant('an inferred edge that does not name HORDE\'s session as its source', rebind(s), 'does not name'); }
{ const s = clone(base), src = 'file:h2/engine/engine.h', dst = 'file:reference/swarmsaw.html';
  s.overlay.edges.push({ id: edgeId(src, dst, 'reference'), src, dst, kind: 'reference', provenance: 'annotated', evidence: [{ type: 'annotation', author: JULIAN, note: 'x' }] });
  plant('an annotated edge that no answered question applied', rebind(s), 'no answered question lists it'); }
{ const s = clone(base), e = el(s, 'sec:cmake'); e.parent = 'sec:records'; e.status = 'confirmed';
  plant('a section moved and confirmed with no answer behind it', s, 'no answered question lists it'); }
{ const s = clone(base); el(s, 'sec:engine2').by = ASKER;
  plant('q1\'s change to a section still signed by the asking agent', s, `not by ${HORDE}`); }
{ const s = clone(base); q(s, 'q2').answeredBy = ASKER;
  plant('the asking agent answering its own question', s, 'the agent that asked it'); }
{ const s = clone(base); Object.assign(q(s, 'q2'), { answer: null, answeredBy: null, confirmation: CONFIRM });
  plant('a confirmation on an unanswered question', s, 'confirmed, but not answered'); }
{ const s = clone(base); q(s, 'q4').confirmation = null;
  plant('Julian\'s answer with no confirmation in Julian\'s words', s, 'needs its confirmation recorded'); }
{ const s = clone(base); s.overlay.roles.push({ edge: base.graph.edges[0].id, role: 'product' });
  plant('an overlay role no answer applied', rebind(s), 'no answered question lists it'); }
{ const s = clone(base); s.overlay.conditions.push({ edge: base.graph.edges[0].id, expr: 'x' });
  plant('an overlay condition no answer applied', rebind(s), 'no answered question lists it'); }
{ const s = clone(base); s.view.settings.hubPlacement = 'center';
  plant('the view\'s settings changed by no answer', s, 'settings or exemptions'); }
{ const s = clone(base); s.dialogue.questions.pop();
  plant('an asked question deleted', s, 'is gone'); }
{ const s = clone(base); q(s, 'q3').question += ' (reworded)';
  plant('a question reworded after it was answered', s, 'not as it was asked'); }
{ const s = clone(base); s.view.elements = s.view.elements.filter((e) => e.id !== 'sec:engine2');
  plant('a section removed on HORDE\'s unconfirmed answer', s, 'is removed, but Julian has not confirmed'); }
{ const s = clone(base); s.overlay.edges.find((x) => x.id === ID).provenance = 'runtime';
  plant('an answer that makes a runtime edge', rebind(s), 'can only make inferred or annotated'); }
{ const s = clone(base); q(s, 'q4').applied.elements.push(q(s, 'q1').applied.elements[0]);
  plant('one change claimed by two answers', s, 'is also applied by'); }
{ // A later unconfirmed answer may not overwrite an edge Julian annotated.
  const s = clone(base); q(s, 'q3').confirmation = CONFIRM;
  const e = s.overlay.edges.find((x) => x.id === ID); e.provenance = 'annotated'; e.evidence.push({ type: 'annotation', author: JULIAN, note: 'x', dialogue: 'q3' });
  rebind(s); s.dialogue.baseline = baselineOf(s.overlay, s.view, s.dialogue.questions);
  e.provenance = 'inferred'; e.evidence = [{ type: 'inference', agent: HORDE, rationale: 'second round' }];
  q(s, 'q3').applied.edges = q3edges.filter((x) => x !== ID); q(s, 'q2').applied.edges = [ID];
  plant('a later unconfirmed answer overwriting an edge Julian annotated', rebind(s), 'was annotated by Julian'); }
{ const s = clone(base); s.overlay.edges.push({ id: ID, src: 'x', dst: 'y', kind: 'reference', provenance: 'inferred', evidence: [] });
  s.dialogue.baseline = baselineOf(s.overlay, s.view, s.dialogue.questions);
  check('plant caught: re-baselining after a change (the pinned digest no longer matches)', sha256(canonicalDoc(s.dialogue.baseline)) !== BASELINE); }
{ const s = clone(base); el(s, q(s, 'q4').applied.agentElements[0]).status = 'confirmed';
  plant('one of Loupe\'s allocations marked confirmed under Julian\'s q4 confirmation', s, 'must stay'); }
{ const s = clone(base), id = q(s, 'q4').applied.agentElements.find((x) => x !== 'sec:verification' && !s.view.elements.some((e) => e.parent === x));
  s.view.elements = s.view.elements.filter((e) => e.id !== id);
  plant('one of Loupe\'s allocations removed', s, 'only an answer Julian confirmed may remove'); }
{ const s = clone(base); q(s, 'q2').owner = 'julian';
  plant('a question marked Julian\'s answered by HORDE', s, 'marked Julian\'s, but answered by'); }
{ const s = clone(base), x = q(s, 'q4'), id = x.applied.agentElements[0];
  x.applied.agentElements = x.applied.agentElements.filter((y) => y !== id); x.applied.elements.push(id); x.confirmation.elements.push(id);
  el(s, id).status = 'confirmed';
  check('plant caught: one of Loupe\'s allocations moved into Julian\'s confirmed list (the pinned lists no longer match)',
    [...x.applied.elements].sort().join() !== Q4_CONFIRMED); }
{ const s = clone(base); el(s, 'sec:gui3').status = 'confirmed'; el(s, 'sec:gui3').by = JULIAN;
  plant('a section Julian placed marked confirmed, as if Julian had confirmed its claim', s, 'no confirmation of Julian\'s lists it'); }
{ const s = clone(base); q(s, 'q4').applied.elements.pop();
  plant('applied elements that differ from what Julian\'s confirmation lists', s, 'differ from the elements Julian\'s confirmation lists'); }
{ const s = clone(base), e = el(s, 'sec:cmake'); e.parent = 'sec:records'; q(s, 'q2').applied.agentElements = ['sec:cmake'];
  plant('an agent allocation riding on HORDE\'s unconfirmed "no change"', s, 'agent elements need an answer Julian confirmed'); }
plant('a snapshot missing the dialogue\'s fields reports, not throws', { ...clone(base), dialogue: { graph: base.dialogue.graph } }, 'malformed');

console.log(failed ? `\n${failed} FAILED` : '\nall dialogue checks passed');
process.exit(failed ? 1 : 0);
