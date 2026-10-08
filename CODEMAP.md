# CODEMAP — Loupe

Where things are. Moved verbatim from the pre-spinup CLAUDE.md (2026-10-01) and extended with the harness.

## Harness

- `CLAUDE.md`: charter (invariant harness layer + §Domain + knowledge loop).
- `ROADMAP.md`: phase-gated plan; the single source of task state.
- `DECISIONS.md`: append-only index of decisions; content lives in `docs/decisions/`.
- `INDEX.md` / `LIBRARY.md`: knowledge loop.
- `verify`: the oracle (`./verify fast|full|report`). `.kit/`: vendored kit gates (do not edit).
- `project.manifest.json`: spin-up survey answers.
- `traces/`: one entry per merged change.
- `.claude/`: hooks, agents (implementer=sonnet, verifier=haiku, critic=opus), provenance skill.

## Project

- `docs/vision.md`: the pipeline, the two-view split, the target experience.
- `docs/visual-grammar.md`: primitives, the claim each makes, audit tests, dialects. Mostly Proposed.
- `docs/decisions/`: decision log.
- `prototype/index.html`: 2D viewer v1 (open in a browser). Hosted copy: https://claude.ai/artifact/9MWcjmEY9umVzobq71a3wW
- `prototype/primitives.html`: gallery of the proposed visual primitives, each with its audit test run live on the
  sample, plus Keep / Revise / Cut verdicts. Hosted copy: https://claude.ai/artifact/Lw7cH6LF7sUgLGCERhgR1Y
- `docs/graph-schema.md`, `schema/`: the data contract (graph, overlay, view, loupe-spec). Example snapshot in
  `schema/examples/horde-sample/`.
- `tools/`: `loupe-check.mjs` (snapshot checker), `loupe-check.test.mjs` (19 mutation tests), `canon.mjs`,
  `convert-sample.mjs`, `probe-crawl.mjs` (probe crawler, not P1). Run with `npm run check` and `npm test`.
- `schema/examples/horde-probe/`: a real crawl of HORDE (commit c64cfdbc), produced by the probe.
- `docs/spinup-brief.md`: what the `/spinup` agent needs to wire Loupe into the autonomous system.
- `docs/design-handoff.md`: the contract with the Claude Design agent: required tokens, the `loupe-spec`
  block per primitive, screens, stress cases. Published doc: https://claude.ai/code/artifact/090409e4-c614-47e7-aa44-cebbea549775
- `docs/design-links.md`: pinned links and versions of the design agent's artifacts.
- `prototype/data/sample-horde.js`: invented HORDE-shaped sample graph. Not crawled. Shared by both pages.
- `design/`: in-house since ADR 0022 (was the Claude Design agent's lane). `HANDOFF.md` (delivery note), `prototype/` (v4),
  `system/` (design-system snapshot: tokens.json, one README per primitive), `tokens.css` (hand-made until Q-007).
- `docs/design-review-v4.md`: infrastructure's review of delivery v4.
- `viewer/index.html`: the testbench landing page (no doctype; wrapped by the artifact host and by `tools/serve.mjs`).
- `tools/serve.mjs`: `npm run view`. Zero-dependency, read-only, loopback-only server. `ALIASES` maps the published
  paths `design/proto/` and `v1/`, because the artifact host reserves `prototype` as a path segment.
- `.claude/launch.json`: `loupe-view` for the app's browser pane.
- `design/prototype/story.js`, `works.js`, `stories/`: the "How it works" view (ADR 0025). `stories/<repo>-<commit>.json`
  holds agent-written stories (stand-in format); `story.js` applies Julian's edits and does the accounting;
  `works.js` draws it. `lens.js`: focus lenses (ADR 0019). Tests: `tools/{history,lens,story}.test.mjs`.

