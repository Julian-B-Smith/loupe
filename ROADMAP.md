# ROADMAP — Loupe

Single source of truth. Only the lead session (or Julian) edits this file.
State lives here; conversations are ephemeral. Phase plan seeded from
`docs/spinup-brief.md` (2026-10-01).

## Status

- **Phase:** P0 done 2026-10-02 (green locally and in CI; manifest ratified). PA ← current.
- **Oracle:** `./verify fast` = kit integrity, leak gate, 20 loupe-check mutation
  cases, loupe-check with required schema validation on every `schema/examples/*`.
  `full` == `fast` until P1/P2 add Layer-E gates. **Known gaps:** no crawl
  determinism gate (no P1 crawler yet); `schema/examples/horde-sample` freshness
  vs `tools/convert-sample.mjs` not checked.
- **Last human ratification:** 2026-10-01 (manifest ratified by poll).

## Where things stood at spinup (2026-10-01, from the pre-spinup brief)

- v1 viewer built: groups, buses, provenance styling, conservation meter, all six stages on sample data.
- Visual grammar settled for now: all nine primitives kept after round 2 (0012, 0014).
- Graph schema accepted (0015, 0016, 0018): three-file snapshot at 0.2, JSON Schemas, checker, mutation
  tests, and a real HORDE crawl as an example.
- Proposed (0019): per-repo `.loupe/config.json` for what counts as code; focus lenses in the view.
  Schema 0.3 adds `lens` once accepted.
- Stack confirmed; agent setup confirmed (rung 2: main session = Structure agent; audit swarm = subagents).
- Visual design and a working prototype handed to a Claude Design agent (0013, 0017); packet v2 answers
  its 18 review points.

## Invariants under active protection

See CLAUDE.md §Domain. At risk in P1: crawler determinism (no wall-clock, no
unordered iteration leaking into output) and edge provenance.

## Phases

Each gate is a checkable condition. A phase is done when its gate passes in
`./verify` (or, where noted, a human-run check) and a trace exists.

| Phase | Builds | Gate |
| --- | --- | --- |
| **P0** Spinup (done 2026-10-02) | Harness, `./verify`, CI, manifest | `./verify fast` green locally and in CI; manifest ratified |
| **PA** ← current. Prior-art landscape (agent swarm, Decision 30) | `docs/prior-art.md`: existing code-map / dependency-visualization tools, dated and cited | Doc exists with ≥1 cited source per competitor; reviewed by Julian before P1 design is committed |
| **P1** Multi-language crawler (C/C++, Python, JS, HTML, shell, CMake) per 0018: include paths and defines from `compile_commands.json` with search fallback marked; symbols in headers; signatures on call sites; dsp-plugin dialect incl. GUI bridge rule (`web.bind` → JS calls) | Same bytes on two crawls (gate in `fast`); golden graph for a small fixture repo (gate in `fast`); HORDE crawls clean with zero `unknown` missing nodes and a closing inventory; everything the probe found is found again (`full`) |
| **P2** Flow view renderer reading tokens and specs; `conserve()` | Meter balanced on HORDE; the 10 stress cases render (`full`) |
| **P3** Structure agent writes `view.json`, incl. proposed focus lenses with evidence (0019 once accepted); dialogue in chat | `loupe-check` passes on every agent-written view; on HORDE the agent proposes the legacy / horde 2 split unprompted (Layer-E, measured) |
| **P4** Audit swarm; one test per primitive | Each test reproduces the gallery's results on the sample |
| **P5** Explainers and navigator | Explainers anchored to hashes; stale ones flagged after an edit |
| **P6** Re-run diff, `.loupe/current/`, `loupe-history`. Precondition: HORDE has accepted brief loupe-001 (filed 2026-10-02 in `HYPERSAW/integrations/loupe/brief-001.md`); the skill runs in HORDE's sessions | Brief loupe-001 accepted; diff of two real HORDE commits renders; history branch written |
| **P7** Design system integration | `tokens.css` and `primitives.json` generated from the design agent's artifact; `design/prototype/` wired to real data |
| **PX** Pre-ship prior-art & IP re-scan (Decision 30) | Before any public release: `docs/prior-art.md` refreshed with a patent/IP pass |

## Queue

### Q-001 — Ratify the manifest
- **Status:** done 2026-10-01 (trace: traces/2026-10-01-spinup.md)
- **Scope:** `project.manifest.json`
- **Acceptance criteria:** 1. Julian answers the ratification poll with Ratify; `status` updated with the date.
- **Out of scope:** phase work.

### Q-002 — Gate `horde-sample` freshness
- **Status:** open
- **Scope:** `tools/convert-sample.mjs`, `verify`
- **Acceptance criteria:** 1. `convert-sample.mjs` accepts an output dir; 2. `./verify fast` regenerates into a temp dir and fails on any byte difference from `schema/examples/horde-sample/`; 3. proven by planting an edit in `prototype/data/sample-horde.js`.
- **Out of scope:** changing the sample's content.

### Q-003 — Prior-art landscape (PA)
- **Status:** open
- **Scope:** `docs/prior-art.md`
- **Acceptance criteria:** see PA gate.

### Q-004 — Design prototype v5 (ball: design)
- **Status:** blocked on design; review sent as `docs/design-review-v4.md` (2026-10-02)
- **Scope:** `design/` (design lane; infrastructure copies deliveries in, never edits them)
- **Acceptance criteria:** 1. B1 to B3 of the review fixed; 2. on every `schema/examples/*` snapshot the meter
  balances AND every node and edge counted as placed or drawn has a drawn element (to be checked by the P2
  render gate, not by eye); 3. addenda v2.2 and v2.3 items drawn.
- **Out of scope:** layout engine (P2).

### Q-005 — Schemas for audit, dialogue, explain and re-run diff
- **Status:** open
- **Scope:** `schema/`, `docs/graph-schema.md` (human gate: schema change)
- **Acceptance criteria:** 1. JSON Schemas covering every field `design/prototype/snapshots/horde-sample/stages.sample.json`
  and `diff.sample.json` use; 2. both stand-ins validate; 3. loupe-check validates them when present.

### Q-006 — Schema 0.3: `settings.offsets` (0020)
- **Status:** open
- **Scope:** `schema/view.schema.json`, `tools/loupe-check.mjs`, mutation tests
- **Acceptance criteria:** 1. `settings.offsets` in the view schema; 2. loupe-check refuses offsets that make two
  top-level sections overlap, proven by a new mutation case; 3. ships together with 0019's `lens` if accepted.

### Q-007 — Generate `design/tokens.css` from `tokens.json`
- **Status:** open
- **Scope:** `tools/`, `design/tokens.css` (generated), `verify`
- **Acceptance criteria:** 1. a deterministic generator emits every `--loupe-<name>`, `--loupe-type-<name>`,
  `--loupe-tracking-<name>`, `--loupe-font-ui`, `--loupe-font-mono`; 2. no network import: local font files or a
  system fallback; 3. `./verify fast` fails if the committed `tokens.css` differs from the generator's output.

### Q-008 — Regenerate the prototype snapshots at schema 0.2
- **Status:** open
- **Scope:** `design/prototype/snapshots/` (generated copies)
- **Acceptance criteria:** 1. `horde-sample` equals `schema/examples/horde-sample/`; 2. `loops-synthetic` rebound to
  its graph hash; 3. `./verify fast` runs loupe-check on both.

## Open questions (blocking — ask Julian)

- **Name.** "Loupe" is a working name; the repo is already `Julian-B-Smith/loupe` (public).
- **HORDE brief loupe-001** (filed 2026-10-02, respond-by 2026-10-31). Its response lands in HORDE's tree, not here: pull `HYPERSAW/integrations/loupe/` at each wakeup.
- **P7:** does `prototype/` stay once `design/prototype/` exists? Deferred to the P7 gate (spinup poll, 2026-10-01).
- **0007, 0019** are Proposed; P1 and P3 depend on them.
- **Design packet links are stale:** the doc copy and the data kit are pinned at v2.1 / schema 0.1 (`docs/design-links.md`). Republish them with addenda v2.2, v2.3 and schema 0.2 before design starts v5.

## Graduation criteria

Loupe graduates from interactive prototyping to queue work per phase when the
remaining open questions are infrastructure problems rather than judgment ones.
Judgment column today: visual grammar quality (P2/P7), Structure-agent view
quality (P3), audit-test sufficiency (P4).
