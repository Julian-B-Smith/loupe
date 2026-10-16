// Mutation tests: each case breaks the sample snapshot one way and expects one error code.
// Run: node tools/loupe-check.test.mjs   (exit 1 if any case is not caught, or the clean sample fails)
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { check } from './loupe-check.mjs';
import { canonicalGraph, canonicalDoc, sha256, edgeId } from './canon.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const sample = join(here, '..', 'schema', 'examples', 'horde-sample');
const load = (f) => JSON.parse(readFileSync(join(sample, f), 'utf8'));

// Write a mutated snapshot. rebind=true re-hashes so only the intended rule fails.
function snapshot(mutate, { rebind = true } = {}) {
  const G = load('graph.json'), O = load('overlay.json'), V = load('view.json');
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
  G.crawler.configurations = [{ name: 'release', args: ['-DCMAKE_BUILD_TYPE=Release'], buildType: 'Release' }, { name: 'extra', args: ['-DFIX_EXTRA=ON'], buildType: 'Release' }];
  G.crawler.notEvaluated = [{ what: 'Windows-only sources', reason: 'configured on macOS' }];
  for (const e of G.edges) for (const ev of e.evidence) if (!ev.resolution) ev.resolution = 'exact';
  G.nodes.push({ id: 'target:engine', kind: 'target', path: 'engine', hash: 'none', targetType: 'STATIC_LIBRARY' },
               { id: 'target:plugin', kind: 'target', path: 'plugin', hash: 'none', targetType: 'EXECUTABLE' });
  const file = G.nodes.find((n) => n.kind === 'file').id;
  G.edges.push(cfgEdge('target:engine', file, 'builds', { configs: ['extra'] }), cfgEdge('target:plugin', 'target:engine', 'links'));
}
const v03 = (f) => (x) => { to03(x); f(x); };

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
  ['edge holds in an undeclared configuration', 'G7', v03(({ G }) => { G.edges.find((e) => e.kind === 'builds').configs = ['debug']; })],
  ['configuration declared twice', 'G7', v03(({ G }) => { G.crawler.configurations.push({ name: 'release', args: [] }); })],
  ['builds edge from a file', 'G8', v03(({ G }) => { const f = G.nodes.find((n) => n.kind === 'file').id; G.edges.push(cfgEdge(f, 'target:engine', 'builds')); })],
  ['links edge to a file', 'G8', v03(({ G }) => { const f = G.nodes.find((n) => n.kind === 'file').id; G.edges.push(cfgEdge('target:engine', f, 'links')); })],
  ['an include touching a target', 'G8', v03(({ G }) => { const f = G.nodes.find((n) => n.kind === 'file').id; G.edges.push({ id: edgeId(f, 'target:plugin', 'include'), src: f, dst: 'target:plugin', kind: 'include', provenance: 'static', evidence: [{ type: 'site', path: 'x', line: 1, resolution: 'exact' }] }); })],
  ['target without targetType', 'G8', v03(({ G }) => { delete G.nodes.find((n) => n.id === 'target:engine').targetType; })],
  ['offset on a top-level section and a level passes', null, ({ V }) => { const top = V.elements.find((e) => e.primitive === 'section' && !e.parent); V.settings.offsets = { [top.id]: { dx: 10, dy: 0 }, 'level:0': { dx: 0, dy: 5 } }; }],
  ['offset on a nested section', 'V8', ({ V }) => { const nested = V.elements.find((e) => e.primitive === 'section' && e.parent); V.settings.offsets = { [nested.id]: { dx: 1, dy: 1 } }; }],
  ['offset on a level that does not exist', 'V8', ({ V }) => { V.settings.offsets = { 'level:99': { dx: 1, dy: 1 } }; }],
  ['offset without dy', 'S1', ({ V }) => { V.settings.offsets = { gutter: { dx: 1 } }; }],
];

let failed = 0;
for (const [name, code, mutate, opts] of cases) {
  const d = snapshot(mutate, opts);
  // Schema validation on for every case: without schemaDir, S1 cases could never fail (gap found 2026-10-16).
  const { errors } = check(d, { schemaDir: join(here, '..', 'schema') });
  rmSync(d, { recursive: true });
  const ok = code === null ? errors.length === 0 : errors.some((e) => e.startsWith(code + ' '));
  if (!ok) failed++;
  console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${code ? ` → ${code}` : ''}${ok ? '' : `  got: ${errors.slice(0, 2).join(' | ') || 'no errors'}`}`);
}
console.log(failed ? `${failed} case(s) not caught` : `all ${cases.length} cases behave`);
process.exit(failed ? 1 : 0);
