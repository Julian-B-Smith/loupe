# q040-mixed-bundle — a bundle of mixed provenance is drawn as its least-trusted edge

- **Queue item:** Q-040 (Julian, 2026-11-06: the design call, the criteria, and the order of trust confirmed).
- **Change:**
  - `design/prototype/render.js`: `TRUST` (least trusted first: inferred, annotated, runtime, declared, config, static),
    `leastTrusted`, `provCounts`, `MIXED_NOTE`. A bundle line, in Design and in the zoomed-out overview, takes the
    dash and the cap of `leastTrusted(provs)`; before, a bundle of more than one provenance drew as `static`, solid. A
    provenance outside `TRUST` (the schema allows none) takes the inferred dash, as spine.js does. The line's tooltip
    counts each provenance, least trusted first ("4 edges folded · 1 inferred · 3 static"); the pill's tooltip says what
    it is drawn as and gives the same counts. One-provenance tooltips now carry the count too ("· 4 static" where they
    said "· static"); their drawing is unchanged.
  - `design/prototype/index.html`: the Design key gives `MIXED_NOTE` a line under the provenance patterns, when the
    snapshot holds more than one provenance (Flow draws no bundles).
  - `design/system/components/edge/README.md`: the rule and the order, in prose (no spec-block change).
  - `tools/render.test.mjs`: the Q-040 block.
  - Answers review v4's item 4 ("bundle by provenance too", `docs/design-review-v4.md`) another way: bundles still
    mix, and say so.
- **What changes on committed snapshots (criterion 4):** Design views at auto, 2, 1, 0.5 and 0.2, with and without the
  operational lens. Flow draws no bundles. `horde-crawl` 4 bundles of config and static, now the config dash;
  `schema/examples/horde-probe` 2 to 3 of config and static; `cmake-basic-crawl` with the lens, 1 at every zoom
  ("2 config · 1 static"); `horde-sample` (both copies) 2 to 5 mixing static with inferred or runtime, and with the lens
  "1 inferred · 4 static" at auto and 1, 1 to 3 at 0.2; stress `big-bus` 1 (static and runtime, at 0.2); stress
  `big-family` 3 to 6 (static and inferred). engine2 and the other stress cases have none. The stress cases' byte
  comparison and geometry checks pass unchanged.
- **Checks:** the order is the confirmed one; for every pair the least trusted wins; on engine2, the first bundle of two
  or more at zoom 0.5 and at 0.2, with one edge planted `inferred`, draws the inferred dash, its line and pill tooltips
  count "1 inferred · N−1 declared", the meter balances; planted `runtime`, it draws runtime's dots round-capped;
  unplanted it keeps the declared dash. On HORDE's crawl the 4 config-and-static bundles draw the config dash and the
  static-only ones stay solid. The key's code renders `MIXED_NOTE` once.
- **Plants (each caught):** the old `'static'` fallback (both dash checks); the bundle paths without a cap (both runtime
  checks).
- **Browser (local, horde-sample, Design, 1440×900):** `s:sec:dyn>s:sec:saw` dash 4 3.5, "4 edges folded · 1 inferred ·
  3 static"; `s:sec:ui>s:sec:shell` dash 0.1 3.6, "2 edges folded · 1 runtime · 1 static"; the key's new line, open.
- **Critic (opus): REWORK**, fixed: runtime-mixed bundles drew 0.1 px butt dashes, nearly invisible (H1: the cap, and a
  planted test); the snapshot list above was missing cmake-basic-crawl and horde-sample's lens frames (M1); tests for
  the cap, the crawl case and the pill (M5); an unknown provenance drew solid (L1); the rule in the edge README (L2); the
  key line only where a mix can occur (L3); the tooltip wording and review item 4 said here (L4, L5).
  **Taken to Julian, not done here:** M2, on the overview's heavy lines (up to 7 px) round dots 3.6 px apart run
  together and read solid, as runtime-only bundles already did; M3, collector bars, their stubs and bus exit stubs stay
  solid whatever the lines they gather (known since review v4, item 8); M4, the key line hides when the key is closed,
  and the strip does not mention mixing.
- **Not tested:** the key's HTML itself (`index.html` is parsed, not run); hosted Testbench.
- **Verify:** see the PR.
