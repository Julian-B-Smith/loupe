// Mutation tests: each case breaks the sample snapshot one way and expects one error code.
// Run: node tools/loupe-check.test.mjs   (exit 1 if any case is not caught, or the clean sample fails)
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { check } from './loupe-check.mjs';
import { canonicalGraph, canonicalDoc, sha256 } from './canon.mjs';

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
];

let failed = 0;
for (const [name, code, mutate, opts] of cases) {
  const d = snapshot(mutate, opts);
  const { errors } = check(d, {});
  rmSync(d, { recursive: true });
  const ok = code === null ? errors.length === 0 : errors.some((e) => e.startsWith(code + ' '));
  if (!ok) failed++;
  console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${code ? ` → ${code}` : ''}${ok ? '' : `  got: ${errors.slice(0, 2).join(' | ') || 'no errors'}`}`);
}
console.log(failed ? `${failed} case(s) not caught` : `all ${cases.length} cases behave`);
process.exit(failed ? 1 : 0);
