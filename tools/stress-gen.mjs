// The ten stress cases every design must survive (docs/design-handoff.md; ROADMAP Q-029). Deterministic: no clock,
// no Math.random (the whole-repo case uses a seeded LCG), canonical JSON, so two runs are byte-identical.
//   node tools/stress-gen.mjs [out dir] [--case <name>] [--all]
// Default: the nine committed cases into design/prototype/snapshots/stress/<case>/. The 4,000-file case is never
// committed (Julian, 2026-10-27: about 4 MB); --all or --case whole-repo writes it too, into the given out dir.
// Each case is an invented repo: one graph (schema 0.3.2), an overlay (for the provenances only an overlay carries),
// a design view, and for big-diff the stand-in re-run diff (diff.sample.json, as the horde-sample has).
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalGraph, canonicalDoc, sha256, edgeId } from './canon.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LANG = { cpp: 'cpp', h: 'cpp', hpp: 'cpp', py: 'python', mjs: 'js', js: 'js', json: 'json', yml: 'yaml' };
const OVERLAY = new Set(['runtime', 'annotated', 'inferred']);

// A case is files (repo paths), edges and view elements; build() turns it into the three documents. Edge kinds
// follow the renderer's slots (render.js SPEC.slot): a role wins over the kind.
function build({ files, edges, elements, settings = { hubPlacement: 'group' }, diff = null, name }) {
  const nodes = files.map((p) => {
    const ext = p.split('.').pop(), o = { id: 'file:' + p, kind: 'file', path: p, hash: 'none' };
    if (LANG[ext]) o.lang = LANG[ext];
    return o;
  });
  const have = new Set(nodes.map((n) => n.id));
  const graphEdges = [], overlayEdges = [], seen = new Set();
  for (const e of edges) {
    for (const x of [e.src, e.dst]) if (!have.has(x)) throw new Error(`${name}: edge end ${x} is not a file of the case`);
    const id = edgeId(e.src, e.dst, e.kind);
    if (seen.has(id)) throw new Error(`${name}: duplicate edge ${e.src} ${e.kind} ${e.dst}`);
    seen.add(id);
    const prov = e.provenance || 'static', o = { id, src: e.src, dst: e.dst, kind: e.kind, provenance: prov };
    if (e.role) o.role = e.role;
    if (OVERLAY.has(prov)) {
      o.evidence = [prov === 'runtime' ? { type: 'trace', trace: 'trace:stress-001', observed: 1 }
        : prov === 'annotated' ? { type: 'annotation', author: 'stress', note: 'Invented for the stress case.' }
        : { type: 'inference', agent: 'structure', rationale: 'Invented for the stress case.' }];
      overlayEdges.push(o);
    } else {
      const path = e.src.slice(5);
      o.count = 1;
      o.evidence = [prov === 'config' ? { type: 'config', path, key: 'stress.' + e.kind, resolution: 'exact' } : { type: 'site', path, line: 1, resolution: 'exact' }];
      // A role rule reads the callee signature on a site; config evidence has no signature, so its role is by config.
      if (e.role) { o.roleRule = `dsp-plugin/${e.role}-by-${prov === 'config' ? 'config' : 'signature'}`; if (prov !== 'config') o.evidence[0].signature = SIG[e.role]; }
      graphEdges.push(o);
    }
  }
  const langs = [...new Set(nodes.map((n) => n.lang).filter(Boolean))].sort();
  const graph = {
    schema: 'loupe.graph/0.3.2',
    source: { repo: 'stress/' + name, commit: 'sample', commitTime: '2026-10-27T00:00:00Z', dirty: false },
    crawler: { name: 'loupe-stress', version: '0.0.0-stress', granularity: 'file', languages: langs, dialect: { name: 'dsp-plugin', version: '0.1' },
      scope: { include: ['**/*'], exclude: [], resolution: 'heuristic' },
      inventory: { files: nodes.length, crawled: nodes.length, excluded: [] }, configurations: [{ name: 'default', buildType: 'Release', args: [] }], notEvaluated: [] },
    nodes, edges: graphEdges,
  };
  const graphText = canonicalGraph(graph);
  const overlay = { schema: 'loupe.overlay/0.2', graph: { hash: sha256(graphText) }, edges: overlayEdges.sort((a, b) => (a.id < b.id ? -1 : 1)), roles: [], conditions: [] };
  const overlayText = canonicalDoc(overlay);
  const view = { schema: 'loupe.view/0.2', graph: { hash: sha256(graphText) }, overlay: { hash: sha256(overlayText) },
    dialect: { name: 'dsp-plugin', version: '0.1' }, settings, exemptions: [],
    elements: elements.map((el) => ({ by: 'agent:structure', status: 'proposed', ...el })) };
  const out = { 'graph.json': graphText, 'overlay.json': overlayText, 'view.json': canonicalDoc(view) };
  if (diff) out['diff.sample.json'] = canonicalDoc({ schema: 'loupe.diff-sample/0', note: 'Stand-in re-run diff for the big-diff stress case.', ...diff });
  return out;
}
const SIG = { audio: 'render(AudioBlock&)', param: 'ParamStore::read(ParamId)', mod: 'ModTarget::apply(IntentId, depth)' };
const F = (p) => 'file:' + p;
const sec = (id, label, members, extra = {}) => ({ id: 'sec:' + id, primitive: 'section', label, claim: `${label} (stress case).`, members: members.map(F), ...extra });
const range = (n) => Array.from({ length: n }, (_, i) => i);
const pad = (i) => String(i + 1).padStart(2, '0');

// Seeded LCG (Numerical Recipes constants). Deterministic across platforms: 32-bit integer arithmetic only.
function lcg(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

export const CASES = {
  // Truncation and tooltip: 48-character stems that share long prefixes and suffixes, so a plain end-cut would make
  // several of them read the same; a 48-character section label too.
  'long-names'() {
    // Every stem is exactly 48 characters and the word that tells them apart sits in the middle, so only a cut that
    // keeps it (or the tooltip) can tell them apart: no padding to lean on (critic: "echo" was padded with "xx").
    const stem = (mid) => { const s = `spectral_resynthesis_${mid}_partial_tracker_`; return s + 'implementation_stage'.slice(0, 48 - s.length); };
    const mids = ['alpha', 'bravo', 'charlie', 'delta', 'kilo', 'foxtrot'];
    const longs = mids.map((m) => `src/dsp/${stem(m)}.cpp`);
    const shared = range(4).map((i) => `src/dsp/${'oversampled_polyphase_halfband_filter_bank_stage'.slice(0, 47)}${i}.h`);
    const shorts = ['src/dsp/fft.cpp', 'src/dsp/window.h'];
    const host = ['src/host/plugin_entry_point_for_every_supported_host_format.cpp', 'src/host/main.cpp'];
    const files = [...longs, ...shared, ...shorts, ...host];
    const edges = [...longs.map((p, i) => ({ src: F(p), dst: F(shared[i % 4]), kind: 'include' })), ...longs.map((p) => ({ src: F(host[0]), dst: F(p), kind: 'call' })),
      ...shared.map((p) => ({ src: F(p), dst: F(shorts[1]), kind: 'include' })), { src: F(shorts[0]), dst: F(shorts[1]), kind: 'include' }, { src: F(host[1]), dst: F(host[0]), kind: 'call' }];
    return { files, edges, elements: [sec('dsp', 'Spectral resynthesis and partial tracking engine', [...longs, ...shared, ...shorts]), sec('host', 'Host', host)] };
  },
  // Rail length, tap spacing, count label: 50 voices render into one mixer through one audio contract.
  // The voices sit in five banks of ten so the bus spec's merge (past 20 taps on one side, one tap per section) shows;
  // two of bank E's edges are runtime, so its taps split by provenance (each tap keeps its own pattern).
  'big-bus'() {
    const banks = ['a', 'b', 'c', 'd', 'e'], voices = banks.flatMap((b) => range(10).map((i) => `src/voices/${b}/voice_${b}${pad(i)}.cpp`)), mix = 'src/mix/mixer.cpp', out = 'src/mix/output.cpp';
    const edges = [...voices.map((v, i) => ({ src: F(v), dst: F(mix), kind: 'call', role: 'audio', ...(i >= 48 ? { provenance: 'runtime' } : {}) })), { src: F(mix), dst: F(out), kind: 'call' }];
    return { files: [...voices, mix, out], edges, elements: [...banks.map((b, i) => sec('voices-' + b, 'Voices ' + b.toUpperCase(), voices.slice(i * 10, i * 10 + 10))), sec('mix', 'Mix', [mix, out]),
      { id: 'bus:audio', primitive: 'bus', label: 'Audio bus', claim: 'Every voice renders into the mixer through one contract.', edges: edges.slice(0, 50).map((e) => edgeId(e.src, e.dst, e.kind)), contract: { dst: F(mix), role: 'audio', signature: SIG.audio } }] };
  },
  // Spoke crowding, badge placement: 40 files in four sections include one registry header.
  'wide-hub'() {
    const groups = ['ui', 'dsp', 'io', 'state'], hub = 'src/core/registry.h', core = ['src/core/registry.cpp', hub];
    const members = Object.fromEntries(groups.map((g) => [g, range(10).map((i) => `src/${g}/${g}_${pad(i)}.cpp`)]));
    const edges = [...groups.flatMap((g) => members[g].map((p) => ({ src: F(p), dst: F(hub), kind: 'include' }))), { src: F(core[0]), dst: F(hub), kind: 'include' }];
    return { files: [...Object.values(members).flat(), ...core], edges, elements: [...groups.map((g) => sec(g, g.toUpperCase(), members[g])), sec('core', 'Core', core),
      { id: 'hub:registry', primitive: 'hub', claim: 'Every subsystem registers through registry.h.', node: F(hub) }] };
  },
  // Container depth: three levels of nesting, edges crossing every level.
  'deep-nesting'() {
    const lv = [['engine', 'Engine'], ['engine/voice', 'Voice'], ['engine/voice/osc', 'Oscillators']];
    const files = {}, els = [];
    lv.forEach(([p, label], d) => { files[p] = range(3).map((i) => `src/${p}/${p.split('/').pop()}_${pad(i)}.cpp`); els.push(sec(p.replace(/\//g, '-'), label, files[p], d ? { parent: 'sec:' + lv[d - 1][0].replace(/\//g, '-') } : {})); });
    const app = ['src/app/main.cpp', 'src/app/ui.cpp']; els.push(sec('app', 'App', app));
    const all = Object.values(files).flat();
    const edges = [{ src: F(app[0]), dst: F(files.engine[0]), kind: 'call' }, { src: F(app[1]), dst: F(files['engine/voice/osc'][2]), kind: 'reference' },
      ...lv.slice(0, 2).flatMap(([p], d) => files[p].map((f, i) => ({ src: F(f), dst: F(files[lv[d + 1][0]][i]), kind: 'call' }))),
      ...files['engine/voice/osc'].slice(1).map((f) => ({ src: F(f), dst: F(files['engine/voice/osc'][0]), kind: 'include' }))];
    return { files: [...all, ...app], edges, elements: els };
  },
  // A file in three sets: its home section, a set spanning sections (marks) and a set inside one section (hull).
  'triple-overlap'() {
    const dsp = ['src/dsp/morph.cpp', 'src/dsp/filter.cpp', 'src/dsp/delay.cpp'], st = ['src/state/preset_io.cpp', 'src/state/undo.cpp'];
    const edges = [{ src: F(dsp[0]), dst: F(st[0]), kind: 'call' }, { src: F(dsp[1]), dst: F(dsp[0]), kind: 'call' }, { src: F(st[1]), dst: F(st[0]), kind: 'call' }, { src: F(dsp[2]), dst: F(dsp[1]), kind: 'include' }];
    return { files: [...dsp, ...st], edges, elements: [sec('dsp', 'DSP', dsp), sec('state', 'State', st),
      { id: 'set:presets', primitive: 'set', label: 'Presets', claim: 'These read and write presets.', members: [F(dsp[0]), F(st[0])] },
      { id: 'set:realtime', primitive: 'set', label: 'Realtime', claim: 'These run on the audio thread.', members: [F(dsp[0]), F(dsp[1])] },
      { id: 'overlap:morph', primitive: 'overlap', claim: 'morph is DSP, preset handling and realtime at once.', members: [F(dsp[0])], sets: ['sec:dsp', 'set:presets', 'set:realtime'] }] };
  },
  // Folding: a 16-step lane inside a section big enough to fold (16 other files; steps are laid out on the lane, not
  // as rows, so only the others count toward the fold), and a 16-step lane routed across four sections. Past 12 steps
  // the inline lane folds its middle (lane spec, Q-033); the route never does (Julian, poll 2026-10-28).
  'long-lane'() {
    const chain = range(16).map((i) => `src/chain/stage_${pad(i)}.cpp`), extra = range(16).map((i) => `src/chain/util_${pad(i)}.h`);
    const parts = ['input', 'analysis', 'synthesis', 'output'], across = parts.flatMap((p) => range(4).map((i) => `src/${p}/${p}_${pad(i)}.cpp`));
    const link = (xs) => xs.slice(1).map((x, i) => ({ src: F(xs[i]), dst: F(x), kind: 'call' }));
    return { files: [...chain, ...extra, ...across], edges: [...link(chain), ...link(across), ...extra.map((x, i) => ({ src: F(chain[i % 16]), dst: F(x), kind: 'include' }))], elements: [sec('chain', 'Chain', [...chain, ...extra]), ...parts.map((p, i) => sec(p, p[0].toUpperCase() + p.slice(1), across.slice(i * 4, i * 4 + 4))),
      { id: 'lane:chain', primitive: 'lane', label: 'Signal chain', claim: 'Audio runs through the sixteen stages in order.', steps: chain.map(F), source: { provenance: 'static' } },
      { id: 'lane:across', primitive: 'lane', label: 'Analysis to output', claim: 'A frame travels input → analysis → synthesis → output.', steps: across.map(F), source: { provenance: 'static' } }] };
  },
  // Twins scaling, mixed ✓ ~ ✕: 8 engines (children of one Engines section, as twins are laid out today) implement a
  // 6-port interface; twin i matches port p statically, only through
  // the overlay, or not at all, by a fixed pattern, so every mark kind appears and each twin differs.
  'big-family'() {
    const peers = { voice: 'src/core/voice_alloc.cpp', audio: 'src/fx/router.cpp', param: 'src/core/params.h', mod: 'src/core/mod_matrix.cpp', midi: 'src/core/midi_in.cpp', meter: 'src/ui/meters.cpp' };
    const ports = [{ name: 'voice in', direction: 'in', kind: 'call', peer: F(peers.voice) }, { name: 'audio out', direction: 'out', role: 'audio', peer: F(peers.audio) },
      { name: 'param read', direction: 'out', role: 'param', peer: F(peers.param) }, { name: 'mod in', direction: 'in', role: 'mod', peer: F(peers.mod) },
      { name: 'midi in', direction: 'in', kind: 'reference', peer: F(peers.midi) }, { name: 'meter out', direction: 'out', kind: 'data', peer: F(peers.meter) }];
    const names = ['saw', 'choir', 'station', 'warp', 'grain', 'modal', 'fm', 'wave'], files = [], edges = [], els = [];
    names.forEach((n, t) => {
      const fs = [`src/engines/${n}/${n}_voice.cpp`, `src/engines/${n}/${n}_core.cpp`]; files.push(...fs); els.push(sec(n, n.toUpperCase(), fs, { parent: 'sec:engines' }));
      edges.push({ src: F(fs[0]), dst: F(fs[1]), kind: 'call' });
      ports.forEach((p, i) => {
        const mode = (t + i) % 3; // 0 static ✓, 1 overlay only ~, 2 none ✕
        if (mode === 2) return;
        const mine = F(fs[i % 2]), prov = mode === 0 ? 'static' : 'inferred';
        edges.push(p.direction === 'in' ? { src: p.peer, dst: mine, kind: p.kind || 'call', role: p.role, provenance: prov } : { src: mine, dst: p.peer, kind: p.kind || 'call', role: p.role, provenance: prov });
      });
    });
    const core = Object.values(peers);
    return { files: [...files, ...core], edges, elements: [sec('engines', 'Engines', []), ...els, sec('core', 'Core', core.filter((p) => !p.includes('/fx/') && !p.includes('/ui/'))), sec('out', 'Out', [peers.audio, peers.meter]),
      { id: 'twins:engines', primitive: 'twins', label: 'Engine interface', claim: 'Eight engines implement one interface.', members: names.map((n) => 'sec:' + n), interface: ports }] };
  },
  // Every slot × provenance legible on one screen: 8 slots (render.js SPEC.slot) × 5 provenances, one edge each. One
  // section per slot (five sources and their target), so no section passes the fold threshold and every combination is
  // its own drawn line.
  'edge-matrix'() {
    const SLOTS = [['call', null, 'Calls'], ['include', null, 'Includes'], ['call', 'audio', 'Audio'], ['call', 'param', 'Params'], ['call', 'mod', 'Modulation'], ['test', null, 'Tests'], ['data', null, 'Data'], ['reference', null, 'References']];
    const PROVS = ['static', 'config', 'runtime', 'annotated', 'inferred'], files = [], edges = [], els = [];
    SLOTS.forEach(([kind, role, label], s) => {
      // Names unique across the repo, so the viewer never prefixes the folder and the provenance stays readable.
      const name = label.toLowerCase(), dst = `src/slot${s + 1}/${name}_target.cpp`, srcs = PROVS.map((prov) => `src/slot${s + 1}/${name}_${prov}.cpp`);
      files.push(...srcs, dst); els.push(sec('slot' + (s + 1), label, [...srcs, dst]));
      PROVS.forEach((prov, i) => edges.push({ src: F(srcs[i]), dst: F(dst), kind, role, provenance: prov }));
    });
    return { files, edges, elements: els };
  },
  // Diff marks at volume: 30 added, 12 removed, 5 stale and 4 changed, over an 80-file repo in four sections.
  'big-diff'() {
    const parts = ['ui', 'dsp', 'io', 'state'], files = parts.flatMap((p) => range(20).map((i) => `src/${p}/${p}_${pad(i)}.cpp`));
    const edges = files.slice(1).map((f, i) => ({ src: F(files[i]), dst: F(f), kind: i % 3 ? 'call' : 'include' }));
    // Disjoint by construction: added are i % 8 < 3, stale i % 8 = 5, changed i % 8 = 6 (a file in two lists would show one mark).
    const added = files.filter((_, i) => i % 8 < 3).slice(0, 30).map(F), stale = [5, 29, 45, 61, 77].map((i) => F(files[i])), changed = [6, 30, 46, 62].map((i) => F(files[i]));
    const removed = range(12).map((i) => { const p = parts[i % 4], path = `src/${p}/${p}_old_${pad(i)}.cpp`; return { id: F(path), kind: 'file', path, home: 'sec:' + p }; });
    return { files, edges, elements: parts.map((p, k) => sec(p, p.toUpperCase(), files.slice(k * 20, k * 20 + 20))), diff: { added, changed, stale, removed } };
  },
  // Level of detail at all three levels: 4,000 files in 40 top sections with nested children, edges mostly local.
  'whole-repo'() {
    const rnd = lcg(29), files = [], els = [], edges = [], homes = [];
    for (let t = 0; t < 40; t++) {
      const top = `mod${pad(t)}`, subs = [top, `${top}/core`, `${top}/impl`];
      subs.forEach((s, d) => {
        const n = d === 0 ? 40 : 30, fs = range(n).map((i) => `src/${s}/f${String(i).padStart(3, '0')}.cpp`);
        files.push(...fs); homes.push(fs);
        els.push(sec(s.replace(/\//g, '-'), d ? s.split('/')[1] : `Module ${pad(t)}`, fs, d ? { parent: 'sec:' + top } : {}));
      });
    }
    const seen = new Set(), homeOf = new Map(homes.flatMap((h) => h.map((f) => [f, h])));
    for (let i = 0; i < files.length * 2; i++) {
      const a = files[Math.floor(rnd() * files.length)], local = rnd() < 0.8;
      const pool = local ? homeOf.get(a) : files;
      const b = pool[Math.floor(rnd() * pool.length)], kind = rnd() < 0.5 ? 'include' : 'call';
      const k = `${a}|${b}|${kind}`; if (a === b || seen.has(k)) continue; seen.add(k);
      edges.push({ src: F(a), dst: F(b), kind });
    }
    return { files, edges, elements: els };
  },
};
export const COMMITTED = Object.keys(CASES).filter((c) => c !== 'whole-repo');
export const generate = (name) => build({ name, ...CASES[name]() });

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const a = process.argv.slice(2), only = a.includes('--case') ? a[a.indexOf('--case') + 1] : null;
  const dir = a.find((x, i) => !x.startsWith('--') && a[i - 1] !== '--case');
  const names = only ? [only] : a.includes('--all') ? Object.keys(CASES) : COMMITTED;
  if (only && !CASES[only]) { console.error(`no stress case "${only}"; cases: ${Object.keys(CASES).join(', ')}`); process.exit(2); }
  if (!dir && names.includes('whole-repo')) { console.error('whole-repo is never committed: give an out dir'); process.exit(2); }
  const base = dir ? resolve(dir) : join(ROOT, 'design/prototype/snapshots/stress');
  for (const n of names) {
    const docs = generate(n), d = join(base, n); mkdirSync(d, { recursive: true });
    for (const [f, text] of Object.entries(docs)) writeFileSync(join(d, f), text);
    const g = JSON.parse(docs['graph.json']), o = JSON.parse(docs['overlay.json']);
    console.log(`${n}: ${g.nodes.length} nodes, ${g.edges.length} crawled + ${o.edges.length} overlay edges`);
  }
}
