#!/usr/bin/env node
// Loupe snapshot checker. Deterministic, no network, no clock.
// Usage: node tools/loupe-check.mjs <snapshot dir containing graph.json, overlay.json, view.json>
// Exit 0 = clean, 1 = errors. Schema validation runs when the `ajv` package is installed.
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { canonicalGraph, canonicalDoc, sha256, edgeId } from './canon.mjs';
const require = createRequire(import.meta.url);

export function check(dir, { schemaDir } = {}) {
  const errors = [], notes = [];
  const err = (code, msg) => errors.push(`${code} ${msg}`);
  const read = (f) => readFileSync(join(dir, f), 'utf8');
  const gText = read('graph.json'), oText = read('overlay.json'), vText = read('view.json');
  const G = JSON.parse(gText), O = JSON.parse(oText), V = JSON.parse(vText);

  // ---- schema (optional dependency)
  if (schemaDir) {
    try {
      const Ajv = require('ajv');
      const ajv = new Ajv({ strict: false, allErrors: true });
      for (const [name, doc] of [['graph', G], ['overlay', O], ['view', V]]) {
        const validate = ajv.compile(JSON.parse(readFileSync(join(schemaDir, `${name}.schema.json`), 'utf8')));
        if (!validate(doc)) for (const e of validate.errors.slice(0, 10)) err('S1', `${name}${e.instancePath} ${e.message}`);
      }
    } catch { notes.push('schema validation skipped (install ajv to enable)'); }
  }

  // ---- graph: canonical, ids, references
  if (canonicalGraph(G) !== gText) err('G1', 'graph.json is not in canonical form');
  const gHash = sha256(gText);
  const nodes = new Map();
  for (const n of G.nodes) {
    if (nodes.has(n.id)) err('G2', `duplicate node ${n.id}`);
    nodes.set(n.id, n);
    const prefix = { file: 'file:', symbol: 'sym:', external: 'ext:', artifact: 'art:', missing: 'miss:' }[n.kind];
    if (!n.id.startsWith(prefix)) err('G2', `node ${n.id} id prefix does not match kind ${n.kind}`);
    if (n.parent && !G.nodes.some((m) => m.id === n.parent)) err('G2', `node ${n.id} parent ${n.parent} missing`);
  }
  const edges = new Map();
  for (const e of G.edges) {
    if (edges.has(e.id)) err('G3', `duplicate edge ${e.id}`);
    if (e.id !== edgeId(e.src, e.dst, e.kind)) err('G3', `edge ${e.id} id does not match sha256(src|dst|kind)`);
    if (!nodes.has(e.src) || !nodes.has(e.dst)) err('G3', `edge ${e.id} endpoint missing`);
    const types = new Set(e.evidence.map((x) => x.type));
    if (e.provenance === 'static' && !types.has('site')) err('G4', `static edge ${e.id} has no site evidence`);
    if (e.provenance === 'config' && !types.has('config')) err('G4', `config edge ${e.id} has no config evidence`);
    edges.set(e.id, { ...e, layer: 'graph' });
  }

  // ---- inventory closes: every repo file is crawled or counted as excluded
  const inv = G.crawler && G.crawler.inventory;
  if (inv) {
    const excl = inv.excluded.reduce((a, x) => a + x.count, 0);
    if (inv.files !== inv.crawled + excl) err('G5', `inventory does not close: ${inv.files} files ≠ ${inv.crawled} crawled + ${excl} excluded`);
    const fileNodes = G.nodes.filter((n) => n.kind === 'file').length;
    if (inv.crawled !== fileNodes) err('G5', `inventory says ${inv.crawled} crawled but the graph has ${fileNodes} file nodes`);
    for (const x of inv.excluded) if (x.byExt && Object.values(x.byExt).reduce((a, b) => a + b, 0) !== x.count) err('G5', `excluded "${x.reason}" byExt does not sum to its count`);
  }
  // ---- missing nodes: referenced but absent, always with a reason
  for (const n of G.nodes) {
    if (n.kind === 'missing' && !n.missing) err('G6', `missing node ${n.id} has no reason`);
    if (n.kind !== 'missing' && n.missing) err('G6', `node ${n.id} carries a missing reason but is kind ${n.kind}`);
    if (n.kind === 'missing' && n.missing && n.missing.reason === 'generated'
        && !G.edges.some((e) => e.dst === n.id && e.kind === 'generates') && !n.missing.note)
      err('G6', `missing node ${n.id} is marked generated but has no generates edge and no note`);
  }

  // ---- overlay: bound to this graph, adds but never overrides
  if (canonicalDoc(O) !== oText) err('O1', 'overlay.json is not in canonical form');
  if (O.graph.hash !== gHash) err('O1', 'overlay is bound to a different graph hash');
  const rank = { runtime: 3, annotated: 2, inferred: 1 };
  const evRank = { trace: 3, annotation: 2, inference: 1 };
  for (const e of O.edges) {
    if (e.id !== edgeId(e.src, e.dst, e.kind)) err('O2', `overlay edge ${e.id} id does not match sha256(src|dst|kind)`);
    if (edges.has(e.id)) err('O2', `overlay edge ${e.id} collides with an existing edge`);
    if (!nodes.has(e.src) || !nodes.has(e.dst)) err('O2', `overlay edge ${e.id} endpoint missing`);
    const strongest = Math.max(...e.evidence.map((x) => evRank[x.type]));
    if (rank[e.provenance] !== strongest) err('O3', `overlay edge ${e.id} provenance ${e.provenance} is not its strongest evidence`);
    edges.set(e.id, { ...e, layer: 'overlay' });
  }
  for (const r of O.roles) if (!edges.has(r.edge)) err('O4', `role on missing edge ${r.edge}`);
  for (const c of O.conditions) if (!edges.has(c.edge)) err('O4', `condition on missing edge ${c.edge}`);

  // ---- view
  if (canonicalDoc(V) !== vText) err('V1', 'view.json is not in canonical form');
  if (V.graph.hash !== gHash) err('V1', 'view is bound to a different graph hash');
  if (V.overlay && V.overlay.hash !== sha256(oText)) err('V1', 'view is bound to a different overlay hash');
  const els = new Map();
  for (const el of V.elements) { if (els.has(el.id)) err('V2', `duplicate element ${el.id}`); els.set(el.id, el); }
  const isA = (id, ...kinds) => els.has(id) && kinds.includes(els.get(id).primitive);
  const needNode = (el, id) => { if (!nodes.has(id)) err('V2', `${el.id} references missing node ${id}`); };
  const needEdge = (el, id) => { if (!edges.has(id)) err('V2', `${el.id} references missing edge ${id}`); };
  const needEl = (el, id, ...kinds) => { if (!isA(id, ...kinds)) err('V2', `${el.id} references ${id}, which is not a ${kinds.join('/')}`); };
  const adj = new Set([...edges.values()].map((e) => `${e.src}>${e.dst}`));
  const home = new Map(), busOf = new Map();

  for (const el of V.elements) {
    switch (el.primitive) {
      case 'section':
        for (const m of el.members) {
          needNode(el, m);
          if (home.has(m)) err('V3', `node ${m} is in two sections: ${home.get(m)} and ${el.id}`);
          home.set(m, el.id);
        }
        if (el.parent) needEl(el, el.parent, 'section');
        break;
      case 'set': el.members.forEach((m) => needNode(el, m)); break;
      case 'overlap':
        el.sets.forEach((s) => needEl(el, s, 'section', 'set'));
        el.members.forEach((m) => needNode(el, m));
        break;
      case 'bus':
        for (const id of el.edges) {
          needEdge(el, id);
          if (busOf.has(id)) err('V4', `edge ${id} is in two buses: ${busOf.get(id)} and ${el.id}`);
          busOf.set(id, el.id);
          const e = edges.get(id);
          if (e && el.contract.dst && e.dst !== el.contract.dst) err('V4', `${el.id} member ${id} does not end at the contract target`);
        }
        break;
      case 'band':
        for (const lvl of el.levels) for (const m of lvl.members) {
          if (m.includes(':') && /^(file|sym|ext|art|miss):/.test(m)) needNode(el, m); else needEl(el, m, 'section', 'set');
        }
        break;
      case 'lane':
        el.steps.forEach((s) => needNode(el, s));
        if (el.source.provenance === 'static') {
          for (let i = 0; i < el.steps.length - 1; i++)
            if (!adj.has(`${el.steps[i]}>${el.steps[i + 1]}`)) err('V5', `${el.id} claims a static order but has no edge ${el.steps[i]} → ${el.steps[i + 1]}`);
        } else if (!el.source.evidence) err('V5', `${el.id} rests on ${el.source.provenance} provenance but names no source`);
        break;
      case 'twins':
        el.members.forEach((m) => needEl(el, m, 'section'));
        el.interface.forEach((p) => p.peer && needNode(el, p.peer));
        break;
      case 'hub': needNode(el, el.node); break;
      case 'loop':
        el.cycle.forEach((n) => needNode(el, n));
        if (el.classification === 'intentional' && !(el.evidence && el.evidence.length)) err('V6', `${el.id} is marked intentional without evidence`);
        if (el.classification === 'circular')
          for (let i = 0; i < el.cycle.length; i++) {
            const a = el.cycle[i], b = el.cycle[(i + 1) % el.cycle.length];
            if (!adj.has(`${a}>${b}`)) err('V6', `${el.id} is not a real cycle: no edge ${a} → ${b}`);
          }
        break;
    }
  }
  // section tree must be acyclic
  for (const el of V.elements.filter((e) => e.primitive === 'section')) {
    const seen = new Set([el.id]); let p = el.parent;
    while (p) { if (seen.has(p)) { err('V3', `section parent cycle at ${el.id}`); break; } seen.add(p); p = els.get(p)?.parent; }
  }
  for (const x of V.exemptions) {
    if (x.pattern.srcIn) needEl(x, x.pattern.srcIn, 'section', 'set');
    if (x.pattern.dstIn) needEl(x, x.pattern.dstIn, 'section', 'set');
    if (x.pattern.src) needNode(x, x.pattern.src);
    if (x.pattern.dst) needNode(x, x.pattern.dst);
    const ok = (x.explicit && x.approvals.length >= 1) || x.approvals.length >= 3;
    if (x.status === 'established' && !ok) err('V7', `${x.id} is established with ${x.approvals.length} approval(s); needs 3, or 1 marked explicit`);
  }

  // ---- conservation summary (spec level): every node is homed or loose, every edge is bussed or free
  const loose = [...nodes.keys()].filter((id) => !home.has(id));
  const byProv = {};
  for (const e of edges.values()) byProv[e.provenance] = (byProv[e.provenance] || 0) + 1;
  const summary = {
    graph: gHash, nodes: nodes.size, homed: home.size, loose: loose.length,
    edges: edges.size, crawled: G.edges.length, overlay: O.edges.length, bussed: busOf.size, free: edges.size - busOf.size,
    provenance: Object.fromEntries(Object.entries(byProv).sort()), elements: els.size,
  };
  if (summary.homed + summary.loose !== summary.nodes || summary.bussed + summary.free !== summary.edges) err('C1', 'conservation arithmetic does not close');
  return { errors, notes, summary, loose };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const dir = process.argv[2];
  if (!dir || !existsSync(join(dir, 'graph.json'))) { console.error('usage: loupe-check.mjs <snapshot dir>'); process.exit(2); }
  const schemaDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'schema');
  const { errors, notes, summary, loose } = check(dir, { schemaDir });
  console.log(JSON.stringify(summary, null, 2));
  if (loose.length) console.log(`loose nodes (allowed, shown at top level): ${loose.join(', ')}`);
  notes.forEach((n) => console.log(`note: ${n}`));
  if (errors.length) { errors.forEach((e) => console.log(`ERROR ${e}`)); process.exit(1); }
  console.log('OK');
}
