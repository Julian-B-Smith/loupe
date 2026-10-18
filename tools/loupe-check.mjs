#!/usr/bin/env node
// Loupe snapshot checker. Deterministic, no network, no clock.
// Usage: node tools/loupe-check.mjs <snapshot dir containing graph.json, overlay.json, view.json>
// Exit 0 = clean, 1 = errors. Schema validation runs when the `ajv` package is installed.
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { canonicalGraph, canonicalDoc, sha256, edgeId } from './canon.mjs';
// V9 runs the viewer's own layout (pure: no DOM, no clock) so the no-overlap rule blocks an agent's view.json edit
// deterministically, not only when someone opens the viewer (ROADMAP Q-010, decided 2026-10-16).
import { indexSnapshot } from '../design/prototype/snapshot.js';
import { layout } from '../design/prototype/layout.js';
const require = createRequire(import.meta.url);

export function check(dir, { schemaDir } = {}) {
  const errors = [], notes = [];
  const err = (code, msg) => errors.push(`${code} ${msg}`);
  const read = (f) => readFileSync(join(dir, f), 'utf8');
  const gText = read('graph.json'), oText = read('overlay.json'), vText = read('view.json');
  const G = JSON.parse(gText), O = JSON.parse(oText), V = JSON.parse(vText);

  // ---- schema (optional dependency)
  if (schemaDir) {
    // Only a missing ajv may skip validation (and ./verify makes that note fatal, DECISIONS H2). A schema that fails
    // to compile is an error: catching it here once reported "install ajv", hiding a broken schema.
    let Ajv = null;
    try { Ajv = require('ajv'); } catch { notes.push('schema validation skipped (install ajv to enable)'); }
    if (Ajv) {
      const ajv = new Ajv({ strict: false, allErrors: true });
      for (const [name, doc] of [['graph', G], ['overlay', O], ['view', V]]) {
        let validate;
        try { validate = ajv.compile(JSON.parse(readFileSync(join(schemaDir, `${name}.schema.json`), 'utf8'))); }
        catch (e) { err('S0', `${name}.schema.json does not compile: ${e.message}`); continue; }
        if (!validate(doc)) for (const e of validate.errors.slice(0, 10)) err('S1', `${name}${e.instancePath} ${e.message}`);
      }
    }
  }

  // ---- graph: canonical, ids, references
  if (canonicalGraph(G) !== gText) err('G1', 'graph.json is not in canonical form');
  const gHash = sha256(gText);
  const nodes = new Map();
  for (const n of G.nodes) {
    if (nodes.has(n.id)) err('G2', `duplicate node ${n.id}`);
    nodes.set(n.id, n);
    const prefix = { file: 'file:', symbol: 'sym:', external: 'ext:', artifact: 'art:', missing: 'miss:', target: 'target:' }[n.kind];
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
  // G7 (0.3, ADR 0026): configuration names are unique; `configs` (on edges and target nodes) names only declared
  // configurations, is sorted, and never lists all of them: "all" is spelled by omission, so one fact has one encoding
  // and diffs cannot flip between two (critic, 2026-10-16). An edge touching a target cannot hold where it is absent.
  const cfgNames = new Set();
  for (const c of G.crawler.configurations || []) { if (cfgNames.has(c.name)) err('G7', `configuration ${c.name} is declared twice`); cfgNames.add(c.name); }
  const checkConfigs = (what, cs) => {
    if (!cs) return;
    for (const c of cs) if (!cfgNames.has(c)) err('G7', `${what} holds in configuration ${c}, which the crawler does not declare`);
    if (cs.join('\u0000') !== [...cs].sort().join('\u0000')) err('G7', `${what} lists its configs unsorted`);
    if (cfgNames.size && cs.length === cfgNames.size) err('G7', `${what} lists every configuration; omit configs instead`);
  };
  for (const e of G.edges) checkConfigs(`edge ${e.id}`, e.configs);
  // 0.3.1: a site's configs follow the same rules, and the edge holds exactly where its sites do (their union).
  for (const e of G.edges) {
    const sites = e.evidence.filter((x) => x.type === 'site');
    for (const x of sites) checkConfigs(`edge ${e.id} site ${x.path}:${x.line}`, x.configs);
    if (sites.some((x) => x.configs)) {
      const union = sites.every((x) => x.configs) ? [...new Set(sites.flatMap((x) => x.configs))].sort() : null;
      const want = union && union.length < cfgNames.size ? union.join() : '';
      if ((e.configs || []).join() !== want) err('G7', `edge ${e.id} configs ${(e.configs || ['(all)']).join()} is not the union of its sites' configs`);
    }
  }
  for (const n of G.nodes) checkConfigs(`node ${n.id}`, n.configs);
  const holdsIn = (cs) => new Set(cs || cfgNames);
  for (const e of G.edges) for (const end of [e.src, e.dst]) {
    const n = nodes.get(end); if (!n || !n.configs) continue;
    const t = holdsIn(n.configs);
    for (const c of holdsIn(e.configs)) if (!t.has(c)) { err('G7', `edge ${e.id} holds in ${c}, where its target ${end} does not exist`); break; }
  }
  // G8 (0.3): build targets connect through builds (target -> a file it compiles or lists), depends (target -> another
  // target built first) and generates (a target's custom command produces a file; dropping it would hide an edge).
  // Nothing else touches a target. targetType and configs belong to targets only; a target's path is its name.
  const isTarget = (id) => nodes.get(id)?.kind === 'target';
  for (const n of G.nodes) {
    if (n.kind === 'target') {
      if (!n.targetType) err('G8', `target ${n.id} has no targetType`);
      if (n.path !== n.id.slice('target:'.length)) err('G8', `target ${n.id} has path ${n.path}; it must be the target's name`);
      for (const f of ['lang', 'loc', 'symbolKind', 'parent', 'missing']) if (n[f] != null) err('G8', `target ${n.id} carries ${f}, which only files and symbols have`);
    } else {
      if (n.targetType != null) err('G8', `node ${n.id} has a targetType but is kind ${n.kind}`);
      if (n.configs != null) err('G8', `node ${n.id} has configs but is kind ${n.kind}; only targets may`);
    }
  }
  for (const e of G.edges) {
    if (e.kind === 'builds' && (!isTarget(e.src) || isTarget(e.dst))) err('G8', `builds edge ${e.id} must run from a target to a non-target`);
    else if (e.kind === 'depends' && (!isTarget(e.src) || !isTarget(e.dst) || e.src === e.dst)) err('G8', `depends edge ${e.id} must join two different targets`);
    else if (e.kind === 'generates' && isTarget(e.dst)) err('G8', `generates edge ${e.id} ends at a target; a target is not a file`);
    else if (!['builds', 'depends', 'generates'].includes(e.kind) && (isTarget(e.src) || isTarget(e.dst))) err('G8', `${e.kind} edge ${e.id} touches a target; only builds, depends and generates may`);
    if ((e.kind === 'builds' || e.kind === 'depends') && e.evidence.some((x) => x.resolution && x.resolution !== 'build'))
      err('G8', `${e.kind} edge ${e.id} comes from the build system, so its evidence resolution must be build`);
  }

  // G9 (0.3.1): `via` names compiled sources the auditor can open (file nodes), and only on a site found through a
  // build include path; on any other resolution it would claim a compile that played no part.
  for (const e of G.edges) for (const x of e.evidence) if (x.via && x.type === 'site') {
    if (x.resolution !== 'build') err('G9', `edge ${e.id} site ${x.path}:${x.line} has via but resolution ${x.resolution}`);
    for (const v of x.via) if (nodes.get('file:' + v)?.kind !== 'file') err('G9', `edge ${e.id} site ${x.path}:${x.line} via ${v}, which is not a file in the graph`);
  }

  // G10 (0.3.2): `as` says which side of a generates edge the source is on, so the Operational lens reads the
  // crawler's fact instead of guessing from names or roles. Only on generates; in 0.3.2 on every generates evidence (a
  // missing one would let the lens silently treat build-time code as product); code that writes a file is its program.
  for (const e of G.edges) for (const x of e.evidence) {
    if (x.as != null && e.kind !== 'generates') err('G10', `${e.kind} edge ${e.id} evidence carries as=${x.as}; only generates edges may`);
    if (e.kind === 'generates' && G.schema === 'loupe.graph/0.3.2' && x.as == null) err('G10', `generates edge ${e.id} evidence ${x.path} does not say whether its source is program or input`);
    if (e.kind === 'generates' && x.type === 'site' && x.as === 'input') err('G10', `generates edge ${e.id} site ${x.path}:${x.line} is code writing a file, so its source is the program, not an input`);
  }

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
  // V8 (ADR 0020): drag offsets name a top-level section, a band level that exists, or the gutter. Levels count in
  // the first band only and are written without leading zeros, exactly as the layout reads them. Whether offsets make
  // anything overlap is V9, below, which runs the layout itself.
  {
    const offs = (V.settings && V.settings.offsets) || {};
    const band0 = V.elements.find((x) => x.primitive === 'band');
    const bandLevels = band0 ? (band0.levels || []).length : 0;
    for (const key of Object.keys(offs)) {
      const lv = /^level:(0|[1-9]\d*)$/.exec(key);
      const ok = key === 'gutter' || (lv ? +lv[1] < bandLevels : els.get(key)?.primitive === 'section' && !els.get(key).parent);
      if (!ok) err('V8', `offset key ${key} is not a top-level section, an existing level, or the gutter`);
    }
  }
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

  // V9 (ADR 0020): offsets in view.json must not make two top-level sections overlap or a section cover a centered
  // hub. Only checked on an otherwise clean snapshot: layout over broken references would report noise.
  const offs9 = (V.settings && V.settings.offsets) || {};
  if (!errors.length && Object.keys(offs9).length) {
    try {
      const d = indexSnapshot({ graph: G, overlay: O, view: V, stages: null, diff: null, hashes: {} });
      const P = layout(d, { view: 'design', settings: {}, offsets: offs9 });
      for (const [a, b] of P.overlaps) err('V9', `offsets make ${a} overlap ${b}; something may be hidden underneath`);
    } catch (e) { err('V9', `layout failed on this view: ${e.message}`); }
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
