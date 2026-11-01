# q015-signal-path-view — "Signal path" view for structure snapshots (spine.js)

- **Queue item:** Q-015 (engine2 structure from HORDE's declaration)
- **Why:** Julian's poll 2026-10-31 ("spine from the spec"): Flow and Design were unreadable on the engine2 draft snapshot; the declared signal path gives a placement with no inference.
- **Evidence consulted:** design/prototype/works.js, standins.js conserve(), render.js SPEC, index.html paint/hit/chrome, tools/engine-structure.mjs, the committed engine2-structure graph.json (47 stages, 79 nodes, 117 edges).
- **Alternatives rejected:** tray for every edgeless item (stretched four container boxes across the whole diagram; a container's own node must sit inside its box, so edgeless items with a placed parent or member hang below it instead); feeding box overlaps to conserve() via map.layout.overlaps (it reads them as dragged sections and breaks a meter that is balanced: every node and edge is drawn).
- **Verify:** `./verify fast` exit 0 at git be70b24 (uncommitted change set); `node tools/spine.test.mjs` 20 checks pass; 14 planted breakages all caught.
- **Open questions:** the layout reports 13 container-box overlaps and 145 nodes inside boxes they are not members of (inherent: descendants of voice/engine/instrument/mixer scatter across the spine); edge-kind colours are a proposal awaiting the design review; the Testbench listing is out of scope.

## Round 2 (2026-11-01, lead brief: "frame the spine")

- **Correction to round 1:** the spine test was NOT in `./verify` in round 1 (`./verify` lists tests by hand and I may not edit it); it is now (Julian approved, 2026-11-01). The round-1 verify result above therefore did not cover it.
- **Change:** off-path external blocks go to rails (left inputs, right outputs, bottom observers) by declared scope and edge direction; off-path engine blocks hang at the lower median column of their placed neighbours; a container gets one box per region it stands in, with dashed "continued" boxes beside its own; the view has its own zoom controls (+, -, fit, % read-out) sharing the map's zoom state, fit on entry, wheel zoom about the cursor.
- **Evidence:** `node tools/spine.test.mjs` (all pass; 25 planted breakages all caught), `./verify fast`.
- **Open questions:** the remaining overlaps/intrusions among noise, sub, osc, member, parameters, voice are consequences of the declared stage order (their members interleave in columns); engine blocks whose only edges go to railed blocks now hang with their container (widened from "edgeless").
- **Round 3 (2026-11-01):** a container with no columned neighbour now hangs at the earliest column of its own placed members (a non-container still falls back to its parent); `noise` and `sub` no longer stretch to column 2. Overlaps 8 to 1, intrusions 78 to 18; planted (container falls back to parent) and caught.
