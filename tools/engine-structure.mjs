// HORDE's declared engine2 structure → a Loupe structure snapshot (ROADMAP Q-015; Julian, polls 2026-10-16 and
// 2026-10-31). The one adapter between HORDE's format and Loupe's: HORDE gates the declaration against its spec in its
// own ./verify, and Loupe draws it with no inference. Deterministic: same declaration bytes, same output bytes.
//   node tools/engine-structure.mjs --horde <checkout> --commit <sha> [--out <dir>]
// Reads the file at the commit with `git show` (HORDE's working tree and index are never touched).
// Writes graph.json, overlay.json, view.json and census.json (default: design/prototype/snapshots/engine2-structure/).
//
// DRAFT: the graph is in the proposed schema 0.4 shape (`loupe.graph/0.4-draft`), which is not yet in schema/ and is
// behind Julian's gate; the viewer draws it first so the schema is approved with the picture (domain invariant).
import { writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalGraph, canonicalDoc, sha256, edgeId } from './canon.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const FORMAT = 'horde.engine-structure/1';
export const DECL_PATH = 'engine2/structure/engine-structure.json';
export const REPO = 'github.com/Julian-B-Smith/horde';
const KINDS = ['audio', 'control', 'event', 'modulation', 'observation'];

export const nodeId = (id) => 'decl:' + id;
export const secId = (id) => 'sec:' + id;

// The format's own keys, per record type. A key outside these lists is reported in census.unknownKeys, never dropped
// silently (a newer HORDE format could carry meaning this adapter does not read).
const KNOWN = {
  top: ['format', 'spec', 'counts', 'edge_kinds', 'items', 'edges', 'signal_path'],
  item: ['id', 'label', 'parent', 'kind', 'scope', 'multiplicity', 'cites'],
  edge: ['id', 'from', 'to', 'kind', 'label', 'cites'],
  stage: ['stage', 'ids'],
};

// The adapter proper: pure, from the declaration's parsed JSON (and the commit it was read at) to the four documents.
// Anything it cannot place is reported in the census, never dropped silently (Q-015 criterion 2).
export function adapt(decl, { commit, commitTime, blob }) {
  if (decl.format !== FORMAT) throw new Error(`declaration format is ${decl.format}, this adapter reads ${FORMAT}`);
  const rawItems = decl.items || [], declEdges = decl.edges || [], stages = decl.signal_path || [];
  const unplaced = [];
  const unknown = (rec, type) => Object.keys(rec).filter((k) => !KNOWN[type].includes(k));
  const unknownKeys = { top: unknown(decl, 'top'), item: [], edge: [], stage: [] };
  const addUnknown = (type, rec) => { for (const k of unknown(rec, type)) if (!unknownKeys[type].includes(k)) unknownKeys[type].push(k); };
  rawItems.forEach((i) => addUnknown('item', i)); declEdges.forEach((e) => addUnknown('edge', e)); stages.forEach((st) => addUnknown('stage', st));
  for (const t of Object.keys(unknownKeys)) unknownKeys[t].sort();

  const eq = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
  if (!Array.isArray(decl.edge_kinds) || !eq(decl.edge_kinds, KINDS)) {
    unplaced.push({ what: 'edge_kinds', id: null, why: `the declaration's edge_kinds ${JSON.stringify(decl.edge_kinds ?? null)} differ from the adapter's ${JSON.stringify(KINDS)}` });
  }

  // First declaration wins and the later one is reported: "the last one wins" would hide a declaration silently.
  const byId = new Map(), items = [];
  for (const i of rawItems) {
    if (byId.has(i.id)) { unplaced.push({ what: 'item', id: i.id, why: 'duplicate item id (the first declaration is kept)' }); continue; }
    byId.set(i.id, i); items.push(i);
  }

  // Effective parent: a parent that is not an item, or one that closes a cycle, is cut (reported) so no consumer can
  // recurse forever. A cycle is broken at its smallest id, which makes the cut independent of declaration order.
  const parent = new Map(items.map((i) => [i.id, i.parent ?? null]));
  const missing = new Set();
  for (const i of items) if (i.parent != null && !byId.has(i.parent)) { parent.set(i.id, null); missing.add(i.parent); }
  for (const p of [...missing].sort()) unplaced.push({ what: 'parent', id: p, why: 'named as a parent, not declared as an item (its members are drawn without it)' });
  for (const start of [...byId.keys()].sort()) {
    for (;;) {
      const path = [];
      let at = start;
      while (at != null && !path.includes(at)) { path.push(at); at = parent.get(at); }
      if (at == null) break;
      const cycle = path.slice(path.indexOf(at)), root = [...cycle].sort()[0];
      parent.set(root, null);
      unplaced.push({ what: 'parent', id: root, why: `parent cycle ${[...cycle, cycle[0]].join(' -> ')} (cut at ${root}: drawn without its parent)` });
    }
  }

  // Containers: items some other item names as its parent. Each becomes a section holding its own node (Julian, poll
  // 2026-10-31: edges to a container land on the node for the block itself, so no edge ends on a section).
  const containers = new Set([...parent.values()].filter((p) => p != null));

  const nodes = items.map((i) => ({
    id: nodeId(i.id), kind: i.kind === 'slot' ? 'slot' : 'block', path: i.id, hash: 'none',
    declared: { label: i.label, scope: i.scope, multiplicity: i.multiplicity ?? null, cites: [...(i.cites || [])], parent: parent.get(i.id) },
  }));
  for (const i of items) if (i.kind !== 'block' && i.kind !== 'slot') unplaced.push({ what: 'item', id: i.id, why: `kind ${i.kind} is neither block nor slot (drawn as a block)` });

  const edges = [], seen = new Map(), declEdgeIds = new Map(), edgeById = new Map(), seenEdgeIds = new Set();
  for (const e of declEdges) {
    if (seenEdgeIds.has(e.id)) unplaced.push({ what: 'edge', id: e.id, why: 'duplicate edge id (each declaration is still placed)' });
    seenEdgeIds.add(e.id);
    if (!byId.has(e.from) || !byId.has(e.to)) { unplaced.push({ what: 'edge', id: e.id, why: `an end is not a declared item` }); continue; }
    if (!KINDS.includes(e.kind)) { unplaced.push({ what: 'edge', id: e.id, why: `kind ${e.kind} is not in ${FORMAT}'s closed list` }); continue; }
    const src = nodeId(e.from), dst = nodeId(e.to), id = edgeId(src, dst, e.kind);
    const evidence = { type: 'declaration', path: DECL_PATH, id: e.id, cites: [...(e.cites || [])] };
    if (seen.has(id)) {
      // Merged, not dropped: the second declaration stays on the edge as evidence, and is reported.
      edgeById.get(id).evidence.push(evidence);
      unplaced.push({ what: 'edge', id: e.id, why: `same ends and kind as ${seen.get(id)} (evidence merged into that edge)` });
    } else {
      seen.set(id, e.id);
      const edge = { id, src, dst, kind: e.kind, provenance: 'declared', ...(e.label ? { label: e.label } : {}), evidence: [evidence] };
      edges.push(edge); edgeById.set(id, edge);
    }
    if (!declEdgeIds.has(e.id)) declEdgeIds.set(e.id, id);
  }

  // Signal path: each stage keeps its raw ids and gains refs, the Loupe ids they resolve to (decl:<id> for an item,
  // the e: id for an edge), so loupe-check can validate them. An id that is neither an item nor an edge is reported.
  let resolved = 0;
  const stagesUnresolved = [];
  const signalPath = stages.map((st, n) => {
    const ids = Array.isArray(st.ids) ? [...st.ids] : [], refs = [];
    for (const id of ids) {
      // Resolved only when it emits a ref: a declared edge that was dropped (bad kind, an end that is no item) has an id in
      // seenEdgeIds but nothing to draw, so a stage naming it is unresolved, never silently counted (critic N5).
      const isItem = byId.has(id), drawn = declEdgeIds.has(id), dropped = seenEdgeIds.has(id) && !drawn;
      if (!isItem && !drawn) { stagesUnresolved.push({ stage: n, id }); unplaced.push({ what: 'stage', id, why: dropped ? `stage ${n} names a dropped edge (declared, but not drawn: see its own entry)` : `stage ${n} names an id that is neither a declared item nor a declared edge` }); continue; }
      resolved++;
      if (isItem) refs.push(nodeId(id));
      if (drawn) refs.push(declEdgeIds.get(id));
    }
    return { stage: st.stage, ids, refs };
  });

  const graph = {
    schema: 'loupe.graph/0.4-draft',
    source: { repo: REPO, commit, commitTime, dirty: false },
    declaration: { format: decl.format, path: DECL_PATH, blob, spec: { ...decl.spec }, counts: decl.counts, signalPath },
    nodes, edges,
  };
  const graphText = canonicalGraph(graph);
  const overlay = { schema: 'loupe.overlay/0.2', graph: { hash: sha256(graphText) }, edges: [], roles: [], conditions: [] };
  const overlayText = canonicalDoc(overlay);

  // The view nests as the declaration does. Written by this adapter, not an agent: `by` says so, and it is accepted
  // (it states the declaration, nothing composed). Ordered by declared id so the bytes are stable.
  const elements = [...containers].filter((c) => byId.has(c)).sort().map((c) => {
    const it = byId.get(c), up = parent.get(c);
    const members = [nodeId(c), ...items.filter((i) => parent.get(i.id) === c && !containers.has(i.id)).map((i) => nodeId(i.id)).sort()];
    return { id: secId(c), primitive: 'section', label: c, claim: it.label + (it.multiplicity ? ` (× ${it.multiplicity})` : ''),
      members, by: 'adapter:engine-structure', status: 'accepted', ...(up != null ? { parent: secId(up) } : {}) };
  });
  const view = { schema: 'loupe.view/0.2', graph: { hash: sha256(graphText) }, overlay: { hash: sha256(overlayText) },
    dialect: { name: 'engine-structure', version: '0.1' }, settings: { hubPlacement: 'group' }, exemptions: [], elements };

  // The census: the declaration's own counts against what was carried, so a drop is a visible number (criterion 2).
  // Every carried count is taken from the emitted documents (nodes, edges), never from the input.
  const count = (xs, key) => xs.reduce((a, x) => ((a[x[key]] = (a[x[key]] || 0) + 1), a), {});
  const census = {
    declared: decl.counts,
    carried: { items: count(nodes, 'kind'), scope: count(nodes.map((n) => n.declared), 'scope'), edges: count(edges, 'kind'), stages: signalPath.length },
    stagesResolved: resolved, stagesUnresolved, unknownKeys,
    sections: elements.length, unplaced,
  };
  return { 'graph.json': graphText, 'overlay.json': overlayText, 'view.json': canonicalDoc(view), 'census.json': canonicalDoc(census) };
}

function main(argv) {
  const arg = (k) => { const i = argv.indexOf(k); return i < 0 ? null : argv[i + 1]; };
  const out = arg('--out') || join(ROOT, 'design/prototype/snapshots/engine2-structure');
  const commit = arg('--commit');
  if (!commit || !/^[0-9a-f]{40}$/.test(commit)) throw new Error('--commit <full 40-hex sha> is required');
  // Only from a git checkout at a commit: a bare file has no commit or dirty state to stamp, and stamping one would be
  // false provenance (critic H4).
  if (!arg('--horde')) throw new Error('--horde <checkout> is required');
  const git = (...a) => execFileSync('git', ['-C', arg('--horde'), ...a], { encoding: 'utf8', maxBuffer: 1 << 26 });
  const text = git('show', `${commit}:${DECL_PATH}`);
  const commitTime = git('log', '-1', '--format=%cI', commit).trim();
  const blob = git('rev-parse', `${commit}:${DECL_PATH}`).trim();
  const docs = adapt(JSON.parse(text), { commit, commitTime, blob });
  mkdirSync(out, { recursive: true });
  for (const [name, body] of Object.entries(docs)) writeFileSync(join(out, name), body);
  const c = JSON.parse(docs['census.json']);
  console.log(`engine-structure: ${Object.values(c.carried.items).reduce((a, b) => a + b, 0)} items, ${Object.values(c.carried.edges).reduce((a, b) => a + b, 0)} edges, ${c.carried.stages} stages, ${c.sections} sections; ${c.unplaced.length} unplaced`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try { main(process.argv.slice(2)); } catch (e) { console.error('engine-structure: ' + e.message); process.exit(1); }
}
