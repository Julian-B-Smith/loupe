# ROADMAP — Loupe

Single source of truth. Only the lead session (or Julian) edits this file.
State lives here; conversations are ephemeral. Phase plan seeded from
`docs/spinup-brief.md` (2026-10-01).

## Status

- **Phase:** P0 (spinup) closing → PA (prior-art landscape) next.
- **Oracle:** `./verify fast` = kit integrity, leak gate, 20 loupe-check mutation
  cases, loupe-check with required schema validation on every `schema/examples/*`.
  `full` == `fast` until P1/P2 add Layer-E gates. **Known gaps:** no crawl
  determinism gate (no P1 crawler yet); `schema/examples/horde-sample` freshness
  vs `tools/convert-sample.mjs` not checked.
- **Last human ratification:** pending (manifest provisional, 2026-10-01).

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
| **P0** Spinup | Harness, `./verify`, CI, manifest | `./verify fast` green locally and in CI; manifest ratified |
| **PA** Prior-art landscape (agent swarm, Decision 30) | `docs/prior-art.md`: existing code-map / dependency-visualization tools, dated and cited | Doc exists with ≥1 cited source per competitor; reviewed by Julian before P1 design is committed |
| **P1** Multi-language crawler (C/C++, Python, JS, HTML, shell, CMake) per 0018: include paths and defines from `compile_commands.json` with search fallback marked; symbols in headers; signatures on call sites; dsp-plugin dialect incl. GUI bridge rule (`web.bind` → JS calls) | Same bytes on two crawls (gate in `fast`); golden graph for a small fixture repo (gate in `fast`); HORDE crawls clean with zero `unknown` missing nodes and a closing inventory; everything the probe found is found again (`full`) |
| **P2** Flow view renderer reading tokens and specs; `conserve()` | Meter balanced on HORDE; the 10 stress cases render (`full`) |
| **P3** Structure agent writes `view.json`, incl. proposed focus lenses with evidence (0019 once accepted); dialogue in chat | `loupe-check` passes on every agent-written view; on HORDE the agent proposes the legacy / horde 2 split unprompted (Layer-E, measured) |
| **P4** Audit swarm; one test per primitive | Each test reproduces the gallery's results on the sample |
| **P5** Explainers and navigator | Explainers anchored to hashes; stale ones flagged after an edit |
| **P6** Re-run diff, `.loupe/current/`, `loupe-history` | Diff of two real HORDE commits renders; history branch written |
| **P7** Design system integration | `tokens.css` and `primitives.json` generated from the design agent's artifact; `design/prototype/` wired to real data |
| **PX** Pre-ship prior-art & IP re-scan (Decision 30) | Before any public release: `docs/prior-art.md` refreshed with a patent/IP pass |

## Queue

### Q-001 — Ratify the manifest
- **Status:** open
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

## Open questions (blocking — ask Julian)

- **Name.** "Loupe" is a working name; the repo is already `Julian-B-Smith/loupe` (public).
- **P7:** does `prototype/` stay once `design/prototype/` exists? Deferred to the P7 gate (spinup poll, 2026-10-01).
- **0007, 0019** are Proposed; P1 and P3 depend on them.

## Graduation criteria

Loupe graduates from interactive prototyping to queue work per phase when the
remaining open questions are infrastructure problems rather than judgment ones.
Judgment column today: visual grammar quality (P2/P7), Structure-agent view
quality (P3), audit-test sufficiency (P4).
