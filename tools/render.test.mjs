// Headless render test (Q-017; critic, 2026-10-16: no oracle ran render(), so a crash at one zoom level passed every
// layout test). Renders the design view with a stub DOM at each level of detail and asserts the conservation meter
// balances: every node and edge accounted for in the frame that was actually built.
// Run: node tools/render.test.mjs
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';

// The DOM render() touches: one canvas for text width, one <svg>, the container's size. Nothing else is needed.
const svg = { setAttribute() {}, getAttribute: () => 'l1', style: {}, innerHTML: '' };
globalThis.document = { createElement: () => ({ getContext: () => ({ font: '', measureText: () => ({ width: 27 * 7.2 }) }) }), createElementNS: () => svg, fonts: null };
const container = { querySelector: () => svg, appendChild() {}, clientWidth: 1440, clientHeight: 900 };

const { indexSnapshot } = await import('../design/prototype/snapshot.js');
const { render } = await import('../design/prototype/render.js');
const { conserve } = await import('../design/prototype/standins.js');

let failed = 0;
const check = (name, cond) => { console.log(`${cond ? 'pass' : 'FAIL'}  ${name}`); if (!cond) failed++; };
const j = (p) => JSON.parse(readFileSync(p, 'utf8'));
const snap = (dir, edit = (raw) => raw) => {
  const raw = edit({ graph: j(dir + 'graph.json'), overlay: j(dir + 'overlay.json'), view: j(dir + 'view.json') });
  return indexSnapshot({ ...raw, stages: null, diff: null, hashes: {} });
};
const ZOOMS = [{ auto: true }, { k: 1, x: 0, y: 0 }, { k: 0.5, x: 0, y: 0 }, { k: 0.2, x: 0, y: 0 }];
function sweep(name, data, extra = {}) {
  const bad = [];
  for (const zoom of ZOOMS) for (const lens of [null, 'operational']) {
    const state = { view: 'design', stage: 2, settings: {}, zoom, ...(lens ? { lens } : {}), ...extra };
    try {
      const map = render(container, data, state);
      const c = conserve(data, state, map);
      if (c.status === 'broken') bad.push(`${JSON.stringify(zoom)}${lens ? ' lens' : ''}: ${c.unaccounted.slice(0, 2).join(', ')}`);
    } catch (e) { bad.push(`${JSON.stringify(zoom)}${lens ? ' lens' : ''}: threw ${e.message}`); }
  }
  check(`${name}: renders and balances at every level of detail, with and without a lens${bad.length ? ' — ' + bad.join(' | ') : ''}`, bad.length === 0);
}

sweep('crawler snapshot, every file loose', snap('design/prototype/snapshots/cmake-basic-crawl/'));
// The critic's case: some files homed, some loose, an edge between them (structure zoom crashed here).
sweep('mixed view: sectioned and loose files', snap('schema/examples/horde-sample/', (raw) => {
  const top = raw.view.elements.find((e) => e.primitive === 'section' && !e.parent);
  top.members = top.members.slice(2);
  return raw;
}));
// HORDE's size with an empty view: the loose block folds; the fold row (or the block, zoomed out) stands in.
const big = snap('schema/examples/horde-probe/', (raw) => ({ ...raw, view: { ...raw.view, elements: [] } }));
sweep('large empty view (folded loose block)', big);
sweep('large empty view, unfolded', big, { unfolded: ['loose'] });

// Node kinds (Q-019): never two kinds that look alike, never two nodes of one kind with the same label.
for (const dir of ['design/prototype/snapshots/horde-crawl/', 'design/prototype/snapshots/cmake-basic-crawl/', 'schema/examples/horde-probe/', 'schema/examples/horde-sample/']) {
  const d = snap(dir), seen = new Map(), dups = [];
  for (const id of d.nodeIds) { const n = d.nodes[id], k = n.kind + '|' + n.label; if (seen.has(k)) dups.push(`${seen.get(k)} / ${id}`); else seen.set(k, id); }
  check(`${dir}: no two nodes of one kind share a label${dups.length ? ' — ' + dups.slice(0, 3).join(', ') : ''}`, dups.length === 0);
}
{
  const d = snap('design/prototype/snapshots/cmake-basic-crawl/');
  render(container, d, { view: 'design', stage: 2, settings: {}, zoom: { k: 1.2, x: 0, y: 0 } });
  const html = svg.innerHTML;
  const nodeG = (id) => (html.split(`data-node="${id}"`)[1] || '').split('</g>')[0];
  // The body itself must be the pill (the chip is a pill too, so matching "radius-pill" anywhere proved nothing).
  check('a build target\'s body is a pill, and a "target" chip names it', /style="rx:var\(--loupe-radius-pill\);fill:var\(--loupe-surface-group\)/.test(nodeG('target:lut')) && />target</.test(html));
  check('a missing node is drawn dashed, and a file is not', /stroke-dasharray:2 4/.test(nodeG('miss:vector')) && !/stroke-dasharray:2 4/.test(nodeG('file:src/engine.cpp')));
  check('engine.h and engine.cpp are told apart by their labels', />engine\.h</.test(html) && />engine\.cpp</.test(html));
}
// Drawn labels (Julian, 2026-10-17: unique at detail zoom): what the frame shows, not only the data. Middle-cut keeps
// the distinguishing end ("HYPERSAW-impl" and "HYPERSAW_auv2" both read "HYPERSAW…" with an end-cut).
const drawnLabels = (html) => {
  const out = new Map();
  for (const part of html.split('<g data-node="').slice(1)) {
    const id = part.slice(0, part.indexOf('"')), m = /letter-spacing:var\(--loupe-tracking-node-label\)[^>]*>([^<]*)<\/text>/.exec(part.split('<g data-node="')[0]);
    if (m && m[1]) out.set(id, m[1]);
  }
  return out;
};
for (const dir of ['design/prototype/snapshots/horde-crawl/', 'design/prototype/snapshots/cmake-basic-crawl/', 'schema/examples/horde-probe/', 'schema/examples/horde-sample/']) {
  const d = snap(dir), bad = [];
  for (const view of ['design', 'flow']) {
    render(container, d, { view, stage: 2, settings: {}, unfolded: ['loose', ...d.sections], zoom: { k: 1, x: 0, y: 0 } });
    const seen = new Map();
    for (const [id, t] of drawnLabels(svg.innerHTML)) { const k = (d.nodes[id] ? d.nodes[id].kind : '?') + '|' + t; if (seen.has(k)) bad.push(`${view}: ${seen.get(k)} / ${id} both "${t}"`); else seen.set(k, id); }
  }
  check(`${dir}: at detail zoom no two drawn labels of one kind read the same${bad.length ? ' — ' + bad.length + ', e.g. ' + bad.slice(0, 2).join('; ') : ''}`, bad.length === 0);
}
{ // kinds through every path: isolate ports, packages vs missing, artifacts, ghosts
  const { kindStyle } = await import('../design/prototype/render.js');
  const pk = kindStyle({ kind: 'external' }), ms = kindStyle({ kind: 'missing', missing: { reason: 'external' } });
  check('a package and a missing external file have different bodies (critic)', pk.fill !== ms.fill);
  check('an artifact is not described as missing (critic)', !/not in the tree/.test(kindStyle({ kind: 'artifact' }).title) && kindStyle({ kind: 'artifact' }).fill !== kindStyle({ kind: 'file' }).fill);
  const d = snap('schema/examples/horde-probe/'), sec = 'sec:artifacts';
  // Open every section port (by its key) so file ports, including the missing ones, are drawn.
  const first = render(container, d, { view: 'design', stage: 2, settings: {}, isolate: sec, zoom: { k: 1, x: 0, y: 0 } });
  const keys = Object.values(first.layout.iso.ports).filter((P) => P.kind === 'section').map((P) => P.key);
  render(container, d, { view: 'design', stage: 2, settings: {}, isolate: sec, isoOpen: keys, zoom: { k: 1, x: 0, y: 0 } });
  const html = svg.innerHTML, gen = d.nodeIds.find((id) => d.nodes[id].kind === 'missing' && /<g data-node="/.test(html) && html.includes(`data-node="${id}"`));
  const portG = gen ? (html.split(`data-node="${gen}"`)[1] || '').split('</g>')[0] : '';
  check('an isolate port of a missing node is drawn dashed, not as a file (critic)', !!gen && /stroke-dasharray:2 4/.test(portG));
}
// Every component's loupe-spec block validates against schema/loupe-spec.schema.json. design/system/README.md says
// they are validated; until Q-019 nothing did (the node spec was edited to v3 here, so the gap mattered).
{
  const Ajv = createRequire(import.meta.url)('ajv');
  const validate = new Ajv({ strict: false, allErrors: true }).compile(j('schema/loupe-spec.schema.json'));
  const bad = [];
  for (const c of readdirSync('design/system/components')) {
    const f = `design/system/components/${c}/README.md`;
    if (!existsSync(f)) continue;
    for (const m of readFileSync(f, 'utf8').matchAll(/```loupe-spec\n([\s\S]*?)\n```/g)) {
      let spec; try { spec = JSON.parse(m[1]); } catch (e) { bad.push(`${c}: not JSON`); continue; }
      if (!validate(spec)) bad.push(`${c}: ${validate.errors[0].instancePath} ${validate.errors[0].message}`);
    }
  }
  check(`every component loupe-spec block validates against its schema${bad.length ? ' — ' + bad.join('; ') : ''}`, bad.length === 0);
}
// ADR 0029, Q-011: every ×N bundle drawn opens to exactly the edges the meter attributes to it. For each frame: the
// N on the pill, the inspector's list (inspect.js bundleEdges) and the meter's record agree, and no edge the meter
// counts as folded into a bundle lacks a drawn bundle to open.
{
  const { bundleEdges } = await import('../design/prototype/inspect.js');
  const unesc = (x) => x.replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  let frames = 0, bundles = 0, iso = 0;
  const bad = [];
  const dirs = ['design/prototype/snapshots/horde-crawl/', 'schema/examples/horde-probe/', 'schema/examples/horde-sample/', 'design/prototype/snapshots/cmake-basic-crawl/'];
  // The independent check (critic M1): from graph data and the layout alone, never from the meter's record, each
  // listed edge must run from the bundle's first end to its second. A wrong key in render() would make the line, the
  // pill, the list and the meter agree and all be wrong; this is what catches it (and the arrow's direction).
  const inEnd = (data, P, end, x) => {
    const k = end.slice(0, 2), id = end.slice(2);
    if (k === 'n:') return x === id;
    if (k === 's:') return data.descendants(id).includes(data.home[x]);
    if (k === 'f:') return !!(P.folds[id] && P.folds[id].members.includes(x));
    if (end === 'o:lens') return !!(P.lens && !P.lens.inside.has(x));
    if (end === 'o:loose') return !!(P.loose && P.loose.members.includes(x));
    if (k === 'p:') return !!(P.iso && (P.iso.portOf.in[x] === id || P.iso.portOf.out[x] === id));
    return false;
  };
  for (const dir of dirs) {
    const data = snap(dir), tops = data.sections.filter((s) => !data.parentOf[s]);
    const states = [...ZOOMS.flatMap((zoom) => [null, 'operational'].map((lens) => ({ zoom, ...(lens ? { lens } : {}) }))),
      ...tops.map((isolate) => ({ zoom: { auto: true }, isolate }))]; // isolate: port bundles and the elsewhere fold (critic M2)
    for (const extra of states) {
      const state = { view: 'design', stage: 2, settings: {}, ...extra };
      const map = render(container, data, state), html = svg.innerHTML, P = map.layout;
      frames++;
      const pills = [...html.matchAll(/<g data-bundle="([^"]*)" data-count="(\d+)"/g)].map((x) => [unesc(x[1]), Number(x[2])]);
      const paths = [...html.matchAll(/<path data-bundle="([^"]*)"/g)].map((x) => unesc(x[1]));
      const drawn = new Map(pills);
      // One pill and one line per bundle (critic L4): a pill drawn twice, or a line without its pill, is a finding.
      if (drawn.size !== pills.length || paths.length !== pills.length || paths.some((k) => !drawn.has(k))) bad.push(`${dir}: ${pills.length} pills, ${drawn.size} distinct, ${paths.length} lines`);
      for (const [key, n] of drawn) {
        bundles++;
        const listed = bundleEdges(data, map, key), ids = listed.map((e) => e.id).sort();
        const meter = Object.entries(map.edges).filter(([, m]) => m.via === 'folded' && m.bundle === key).map(([id]) => id).sort();
        if (listed.length !== n || JSON.stringify(ids) !== JSON.stringify(meter)) bad.push(`${dir} ${key}: pill ${n}, listed ${listed.length}, meter ${meter.length}`);
        const cut = key.indexOf('>', 2), a = key.slice(0, cut), b = key.slice(cut + 1);
        const wrong = listed.filter((e) => !inEnd(data, P, a, e.src) || !inEnd(data, P, b, e.dst));
        if (wrong.length) bad.push(`${dir} ${key}: ${wrong.length} listed edges do not run from ${a} to ${b} (e.g. ${wrong[0].src} -> ${wrong[0].dst})`);
      }
      const orphan = [...new Set(Object.values(map.edges).filter((m) => m.via === 'folded' && m.bundle !== 'elsewhere').map((m) => m.bundle))].filter((k) => !drawn.has(k));
      if (orphan.length) bad.push(`${dir}: folded into a bundle nothing draws: ${orphan.slice(0, 2).join(', ')}`);
      if (extra.isolate) iso++;
    }
  }
  check(`every ×N bundle opens to exactly the edges the meter attributes to it, each running between its two ends (${bundles} bundles, ${frames} frames, ${iso} isolated)${bad.length ? ' — ' + bad.slice(0, 3).join(' | ') : ''}`, bad.length === 0 && bundles > 0 && iso > 0);
}

// Q-028 (ADR 0029, the rest of its rule): every drawn element that stands for several edges (fold row, port, elsewhere
// chip, overview loose block) opens to the edges whose recorded ends name it. Its stated count (data-count: the "N
// edges" it shows) equals that list, and each listed edge has an end inside the element by graph data and the layout
// alone. Over all recorded ends (section boxes too), no edge names an element it does not touch. Buses: the panel's
// list (the view's `edges`) equals the edges the meter counts in that bus.
{
  const { heldEdges } = await import('../design/prototype/inspect.js');
  const unesc = (x) => x.replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  const touches = (data, P, state, key, e) => {
    if (key === 'elsewhere') { const ins = P.iso && P.iso.inside; return !!ins && !ins.has(e.src) && !ins.has(e.dst); }
    const at = (x) => {
      const k = key.slice(0, 2), id = key.slice(2);
      if (k === 'n:') return x === id;
      if (k === 's:') return data.descendants(id).includes(data.home[x]);
      if (k === 'f:') return !!(P.folds[id] && P.folds[id].members.includes(x));
      if (key === 'o:lens') return !!(P.lens && !P.lens.inside.has(x));
      if (key === 'o:loose') return !!(P.loose && P.loose.members.includes(x));
      if (k === 'p:') return !!(P.iso && (P.iso.portOf.in[x] === id || P.iso.portOf.out[x] === id));
      return false;
    };
    return at(e.src) || at(e.dst);
  };
  let elements = 0, ends = 0, buses = 0;
  const bad = [];
  const dirs = ['design/prototype/snapshots/horde-crawl/', 'schema/examples/horde-probe/', 'schema/examples/horde-sample/', 'design/prototype/snapshots/horde-sample/', 'design/prototype/snapshots/cmake-basic-crawl/'];
  for (const dir of dirs) {
    let data; try { data = snap(dir); } catch { continue; }
    const tops = data.sections.filter((s) => !data.parentOf[s]);
    // Every top isolated, then with each of its section ports open (critic H2: the first test never opened a port);
    // collapsed tops, and a collapsed child inside a collapsed parent (critic M2).
    const openPorts = (isolate) => { const m = render(container, data, { view: 'design', stage: 2, settings: {}, zoom: { auto: true }, isolate });
      return Object.values(m.layout.iso.ports).filter((p) => p.kind === 'section').map((p) => p.key); };
    const child = data.sections.find((s) => data.parentOf[s]);
    const states = [...ZOOMS.flatMap((zoom) => [null, 'operational'].map((lens) => ({ zoom, ...(lens ? { lens } : {}) }))),
      ...tops.map((isolate) => ({ zoom: { auto: true }, isolate })), ...tops.map((isolate) => ({ zoom: { auto: true }, isolate, isoOpen: openPorts(isolate) })),
      { zoom: { auto: true }, collapsed: tops.slice(0, 3) }, ...(child ? [{ zoom: { auto: true }, collapsed: [child] }, { zoom: { auto: true }, collapsed: [child, data.parentOf[child]] }] : [])];
    for (const extra of states) {
      const state = { view: 'design', stage: 2, settings: {}, ...extra };
      const map = render(container, data, state), html = svg.innerHTML, P = map.layout;
      for (const x of html.matchAll(/data-holds="([^"]*)"(?: data-count="(\d+)")?/g)) {
        const key = unesc(x[1]), list = heldEdges(data, map, key);
        elements++;
        if (x[2] != null && Number(x[2]) !== list.length) bad.push(`${dir} ${key}: shows ${x[2]} edges, holds ${list.length}`);
        const wrong = list.filter((e) => !touches(data, P, state, key, e));
        if (wrong.length) bad.push(`${dir} ${key}: ${wrong.length} listed edges do not touch it (e.g. ${wrong[0].src} -> ${wrong[0].dst})`);
      }
      const keys = new Set(Object.values(map.edges).flatMap((m) => m.ends || []));
      for (const key of keys) {
        if (key.startsWith('n:')) continue; // a single file: its edges are its own, drawn as lines
        ends++;
        const wrong = heldEdges(data, map, key).filter((e) => !touches(data, P, state, key, e));
        if (wrong.length) bad.push(`${dir} end ${key}: ${wrong.length} edges name it but do not touch it`);
      }
      // Buses (critic H3, no filter): the count on the rail's label equals the edges the meter counts on that rail.
      const railCounts = new Map([...html.matchAll(/data-el="([^"]*)" data-bus-count="(\d+)"/g)].map((x) => [unesc(x[1]), Number(x[2])]));
      for (const b of (data.byPrimitive.bus || [])) {
        const counted = Object.entries(map.edges).filter(([, m]) => m.via === 'bus' && m.bus === b).length;
        if (!counted && !railCounts.has(b)) continue; // not drawn as a rail in this frame
        buses++;
        if (railCounts.get(b) !== counted) bad.push(`${dir} bus ${b}: the rail says ${railCounts.get(b)}, the meter counts ${counted} on it`);
      }
      // A box that replaces its contents (collapsed, or a top in the overview) holds every edge touching its files,
      // not merely edges that touch it (critic M2: under-listing passed). Without lens or isolate, which re-route.
      if (!extra.lens && !extra.isolate) {
        const outer = (x) => { for (let p = data.parentOf[x]; p; p = data.parentOf[p]) if ((extra.collapsed || []).includes(p)) return true; return false; };
        const boxes = [...(extra.collapsed || []).filter((x) => !outer(x)), ...(map.lod === 'overview' ? tops : [])];
        for (const X of new Set(boxes)) {
          if (!P.sections[X]) continue;
          const under = new Set(data.descendants(X));
          const want = data.edges.filter((e) => under.has(data.home[e.src]) || under.has(data.home[e.dst])).length, got = heldEdges(data, map, 's:' + X).length;
          if (want !== got) bad.push(`${dir} box ${X}${map.lod === 'overview' ? ' (overview)' : ' (collapsed)'}: ${want} edges touch its files, it holds ${got}`);
        }
      }
      const unrecorded = Object.entries(map.edges).filter(([, m]) => !m.ends).map(([id]) => id);
      if (unrecorded.length) bad.push(`${dir}: ${unrecorded.length} routed edges without recorded ends`);
    }
  }
  check(`every element standing for several edges opens to exactly them (${elements} elements, ${ends} element ends, ${buses} bus frames)${bad.length ? ' — ' + bad.slice(0, 3).join(' | ') : ''}`, bad.length === 0 && elements > 0);
}

// Every inline script in the viewers' HTML parses (Q-028: a template-literal slip broke the whole viewer while every
// other test, which imports only the .js modules, stayed green). Module scripts are checked as modules.
{
  const { spawnSync } = await import('node:child_process'), { mkdtempSync, writeFileSync: wf, rmSync } = await import('node:fs'), { join } = await import('node:path'), { tmpdir } = await import('node:os');
  const t = mkdtempSync(join(tmpdir(), 'loupe-pages-')), bad = [];
  let n = 0;
  try {
    for (const page of ['design/prototype/index.html', 'viewer/index.html', 'docs/plan-map.html', 'prototype/index.html']) {
      let html; try { html = readFileSync(page, 'utf8'); } catch { continue; }
      for (const m of html.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
        if (/\ssrc=/.test(m[1] || '') || !m[2].trim()) continue;
        const f = join(t, `s${n++}.${/type=["']module["']/.test(m[1] || '') ? 'mjs' : 'cjs'}`);
        wf(f, m[2]);
        const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
        if (r.status !== 0) bad.push(`${page}: ${(r.stderr.split('\n').find((l) => /Error/.test(l)) || 'does not parse').trim()}`);
      }
    }
  } finally { rmSync(t, { recursive: true, force: true }); }
  check(`every inline script in the viewer pages parses (${n} scripts)${bad.length ? ' — ' + bad.join(' | ') : ''}`, bad.length === 0 && n > 0);
}

console.log(failed ? `${failed} failed` : 'all render cases behave');
process.exit(failed ? 1 : 0);
