# q015-signal-path-view — "Signal path" view for structure snapshots (spine.js)

- **Queue item:** Q-015 (engine2 structure from HORDE's declaration)
- **Why:** Julian's poll 2026-10-31 ("spine from the spec"): Flow and Design were unreadable on the engine2 draft snapshot; the declared signal path gives a placement with no inference.
- **Evidence consulted:** design/prototype/works.js, standins.js conserve(), render.js SPEC, index.html paint/hit/chrome, tools/engine-structure.mjs, the committed engine2-structure graph.json (47 stages, 79 nodes, 117 edges).
- **Alternatives rejected:** tray for every edgeless item (stretched four container boxes across the whole diagram; a container's own node must sit inside its box, so edgeless items with a placed parent or member hang below it instead); feeding box overlaps to conserve() via map.layout.overlaps (it reads them as dragged sections and breaks a meter that is balanced: every node and edge is drawn).
- **Verify:** `./verify fast` exit 0 at git be70b24 (uncommitted change set); `node tools/spine.test.mjs` 20 checks pass; 14 planted breakages all caught.
- **Open questions:** the layout reports 13 container-box overlaps and 145 nodes inside boxes they are not members of (inherent: descendants of voice/engine/instrument/mixer scatter across the spine); edge-kind colours are a proposal awaiting the design review; the Testbench listing is out of scope.
