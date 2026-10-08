// "How it works" stories (ADR 0025): pure functions, no DOM, no clock.
// A story is agent-written (inferred); Julian's edits are layered on top (annotated) and never mutate the source.
// Accounting keeps the one rule: files on a story's cards are in focus, every other file folds into one counted
// box, and every edge is counted as among story files, crossing into the box, or inside the box.

const by = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
export const CARD = { w: 240, h: 128, gapX: 96, gapY: 40 };
// Card height from its content (deterministic estimate, no DOM): a fixed height clipped text and file chips while
// the chips still counted as drawn (critic, 2026-10-08).
export function cardHeight(step) {
  const lines = Math.ceil((step.does || '').length / 38) + Math.ceil((step.label || '').length / 30);
  const chipChars = (step.files || []).reduce((a, f) => a + f.split('/').pop().length + 4, 0);
  return 44 + lines * 16 + Math.max(1, Math.ceil(chipChars / 30)) * 22;
}

// Effective story = source story + edits. edits: { steps: {sid: {label, does, deleted, pinned}}, added: [{id, after,
// label, does, files}], pos: {sid: {dx, dy}}, requests: [{text, step}] }. A step any edit touched is 'annotated'.
export function applyEdits(story, edits = {}) {
  const se = edits.steps || {};
  const steps = [];
  const pushAdded = after => (edits.added || []).filter(a => a.after === after).forEach(a => {
    if (!(se[a.id] || {}).deleted) steps.push({ id: a.id, concept: 'added', label: a.label || 'New step', does: a.does || '', files: a.files || [], evidence: [], provenance: 'annotated', pinned: !!(se[a.id] || {}).pinned, added: true });
    pushAdded(a.id);
  });
  pushAdded(null);
  const placed = new Set();
  story.steps.forEach(s => {
    const e = se[s.id] || {};
    if (!e.deleted) {
      const edited = e.label != null || e.does != null;
      steps.push({ ...s, label: e.label ?? s.label, does: e.does ?? s.does, provenance: edited ? 'annotated' : (s.provenance || 'inferred'), pinned: !!e.pinned, edited });
    }
    pushAdded(s.id);
  });
  // An added step whose anchor no longer exists is kept, at the end, marked orphaned: dropping it would lose Julian's work.
  steps.forEach(s => placed.add(s.id));
  (edits.added || []).filter(a => !placed.has(a.id) && !(se[a.id] || {}).deleted).forEach(a => steps.push({ id: a.id, concept: 'added', label: a.label || 'New step', does: a.does || '', files: a.files || [], evidence: [], provenance: 'annotated', pinned: !!(se[a.id] || {}).pinned, added: true, orphan: true }));
  const alive = new Set(steps.map(s => s.id));
  // Links touching a deleted step are dropped, not rerouted: a reroute would invent a claim nobody made.
  const links = story.links.filter(l => alive.has(l.from) && alive.has(l.to)).map(l => ({ ...l, provenance: l.provenance || 'inferred' }));
  // An added step is linked from the step it was added after (not onward: which successor it feeds is Julian's call).
  (edits.added || []).filter(a => alive.has(a.id)).forEach(a => {
    if (a.after && alive.has(a.after)) links.push({ from: a.after, to: a.id, carries: 'control', provenance: 'annotated' });
  });
  return { ...story, steps, links };
}

// Columns by longest path from the story's sources (cycles cut by visiting order); rows in step order.
// measured: optional {stepId: height} from the renderer (the DOM knows real text height; the estimate is a floor).
export function layoutStory(story, edits = {}, measured = {}) {
  const ids = story.steps.map(s => s.id), rank = {}, inc = {};
  story.links.forEach(l => { (inc[l.to] = inc[l.to] || []).push(l.from); });
  const visiting = {};
  const r = id => {
    if (rank[id] != null) return rank[id];
    if (visiting[id]) return 0;
    visiting[id] = true;
    rank[id] = Math.max(-1, ...(inc[id] || []).map(r)) + 1;
    return rank[id];
  };
  ids.forEach(r);
  const heightOf = {}; story.steps.forEach(s => { heightOf[s.id] = Math.max(cardHeight(s), measured[s.id] || 0); });
  const rowH = Math.max(CARD.h, ...Object.values(heightOf));
  // Wrap every WRAP columns into a new band, reading order like text, so an 11-step story is not one long row.
  const WRAP = 4, rows = {}, perRank = {}, pos = {};
  ids.forEach(id => { perRank[rank[id]] = (perRank[rank[id]] || 0) + 1; });
  const bandRows = {}; Object.entries(perRank).forEach(([k, n]) => { const b = Math.floor(k / WRAP); bandRows[b] = Math.max(bandRows[b] || 0, n); });
  const bandY = {}; let y = 0; Object.keys(bandRows).map(Number).sort((a, b) => a - b).forEach(b => { bandY[b] = y; y += bandRows[b] * (rowH + CARD.gapY) + 56; });
  ids.forEach(id => {
    const c = rank[id], row = rows[c] = (rows[c] || 0) + 1, off = (edits.pos || {})[id] || {};
    pos[id] = { x: (c % WRAP) * (CARD.w + CARD.gapX) + (Number(off.dx) || 0), y: bandY[Math.floor(c / WRAP)] + (row - 1) * (rowH + CARD.gapY) + (Number(off.dy) || 0), w: CARD.w, h: heightOf[id] };
  });
  return pos;
}

export function storyAccounting(data, story) {
  const known = new Set(data.nodeIds);
  const inside = new Set(story.steps.flatMap(s => s.files).filter(f => known.has(f)));
  const unknownFiles = [...new Set(story.steps.flatMap(s => s.files).filter(f => !known.has(f)))].sort(by);
  let insideEdges = 0, outsideEdges = 0;
  const crossing = [];
  data.edges.forEach(e => {
    const a = inside.has(e.src), b = inside.has(e.dst);
    if (a && b) insideEdges++; else if (a || b) crossing.push(e.id); else outsideEdges++;
  });
  crossing.sort(by);
  const outsideRoles = {};
  data.nodeIds.forEach(id => { if (!inside.has(id)) { const r = (data.nodes[id] || {}).role || 'other'; outsideRoles[r] = (outsideRoles[r] || 0) + 1; } });
  // A link is supported when at least one crawled edge joins a file of one step to a file of the other.
  const filesOf = {}; story.steps.forEach(s => { filesOf[s.id] = new Set(s.files); });
  const support = {};
  story.links.forEach((l, i) => {
    const A = filesOf[l.from] || new Set(), B = filesOf[l.to] || new Set();
    support[i] = data.edges.filter(e => (e.provenance === 'static' || e.provenance === 'config') && ((A.has(e.src) && B.has(e.dst)) || (B.has(e.src) && A.has(e.dst))) && e.src !== e.dst).length;
  });
  return { inside, unknownFiles, crossing, outsideRoles, support,
    counts: { insideFiles: inside.size, outsideFiles: data.nodeIds.length - inside.size, insideEdges, crossing: crossing.length, outsideEdges } };
}

// Stories file for a snapshot: stories/<repo name>-<first 8 of commit>.json, next to the prototype.
export function storiesPath(graph) {
  const src = graph && graph.source;
  if (!src || !src.repo || !src.commit || src.commit === 'sample') return null;
  return `stories/${src.repo.split('/').pop()}-${src.commit.slice(0, 8)}.json`;
}
