// Q-014 scratch: the engine2-spec "How it works" story (Loupe lead brief, 2026-10-16). Every step cites spec lines.
import { writeFileSync } from 'node:fs';
const out = process.argv[2];
const f = (p) => `file:engine2/core/${p}`;
const ev = (line, note) => ({ path: 'specs/SPEC-ENGINE.md', line, note });
const steps = [
  ['n1', 'note-in', 'A note arrives', 'The API accepts a note-on with its note id, channel, key and velocity, sample-timed; the pitch system sends each note\'s pitch in Hz by note id.', ['api/engine.h'], [ev(563, 'IF-1: notes, voices, expressions'), ev(564, 'IF-2: pitch addressed by note id')]],
  ['n2', 'allocate', 'The allocator picks a voice', 'One allocator serves the whole instrument. A new note takes a faded voice first, then the quietest tail, and only when every voice is held the oldest held one; a taken voice fades over 5 ms.', ['voice/allocator.h'], [ev(422, 'VO-1'), ev(423, 'VO-2: the voice law'), ev(424, 'VO-3: a taken voice fades')]],
  ['n3', 'voice-start', 'The voice starts', 'A fresh start re-runs start phases, onset burst and scatter, the rotation clock, spread targets, noise streams, the sub\'s phase, drift and ENV 1; a legato change keeps them running.', ['voice/voice.h'], [ev(427, 'VO-6: mono and legato'), ev(439, 'what re-runs at each kind of start')]],
  ['n4', 'gravity', 'Gravity sets the sounding pitch', 'The note\'s pitch times gravity\'s ratio is the sounding pitch the voice publishes; held voices are pulled toward just ratios of one another on a fixed grid.', ['swarm/gravity.h', 'voice/voice.h'], [ev(128, '§4.2: voice pitch × gravity ratio'), ev(370, 'SW-11'), ev(1004, 'C.6: the gravity step')]],
  ['n5', 'members', 'Each oscillator sets its members\' frequencies', 'Placement spreads U members around the oscillator\'s pitch, the detune law maps placement to frequency, and drift wanders each member.', ['swarm/placement.h', 'swarm/detune.h', 'swarm/drift.h'], [ev(965, 'C.2: placement'), ev(979, 'C.3: detune laws'), ev(992, 'C.4: drift walk')]],
  ['n6', 'coupling', 'Coupling pulls the members', 'Each control interval the pull toward sync or splay is computed from the members\' mean field and added to each natural frequency; inertia swings the result, and the phases advance by it.', ['swarm/coupling.h', 'swarm/inertia.h', 'swarm/swarm.h', 'swarm/onset.h'], [ev(955, 'C.1: mean field'), ev(957, 'C.1: the pull'), ev(998, 'C.5: inertia'), ev(946, 'C.0: phase advance'), ev(1016, 'C.7: onset waits')]],
  ['n7', 'blades', 'Base wave and blades', 'Each member plays the base wave; blade 1 and blade 2 cut a window in each cycle and blend in their mode\'s sound, with per-member values from the spreads.', ['blade/blade.h', 'blade/modes.h', 'blade/waves.h', 'blade/spreads.h', 'blade/interplay.h'], [ev(130, '§4.2: base wave + blade 1 + blade 2'), ev(1036, 'C.9.1: geometry'), ev(1073, 'C.9 item 1: the blend'), ev(1123, 'C.11: the two blades together')]],
  ['n8', 'edges', 'Every hard step is band-limited', 'Discontinuities of the base wave, the windows, carrier wraps, Crush and noise steps are corrected by a 32-tap minimum-phase step table.', ['edges/edges.h'], [ev(131, '§4.2: edge correction'), ev(408, 'ED-1')]],
  ['n9', 'dc', 'DC is removed', 'Each member subtracts the cycle mean of its blades\' contributions, estimated at its current values and smoothed so it never steps.', ['blade/dc.h'], [ev(131, '§4.2: DC removal'), ev(1178, 'C.16')]],
  ['n10', 'pan', 'Members are panned and summed', 'Each mono member gets an equal-power seat in the stereo field; the swarm\'s sum is scaled by U^-0.75.', ['swarm/pan.h'], [ev(131, '§4.2: pan'), ev(132, '§4.2: Σ members × density compensation'), ev(1027, 'C.8: gains and density')]],
  ['n11', 'sub-noise', 'The sub and the noise oscillator', 'The sub (one phase, one shape, tone) and the per-voice noise (colour) are the other two sources, each panned by the single-source law.', ['sources/sub.h', 'sources/noise.h'], [ev(134, '§4.2: sub'), ev(135, '§4.2: noise'), ev(548, 'SN-1'), ev(551, 'SN-4'), ev(1028, 'C.8: a single source')]],
  ['n12', 'slot', 'Sources hand their signal to the voice', 'Each source hands its per-voice stereo signal through the source slot; each passes its gate (mute and solo) and its level, and the sum goes through the per-voice filter slot, which passes it unchanged until a filter is assigned.', ['sources/slot.h'], [ev(618, 'RC-6: what a source hands the voice'), ev(132, '§4.2: gate, level'), ev(137, '§4.2: filter slot'), ev(147, 'filter slot passes unchanged')]],
  ['n13', 'env1', '× ENV 1 × velocity', 'The voice\'s signal is multiplied by ENV 1 (attack, hold, decay, sustain, release, each stage exact in time) and by velocity\'s mapping.', ['voice/envelope.h'], [ev(139, '§4.2: × ENV 1 × velocity'), ev(1139, 'C.12: the stage curve'), ev(429, 'VO-8: velocity')]],
  ['n14', 'output', 'Σ voices into the output stage', 'The voices are summed and scaled by 0.14 × 10^(Level/20), with no saturation or limiter; a sample over 0 dBFS is latched and reported.', ['output/output.h'], [ev(142, '§4.2: Σ voices, output stage'), ev(535, '0 dB defined'), ev(539, 'OU-1')]],
].map(([id, concept, label, does, files, evidence]) => ({ id, concept, label, does, files: files.map(f), evidence }));
const L = (from, to, carries, reason) => ({ from, to, carries, reason });
const links = [
  L('n1', 'n2', 'events', 'SPEC-ENGINE.md line 422: notes are addressed by note id to the one allocator.'),
  L('n2', 'n3', 'events', 'SPEC-ENGINE.md line 427: the voice a note takes re-runs its start (VO-6).'),
  L('n3', 'n4', 'control', 'SPEC-ENGINE.md line 1009: a newly started note starts at its played pitch, then gravity moves it.'),
  L('n4', 'n5', 'control', 'SPEC-ENGINE.md line 979: f0, the oscillator\'s pitch, is the voice\'s sounding pitch times the transposition.'),
  L('n4', 'n11', 'control', 'SPEC-ENGINE.md line 548: the sub\'s frequency is the voice\'s published pitch (keytrack on).'),
  L('n5', 'n6', 'control', 'SPEC-ENGINE.md line 961: the coupled frequency is the natural frequency plus the pull.'),
  L('n6', 'n7', 'control', 'SPEC-ENGINE.md line 944: blades read each member\'s blade phase from its swarm phase.'),
  L('n7', 'n8', 'audio', 'SPEC-ENGINE.md line 131: the members\' waves pass to edge correction.'),
  L('n8', 'n9', 'audio', 'SPEC-ENGINE.md line 131: edge correction, then DC removal.'),
  L('n9', 'n10', 'audio', 'SPEC-ENGINE.md line 131: DC removal, then pan.'),
  L('n10', 'n12', 'audio', 'SPEC-ENGINE.md line 618: a source hands the voice its stereo signal before its level and gate.'),
  L('n11', 'n12', 'audio', 'SPEC-ENGINE.md lines 134-135: the sub and the noise join the voice after their gate and level.'),
  L('n12', 'n13', 'audio', 'SPEC-ENGINE.md line 139: after the filter slot, × ENV 1 × velocity.'),
  L('n13', 'n14', 'audio', 'SPEC-ENGINE.md line 142: the voices are summed into the output stage.'),
];
const doc = {
  schema: 'loupe.stories/0.0-standin',
  about: 'Written by the structure agent for Loupe ROADMAP Q-014 (2026-10-16) from HORDE\'s engine spec alone (specs/SPEC-ENGINE.md at commit 595140e); engine2\'s code is empty headers, so every step cites the spec line that states it, not code. Step provenance is inferred; Julian\'s edits become annotated.',
  graph: { repo: 'github.com/Julian-B-Smith/horde', commit: '595140e7277d7487c77761389597db9d7d0b27a4' },
  stories: [{ id: 'story:signal-path', title: 'From note-on to output', question: 'What happens to a note, from the API to the engine\'s stereo output, as the spec describes it?', by: 'agent:structure', steps, links }],
};
writeFileSync(out, JSON.stringify(doc, null, 2) + '\n');
console.log(`${steps.length} steps, ${links.length} links`);
