/* Sample HORDE-shaped graph for the Loupe prototype.
   NOT crawled: file names and edges are invented to exercise the viewer.
   Replace with real crawler output once the graph schema exists (see docs/decisions/0005).

   Shape:
     GROUPS  view spec: containers (Stage 2 output)
     NODES   ground truth: one per file (Stage 1 output)
     RAW     ground truth: "src>dst kind provenance" per edge; provenance s=static, i=inferred, r=runtime
     BUSES   view spec: bundled edges with a contract
     NOTES, QS, AUD, FLOW, TOURS  stage 3-6 content (dialogue, audit, explainers, navigator)
*/
const GROUPS=[
 {id:'shell',label:'Plugin shell',col:0,blurb:'Host-facing entry. CLAP is native; VST3 and AUv2 come through clap-wrapper. processor.cpp owns the audio callback.'},
 {id:'ui',label:'Editor UI',col:0,blurb:'The editor and its views. The XY pad and morph panel write into Modulation, never straight to parameters.'},
 {id:'mod',label:'Modulation',col:1,blurb:'Two-tier modulation. Macros and the XY pad write intents, quantum morph resolves corners, and inertia smooths anything that moves.'},
 {id:'dyn',label:'Dynamics',col:1,blurb:'Coupling laws acting on the Kuramoto ring: topology, Sakaguchi phase lag, consonance gravity and ROAM chord wander.'},
 {id:'eng',label:'Engines',col:2,blurb:'Sound sources. Each engine renders into the Audio bus and reads its parameters through the Param bus.'},
 {id:'saw',label:'SAW',parent:'eng',blurb:'The core instrument. Per-voice Kuramoto oscillators, with detune governed by the same coupling law.'},
 {id:'choir',label:'CHOIR',parent:'eng',blurb:'Pulsar/FOF formant engine. The vowel field is a quantum-morph surface.'},
 {id:'station',label:'STATION',parent:'eng',blurb:'Lightweight phase-modulation engine: three operators, 4-bit wave RAM and LFSR noise.'},
 {id:'warp',label:'WARP',parent:'eng',blurb:'Distortion engine: a 7-curve simplex blend walked by an Ornstein-Uhlenbeck process.'},
 {id:'fx',label:'FX chain',col:3,blurb:'Shared effects after the engines, routed by fx_router.'},
 {id:'fnd',label:'FOUNDATIONS',col:4,blurb:'The shared plumbing library: voice allocation, smoothing, oversampling, ADAA and parameter storage.'},
 {id:'ver',label:'Verification',col:4,blurb:'The parity oracle. ./verify checks C++ output against goldens from the browser prototypes.'}
];
const NODES=[
 ['wrapper','build/clap-wrapper','shell'],['clap_entry','src/plugin/clap_entry.cpp','shell'],['processor','src/plugin/processor.cpp','shell'],['params','src/plugin/param_registry.cpp','shell'],['state','src/plugin/state_io.cpp','shell'],
 ['editor','src/ui/editor.cpp','ui'],['xyview','src/ui/xy_pad_view.cpp','ui'],['morphview','src/ui/morph_panel_view.cpp','ui'],['scope','src/ui/scope_view.cpp','ui'],
 ['modmatrix','src/mod/mod_matrix.cpp','mod'],['intent','src/mod/intent_bus.cpp','mod'],['qmorph','src/mod/quantum_morph.cpp','mod'],['inertia','src/mod/inertia.cpp','mod'],['macros','src/mod/macros.cpp','mod'],['lfoenv','src/mod/lfo_env.cpp','mod'],
 ['topology','src/dynamics/topology.cpp','dyn'],['sakaguchi','src/dynamics/sakaguchi.cpp','dyn'],['gravity','src/dynamics/consonance_gravity.cpp','dyn'],['roam','src/dynamics/roam.cpp','dyn'],
 ['kcore','src/engines/saw/kuramoto_core.cpp','saw'],['sawvoice','src/engines/saw/saw_voice.cpp','saw'],['detune','src/engines/saw/detune_law.cpp','saw'],
 ['fof','src/engines/choir/fof_grain.cpp','choir'],['vowel','src/engines/choir/vowel_field.cpp','choir'],['register','src/engines/choir/register_ctl.cpp','choir'],
 ['pmop','src/engines/station/pm_operator.cpp','station'],['waveram','src/engines/station/wave_ram.cpp','station'],['lfsr','src/engines/station/lfsr_noise.cpp','station'],
 ['simplex','src/engines/warp/simplex_shaper.cpp','warp'],['ouwalk','src/engines/warp/ou_walk.cpp','warp'],
 ['fxrouter','src/fx/fx_router.cpp','fx'],['filter','src/fx/filter.cpp','fx'],['phaser','src/fx/phaser.cpp','fx'],['timefx','src/fx/time_fx.cpp','fx'],['mshaper','src/fx/multistage_shaper.cpp','fx'],
 ['voicealloc','foundations/voice_alloc.cpp','fnd'],['smoother','foundations/smoother.hpp','fnd'],['oversampler','foundations/oversampler.cpp','fnd'],['adaa','foundations/adaa.hpp','fnd'],['dspmath','foundations/dsp_math.hpp','fnd'],['pstore','foundations/param_store.hpp','fnd'],
 ['verify','./verify','ver'],['parity','tests/parity_tests.cpp','ver'],['goldens','tests/goldens/*.bin','ver'],['ci','.github/workflows/ci.yml','ver']
].map(([id,path,group])=>({id,path,group}));
const RAW=`wrapper>clap_entry call s
clap_entry>processor call s
clap_entry>params call s
clap_entry>state call s
state>params call s
state>qmorph call s
params>pstore include s
processor>voicealloc call s
processor>modmatrix call s
processor>fxrouter call s
voicealloc>sawvoice call s
voicealloc>fof call s
voicealloc>pmop call s
voicealloc>simplex call i
voicealloc>dspmath include s
editor>xyview include s
editor>morphview include s
editor>scope include s
editor>params call s
xyview>intent call s
morphview>qmorph call s
scope>processor call r
macros>intent mod s
lfoenv>modmatrix mod s
modmatrix>intent mod s
intent>qmorph mod s
qmorph>inertia call s
inertia>smoother include s
modmatrix>kcore mod s
modmatrix>vowel mod s
modmatrix>pmop mod i
modmatrix>ouwalk mod s
modmatrix>filter mod s
modmatrix>mshaper mod s
intent>detune mod i
topology>kcore call s
sakaguchi>kcore call s
gravity>kcore call s
roam>gravity call s
roam>kcore call i
gravity>dspmath include s
sawvoice>kcore call s
sawvoice>detune call s
detune>inertia call s
kcore>dspmath include s
register>fof call s
register>inertia call s
fof>vowel call s
vowel>qmorph call s
pmop>waveram call s
pmop>lfsr call s
simplex>ouwalk call s
ouwalk>dspmath include s
sawvoice>fxrouter audio s
fof>fxrouter audio s
pmop>fxrouter audio s
lfsr>fxrouter audio s
simplex>fxrouter audio i
fxrouter>filter audio s
fxrouter>phaser audio s
fxrouter>timefx audio s
fxrouter>mshaper audio s
mshaper>adaa include s
mshaper>oversampler call s
filter>smoother include s
kcore>pstore param s
detune>pstore param s
vowel>pstore param s
pmop>pstore param s
simplex>pstore param s
filter>pstore param s
phaser>pstore param s
timefx>pstore param s
mshaper>pstore param s
modmatrix>pstore param s
oversampler>dspmath include s
pstore>smoother include s
ci>verify call s
verify>parity call s
parity>goldens test s
parity>kcore test s
parity>fof test s
parity>pmop test s
parity>simplex test s`;
const E=RAW.trim().split('\n').map((l,i)=>{const [p,k,pr]=l.trim().split(/\s+/);const [s,t]=p.split('>');return {i,s,t,k,p:pr};});
const BUSES=[
 {id:'bmod',label:'Mod bus',k:'mod',col:2,contract:'ModTarget::apply(IntentId, depth). Global tier only; corner-level mods stay inside Modulation.'},
 {id:'baudio',label:'Audio bus',k:'audio',col:3,contract:'render(AudioBlock&): stereo float32, at most 512 frames per block.'},
 {id:'bparam',label:'Param bus',k:'param',col:4,contract:'ParamStore::read(ParamId) returns a float, smoothed once per block.'}
];
const KINDS=[['call','Call'],['include','Include'],['audio','Audio'],['param','Param read'],['mod','Modulation'],['test','Test']];
const PROV={s:{short:'static',long:'Static. The crawler found a direct reference (include or call site).'},i:{short:'inferred',long:'Inferred. The structure agent added it; no direct reference exists (function pointer, table dispatch or registration).'},r:{short:'runtime',long:'Runtime. Observed in a trace but not visible statically.'}};
const NOTES={
 kcore:'Integrates the coupled phases for each voice. K runs from −1 (splay) to +1 (lock).',
 qmorph:'Resolves each parameter to one of four corner presets by a weighted coin flip.',
 intent:'Macros and the XY pad write intents. Each corner binds intents to parameters with a depth and range.',
 inertia:'Mass-spring smoothing applied to detune, glide and modulation.',
 roam:'Chord tones as potential wells in log-frequency space, with thermal wander.',
 gravity:'Pulls chord intervals toward just intonation.',
 simplex:'Blends 7 transfer curves; the weights always sum to one.',
 verify:'Bit-level parity against the browser prototypes.',
 pstore:'Single source of parameter values. Every read is smoothed per block.',
 fxrouter:'Receives the Audio bus and routes it through the FX chain.',
 processor:'The audio callback. Hands each block to the voices, then to the FX chain.',
 voicealloc:'Assigns incoming notes to engine voices.',
 goldens:'Reference renders produced by the browser prototypes.'
};
const QS=[
 {id:'q1',node:'roam',q:'roam.cpp registers a function pointer that processor.cpp later calls into kuramoto_core. I drew that as an inferred edge from ROAM to kuramoto_core. Should ROAM sit in Dynamics, or is it a SAW feature?',a:'Dynamics. ROAM is a coupling law, same family as consonance gravity.',effect:'Kept ROAM in Dynamics. The edge stays inferred until a runtime trace confirms it.'},
 {id:'q2',node:'state',q:'state_io.cpp and quantum_morph.cpp both serialize corner presets. Should I group them as a Presets cluster, or keep quantum_morph under Modulation?',a:null},
 {id:'q3',node:'lfsr',q:'Nothing in the repo calls lfsr_noise::reseed(). Is it dead code, or does the host thread call it by name?',a:null},
 {id:'q4',node:'simplex',q:'multistage_shaper.cpp uses the ADAA helper from FOUNDATIONS, but WARP\'s simplex_shaper.cpp does not. Is that intentional, given the 2× oversampling ceiling?',a:'Not intentional. WARP predates the ADAA helper.',effect:'Sent to the audit swarm and added to the WARP explainer.'}
];
const AUD=[
 {id:'a1',v:'confirmed',by:'auditor-1',nodes:['fxrouter'],bus:'baudio',text:'Audio bus contract holds. All five engine outputs call render(AudioBlock&) with stereo float32.'},
 {id:'a2',v:'challenged',by:'auditor-3',nodes:['topology','sakaguchi','gravity','roam'],group:'dyn',text:'Dynamics has 1 internal edge and 4 edges into kuramoto_core. It behaves like part of SAW. Suggest nesting it under SAW or renaming it Coupling laws.',resp:'Keep it top-level. CHOIR will couple through it once vowel coupling lands.'},
 {id:'a3',v:'challenged',by:'auditor-2',nodes:['roam','kcore'],text:'ROAM → kuramoto_core is inferred. A runtime trace shows it fires only when ROAM is enabled. Mark the edge conditional.'},
 {id:'a4',v:'confirmed',by:'auditor-4',nodes:['dspmath'],group:'fnd',text:'No cycles between FOUNDATIONS and the engines. Every FOUNDATIONS edge points inward.'},
 {id:'a5',v:'open',by:'auditor-2',nodes:['goldens','parity'],text:'parity_tests.cpp compares against goldens generated by the browser prototypes, which live outside this repo. That dependency is missing from the graph.'},
 {id:'a6',v:'challenged',by:'auditor-1',nodes:['simplex'],text:'simplex_shaper → fx_router is counted toward the Audio bus but is only inferred through an engine table. Confirm it statically before counting it toward the contract.'}
];
const FLOW=[
 'The host calls clap_entry, which hands each audio block to processor.',
 'processor runs the mod matrix and resolves the morph before any sound is made.',
 'voice_alloc hands note events to engine voices.',
 'Engines render into the Audio bus, which feeds fx_router.',
 'fx_router runs filter, phaser, time and shaper stages in order.',
 'Every stage reads its settings through the Param bus.'
];
const TOURS=[
 {title:'Trace a note-on',q:['note','midi','play','key'],steps:[['clap_entry','The host delivers a note event with the audio block.'],['processor','The audio callback forwards events before rendering.'],['voicealloc','Picks a free SAW voice, or steals the oldest.'],['sawvoice','Starts the voice and sets its pitch target.'],['kcore','Couples the voice\'s oscillators; the phases settle according to K.'],['fxrouter','The voice output arrives on the Audio bus.'],['mshaper','Last stage in the default chain before output.']]},
 {title:'Where does the XY pad write?',q:['xy','pad','morph','macro'],steps:[['xyview','Dragging the pad writes an intent, not a parameter.'],['intent','Intent values fan out to each corner\'s bindings.'],['qmorph','Each block, every parameter resolves to a corner.'],['inertia','Changes go through a mass-spring so they glide.'],['smoother','Final smoothing before the DSP reads the value.']]},
 {title:'What does ./verify check?',q:['verify','test','parity','golden','ci'],steps:[['ci','CI runs ./verify on every push.'],['verify','Drives the parity tests.'],['parity','Renders each engine offline and diffs against the goldens.'],['goldens','Reference output from the browser prototypes. Parity with them is not the same as sounding right.'],['kcore','One of four engines under test.']]}
];
const STAGES=[['crawl','Crawl'],['structure','Structure'],['dialogue','Dialogue'],['audit','Audit'],['explain','Explain'],['navigate','Navigate']];

