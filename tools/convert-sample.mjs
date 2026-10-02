// One-off, reproducible: turns prototype/data/sample-horde.js into schema-shaped example files.
// The sample is invented. Its evidence sites are placeholders (line 1) and its commit is "sample".
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { canonicalGraph, canonicalDoc, sha256, edgeId } from './canon.mjs';

const src = readFileSync(new URL('../prototype/data/sample-horde.js', import.meta.url), 'utf8');
const S = new Function(src + '\nreturn {GROUPS,NODES,E,BUSES,QS,AUD};')();

const idOf = (n) => {
  if (n.path.startsWith('build/')) return `ext:${n.path.split('/').pop()}`;
  if (n.path.includes('*') || n.path.endsWith('.yml')) return `art:${n.path.replace(/^\.\//, '')}`;
  return `file:${n.path.replace(/^\.\//, '')}`;
};
const NID = {}; S.NODES.forEach((n) => (NID[n.id] = idOf(n)));
const kindOf = (id) => (id.startsWith('ext:') ? 'external' : id.startsWith('art:') ? 'artifact' : 'file');
const langOf = (p) => (/\.(cpp|hpp)$/.test(p) ? 'cpp' : p.endsWith('.yml') ? 'yaml' : undefined);

const nodes = S.NODES.map((n) => {
  const id = NID[n.id];
  const o = { id, kind: kindOf(id), path: id.split(':').slice(1).join(':'), hash: 'none' };
  const lang = langOf(n.path); if (lang) o.lang = lang;
  return o;
});

const SIG = { audio: 'render(AudioBlock&)', param: 'ParamStore::read(ParamId)', mod: 'ModTarget::apply(IntentId, depth)' };
const map = (e) => {
  const s = NID[e.s], d = NID[e.t];
  if (e.k === 'audio' || e.k === 'param' || e.k === 'mod') return { s, d, kind: 'call', role: e.k };
  if (e.k === 'test' && d.startsWith('art:')) return { s, d, kind: 'data' };
  return { s, d, kind: e.k };
};
const pathOf = (id) => id.split(':').slice(1).join(':');

const graphEdges = [], overlayEdges = [], idByRaw = {};
for (const e of S.E) {
  const m = map(e); const id = edgeId(m.s, m.d, m.kind); idByRaw[e.i] = id;
  if (e.p === 's') {
    const site = { type: 'site', path: pathOf(m.s), line: 1 };
    if (m.role) site.signature = SIG[m.role];
    const o = { id, src: m.s, dst: m.d, kind: m.kind, provenance: 'static', count: 1, evidence: [site] };
    if (m.role) { o.role = m.role; o.roleRule = `dsp-plugin/${m.role}-by-signature`; }
    graphEdges.push(o);
  } else {
    const ev = e.p === 'r'
      ? { type: 'trace', trace: 'trace:sample-001', observed: 1 }
      : { type: 'inference', agent: 'structure', rationale: 'No direct reference; reached through a function pointer or engine table (sample).' };
    const o = { id, src: m.s, dst: m.d, kind: m.kind, provenance: e.p === 'r' ? 'runtime' : 'inferred', evidence: [ev] };
    if (m.role) o.role = m.role;
    overlayEdges.push(o);
  }
}

const graph = {
  schema: 'loupe.graph/0.2',
  source: { repo: 'github.com/Julian-B-Smith/horde', commit: 'sample', commitTime: '2026-09-30T00:00:00Z', dirty: false },
  crawler: { name: 'loupe-crawl', version: '0.0.0-sample', granularity: 'file', languages: ['cpp', 'yaml'], dialect: { name: 'dsp-plugin', version: '0.1' },
    scope: { include: ['src/**/*.cpp', 'src/**/*.hpp', 'config/**/*.yml'], exclude: [], resolution: 'heuristic' },
    inventory: { files: nodes.filter((n) => n.kind === 'file').length, crawled: nodes.filter((n) => n.kind === 'file').length, excluded: [] } },
  nodes, edges: graphEdges,
};
const graphText = canonicalGraph(graph);
const gHash = sha256(graphText);

const roamKcore = edgeId(NID.roam, NID.kcore, 'call');
const overlay = {
  schema: 'loupe.overlay/0.2', graph: { hash: gHash },
  edges: overlayEdges.sort((a, b) => (a.id < b.id ? -1 : 1)),
  roles: [],
  conditions: [{ edge: roamKcore, condition: 'Only when ROAM is enabled', evidence: { type: 'trace', trace: 'trace:sample-001', observed: 1 } }],
};
const overlayText = canonicalDoc(overlay);

// ---- design view
const N = (raw) => NID[raw];
const secId = (g) => `sec:${g}`;
const elements = [];
for (const g of S.GROUPS) {
  const el = { id: secId(g.id), primitive: 'section', label: g.label, claim: g.blurb, by: 'agent:structure', status: 'proposed', members: S.NODES.filter((n) => n.group === g.id).map((n) => N(n.id)) };
  if (g.parent) el.parent = secId(g.parent);
  elements.push(el);
}
const busEdges = { baudio: [], bparam: [], bmod: [] };
for (const e of S.E) {
  const t = S.NODES.find((n) => n.id === e.t);
  if (e.k === 'param') busEdges.bparam.push(idByRaw[e.i]);
  else if (e.k === 'audio' && e.t === 'fxrouter') busEdges.baudio.push(idByRaw[e.i]);
  else if (e.k === 'mod' && (e.s === 'modmatrix' || e.s === 'intent') && t.group !== 'mod') busEdges.bmod.push(idByRaw[e.i]);
}
elements.push(
  { id: 'bus:audio', primitive: 'bus', label: 'Audio bus', claim: 'Engines render into fx_router through one audio contract.', by: 'agent:structure', status: 'confirmed', edges: busEdges.baudio, contract: { signature: SIG.audio, role: 'audio', dst: N('fxrouter') } },
  { id: 'bus:param', primitive: 'bus', label: 'Param bus', claim: 'Every stage reads parameters through param_store.', by: 'agent:structure', status: 'proposed', edges: busEdges.bparam, contract: { signature: SIG.param, role: 'param', dst: N('pstore') } },
  { id: 'bus:mod', primitive: 'bus', label: 'Mod bus', claim: 'Global modulation reaches its targets through one contract.', by: 'agent:structure', status: 'proposed', edges: busEdges.bmod, contract: { signature: SIG.mod, role: 'mod' } },
  { id: 'set:presets', primitive: 'set', label: 'Presets', claim: 'These files read and write corner presets.', by: 'agent:structure', status: 'proposed', members: [N('state'), N('qmorph')] },
  { id: 'overlap:qmorph', primitive: 'overlap', claim: 'quantum_morph is both modulation and preset handling.', by: 'agent:structure', status: 'proposed', sets: ['sec:mod', 'set:presets'], members: [N('qmorph')] },
  { id: 'lane:note-on', primitive: 'lane', label: 'Note-on path', claim: 'A note travels host → processor → voice allocation → SAW voice → Kuramoto core.', by: 'agent:structure', status: 'proposed', steps: ['clap_entry', 'processor', 'voicealloc', 'sawvoice', 'kcore'].map(N), source: { provenance: 'static' } },
  { id: 'lane:fx-chain', primitive: 'lane', label: 'FX chain order', claim: 'Audio runs filter → phaser → time → shaper.', by: 'agent:structure', status: 'proposed', steps: ['filter', 'phaser', 'timefx', 'mshaper'].map(N), source: { provenance: 'config', evidence: 'src/fx/fx_router.cpp: chain table (sample)' } },
  { id: 'twins:engines', primitive: 'twins', label: 'Engine interface', claim: 'SAW, CHOIR, STATION and WARP implement the same engine interface.', by: 'agent:structure', status: 'proposed', members: ['sec:saw', 'sec:choir', 'sec:station', 'sec:warp'], interface: [
    { name: 'voice in', direction: 'in', kind: 'call', peer: N('voicealloc') },
    { name: 'audio out', direction: 'out', role: 'audio', peer: N('fxrouter') },
    { name: 'param read', direction: 'out', role: 'param', peer: N('pstore') }] },
  { id: 'hub:pstore', primitive: 'hub', claim: 'param_store is the shared parameter service.', by: 'agent:structure', status: 'proposed', node: N('pstore') },
  { id: 'band:layers', primitive: 'band', claim: 'Interface sits above plugin logic, which sits above FOUNDATIONS.', by: 'agent:structure', status: 'proposed', levels: [
    { label: 'Interface', members: ['sec:ui'] },
    { label: 'Plugin logic', members: ['sec:shell', 'sec:mod', 'sec:dyn', 'sec:eng', 'sec:fx'] },
    { label: 'Foundations', members: ['sec:fnd'] }] },
);
const view = {
  schema: 'loupe.view/0.2', graph: { hash: gHash }, overlay: { hash: sha256(overlayText) },
  dialect: { name: 'dsp-plugin', version: '0.1' }, settings: { hubPlacement: 'group' }, elements,
  exemptions: [{ id: 'exempt:dispatch', rule: 'band.downward', pattern: { src: N('voicealloc'), dstIn: 'sec:eng', kind: 'call' }, status: 'pending', approvals: [] }],
};

const out = new URL('../schema/examples/horde-sample/', import.meta.url);
mkdirSync(out, { recursive: true });
writeFileSync(new URL('graph.json', out), graphText);
writeFileSync(new URL('overlay.json', out), overlayText);
writeFileSync(new URL('view.json', out), canonicalDoc(view));
console.log(`graph: ${nodes.length} nodes, ${graphEdges.length} crawled edges; overlay: ${overlayEdges.length} edges; view: ${elements.length} elements`);
