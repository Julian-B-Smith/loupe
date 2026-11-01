// HORDE's declared engine2 structure → a Loupe structure snapshot (ROADMAP Q-015; Julian, polls 2026-10-16 and
// 2026-10-31). The one adapter between HORDE's format and Loupe's: HORDE gates the declaration against its spec in its
// own ./verify, and Loupe draws it with no inference. Deterministic: same declaration bytes, same output bytes.
//   node tools/engine-structure.mjs --horde <checkout> --commit <sha> [--out <dir>]
//   node tools/engine-structure.mjs --file <declaration.json> --commit <sha> --commit-time <iso> [--out <dir>]
// Reads the file at the commit with `git show` (HORDE's working tree and index are never touched).
// Writes graph.json, overlay.json, view.json and census.json (default: design/prototype/snapshots/engine2-structure/).
//
// DRAFT: the graph is in the proposed schema 0.4 shape (`loupe.graph/0.4-draft`), which is not yet in schema/ and is
// behind Julian's gate; the viewer draws it first so the schema is approved with the picture (domain invariant).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
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

// The adapter proper: pure, from the declaration's parsed JSON (and the commit it was read at) to the four documents.
// Anything it cannot place is reported in the census, never dropped silently (Q-015 criterion 2).
export function adapt(decl, { commit, commitTime, blob }) {
  if (decl.format !== FORMAT) throw new Error(`declaration format is ${decl.format}, this adapter reads ${FORMAT}`);
  const items = decl.items || [], declEdges = decl.edges || [];
  const byId = new Map(items.map((i) => [i.id, i]));
  const unplaced = [];
  // Containers: items some other item names as its parent. Each becomes a section holding its own node (Julian, poll
  // 2026-10-31: edges to a container land on the node for the block itself, so no edge ends on a section).
  const containers = new Set(items.filter((i) => i.parent != null).map((i) => i.parent));
  for (const c of containers) if (!byId.has(c)) unplaced.push({ what: 'parent', id: c, why: 'named as a parent, not declared as an item' });

  const nodes = items.map((i) => ({
    id: nodeId(i.id), kind: i.kind === 'slot' ? 'slot' : 'block', path: i.id, hash: 'none',
    declared: { label: i.label, scope: i.scope, multiplicity: i.multiplicity ?? null, cites: [...(i.cites || [])], parent: i.parent ?? null },
  }));
  for (const i of items) if (i.kind !== 'block' && i.kind !== 'slot') unplaced.push({ what: 'item', id: i.id, why: `kind ${i.kind} is neither block nor slot (drawn as a block)` });

  const edges = [], seen = new Map();
  for (const e of declEdges) {
    if (!byId.has(e.from) || !byId.has(e.to)) { unplaced.push({ what: 'edge', id: e.id, why: `an end is not a declared item` }); continue; }
    if (!KINDS.includes(e.kind)) { unplaced.push({ what: 'edge', id: e.id, why: `kind ${e.kind} is not in ${FORMAT}'s closed list` }); continue; }
    const src = nodeId(e.from), dst = nodeId(e.to), id = edgeId(src, dst, e.kind);
    if (seen.has(id)) { unplaced.push({ what: 'edge', id: e.id, why: `same ends and kind as ${seen.get(id)}` }); continue; }
    seen.set(id, e.id);
    edges.push({ id, src, dst, kind: e.kind, provenance: 'declared', ...(e.label ? { label: e.label } : {}),
      evidence: [{ type: 'declaration', path: DECL_PATH, id: e.id, cites: [...(e.cites || [])] }] });
  }

  const graph = {
    schema: 'loupe.graph/0.4-draft',
    source: { repo: REPO, commit, commitTime, dirty: false },
    declaration: { format: decl.format, path: DECL_PATH, blob, spec: { ...decl.spec }, counts: decl.counts, signalPath: decl.signal_path || [] },
    nodes, edges,
  };
  const graphText = canonicalGraph(graph);
  const overlay = { schema: 'loupe.overlay/0.2', graph: { hash: sha256(graphText) }, edges: [], roles: [], conditions: [] };
  const overlayText = canonicalDoc(overlay);

  // The view nests as the declaration does. Written by this adapter, not an agent: `by` says so, and it is accepted
  // (it states the declaration, nothing composed). Ordered by declared id so the bytes are stable.
  const elements = [...containers].filter((c) => byId.has(c)).sort().map((c) => {
    const it = byId.get(c);
    const members = [nodeId(c), ...items.filter((i) => i.parent === c && !containers.has(i.id)).map((i) => nodeId(i.id)).sort()];
    return { id: secId(c), primitive: 'section', label: c, claim: it.label + (it.multiplicity ? ` (× ${it.multiplicity})` : ''),
      members, by: 'adapter:engine-structure', status: 'accepted', ...(it.parent != null ? { parent: secId(it.parent) } : {}) };
  });
  const view = { schema: 'loupe.view/0.2', graph: { hash: sha256(graphText) }, overlay: { hash: sha256(overlayText) },
    dialect: { name: 'engine-structure', version: '0.1' }, settings: { hubPlacement: 'group' }, exemptions: [], elements };

  // The census: the declaration's own counts against what was carried, so a drop is a visible number (criterion 2).
  const count = (xs, key) => xs.reduce((a, x) => ((a[x[key]] = (a[x[key]] || 0) + 1), a), {});
  const census = {
    declared: decl.counts,
    carried: { items: count(nodes, 'kind'), scope: count(items, 'scope'), edges: count(edges, 'kind'), stages: graph.declaration.signalPath.length },
    sections: elements.length, unplaced,
  };
  return { 'graph.json': graphText, 'overlay.json': overlayText, 'view.json': canonicalDoc(view), 'census.json': canonicalDoc(census) };
}

function main(argv) {
  const arg = (k) => { const i = argv.indexOf(k); return i < 0 ? null : argv[i + 1]; };
  const out = arg('--out') || join(ROOT, 'design/prototype/snapshots/engine2-structure');
  const commit = arg('--commit');
  if (!commit || !/^[0-9a-f]{40}$/.test(commit)) throw new Error('--commit <full 40-hex sha> is required');
  let text, commitTime, blob;
  if (arg('--horde')) {
    const git = (...a) => execFileSync('git', ['-C', arg('--horde'), ...a], { encoding: 'utf8', maxBuffer: 1 << 26 });
    text = git('show', `${commit}:${DECL_PATH}`);
    commitTime = git('log', '-1', '--format=%cI', commit).trim();
    blob = git('rev-parse', `${commit}:${DECL_PATH}`).trim();
  } else if (arg('--file')) {
    text = readFileSync(arg('--file'), 'utf8');
    commitTime = arg('--commit-time');
    blob = execFileSync('git', ['hash-object', arg('--file')], { encoding: 'utf8' }).trim();
    if (!commitTime) throw new Error('--commit-time is required with --file');
  } else throw new Error('--horde <checkout> or --file <declaration.json> is required');
  const docs = adapt(JSON.parse(text), { commit, commitTime, blob });
  mkdirSync(out, { recursive: true });
  for (const [name, body] of Object.entries(docs)) writeFileSync(join(out, name), body);
  const c = JSON.parse(docs['census.json']);
  console.log(`engine-structure: ${Object.values(c.carried.items).reduce((a, b) => a + b, 0)} items, ${Object.values(c.carried.edges).reduce((a, b) => a + b, 0)} edges, ${c.carried.stages} stages, ${c.sections} sections; ${c.unplaced.length} unplaced`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try { main(process.argv.slice(2)); } catch (e) { console.error('engine-structure: ' + e.message); process.exit(1); }
}
