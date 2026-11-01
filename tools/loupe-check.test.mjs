// Mutation tests: each case breaks the sample snapshot one way and expects one error code.
// Run: node tools/loupe-check.test.mjs   (exit 1 if any case is not caught, or the clean sample fails)
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { check } from './loupe-check.mjs';
import { canonicalGraph, canonicalDoc, sha256, edgeId } from './canon.mjs';
import { indexSnapshot } from '../design/prototype/snapshot.js';
import { layout } from '../design/prototype/layout.js';
import { adapt, FORMAT } from './engine-structure.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const sample = join(here, '..', 'schema', 'examples', 'horde-sample');
const load = (f) => JSON.parse(readFileSync(join(sample, f), 'utf8'));

// Write a mutated snapshot. rebind=true re-hashes so only the intended rule fails.
function snapshot(mutate, { rebind = true, base = null } = {}) {
  const [G, O, V] = base ? base() : [load('graph.json'), load('overlay.json'), load('view.json')];
  mutate({ G, O, V });
  const d = mkdtempSync(join(tmpdir(), 'loupe-'));
  const g = canonicalGraph(G);
  if (rebind) { O.graph.hash = sha256(g); }
  const o = canonicalDoc(O);
  if (rebind) { V.graph.hash = sha256(g); V.overlay.hash = sha256(o); }
  writeFileSync(join(d, 'graph.json'), g); writeFileSync(join(d, 'overlay.json'), o); writeFileSync(join(d, 'view.json'), canonicalDoc(V));
  return d;
}
const sec = (V, id) => V.elements.find((e) => e.id === id);

// Schema 0.3 (ADRs 0026-0028): turn the 0.2 sample into a valid 0.3 graph, so each 0.3 case breaks one rule only.
const buildEv = (key) => [{ type: 'config', path: 'CMakeLists.txt', key, resolution: 'build' }];
const cfgEdge = (src, dst, kind, extra = {}) => ({ id: edgeId(src, dst, kind), src, dst, kind, provenance: 'config', evidence: buildEv(`${kind} ${src}`), ...extra });
function to03({ G }) {
  G.schema = 'loupe.graph/0.3';
  G.crawler.configurations = [{ name: 'release', args: ['-DCMAKE_BUILD_TYPE=Release'], buildType: 'Release' }, { name: 'extra', args: ['-DFIX_EXTRA=ON'], buildType: 'Release' }, { name: 'debug', args: ['-DCMAKE_BUILD_TYPE=Debug'], buildType: 'Debug' }];
  G.crawler.notEvaluated = [{ what: 'Windows-only sources', reason: 'configured on macOS' }];
  for (const e of G.edges) for (const ev of e.evidence) if (!ev.resolution) ev.resolution = 'exact';
  G.nodes.push({ id: 'target:engine', kind: 'target', path: 'engine', hash: 'none', targetType: 'STATIC_LIBRARY' },
               { id: 'target:plugin', kind: 'target', path: 'plugin', hash: 'none', targetType: 'EXECUTABLE' });
  const file = G.nodes.find((n) => n.kind === 'file').id;
  G.edges.push(cfgEdge('target:engine', file, 'builds', { configs: ['extra'] }), cfgEdge('target:plugin', 'target:engine', 'depends'));
}
const v03 = (f) => (x) => { to03(x); f(x); };
const aFile = (G) => G.nodes.find((n) => n.kind === 'file').id;
// Put `via` on the first static site, resolved through a build include path unless told otherwise.
const via = (G, viaId, resolution = 'build') => { const ev = G.edges.find((e) => e.provenance === 'static').evidence.find((x) => x.type === 'site'); ev.resolution = resolution; ev.via = [viaId.replace(/^file:/, '')]; };
const T = (G, id) => G.nodes.find((n) => n.id === id);
// A 0.3.2 graph with one generates edge (a script and a data file make one header), each side marked as given.
const gen = (G, progAs = 'program', dataAs = 'input', site = false) => {
  G.schema = 'loupe.graph/0.3.2';
  const [a, b] = G.nodes.filter((n) => n.kind === 'file').map((n) => n.id), out = 'miss:${build}/gen.h';
  G.nodes.push({ id: out, kind: 'missing', path: '${build}/gen.h', hash: 'none', missing: { reason: 'generated' } });
  const ev = (as) => [site ? { type: 'site', path: a.slice(5), line: 1, resolution: 'exact', as } : { type: 'config', path: 'CMakeLists.txt', key: 'add_custom_command line 1', resolution: 'build', as }];
  G.edges.push({ id: edgeId(a, out, 'generates'), src: a, dst: out, kind: 'generates', provenance: site ? 'static' : 'config', evidence: ev(progAs) },
               { id: edgeId(b, out, 'generates'), src: b, dst: out, kind: 'generates', provenance: 'config', evidence: [{ type: 'config', path: 'CMakeLists.txt', key: 'add_custom_command line 1', resolution: 'build', as: dataAs }] });
  if (dataAs === null) delete G.edges.find((e) => e.kind === 'generates' && e.src === b).evidence[0].as; // null: leave it out
};
// V9 needs real geometry: lay the sample out, then drag the second top-level section onto the first.
function dragOnto({ G, O, V }) {
  const P = layout(indexSnapshot({ graph: G, overlay: O, view: V, stages: null, diff: null, hashes: {} }), { view: 'design', settings: {}, offsets: {} });
  const [a, b] = V.elements.filter((e) => e.primitive === 'section' && !e.parent).map((e) => e.id).filter((id) => P.sections[id]);
  V.settings.offsets = { [b]: { dx: P.sections[a].x - P.sections[b].x + 5, dy: P.sections[a].y - P.sections[b].y + 5 } };
}

// Schema 0.4 (Q-015): a small declaration, read by the adapter itself, so each D case breaks one rule of a graph that is
// valid. instrument holds voice and fx; voice holds osc and a reserved slot; osc holds member; host is external.
const decl04 = () => {
  const it = (id, parent, extra = {}) => ({ id, label: id, parent, kind: 'block', scope: 'engine', multiplicity: null, cites: ['S-1'], ...extra });
  const ed = (from, to, kind) => ({ id: `${from}->${to}`, from, to, kind, label: '', cites: ['S-2'] });
  const items = [it('instrument', null), it('voice', 'instrument', { multiplicity: 'many' }), it('osc', 'voice'), it('member', 'osc'), it('fx', 'instrument'), it('spare', 'voice', { kind: 'slot' }), it('host', null, { scope: 'external' })];
  const edges = [ed('host', 'voice', 'event'), ed('member', 'fx', 'audio'), ed('fx', 'host', 'audio'), ed('osc', 'member', 'modulation')];
  const out = adapt({ format: FORMAT, spec: { path: 'spec.md', blob: 'b'.repeat(40) }, counts: { items: { block: 6, slot: 1 }, scope: { engine: 6, external: 1 }, edges: { audio: 2, event: 1, modulation: 1 }, stages: 2 },
    edge_kinds: ['audio', 'control', 'event', 'modulation', 'observation'], items, edges, signal_path: [{ stage: 'in', ids: ['host', 'host->voice'] }, { stage: 'out', ids: ['fx->host'] }] },
    { commit: 'c'.repeat(40), commitTime: '2026-01-01T00:00:00+00:00', blob: 'a'.repeat(40) });
  return [JSON.parse(out['graph.json']), JSON.parse(out['overlay.json']), JSON.parse(out['view.json'])];
};
// opts for a D case: the rule must fire on its own, so schema validation is off for the ones the schema would also refuse.
const d04n = { base: decl04, schema: false };
const D = (G, id) => G.nodes.find((n) => n.id === 'decl:' + id);

const cases = [
  ['clean sample passes', null, () => {}],
  ['edge id not derived from src|dst|kind', 'G3', ({ G }) => { G.edges[0].id = 'e:0000000000000000'; }],
  ['edge to a missing node', 'G3', ({ G }) => { G.nodes = G.nodes.filter((n) => n.id !== 'file:src/fx/phaser.cpp'); }],
  ['static edge without a site', 'G4', ({ G }) => { G.edges[0].evidence = [{ type: 'config', path: 'x', key: 'y' }]; }],
  ['overlay bound to another graph', 'O1', ({ O }) => { O.graph.hash = 'sha256:' + '0'.repeat(64); }, { rebind: false }],
  ['overlay overrides a crawled edge', 'O2', ({ G, O }) => { const e = G.edges[0]; O.edges.push({ id: e.id, src: e.src, dst: e.dst, kind: e.kind, provenance: 'inferred', evidence: [{ type: 'inference', agent: 'a', rationale: 'r' }] }); }],
  ['overlay provenance weaker than its evidence', 'O3', ({ O }) => { O.edges[0].evidence.push({ type: 'trace', trace: 't', observed: 2 }); }],
  ['node homed in two sections', 'V3', ({ V }) => { sec(V, 'sec:ui').members.push('file:src/fx/phaser.cpp'); }],
  ['section parent cycle', 'V3', ({ V }) => { sec(V, 'sec:eng').parent = 'sec:saw'; }],
  ['edge in two buses', 'V4', ({ V }) => { sec(V, 'bus:mod').edges.push(sec(V, 'bus:param').edges[0]); }],
  ['static lane with a missing step edge', 'V5', ({ V }) => { sec(V, 'lane:fx-chain').source = { provenance: 'static' }; }],
  ['config lane with no named source', 'V5', ({ V }) => { delete sec(V, 'lane:fx-chain').source.evidence; }],
  ['intentional loop without evidence', 'V6', ({ V }) => { V.elements.push({ id: 'loop:k', primitive: 'loop', claim: 'c', by: 'agent:a', cycle: ['file:src/engines/saw/kuramoto_core.cpp'], classification: 'intentional' }); }],
  ['circular loop that is not a cycle', 'V6', ({ V }) => { V.elements.push({ id: 'loop:x', primitive: 'loop', claim: 'c', by: 'agent:a', cycle: ['file:src/fx/filter.cpp', 'file:src/fx/phaser.cpp'], classification: 'circular' }); }],
  ['exemption established too early', 'V7', ({ V }) => { V.exemptions[0].status = 'established'; V.exemptions[0].approvals = [{ by: 'julian' }]; }],
  ['inventory does not close', 'G5', ({ G }) => { G.crawler.inventory.files += 3; }],
  ['inventory crawled count disagrees with file nodes', 'G5', ({ G }) => { G.crawler.inventory.crawled += 1; G.crawler.inventory.files += 1; }],
  ['missing node without a reason', 'G6', ({ G }) => { G.nodes.push({ id: 'miss:src/gen.h', kind: 'missing', path: 'src/gen.h', hash: 'none' }); }],
  ['generated missing node with no generator', 'G6', ({ G }) => { G.nodes.push({ id: 'miss:src/gen.h', kind: 'missing', path: 'src/gen.h', hash: 'none', missing: { reason: 'generated' } }); }],
  ['element referencing a missing element', 'V2', ({ V }) => { sec(V, 'twins:engines').members.push('sec:nope'); }],
  // ---- schema 0.3 (Q-010)
  ['a valid 0.3 graph passes', null, v03(() => {})],
  ['0.3 without configurations', 'S1', v03(({ G }) => { delete G.crawler.configurations; })],
  ['0.3 evidence without resolution', 'S1', v03(({ G }) => { delete G.edges[0].evidence[0].resolution; })],
  ['0.3 resolution outside the closed list', 'S1', v03(({ G }) => { G.edges[0].evidence[0].resolution = 'guessed'; })],
  ['edge holds in an undeclared configuration', 'G7', v03(({ G }) => { G.edges.find((e) => e.kind === 'builds').configs = ['nightly']; })],
  ['configuration declared twice', 'G7', v03(({ G }) => { G.crawler.configurations.push({ name: 'release', args: [] }); })],
  ['builds edge from a file', 'G8', v03(({ G }) => { const f = G.nodes.find((n) => n.kind === 'file').id; G.edges.push(cfgEdge(f, 'target:engine', 'builds')); })],
  ['depends edge to a file', 'G8', v03(({ G }) => { G.edges.push(cfgEdge('target:engine', aFile(G), 'depends')); })],
  ['depends edge from a target to itself', 'G8', v03(({ G }) => { G.edges.push(cfgEdge('target:engine', 'target:engine', 'depends')); })],
  ['generates from a target (a custom command) passes', null, v03(({ G }) => { G.edges.push(cfgEdge('target:plugin', aFile(G), 'generates')); })],
  ['generates ending at a target', 'G8', v03(({ G }) => { G.edges.push(cfgEdge('target:plugin', 'target:engine', 'generates')); })],
  ['builds evidence resolved by search', 'G8', v03(({ G }) => { G.edges.find((e) => e.kind === 'builds').evidence[0].resolution = 'search'; })],
  ["target whose path is not its name", 'G8', v03(({ G }) => { T(G, 'target:engine').path = 'lib/engine'; })],
  ['targetType on a file', 'G8', v03(({ G }) => { T(G, aFile(G)).targetType = 'EXECUTABLE'; })],
  ['configs on a file', 'G8', v03(({ G }) => { T(G, aFile(G)).configs = ['extra']; })],
  ['a target that exists in some configurations passes', null, v03(({ G }) => { T(G, 'target:engine').configs = ['extra', 'release']; G.edges.find((e) => e.kind === 'depends').configs = ['extra', 'release']; })],
  ['an edge holding where its target does not exist', 'G7', v03(({ G }) => { T(G, 'target:engine').configs = ['extra']; G.edges.find((e) => e.kind === 'depends').configs = ['release']; })],
  ['configs unsorted', 'G7', v03(({ G }) => { G.edges.find((e) => e.kind === 'builds').configs = ['release', 'extra']; })],
  ['configs listing every configuration', 'G7', v03(({ G }) => { G.edges.find((e) => e.kind === 'builds').configs = ['debug', 'extra', 'release']; })],
  ['0.3 without notEvaluated', 'S1', v03(({ G }) => { delete G.crawler.notEvaluated; })],
  ['0.2 graph with a target node', 'S1', ({ G }) => { G.nodes.push({ id: 'target:engine', kind: 'target', path: 'engine', hash: 'none', targetType: 'STATIC_LIBRARY' }); }],
  ['0.2 graph with a 0.3 resolution', 'S1', ({ G }) => { G.edges[0].evidence[0].resolution = 'syntactic'; }],
  ['0.2 graph with configurations', 'S1', ({ G }) => { G.crawler.configurations = [{ name: 'a', args: [] }]; }],
  ['a target placed in a section passes', null, v03(({ V }) => { V.elements.find((e) => e.primitive === 'section' && !e.parent).members.push('target:engine'); })],
  ['an include touching a target', 'G8', v03(({ G }) => { const f = G.nodes.find((n) => n.kind === 'file').id; G.edges.push({ id: edgeId(f, 'target:plugin', 'include'), src: f, dst: 'target:plugin', kind: 'include', provenance: 'static', evidence: [{ type: 'site', path: 'x', line: 1, resolution: 'exact' }] }); })],
  ['target without targetType', 'G8', v03(({ G }) => { delete G.nodes.find((n) => n.id === 'target:engine').targetType; })],
  // ---- schema 0.3.1: via (Q-016)
  ['0.3.1 with via on a build site passes', null, v03(({ G }) => { G.schema = 'loupe.graph/0.3.1'; via(G, aFile(G)); })],
  ['via in a graph declaring 0.3', 'S1', v03(({ G }) => { via(G, aFile(G)); })],
  ['via in a graph declaring 0.2', 'S1', ({ G }) => { const ev = G.edges.find((e) => e.provenance === 'static').evidence.find((x) => x.type === 'site'); ev.via = [G.nodes.find((n) => n.kind === 'file').id.slice(5)]; }],
  ['0.3.1 with site configs matching the edge passes', null, v03(({ G }) => { G.schema = 'loupe.graph/0.3.1'; const e = G.edges.find((x) => x.provenance === 'static'); for (const x of e.evidence) if (x.type === 'site') x.configs = ['extra']; e.configs = ['extra']; })],
  ['site configs whose union is not the edge configs', 'G7', v03(({ G }) => { G.schema = 'loupe.graph/0.3.1'; const e = G.edges.find((x) => x.provenance === 'static'); for (const x of e.evidence) if (x.type === 'site') x.configs = ['extra']; })],
  ['site configs in a graph declaring 0.3', 'S1', v03(({ G }) => { G.edges.find((x) => x.provenance === 'static').evidence[0].configs = ['extra']; })],
  ['0.3.1 without notEvaluated', 'S1', v03(({ G }) => { G.schema = 'loupe.graph/0.3.1'; delete G.crawler.notEvaluated; })],
  ['via naming a file not in the graph', 'G9', v03(({ G }) => { G.schema = 'loupe.graph/0.3.1'; via(G, 'nowhere.cpp'); })],
  ['via on a site resolved exactly', 'G9', v03(({ G }) => { G.schema = 'loupe.graph/0.3.1'; via(G, aFile(G), 'exact'); })],
  // ---- schema 0.3.2: as on generates evidence (Q-009)
  ['0.3.2 with a program and an input passes', null, v03(({ G }) => gen(G))],
  ['0.3.2 with code writing a file (a program site) passes', null, v03(({ G }) => gen(G, 'program', 'input', true))],
  ['as in a graph declaring 0.3.1', 'S1', v03(({ G }) => { gen(G); G.schema = 'loupe.graph/0.3.1'; })],
  ['as in a graph declaring 0.2', 'S1', ({ G }) => { G.edges.find((e) => e.evidence.length).evidence[0].as = 'input'; }],
  ['as that is neither program nor input', 'S1', v03(({ G }) => gen(G, 'tool'))],
  ['0.3.2 generates evidence without as', 'G10', v03(({ G }) => gen(G, 'program', null))],
  ['as on an edge that is not generates', 'G10', v03(({ G }) => { G.schema = 'loupe.graph/0.3.2'; G.edges.find((e) => e.kind === 'builds').evidence[0].as = 'input'; })],
  ['code writing a file marked as an input', 'G10', v03(({ G }) => gen(G, 'input', 'input', true))],
  ['offset on a top-level section and a level passes', null, ({ V }) => { const top = V.elements.find((e) => e.primitive === 'section' && !e.parent); V.settings.offsets = { [top.id]: { dx: 10, dy: 0 }, 'level:0': { dx: 0, dy: 5 } }; }],
  ['twins of top-level sections (no shared parent)', 'V10', ({ V }) => { for (const id of sec(V, 'twins:engines').members) delete sec(V, id).parent; }],
  ['twins split across two parents', 'V10', ({ V }) => { sec(V, sec(V, 'twins:engines').members[0]).parent = 'sec:fx'; }],
  ['offset on a nested section', 'V8', ({ V }) => { const nested = V.elements.find((e) => e.primitive === 'section' && e.parent); V.settings.offsets = { [nested.id]: { dx: 1, dy: 1 } }; }],
  ['offset on a level that does not exist', 'V8', ({ V }) => { V.settings.offsets = { 'level:99': { dx: 1, dy: 1 } }; }],
  ['offset on level:00 (an alias the layout does not read)', 'V8', ({ V }) => { V.settings.offsets = { 'level:00': { dx: 1, dy: 1 } }; }],
  ['offsets that make two sections overlap', 'V9', dragOnto],
  ['offset without dy', 'S1', ({ V }) => { V.settings.offsets = { gutter: { dx: 1 } }; }],
  // ---- schema 0.4: declaration graphs (Q-015, rules D1 to D7)
  ['a valid 0.4 declaration graph passes', null, () => {}, { base: decl04 }],
  ['D1 declaration graph without declaration', 'D1', ({ G }) => { delete G.declaration; }, d04n],
  ['D1 declaration graph that also has a crawler', 'D1', ({ G }) => { G.crawler = load('graph.json').crawler; }, d04n],
  ['D1 crawl that has a declaration', 'D1', ({ G }) => { G.declaration = decl04()[0].declaration; }, { schema: false }],
  ['D1 crawl without a crawler', 'D1', ({ G }) => { delete G.crawler; }, { schema: false }],
  ['D2 declaration node that is a file', 'D2', ({ G }) => { D(G, 'fx').kind = 'file'; }, d04n],
  ['D2 declaration node without declared', 'D2', ({ G }) => { delete D(G, 'fx').declared; }, d04n],
  ['D2 declaration node whose id is not its declared id', 'D2', ({ G }) => { D(G, 'fx').declared.id = 'other'; }, d04n],
  ['D2 declaration edge that is static', 'D2', ({ G }) => { G.edges[0].provenance = 'static'; }, d04n],
  ['D2 declaration edge with site evidence', 'D2', ({ G }) => { G.edges[0].evidence[0] = { type: 'site', path: 'x', line: 1 }; }, d04n],
  ['D2 declaration edge without declared', 'D2', ({ G }) => { delete G.edges[0].declared; }, d04n],
  ['D2 block node in a crawl', 'D2', ({ G }) => { G.nodes.push({ id: 'decl:x', kind: 'block', declared: decl04()[0].nodes[0].declared }); }, { schema: false }],
  ['D2 declared edge in a crawl', 'D2', ({ G }) => { G.edges[0].provenance = 'declared'; }, { schema: false }],
  ['D3 parent that names nothing', 'D3', ({ G }) => { D(G, 'fx').declared.parent = 'ghost'; }, d04n],
  ['D3 parent cycle', 'D3', ({ G }) => { D(G, 'instrument').declared.parent = 'member'; }, d04n],
  ['D3 a block its own parent', 'D3', ({ G }) => { D(G, 'fx').declared.parent = 'fx'; }, d04n],
  ['D4 stage ref that names nothing', 'D4', ({ G }) => { G.declaration.signalPath[0].refs[0] = 'decl:ghost'; }, d04n],
  ['D4 stage ref to an edge that is not there', 'D4', ({ G }) => { G.declaration.signalPath[1].refs[0] = 'e:0000000000000000'; }, d04n],
  ['D4 stage with fewer refs than ids', 'D4', ({ G }) => { G.declaration.signalPath[0].refs.pop(); }, d04n],
  ['D5 node citing nothing', 'D5', ({ G }) => { D(G, 'fx').declared.cites = []; }, d04n],
  ['D5 edge citing nothing', 'D5', ({ G }) => { G.edges[0].declared.cites = []; }, d04n],
  ['D6 counts that say one block too many', 'D6', ({ G }) => { G.declaration.counts.items.block++; }, d04n],
  ['D6 counts that say one edge too few', 'D6', ({ G }) => { G.declaration.counts.edges.audio--; }, d04n],
  ['D6 a node the counts do not know', 'D6', ({ G }) => { G.nodes.push({ id: 'decl:extra', kind: 'block', declared: { id: 'extra', label: 'x', scope: 'engine', multiplicity: null, parent: null, cites: ['S-1'] } }); }, d04n],
  ['D6 counts of a different scope', 'D6', ({ G }) => { G.declaration.counts.scope = { engine: 7 }; }, d04n],
  ['D6 stage count that is not the stages', 'D6', ({ G }) => { G.declaration.counts.stages = 3; }, d04n],
  ['D7 section that is not a declared parent', 'D7', ({ V }) => { V.elements.push({ id: 'sec:fx', primitive: 'section', claim: 'c', by: 'adapter:x', status: 'declared', members: ['decl:fx'] }); }, d04n],
  ['D7 section with a member that is not its child', 'D7', ({ V }) => { const s = V.elements.find((e) => e.id === 'sec:osc'); s.members.push('decl:fx'); }, d04n],
  ['D7 section missing a child', 'D7', ({ V }) => { const s = V.elements.find((e) => e.id === 'sec:voice'); s.members = s.members.filter((m) => m !== 'decl:spare'); }, d04n],
  ['D7 section nested under the wrong section', 'D7', ({ V }) => { V.elements.find((e) => e.id === 'sec:osc').parent = 'sec:instrument'; }, d04n],
  ['D7 section no longer under its declared parent', 'D7', ({ V }) => { delete V.elements.find((e) => e.id === 'sec:osc').parent; }, d04n],
  ['D7 section whose status is not declared', 'D7', ({ V }) => { V.elements.find((e) => e.id === 'sec:osc').status = 'confirmed'; }, d04n],
  ['0.4 node with a path and a hash', 'S1', ({ G }) => { Object.assign(D(G, 'fx'), { path: 'fx', hash: 'none' }); }, { base: decl04 }],
  ['0.4 edge with a crawl kind', 'S1', ({ G }) => { G.edges[0].kind = 'include'; }, { base: decl04 }],
  ['0.4 edge with crawl provenance', 'S1', ({ G }) => { G.edges[0].provenance = 'config'; }, { base: decl04 }],
  ['0.4 node without declared.cites', 'S1', ({ G }) => { delete D(G, 'fx').declared.cites; }, { base: decl04 }],
  ['0.4 graph with a crawler', 'S1', ({ G }) => { G.crawler = load('graph.json').crawler; }, { base: decl04 }],
  ['0.4 graph without declaration', 'S1', ({ G }) => { delete G.declaration; }, { base: decl04 }],
  ['0.3.2 crawl carrying a declaration', 'S1', v03(({ G }) => { G.schema = 'loupe.graph/0.3.2'; G.declaration = decl04()[0].declaration; })],
  ['0.2 crawl with a block node', 'S1', ({ G }) => { G.nodes.push({ id: 'decl:x', kind: 'block', path: 'x', hash: 'none' }); }],
  ['0.3 crawl edge with declared provenance', 'S1', v03(({ G }) => { G.edges[0].provenance = 'declared'; })],
  // ---- Julian's decisions, 2026-11-01: the declaration block decides; D7 both ways; D8; critic fixes
  ['a 0.4 crawl (crawler, no declaration) validates as a crawl', null, v03(({ G }) => { G.schema = 'loupe.graph/0.4'; })],
  ['a 0.4 crawl without crawler or declaration', 'D1', v03(({ G }) => { G.schema = 'loupe.graph/0.4'; delete G.crawler; }), { schema: false }],
  ['a declaration graph that says 0.3.2', 'D1', ({ G }) => { G.schema = 'loupe.graph/0.3.2'; }, d04n],
  ['a declaration graph that says 0.3.2 is refused by the schema too', 'S1', ({ G }) => { G.schema = 'loupe.graph/0.3.2'; }, { base: decl04 }],
  ['D2 evidence path that is not the declaration', 'D2', ({ G }) => { G.edges[0].evidence[0].path = 'other/file.json'; }, d04n],
  ['0.4 evidence path that is absolute', 'S1', ({ G }) => { G.edges[0].evidence[0].path = '/etc/passwd'; }, { base: decl04 }],
  ['0.4 evidence path that climbs out of the repo', 'S1', ({ G }) => { G.edges[0].evidence[0].path = '../x.json'; }, { base: decl04 }],
  ['0.4 declaration format outside the known list', 'S1', ({ G }) => { G.declaration.format = 'other.format/9'; }, { base: decl04 }],
  ['D4 stage ref that exists but is not what its id resolves to', 'D4', ({ G }) => { const r = G.declaration.signalPath[0].refs; r.reverse(); }, d04n],
  ['D6 one declared id on two evidence entries', 'D6', ({ G }) => { G.edges[1].evidence[0].id = G.edges[0].evidence[0].id; }, d04n],
  ['D7 declared parent with no section', 'D7', ({ V }) => { V.elements = V.elements.filter((e) => e.id !== 'sec:osc'); }, d04n],
  ['D7 section with an invented label', 'D7', ({ V }) => { V.elements.find((e) => e.id === 'sec:osc').label = 'oscillators (our word)'; }, d04n],
  ['D7 section with an invented claim', 'D7', ({ V }) => { V.elements.find((e) => e.id === 'sec:osc').claim = 'a claim nobody declared'; }, d04n],
  ['D8 a section on a crawl saying declared', 'D8', ({ V }) => { sec(V, 'sec:ui').status = 'declared'; }, { schema: false }],
  ['D8 a section on a crawl by adapter:liar', 'D8', ({ V }) => { sec(V, 'sec:ui').by = 'adapter:liar'; }, { schema: false }],
  ['D8 a set by an agent saying declared, on a declaration view', 'D8', ({ V }) => { V.elements.push({ id: 'set:x', primitive: 'set', claim: 'c', by: 'agent:x', status: 'declared', members: ['decl:fx'] }); }, d04n],
  ['a set by an agent saying declared is refused by the schema too', 'S1', ({ V }) => { V.elements.push({ id: 'set:x', primitive: 'set', claim: 'c', by: 'agent:x', status: 'declared', members: ['decl:fx'] }); }, { base: decl04 }],
  ['D8 an adapter section that is merely proposed', 'D8', ({ V }) => { V.elements.find((e) => e.id === 'sec:osc').status = 'proposed'; }, d04n],
  ['D8 an adapter set (declared) on a declaration view', 'D8', ({ V }) => { V.elements.push({ id: 'set:x', primitive: 'set', claim: 'c', by: 'adapter:x', status: 'declared', members: ['decl:fx'] }); }, d04n],
  ['a proposed set by an agent on a declaration view passes', null, ({ V }) => { V.elements.push({ id: 'set:x', primitive: 'set', claim: 'c', by: 'agent:x', status: 'proposed', members: ['decl:fx', 'decl:host'] }); }, { base: decl04 }],
  ['a proposed lane by an agent on a declaration view passes', null, ({ V }) => { V.elements.push({ id: 'lane:x', primitive: 'lane', claim: 'c', by: 'agent:x', status: 'proposed', source: { provenance: 'static' }, steps: ['decl:fx', 'decl:host'] }); }, { base: decl04 }],
  ['a band over declared nodes passes (band refs accept decl)', null, ({ V }) => { V.elements.push({ id: 'band:x', primitive: 'band', claim: 'c', by: 'agent:x', status: 'proposed', levels: [{ label: 'a', members: ['decl:fx'] }, { label: 'b', members: ['decl:host'] }] }); }, { base: decl04 }],
  ['0.4 view section with status accepted', 'S1', ({ V }) => { V.elements.find((e) => e.id === 'sec:osc').status = 'accepted'; }, { base: decl04 }],
];

let failed = 0;
for (const [name, code, mutate, opts] of cases) {
  const d = snapshot(mutate, opts);
  // Schema validation on for every case unless it says otherwise: without schemaDir, S1 cases could never fail (gap found
  // 2026-10-16). A D case turns it off so the rule itself is proven to fire, not the schema's refusal of the same fault.
  const { errors } = check(d, { schemaDir: opts && opts.schema === false ? undefined : join(here, '..', 'schema') });
  rmSync(d, { recursive: true });
  const ok = code === null ? errors.length === 0 : errors.some((e) => e.startsWith(code + ' '));
  if (!ok) failed++;
  console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${code ? ` → ${code}` : ''}${ok ? '' : `  got: ${errors.slice(0, 2).join(' | ') || 'no errors'}`}`);
}
// S0: a schema that does not compile is an error, never reported as "install ajv" (the old catch hid it).
{
  const bad = mkdtempSync(join(tmpdir(), 'loupe-schema-'));
  for (const f of ['graph', 'overlay', 'view']) writeFileSync(join(bad, `${f}.schema.json`), readFileSync(join(here, '..', 'schema', `${f}.schema.json`)));
  writeFileSync(join(bad, 'graph.schema.json'), '{"type": 5}');
  const d = snapshot(() => {});
  const { errors, notes } = check(d, { schemaDir: bad });
  rmSync(d, { recursive: true }); rmSync(bad, { recursive: true });
  const ok = errors.some((e) => e.startsWith('S0 ')) && !notes.some((n) => /install ajv/.test(n));
  if (!ok) failed++;
  console.log(`${ok ? 'pass' : 'FAIL'}  a schema that does not compile → S0${ok ? '' : `  got: ${errors.join(' | ') || 'no errors'}`}`);
}
console.log(failed ? `${failed} case(s) not caught` : `all ${cases.length + 1} cases behave`);
process.exit(failed ? 1 : 0);
