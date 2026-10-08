# operational-lens — a deterministic filter between shipped code and labs/tests (ADR 0019 update)

- **Queue item:** unqueued (Julian's question; polls: build the lens now; operational = reachable from entry points;
  gate the lens test in ./verify with a conservation cross-check). Opens Q-009 (seeds from the build, P1).
- **Change:** `design/prototype/lens.js` (pure); layout/render/state/index wiring; outside box with crossing-edge list;
  meter cross-checks renderer routing against the lens partition; `tools/lens.test.mjs` in `./verify fast`.
- **Withdrawn first attempt:** seeds from path roles. The critic (opus) showed reachability added zero files beyond the
  seeds, so the "two signals agree" claim I made to Julian was self-agreement; and `embeds` was followed in the
  producer direction, which misdiagnosed the compiled-in presets as runtime-loaded. Both fixed before commit; lesson L0003.
- **Evidence:** HORDE probe: 38 in focus; edges 74/287/289 = 650; renderer routing equals the lens partition at every
  zoom; planted miscount reads broken; planted embeds-direction bug fails ./verify; planted crawled entry→test edge is a
  leak, planted inferred edge changes nothing; shuffled input gives identical results.
- **Findings on HORDE:** 0 leaks; 11 product-named files not shipped (h2 cores, 5 src engines only tests use, a
  Windows-only GUI file); 3 build-time generators.
- **Verify:** `./verify fast` exit 0.
