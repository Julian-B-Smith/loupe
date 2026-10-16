// Q-014 scratch generator (Loupe lead brief, 2026-10-16): engine2-spec snapshot from the probe's output.
// Parked (ROADMAP Q-014, 2026-10-16): the diagram will come from HORDE's declared structure; this inferred map stays
// as the future check of Loupe's inference against it. Writes overlay (inferred, spec-cited) and view, bound to the
// probe graph's hashes. Run: see design/prototype/snapshots/engine2-spec/README.md.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { canonicalGraph, canonicalDoc, sha256, edgeId } from '../canon.mjs';

const [probeOut, repo, outDir] = process.argv.slice(2);
const G = JSON.parse(readFileSync(`${probeOut}/graph.json`, 'utf8'));

// The graph is the probe's output, unchanged (agents never write graph.json). The probe config names the spec in
// crawlPaths and the origin commit in source (lead, 2026-10-16).
const SPEC = 'specs/SPEC-ENGINE.md';
if (canonicalGraph(G) !== readFileSync(`${probeOut}/graph.json`, 'utf8')) throw new Error('probe graph not canonical');
const gText = canonicalGraph(G), gHash = sha256(gText);
const nodeIds = new Set(G.nodes.map((n) => n.id));

// ---- overlay: relations the spec states, each citing section and line
const f = (p) => `file:engine2/${p}`;
const S = `file:${SPEC}`;
const cite = (sec, line, text) => `SPEC-ENGINE.md ${sec}, line ${line}: ${text}`;
const E = [];
const add = (src, dst, kind, role, rationale) => E.push({ src, dst, kind, role, rationale });

// The signal path (§4.2) and ownership (§4.1)
add(f('core/api/engine.h'), f('core/voice/allocator.h'), 'call', 'events', cite('§7.1 IF-1', 563, 'the API accepts note-on and note-off by note id; §6.4 VO-1, line 422: one allocator serves the whole instrument and notes are addressed by note id.'));
add(f('core/voice/allocator.h'), f('core/voice/voice.h'), 'call', 'events', cite('§6.4 VO-2', 423, 'the voice law decides which voice a new note takes; §4.1, line 117: one instrument-wide voice per played note owns the allocation decision.'));
add(f('core/voice/voice.h'), f('core/sources/slot.h'), 'instantiate', 'audio', cite('§7.2 RC-6', 616, 'the voice holds its sources through one contract, the source slot; line 617: the voice hands each source its published sounding pitch, master phase, gate and velocity.'));
add(f('core/voice/voice.h'), f('core/voice/envelope.h'), 'instantiate', 'audio', cite('§4.1', 117, 'the voice owns ENV 1.'));
add(f('core/voice/pedal.h'), f('core/voice/voice.h'), 'call', 'events', cite('§6.4 VO-12', 433, 'a key released while the pedal is down keeps its voice sounding at sustain and makes that voice a tail for VO-2; pedal-up releases every voice held only by the pedal.'));
add(f('core/voice/allocator.h'), f('core/voice/envelope.h'), 'reference', 'control', cite('§6.4 VO-2', 423, 'a new note takes a voice that is not held, quietest envelope level first.'));
add(f('core/swarm/gravity.h'), f('core/voice/voice.h'), 'call', 'pitch', cite('§4.2', 128, 'voice pitch × gravity ratio gives the published voice pitch; §6.1 SW-11, line 370: gravity acts on the voice\'s pitch, so both oscillators and the sub follow it; §C.6, line 1005: gravity takes the held voices and their settled pitches.'));
add(f('core/swarm/swarm.h'), f('core/sources/slot.h'), 'inherit', 'audio', cite('§7.2 RC-6.1', 620, 'the four sources are instances of the slot; osc 1 and osc 2 are swarm oscillators (§2, line 46).'));
add(f('core/sources/sub.h'), f('core/sources/slot.h'), 'inherit', 'audio', cite('§7.2 RC-6.1', 620, 'the four sources are instances of the slot; the sub is one of them (RC-6, line 616).'));
add(f('core/sources/noise.h'), f('core/sources/slot.h'), 'inherit', 'audio', cite('§7.2 RC-6.1', 620, 'the four sources are instances of the slot; the noise oscillator is one of them (RC-6, line 616).'));
add(f('core/swarm/swarm.h'), f('core/blade/blade.h'), 'call', 'audio', cite('§4.2', 130, 'osc: swarm of U members, each member: base wave + blade 1 + blade 2; §C.0, line 944: blades read the member\'s blade phase from its swarm phase.'));
add(f('core/blade/blade.h'), f('core/edges/edges.h'), 'call', 'audio', cite('§4.2', 131, 'the members\' waves pass to edge correction; §6.3 ED-1, line 408: every hard step the engine makes (window edges, carrier wraps, Crush steps, noise steps) is band-limited.'));
add(f('core/edges/edges.h'), f('core/blade/dc.h'), 'call', 'audio', cite('§4.2', 131, 'edge correction, then DC removal.'));
add(f('core/blade/dc.h'), f('core/swarm/pan.h'), 'call', 'audio', cite('§4.2', 131, 'DC removal, then pan (mono member to L/R); §C.8, line 1027: the swarm\'s output is U^-0.75 times the sum of each member\'s output under its pan gains.'));
add(f('core/swarm/pan.h'), f('core/sources/slot.h'), 'call', 'audio', cite('§7.2 RC-6', 618, 'a source hands the voice its per-voice stereo signal, panned by its own law, before its level and gate.'));
add(f('core/sources/sub.h'), f('core/swarm/pan.h'), 'call', 'audio', cite('§C.8', 1028, 'a single source (the sub, the noise oscillator) is panned by the same law; §6.10 SN-1, line 548.'));
add(f('core/sources/noise.h'), f('core/swarm/pan.h'), 'call', 'audio', cite('§C.8', 1028, 'a single source (the sub, the noise oscillator) is panned by the same law; §6.10 SN-4, line 551.'));
add(f('core/sources/sub.h'), f('core/edges/edges.h'), 'call', 'audio', cite('§6.10 SN-2', 549, 'every step of the sub\'s saw and pulse is band-limited by the engine\'s one edge correction (ED-1).'));
add(f('core/sources/slot.h'), f('core/voice/envelope.h'), 'call', 'audio', cite('§4.2', 137, 'the sources\' sum passes the per-voice filter slot (no file in the export; RC-1, line 581) and then is multiplied by ENV 1 and velocity (line 139); §6.4 VO-9, line 430.'));
add(f('core/voice/envelope.h'), f('core/output/output.h'), 'call', 'audio', cite('§4.2', 142, 'after ENV 1 the voices are summed into the output stage (Level, guards); §6.9 OU-1, line 539.'));

// The swarm's member frequencies (§C.0 to §C.7)
add(f('core/swarm/placement.h'), f('core/swarm/detune.h'), 'call', 'control', cite('§C.3', 979, 'the detune laws read each member\'s placement x_i of C.2 (x\'_i = x_i - anchor·x_min).'));
add(f('core/swarm/drift.h'), f('core/swarm/detune.h'), 'call', 'control', cite('§C.3', 988, 'then drift (C.4) scales each member\'s frequency before the natural frequency is floored.'));
add(f('core/swarm/detune.h'), f('core/swarm/coupling.h'), 'call', 'control', cite('§C.1', 953, 'coupling\'s spread σ is measured on the natural frequencies of C.3; line 961: the coupled frequency is the natural frequency plus the pull.'));
add(f('core/swarm/coupling.h'), f('core/swarm/inertia.h'), 'call', 'control', cite('§C.5', 996, 'inertia swings each member\'s offset toward its target g_i − f0, g_i the coupled frequency of C.1.'));
add(f('core/swarm/inertia.h'), f('core/swarm/swarm.h'), 'call', 'control', cite('§C.0', 946, 'each member\'s phase advances by g_i/f_s, g_i its frequency from C.1 and C.5.'));
add(f('core/swarm/swarm.h'), f('core/swarm/coupling.h'), 'reference', 'control', cite('§C.1', 955, 'the pull reads the mean field R·e^{iψ} of the members\' phases, recomputed each control interval (line 956).'));
add(f('core/swarm/onset.h'), f('core/swarm/swarm.h'), 'call', 'control', cite('§C.7', 1016, 'each member waits its onset offset, silent with its phase held, then enters by a fade.'));
add(f('core/swarm/onset.h'), f('core/voice/envelope.h'), 'reference', 'control', cite('§C.7', 1016, 'the entry fade\'s time constant reads env1.attack and is multiplied onto the voice\'s envelope.'));

// The blade (§C.9 to §C.11, §C.16)
add(f('core/blade/waves.h'), f('core/blade/modes.h'), 'call', 'audio', cite('§C.9.2', 1047, 'the carrier modes play wave(blade wave, ·) of C.9.3; line 1061: the waves\' antiderivatives are used by Crush.'));
add(f('core/blade/modes.h'), f('core/blade/blade.h'), 'call', 'audio', cite('§C.9 item 1', 1073, 'inside the window the output blends from the blade\'s input toward the mode\'s hot signal by gate × depth.'));
add(f('core/blade/spreads.h'), f('core/blade/blade.h'), 'call', 'control', cite('§C.9.1', 1040, 'the window\'s centre adds the spread offset; §C.9 item 8, line 1080: the per-member effective values come from the spreads of C.10.'));
add(f('core/blade/interplay.h'), f('core/blade/blade.h'), 'call', 'audio', cite('§C.11', 1115, 'serial composition evaluates the lower blade\'s delta and then the upper blade on base + λ·L (line 1121).'));
add(f('core/blade/dc.h'), f('core/blade/waves.h'), 'reference', 'control', cite('§C.16', 1181, 'the DC estimate of a Sync blade uses the antiderivatives of C.9.3 (line 1061: used by crush and DC).'));
add(f('core/edges/edges.h'), f('core/blade/waves.h'), 'reference', 'control', cite('§6.3 ED-1', 408, 'step heights are computed from the waveform\'s closed form at the step.'));

// The API and the manifest
add(f('core/api/engine.h'), f('core/api/state.h'), 'reference', 'api', cite('§3', 82, 'the engine\'s API covers note ids, pitch input, per-voice modulation, state and observations.'));
add(f('core/api/engine.h'), f('core/api/history.h'), 'reference', 'api', cite('§3 proposed layout', 100, 'api/ holds the engine\'s calls, state, observation view, GUI snapshot and history snapshot and gestures (RC-11).'));
add(f('core/api/history.h'), f('core/api/state.h'), 'reference', 'api', cite('§7.2 RC-11.2', 679, 'the snapshot converts to and from IF-4\'s text outside the audio thread.'));
add(f('wasm/CMakeLists.txt'), f('core/api/engine.h'), 'reference', 'api', cite('§7.1 IF-10', 572, 'a WebAssembly build of the same source, with the same API; §3, line 83.'));

// Parameter bus: every reader of the one manifest (BD-5)
const P = (file, sec, line, text) => add(f(file), f('core/manifest/manifest.h'), 'reference', 'param', cite(sec, line, text));
P('core/api/engine.h', '§7.1 IF-3', 565, 'every continuous parameter is a destination by its manifest key and id.');
P('core/api/state.h', '§7.1 IF-4', 566, 'the state document carries params as manifest key → v in ascending manifest id order.');
P('core/api/history.h', '§7.2 RC-11.1', 678, 'every audible value a user can change is a parameter in the manifest; the snapshot holds every parameter\'s v (RC-11.2, line 679).');
P('core/voice/voice.h', '§5.2', 196, 'voice.mode (poly, mono, legato) is a manifest row.');
P('core/voice/allocator.h', '§5.2', 197, 'voice.polyphony sets how many voices exist (VO-5).');
P('core/swarm/gravity.h', '§5.2', 198, 'voice.gravity is a manifest row (SW-11).');
P('core/voice/envelope.h', '§5.2', 199, 'env1.attack to env1.velocity are manifest rows (lines 199-207).');
P('core/output/output.h', '§5.2', 212, 'out.level is a manifest row (OU-1).');
P('core/swarm/swarm.h', '§5.3', 217, 'each oscillator\'s rows exist once per oscillator (osc1.…, osc2.…).');
P('core/blade/blade.h', '§5.4', 268, 'each blade\'s rows exist once per blade per oscillator.');
P('core/sources/sub.h', '§5.5', 305, 'the sub\'s rows (sub.…).');
P('core/sources/noise.h', '§5.6', 324, 'the noise oscillator\'s rows (noise.…).');
P('core/sources/slot.h', '§7.2 RC-6', 618, 'a source hands the voice its parameters, in the manifest under its own id range (RC-6.1, line 620).');

// Observation bus (IF-10): what the view reads, without changing the audio
const O = (file, text) => add(f(file), f('core/api/observation.h'), 'reference', 'observe', cite('§7.1 IF-10', 572, `the observation view reads, per voice and oscillator, ${text}`));
O('core/swarm/swarm.h', 'the members\' phases, natural and coupled frequencies, σ, R and ψ.');
O('core/swarm/coupling.h', 'S, P and Kenv.');
O('core/swarm/drift.h', 'the drift values D.');
O('core/blade/spreads.h', 'the spread positions p.');
O('core/blade/blade.h', 'the effective blade values (C.9 item 8) and the frame angle.');
O('core/swarm/pan.h', 'the pan gains.');
O('core/swarm/gravity.h', 'gravity\'s ratios.');
O('core/swarm/onset.h', 'the onset waits.');
O('core/voice/envelope.h', 'levels; §10.1 item 16 (line 747) reads ENV 1\'s level through it.');

// GUI snapshot bus (RC-8)
const R = (file, text) => add(f(file), f('core/api/gui_snapshot.h'), 'reference', 'readout', cite('§7.2 RC-8', 641, `the snapshot holds ${text}`));
R('core/swarm/swarm.h', 'per voice and oscillator R and ψ and the members\' phases and levels.');
R('core/blade/blade.h', 'each blade\'s window (position and width) and the frame angle.');
R('core/voice/envelope.h', 'per voice its level and ENV 1\'s stage.');
R('core/output/output.h', 'the output\'s clip and non-finite latches and the output meter.');
R('core/sources/slot.h', 'each source meter\'s peak (a source hands the voice its readouts, RC-6, line 618).');

// Spec bus: every file whose purpose the spec states
const SP = (file, sec, line, why) => add(f(file), S, 'reference', 'spec', cite(sec, line, why));
for (const [file, sec, line, why] of [
  ['core/api/engine.cpp', '§10.5 BD-8', 777, 'the build\'s stages; the file\'s line 1 names stage 1 of BD-8.'],
  ['core/api/engine.h', '§7.1', 557, 'the engine\'s interfaces; the header\'s purpose line cites spec 7.1.'],
  ['core/api/gui_snapshot.h', '§7.2 RC-8', 639, 'the GUI readout path; the header cites RC-8.'],
  ['core/api/history.h', '§7.2 RC-11', 674, 'history support; the header cites RC-11.'],
  ['core/api/observation.h', '§7.1 IF-10', 572, 'the observation view; the header cites IF-10.'],
  ['core/api/state.h', '§7.1 IF-4', 566, 'morph and state; the header cites IF-4 and RC-9.'],
  ['core/blade/blade.h', '§C.9.1', 1032, 'blade geometry; the header cites C.9.1.'],
  ['core/blade/dc.h', '§C.16', 1176, 'DC removal; the header cites C.16.'],
  ['core/blade/interplay.h', '§C.11', 1111, 'interplay; the header cites C.11.'],
  ['core/blade/modes.h', '§C.9.2', 1043, 'the blade\'s modes; the header cites C.9.2.'],
  ['core/blade/spreads.h', '§C.10', 1083, 'spreads; the header cites C.10.'],
  ['core/blade/waves.h', '§C.9.3', 1057, 'waves and modulator shapes; the header cites C.9.3.'],
  ['core/edges/edges.h', '§6.3', 404, 'edges and aliasing; the header cites ED.'],
  ['core/manifest/manifest.h', '§5', 166, 'every function and parameter; the header cites spec 5 and BD-5.'],
  ['core/output/output.h', '§6.9', 533, 'the output stage; the header cites OU.'],
  ['core/sources/noise.h', '§6.10', 544, 'the noise oscillator; the header cites SN.'],
  ['core/sources/slot.h', '§7.2 RC-6', 614, 'the source slot; the header cites RC-6.'],
  ['core/sources/sub.h', '§6.10', 544, 'the sub; the header cites SN.'],
  ['core/swarm/coupling.h', '§C.1', 949, 'coupling; the header cites C.1.'],
  ['core/swarm/detune.h', '§C.3', 977, 'detune laws; the header cites C.3.'],
  ['core/swarm/drift.h', '§C.4', 990, 'drift; the header cites C.4.'],
  ['core/swarm/gravity.h', '§C.6', 1002, 'gravity; the header cites C.6.'],
  ['core/swarm/inertia.h', '§C.5', 994, 'inertia; the header cites C.5.'],
  ['core/swarm/onset.h', '§C.7', 1011, 'onset scatter; the header cites C.7.'],
  ['core/swarm/pan.h', '§C.8', 1018, 'pan and density; the header cites C.8.'],
  ['core/swarm/placement.h', '§C.2', 963, 'placement; the header cites C.2.'],
  ['core/swarm/swarm.h', '§6.1', 356, 'the swarm; the header cites SW and C.1.'],
  ['core/voice/allocator.h', '§6.4 VO-2', 423, 'allocation and stealing; the header cites VO-2 and VO-3.'],
  ['core/voice/envelope.h', '§C.12', 1137, 'ENV 1\'s curve; the header cites C.12.'],
  ['core/voice/pedal.h', '§6.4 VO-12', 433, 'the sustain pedal; the header cites VO-12.'],
  ['core/voice/voice.h', '§6.4 VO-6', 427, 'one voice, mono and legato; the header cites VO-6.'],
  ['tests/runner.cpp', '§10.1', 727, 'the invariant suite; engine2/README.md line 30 names runner.cpp as the suite\'s runner.'],
  ['tests/suite.h', '§10.1', 727, 'the invariant suite; engine2/README.md line 30 names suite.h as the items\' registry.'],
  ['tests/controls/failing_item.cpp', '§10.1', 729, 'every check has a must-fail control; this file is the runner\'s own.'],
  ['tools/click_detector.mjs', '§8 QS-4', 697, 'the click detector; engine2/README.md line 32 names this file as QS-4\'s detector.'],
  ['data/bank/presets.json', 'Appendix B.1', 863, 'the bank format; engine2/data/README.md line 8.'],
  ['data/envelopes/presets.json', 'Appendix A', 840, 'the 12 envelope presets; engine2/data/README.md line 9.'],
  ['wasm/CMakeLists.txt', '§7.1 IF-10', 572, 'the WebAssembly build; the file\'s line 1 cites IF-10.'],
  ['CMakeLists.txt', '§10.5 BD-8', 777, 'the staged build; the file\'s line 18 cites BD-8.'],
]) SP(file, sec, line, why);

const overlayEdges = E.map(({ src, dst, kind, role, rationale }) => {
  for (const n of [src, dst]) if (!nodeIds.has(n)) throw new Error(`no node ${n}`);
  return { id: edgeId(src, dst, kind), src, dst, kind, role, provenance: 'inferred', evidence: [{ type: 'inference', agent: 'structure', rationale }] };
});
const ids = new Set(); for (const e of overlayEdges) { if (ids.has(e.id)) throw new Error(`dup ${e.src} ${e.dst} ${e.kind}`); ids.add(e.id); }
const overlay = { schema: 'loupe.overlay/0.2', graph: { hash: gHash }, edges: overlayEdges, roles: [], conditions: [] };
const oText = canonicalDoc(overlay);

// ---- view
const eid = (src, dst, kind) => edgeId(src, dst, kind);
const by = 'agent:structure', status = 'proposed';
const sec = (id, label, members, claim, parent) => ({ id, primitive: 'section', label, claim, by, status, members, ...(parent ? { parent } : {}) });
const core = (dir) => G.nodes.filter((n) => n.kind === 'file' && n.path.startsWith(`engine2/core/${dir}/`)).map((n) => n.id).sort();
const els = [
  sec('sec:spec', 'The spec', [S], 'specs/SPEC-ENGINE.md is the engine\'s contract and the only reference the builder reads (SPEC-ENGINE.md line 5).'),
  sec('sec:core', 'core', [], 'The engine\'s source tree, organised by concept with one home per concept (SPEC-ENGINE.md §3, line 80; layout proposed at lines 97-109).'),
  sec('sec:api', 'API', core('api'), 'The engine\'s calls, events, state, observation view, GUI snapshot and history (SPEC-ENGINE.md §3, line 100).', 'sec:core'),
  sec('sec:manifest', 'Manifest', core('manifest'), 'The parameter manifest, the one source of truth for the parameter table, host parameters, lab controls and manual (SPEC-ENGINE.md §3, line 99; BD-5 line 93).', 'sec:core'),
  sec('sec:voice', 'Voice', core('voice'), 'Allocator and stealing, the pedal, the voice, ENV 1, mono and legato (SPEC-ENGINE.md §3, line 101).', 'sec:core'),
  sec('sec:swarm', 'Swarm', core('swarm'), 'Members, placement, detune laws, coupling, drift, onset, start phase, gravity and pan (SPEC-ENGINE.md §3, line 102).', 'sec:core'),
  sec('sec:blade', 'Blade', core('blade'), 'Geometry, modes, waves, spreads, interplay and DC (SPEC-ENGINE.md §3, line 103).', 'sec:core'),
  sec('sec:edges', 'Edges', core('edges'), 'The band-limited step and corner tables (SPEC-ENGINE.md §3, line 104; ED-1 line 408).', 'sec:core'),
  sec('sec:sources', 'Sources', core('sources'), 'The source slot, the sub and the noise oscillator (SPEC-ENGINE.md §3, line 105; RC-6 line 616).', 'sec:core'),
  sec('sec:output', 'Output', core('output'), 'Level, non-finite guard and clip latch (SPEC-ENGINE.md §3, line 106; OU-1 line 539).', 'sec:core'),
  sec('sec:tests', 'Tests', G.nodes.filter((n) => n.path.startsWith('engine2/tests/')).map((n) => n.id).sort(), 'The invariant suite\'s runner and registry, empty until the test author writes items from the spec (SPEC-ENGINE.md §3, line 108; §10.1 line 729).'),
  sec('sec:data', 'Input data', G.nodes.filter((n) => n.path.startsWith('engine2/data/')).map((n) => n.id).sort(), 'The bank and the envelope presets, input data for the build and its tests (SPEC-ENGINE.md §2, lines 70-71; Appendix A line 840, B.1 line 863).'),
  sec('sec:wasm', 'WebAssembly', [f('wasm/CMakeLists.txt')], 'The WebAssembly build of the same source for the labs (SPEC-ENGINE.md §3, line 83; IF-10 line 572).'),
  sec('sec:tools', 'Tools', [f('tools/click_detector.mjs')], 'The click detector of QS-4, the test author\'s first deliverable (SPEC-ENGINE.md §8, line 697).'),
  sec('sec:build', 'Build', [f('CMakeLists.txt'), f('build.sh')], 'The staged build of the engine and its suite (SPEC-ENGINE.md §10.5 BD-8, line 777).'),
  sec('sec:external', 'External', ['ext:node', 'ext:std'], 'Language runtimes the crawler found includes and imports of; the spec does not name them.'),
];
const bus = (id, label, dst, role, claim, signature) => ({ id, primitive: 'bus', label, claim, by, status,
  contract: { dst, role, ...(signature ? { signature } : {}) },
  edges: overlayEdges.filter((e) => e.dst === dst && e.role === role).map((e) => e.id) });
els.push(
  bus('bus:params', 'Parameter manifest', f('core/manifest/manifest.h'), 'param', 'Every parameter a concept reads is a row of the one manifest, addressed by key and id with unit, range, law, class and rate (SPEC-ENGINE.md §5.1, line 170; IF-3 line 565).', 'manifest key → v ∈ [0, 1] (IF-11)'),
  bus('bus:observe', 'Observation view', f('core/api/observation.h'), 'observe', 'The suite reads per-voice, per-oscillator values through one read-only view that never changes the audio (SPEC-ENGINE.md IF-10, line 572; BD-4 line 92).'),
  bus('bus:snapshot', 'GUI snapshot', f('core/api/gui_snapshot.h'), 'readout', 'The GUI reads one lock-free snapshot the audio thread publishes; it is not the observation view (SPEC-ENGINE.md RC-8, line 641; RC-8.3 line 646).'),
  bus('bus:slot', 'Source slot', f('core/sources/slot.h'), 'audio', 'osc 1, osc 2, the sub and the noise oscillator are instances of one source slot, and the voice\'s code names no source kind (SPEC-ENGINE.md RC-6.1, line 620).'),
  bus('bus:spec', 'Specified by', S, 'spec', 'Every file whose purpose the spec states points at the section that states it; each edge cites the spec line (SPEC-ENGINE.md line 5: the spec is the only reference).'),
);
// The slot bus takes only the inherit edges (the instances); pan → slot carries the signal and stays free.
const slotBus = els.find((e) => e.id === 'bus:slot');
slotBus.edges = overlayEdges.filter((e) => e.dst === f('core/sources/slot.h') && e.kind === 'inherit').map((e) => e.id);
slotBus.contract.kind = 'inherit';
els.push(
  { id: 'lane:signal', primitive: 'lane', label: 'Per-voice signal path', by, status,
    claim: 'A note travels API → allocator → voice → swarm → blades → edge correction → DC removal → pan → source slot → (filter slot) × ENV 1 → output stage, as SPEC-ENGINE.md §4.2 draws it (lines 121-147).',
    steps: ['core/api/engine.h', 'core/voice/allocator.h', 'core/voice/voice.h', 'core/swarm/swarm.h', 'core/blade/blade.h', 'core/edges/edges.h', 'core/blade/dc.h', 'core/swarm/pan.h', 'core/sources/slot.h', 'core/voice/envelope.h', 'core/output/output.h'].map(f),
    source: { provenance: 'annotated', evidence: 'specs/SPEC-ENGINE.md:121-147 (§4.2 the per-voice signal path, the human-owned spec); step-to-file mapping by the structure agent from §3 lines 97-109' } },
  { id: 'loop:coupling', primitive: 'loop', label: 'Coupling feedback', by, status, classification: 'unclassified',
    claim: 'The members\' phases set the mean field, the mean field sets the pull, the pull (through inertia) sets the frequencies that advance the phases: a feedback the spec describes as the swarm\'s design (SPEC-ENGINE.md §C.1, lines 955-961; §C.0, line 946).',
    cycle: ['core/swarm/swarm.h', 'core/swarm/coupling.h', 'core/swarm/inertia.h'].map(f),
    evidence: ['specs/SPEC-ENGINE.md:955 mean field from the members\' phases', 'specs/SPEC-ENGINE.md:961 coupled frequency g_i = natural + pull', 'specs/SPEC-ENGINE.md:996 inertia swings toward g_i', 'specs/SPEC-ENGINE.md:946 phase advances by g_i, updated once per control interval (the state element)'] },
  { id: 'hub:spec', primitive: 'hub', label: 'The spec', node: S, by, status,
    claim: 'The spec is the one reference every concept file answers to (SPEC-ENGINE.md line 5).' },
  { id: 'set:laws', primitive: 'set', label: 'Normative laws (Appendix C)', by, status,
    claim: 'These files hold a law Appendix C states as binding math with its constants and units (SPEC-ENGINE.md line 9; Appendix C, line 940).',
    members: ['core/swarm/coupling.h', 'core/swarm/placement.h', 'core/swarm/detune.h', 'core/swarm/drift.h', 'core/swarm/inertia.h', 'core/swarm/gravity.h', 'core/swarm/onset.h', 'core/swarm/pan.h', 'core/blade/blade.h', 'core/blade/modes.h', 'core/blade/waves.h', 'core/blade/spreads.h', 'core/blade/interplay.h', 'core/blade/dc.h', 'core/voice/envelope.h'].map(f) },
);
const view = { schema: 'loupe.view/0.2', graph: { hash: gHash }, overlay: { hash: sha256(oText) }, dialect: { name: 'dsp-plugin-spec', version: '0' },
  settings: { hubPlacement: 'group' }, exemptions: [], elements: els };
mkdirSync(outDir, { recursive: true });
writeFileSync(`${outDir}/graph.json`, gText);
writeFileSync(`${outDir}/overlay.json`, oText);
writeFileSync(`${outDir}/view.json`, canonicalDoc(view));
console.log(`nodes ${G.nodes.length}, crawled edges ${G.edges.length}, overlay edges ${overlayEdges.length}, elements ${els.length}; graph ${gHash}`);
