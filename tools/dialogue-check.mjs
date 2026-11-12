// Dialogue stand-in check (ROADMAP Q-044, criteria 4 and 5). A pure function over a snapshot's graph, overlay, view and
// dialogue.json, deterministic and model-free: it decides whether the answers applied to the map keep the provenance
// rule Julian set (poll, 2026-11-06). An answer from HORDE's session enters as `inferred` (edges) or `proposed`
// (elements) naming that session; only Julian's confirmation in chat, recorded in `confirmation`, may make it
// `annotated`. Conservation of the crawled graph stays with loupe-check and the render meter; this adds what they cannot
// see. The meter balances on whatever the overlay holds, so an overlay edge deleted outright vanishes from both sides
// of it (critic, 2026-11-11, H1). Hence the baseline: dialogue.json records the overlay and view as they were when the
// questions were asked, and every difference from it must be an applied change of exactly one answered question.
// Run: node tools/dialogue-check.mjs <snapshot dir>
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

export const JULIAN = 'human:julian';
// The Structure agent asks; it may not answer its own questions.
export const ASKER = 'agent:structure';

const sortKeys = (x) => Array.isArray(x) ? x.map(sortKeys)
  : x && typeof x === 'object' ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, sortKeys(x[k])])) : x;
const digest = (x) => 'sha256:' + createHash('sha256').update(JSON.stringify(sortKeys(x)), 'utf8').digest('hex');

// What was asked, and what the map held then: one digest per overlay edge, role and condition, per view element, per
// question as asked, and one for the rest of the view (settings, exemptions; not its overlay binding, which every
// applied edge changes). The baseline sits in the file answers are written to, so tools/dialogue.test.mjs pins its
// digest to a literal: re-baselining is a visible test edit, never a side effect of applying an answer (critic R1).
const ASKED = ({ id, nodes, elements, question, options, owner }) => ({ id, nodes, elements, question, options, owner });
export function baselineOf(overlay, view, questions) {
  const o = overlay || {};
  const { elements, overlay: _binding, ...rest } = view;
  return {
    edges: Object.fromEntries((o.edges || []).map((e) => [e.id, digest(e)])),
    roles: Object.fromEntries((o.roles || []).map((r) => [r.edge, digest(r)])),
    conditions: Object.fromEntries((o.conditions || []).map((c) => [c.edge, digest(c)])),
    elements: Object.fromEntries(elements.map((e) => [e.id, digest(e)])),
    view: digest(rest),
    annotated: (o.edges || []).filter((e) => e.provenance === 'annotated').map((e) => e.id),
    questions: Object.fromEntries(questions.map((q) => [q.id, digest(ASKED(q))])),
  };
}
const KINDS = ['edges', 'elements', 'roles', 'conditions'];

// Ids present in either map whose digest differs, with whether they were removed.
const diff = (before, after) => {
  const out = [];
  for (const id of new Set([...Object.keys(before), ...Object.keys(after)]))
    if (before[id] !== after[id]) out.push({ id, removed: !(id in after) });
  return out;
};

export function checkDialogue(snap) {
  try { return check(snap); } catch (e) { return [`malformed snapshot or dialogue: ${e.message}`]; }
}

function check({ graph, overlay, view, dialogue }) {
  const errors = [];
  const nodes = new Set(graph.nodes.map((n) => n.id));
  const els = new Map(view.elements.map((e) => [e.id, e]));
  const oEdges = new Map(((overlay && overlay.edges) || []).map((e) => [e.id, e]));
  if (dialogue.graph.hash !== view.graph.hash) errors.push('dialogue.graph.hash differs from view.graph.hash');
  const base = dialogue.baseline, now = baselineOf(overlay, view, dialogue.questions);
  const owner = Object.fromEntries(KINDS.map((k) => [k, new Map()]));
  const confirmedQ = new Set();
  for (const q of dialogue.questions) {
    const at = `question ${q.id}`;
    if (!q.nodes.length) errors.push(`${at}: names no node`);
    q.nodes.forEach((n) => { if (!nodes.has(n)) errors.push(`${at}: node ${n} is not in the graph`); });
    q.elements.forEach((e) => { if (!(e in base.elements)) errors.push(`${at}: element ${e} was not in the view when asked`); });
    const applied = { edges: [], elements: [], roles: [], conditions: [], ...(q.applied || {}) };
    const answered = q.answer !== null;
    if (answered && !q.answeredBy) errors.push(`${at}: answered, but by no one`);
    if (answered && q.answeredBy === ASKER) errors.push(`${at}: answered by ${ASKER}, the agent that asked it`);
    if (answered && !q.options.some((o) => o.answer === q.answer) && !q.effect) errors.push(`${at}: an answer outside its options must state its own effect`);
    if (!answered && KINDS.some((k) => applied[k].length)) errors.push(`${at}: applied changes without an answer`);
    if (q.confirmation && !answered) errors.push(`${at}: confirmed, but not answered`);
    if (q.confirmation && (q.confirmation.by !== JULIAN || !q.confirmation.date || !q.confirmation.quote))
      errors.push(`${at}: a confirmation needs by ${JULIAN}, a date and Julian's words`);
    // Julian's own answer too carries a confirmation with his words: criterion 4 records it in this file (critic R2).
    const confirmed = !!(q.confirmation && q.confirmation.by === JULIAN && q.confirmation.date && q.confirmation.quote);
    if (q.answeredBy === JULIAN && !confirmed) errors.push(`${at}: Julian's answer needs its confirmation recorded`);
    if (confirmed) confirmedQ.add(q.id);
    for (const k of KINDS) for (const id of applied[k]) {
      if (owner[k].has(id)) errors.push(`${at}: ${k.slice(0, -1)} ${id} is also applied by ${owner[k].get(id)}`);
      owner[k].set(id, q.id);
    }
    for (const id of applied.edges) {
      const e = oEdges.get(id);
      if (!e) continue; // a removal: judged below with every other difference
      // An edge Julian annotated earlier changes only on Julian's word.
      if (base.annotated && base.annotated.includes(id) && !confirmed) errors.push(`${at}: edge ${id} was annotated by Julian; changing it needs his confirmation`);
      if (e.provenance === 'annotated') {
        if (!confirmed) errors.push(`${at}: edge ${id} is annotated, but Julian has not confirmed the answer`);
        else if (!e.evidence.some((v) => v.type === 'annotation' && v.author === JULIAN && v.dialogue === q.id))
          errors.push(`${at}: annotated edge ${id} carries no annotation by ${JULIAN} citing ${q.id}`);
      } else if (e.provenance === 'inferred') {
        if (!e.evidence.some((v) => v.type === 'inference' && v.agent === q.answeredBy))
          errors.push(`${at}: inferred edge ${id} does not name ${q.answeredBy} as its source`);
      } else errors.push(`${at}: edge ${id} is ${e.provenance}; an answer can only make inferred or annotated edges`);
    }
    for (const id of applied.elements) {
      const el = els.get(id);
      if (confirmed) continue;
      if (!el) { errors.push(`${at}: element ${id} is removed, but Julian has not confirmed the answer`); continue; }
      if (el.status !== 'proposed') errors.push(`${at}: element ${id} is ${el.status}, but Julian has not confirmed the answer`);
      if (el.by !== q.answeredBy) errors.push(`${at}: element ${id} is by ${el.by}, not by ${q.answeredBy}, who answered`);
    }
  }
  // Every difference from the baseline belongs to exactly one answered question; no overlay edge is ever dropped.
  for (const k of KINDS) for (const { id, removed } of diff(base[k], now[k])) {
    if (k === 'edges' && removed) errors.push(`overlay edge ${id} was there when the questions were asked and is gone: an answer may add edges, never drop them`);
    else if (!owner[k].has(id)) errors.push(`${k.slice(0, -1)} ${id} differs from the baseline, but no answered question lists it as applied`);
  }
  for (const k of KINDS) for (const [id, qid] of owner[k])
    if (base[k][id] === now[k][id]) errors.push(`question ${qid}: lists ${k.slice(0, -1)} ${id} as applied, but it is unchanged`);
  if (base.view !== now.view) errors.push('the view\'s settings or exemptions differ from the baseline; no answer may change them');
  for (const { id, removed } of diff(base.questions, now.questions))
    errors.push(removed ? `question ${id} was asked and is gone: questions stay, open or answered` : `question ${id} is not as it was asked`);
  return errors;
}

export function loadDialogueSnapshot(dir) {
  if (!dir.endsWith('/')) dir += '/';
  const j = (f) => JSON.parse(readFileSync(dir + f, 'utf8'));
  return { graph: j('graph.json'), overlay: j('overlay.json'), view: j('view.json'), dialogue: j('dialogue.json') };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2];
  if (!dir) { console.error('usage: node tools/dialogue-check.mjs <snapshot dir>'); process.exit(2); }
  const errors = checkDialogue(loadDialogueSnapshot(dir));
  errors.forEach((e) => console.log(`ERROR ${e}`));
  console.log(errors.length ? `${errors.length} errors` : 'OK');
  process.exit(errors.length ? 1 : 0);
}
