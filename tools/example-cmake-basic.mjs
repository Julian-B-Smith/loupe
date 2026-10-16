#!/usr/bin/env node
// Regenerates schema/examples/cmake-basic-0.3 from the build layer's golden facts (fixtures/cmake-basic.facts.golden.json),
// following the facts-to-0.3 table in docs/graph-schema.md. A stand-in until the crawler emits graph.json itself
// (P1a slice 2): it exists so the 0.3 schema is proven able to hold the build facts, and so the example can be rebuilt
// when the fixture changes instead of edited by hand. Regenerating schema/examples is a human gate (CLAUDE.md).
// Run: node tools/example-cmake-basic.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalGraph, canonicalDoc, sha256, edgeId } from './canon.mjs';
const R = join(dirname(fileURLToPath(import.meta.url)), '..');
const F = JSON.parse(readFileSync(join(R, 'fixtures/cmake-basic.facts.golden.json'), 'utf8'));
const FX = join(R, 'fixtures/cmake-basic');
const files = ['CMakeLists.txt', 'lib/CMakeLists.txt', 'lib/gen_lut.py', 'lib/lut.cpp', 'lib/lut.csv', 'src/engine.cpp', 'src/engine.h', 'src/extra.cpp', 'src/plugin_entry.cpp', 'src/win_only.cpp', 'tests/engine_test.cpp', 'tools/gen_table.py'];
const excluded = [{ reason: 'docs', count: 1, byExt: { '.md': 1 } }, { reason: 'loupe-config', count: 1, byExt: { '.json': 1 } }];
const langOf = (p) => /\.(cpp|h)$/.test(p) ? 'cpp' : p.endsWith('.py') ? 'python' : p.endsWith('.csv') ? 'csv' : 'cmake';
const roleOf = (p) => p.startsWith('tests/') ? ['test', 'path:tests/'] : p.endsWith('.py') ? ['generator', 'path:*.py'] : p.endsWith('.csv') ? ['data', 'path:*.csv'] : p.endsWith('CMakeLists.txt') ? ['build', 'path:CMakeLists.txt'] : ['product', 'default'];
const nodes = files.map((p) => { const t = readFileSync(join(FX, p)); const [role, roleRule] = roleOf(p);
  return { id: 'file:' + p, kind: 'file', path: p, hash: 'sha256:' + createHash('sha256').update(t).digest('hex'), lang: langOf(p), loc: t.toString().split('\n').length - (t.toString().endsWith('\n') ? 1 : 0), role, roleRule }; });
const cfgs = F.configurations.map((c) => c.name).sort();
const narrow = (cs) => { const s = [...cs].sort(); return s.length === cfgs.length ? undefined : s; };
const nodeOf = (p) => p.startsWith('${build}/') ? 'miss:' + p : p.startsWith('${external}/') ? 'miss:' + p : 'file:' + p;
const miss = new Map();
const needMiss = (p, reason, note) => { if (!miss.has(p)) miss.set(p, { id: 'miss:' + p, kind: 'missing', path: p, hash: 'none', missing: note ? { reason, note } : { reason } }); };
// targets: union over configurations; a target absent from some gets configs
const tseen = new Map();
for (const pc of F.perConfiguration) for (const t of pc.targets) { const x = tseen.get(t.name) || { types: new Set(), cs: [] }; x.types.add(t.type); x.cs.push(pc.name); tseen.set(t.name, x); }
for (const [name, x] of tseen) { if (x.types.size !== 1) throw new Error('type differs across configs: ' + name);
  const n = { id: 'target:' + name, kind: 'target', path: name, hash: 'none', targetType: [...x.types][0] }; const c = narrow(x.cs); if (c) n.configs = c; nodes.push(n); }
// The facts do not yet record where each target is defined (gap for the emitter); read from the fixture by hand.
const defIn = (t) => t.startsWith('lut') ? 'lib/CMakeLists.txt' : 'CMakeLists.txt';
const edges = [];
const add = (src, dst, kind, ev, cs) => { const e = { id: edgeId(src, dst, kind), src, dst, kind, provenance: 'config', evidence: ev }; if (cs) e.configs = cs; edges.push(e); };
for (const m of F.membership) {
  if (m.source.startsWith('${build}/')) needMiss(m.source, 'generated');
  else if (m.source.startsWith('${external}/')) needMiss(m.source, 'external', 'source outside the repo, listed by the build');
  add('target:' + m.target, nodeOf(m.source), 'builds', [{ type: 'config', path: defIn(m.target), key: `target ${m.target} sources`, resolution: 'build' }], narrow(m.configs));
}
const deps = new Map();
for (const pc of F.perConfiguration) for (const t of pc.targets) for (const d of t.dependencies) { const k = t.name + '>' + d; deps.set(k, [...(deps.get(k) || []), pc.name]); }
for (const [k, cs] of deps) { const [a, b] = k.split('>'); add('target:' + a, 'target:' + b, 'depends', [{ type: 'config', path: defIn(a), key: `target ${a} dependencies`, resolution: 'build' }], narrow(cs)); }
// custom commands: each tracked DEPENDS file -> each OUTPUT and BYPRODUCT (generates). Commands with no OUTPUT/BYPRODUCTS make no edge.
const ccs = new Map();
for (const pc of F.perConfiguration) for (const c of pc.customCommands) { const k = JSON.stringify(c); ccs.set(k, [...(ccs.get(k) || []), pc.name]); }
for (const [k, cs] of ccs) { const c = JSON.parse(k); const outs = [...c.outputs, ...c.byproducts];
  for (const o of outs) { needMiss(o, 'generated'); for (const d of c.depends) if (!d.startsWith('name:'))
    add('file:' + d, 'miss:' + o, 'generates', [{ type: 'config', path: c.file, key: `add_custom_command line ${c.line}`, resolution: 'build' }], narrow(cs)); } }
nodes.push(...miss.values());
const G = { schema: 'loupe.graph/0.3', source: { repo: 'github.com/Julian-B-Smith/loupe', commit: '3342617757efe8203d70a27c2948010636d66db7', commitTime: '2026-10-16T03:30:26-04:00', dirty: false },
  crawler: { name: 'loupe-example', version: '0.0.0', granularity: 'file', languages: ['cmake', 'cpp', 'csv', 'python'], dialect: { name: 'none', version: '0' },
    scope: { include: ['fixtures/cmake-basic/**'], exclude: ['**/*.md (docs)', '.loupe/** (loupe-config)'], resolution: 'build' },
    inventory: { files: files.length + 2, crawled: files.length, excluded },
    configurations: F.configurations,
    notEvaluated: [...F.unclaimedSources.map((p) => ({ what: p, reason: 'tracked source claimed by no target in any declared configuration (may be platform-only)' })),
                   { what: 'include and call edges', reason: 'hand-built example of the build layer only; the syntax layer comes next (P1a slice 2)' }] },
  nodes, edges };
const g = canonicalGraph(G);
const O = { schema: 'loupe.overlay/0.2', graph: { hash: sha256(g) }, edges: [], roles: [], conditions: [] };
const o = canonicalDoc(O);
const sec = (id, label, members, claim) => ({ id, primitive: 'section', label, members, claim, by: 'human:example' });
const top = (dir) => nodes.filter((n) => n.kind === 'file' && (dir === '.' ? !n.path.includes('/') : n.path.startsWith(dir + '/'))).map((n) => n.id);
const V = { schema: 'loupe.view/0.2', dialect: { name: 'none', version: '0' }, graph: { hash: sha256(g) }, overlay: { hash: sha256(o) }, settings: { hubPlacement: 'group' }, exemptions: [],
  elements: [sec('sec:root', '(root)', top('.'), 'Files at the fixture root.'), sec('sec:src', 'src', top('src'), 'Files under src.'), sec('sec:lib', 'lib', top('lib'), 'Files under lib.'),
    sec('sec:tests', 'tests', top('tests'), 'Files under tests.'), sec('sec:tools', 'tools', top('tools'), 'Files under tools.'),
    sec('sec:targets', 'build targets', nodes.filter((n) => n.kind === 'target').map((n) => n.id), 'The targets CMake defines, in every declared configuration.'),
    sec('sec:outside', 'generated and outside', [...miss.values()].map((n) => n.id), 'Build outputs and sources outside the repo: referenced by the build, not in the tree.')] };
const out = join(R, 'schema/examples/cmake-basic-0.3'); mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'graph.json'), g); writeFileSync(join(out, 'overlay.json'), o); writeFileSync(join(out, 'view.json'), canonicalDoc(V));
console.log(nodes.length, 'nodes', edges.length, 'edges');
