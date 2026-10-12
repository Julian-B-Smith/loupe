# ROADMAP — Loupe

Single source of truth. Only the lead session (or Julian) edits this file.
State lives here; conversations are ephemeral. Phase plan seeded from
`docs/spinup-brief.md` (2026-10-01).

## Status

- **Phase:** P0 done 2026-10-02. PA done 2026-10-11 (Julian reviewed `docs/prior-art.md` and accepted ADRs 0026 to
  0034). **P1a ← current**, waiting on HORDE's answer to brief loupe-002 before any `cmake` run there.
- **Oracle:** `./verify fast` = kit integrity, leak gate, 20 loupe-check mutation
  cases, loupe-check with required schema validation on every `schema/examples/*`.
  `full` == `fast` until P1/P2 add Layer-E gates.
  `fast` also regenerates `horde-sample` and byte-compares it (Q-002), and runs the viewer's history, lens and
  story tests. **Known gaps:** no crawl determinism gate (no P1 crawler yet); the renderer itself has no automated
  test (its conservation is checked in the browser by `conserve()`, not in CI); `design/tokens.css` and the
  prototype snapshots are not generated or gated yet (Q-007, Q-008).
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

## Viewer track (built 2026-10-03 to 2026-10-08, outside the phase plan)

Julian asked for these directly while PA was the current phase; they are prototype work in `design/prototype/`
that P2 (renderer) and P3 (Structure agent) will build on. Recorded here so the plan matches the repo.

| Built | Decision | Checked by |
| --- | --- | --- |
| Design moved in-house; `design/` is project code | 0022 | critic review per visual change |
| Fold long sections; isolate a section as a sub-patch with port rails | 0023 | `conserve()` in the browser; critic |
| One history (Back/Forward = Undo/Redo); right-click menu | 0024 | `tools/history.test.mjs` in `./verify fast` |
| Operational lens: reachable from entry points | 0019 (Proposed, updated) | `tools/lens.test.mjs` in `./verify fast` |
| "How it works" view: behaviour stories, editable | 0025 | `tools/story.test.mjs` in `./verify fast` |
| Testbench: `npm run view` and the hosted artifact | README | republished after each viewer merge |

All three blockers of the v4 review are fixed (`docs/design-review-v4.md`). Its should-fix list is still Q-004.

## Invariants under active protection

See CLAUDE.md §Domain. At risk in P1: crawler determinism (no wall-clock, no
unordered iteration leaking into output) and edge provenance.

## Phases

Each gate is a checkable condition. A phase is done when its gate passes in
`./verify` (or, where noted, a human-run check) and a trace exists.

| Phase | Builds | Gate |
| --- | --- | --- |
| **P0** Spinup (done 2026-10-02) | Harness, `./verify`, CI, manifest | `./verify fast` green locally and in CI; manifest ratified |
| **PA** Prior-art landscape, run as an amendment pass (DECISIONS H8). **Done 2026-10-11** | `docs/prior-art.md`; nine contradictions filed as ADRs 0026 to 0034, all accepted | Met: doc dated and cited; every contradiction filed; reviewed and ruled on by Julian |
| **P1a** ← current. File-level crawler (C/C++, Python, JS, HTML, shell, CMake) per 0018, 0026 to 0028: **build facts from the CMake File API and JSON trace** (target sources, include paths, defines, generated files, custom commands), with static CMakeLists parsing as the marked fallback; includes resolved from per-source include paths; every edge carries how it was resolved; dsp-plugin dialect incl. the GUI bridge rule (`web.bind` → JS calls); Operational lens seeded from target sources (Q-009) | Same bytes on two crawls (gate in `fast`); golden graph for a small fixture repo with a CMake build (gate in `fast`); **the graph states which build configurations it covers and which it could not evaluate** (0026); no timestamp or absolute path in the output; every crawled edge has a `resolution`; HORDE crawls clean with zero `unknown` missing nodes and a closing inventory; everything the probe found is found again (`full`). Precondition for running on HORDE: brief loupe-002 accepted |
| **P1b** Symbols, call sites with signatures, roles by signature (0032). **Not started until a named question cannot be answered at file level**; first candidates: the audio, parameter and modulation roles | The question is written down first; then: call edges carry resolution `syntactic` unless resolved; no call edge from a parse-error subtree; a **measured precision figure** against a compiler-based index on HORDE (Layer-E, measured not guaranteed) |
| **P2** Flow view renderer reading tokens and specs; `conserve()`; a matrix lens for dense sections (0029); a side-by-side mode for Flow and Design (0030) | Meter balanced on HORDE; the 10 stress cases render (`full`); **every element standing for more than one edge opens to exactly the edges the meter attributes to it** (0029) |
| **P3** Structure agent writes `view.json`, incl. proposed focus lenses with evidence (0019 once accepted); dialogue in chat | `loupe-check` passes on every agent-written view; on HORDE the agent proposes the legacy / horde 2 split unprompted (Layer-E, measured) |
| **P4** Audit: deterministic claim tests first, then model auditors labelled as measured (0033); confirmed claims exportable as rules the target repo can run (0034; may become its own phase) | Each deterministic test reproduces the gallery's results on the sample; a claim confirmed only by same-lineage agents reads "reviewed", never "confirmed"; one exported rule runs green in HORDE's own CI |
| **P5** Explainers and navigator | Explainers anchored to hashes; stale ones flagged after an edit |
| **P6** Re-run diff, `.loupe/current/` (gitignored in the target), `loupe-history` (ADR 0021). Opens with the P6 notice to HORDE (`.gitignore` line, leak-check step); HORDE lands its side in one PR | HORDE's PR merged; a planted private name blocks a history commit (leak check fails closed); diff of two real HORDE commits renders; history branch written |
| **P7** Design system integration | `tokens.css` and `primitives.json` generated from `design/system/`; `design/prototype/` wired to real data |
| **PX** Pre-ship prior-art & IP re-scan (Decision 30) | Before any public release: `docs/prior-art.md` refreshed with a patent/IP pass |

## Queue

### Q-001 — Ratify the manifest
- **Status:** done 2026-10-01 (trace: traces/2026-10-01-spinup.md)
- **Scope:** `project.manifest.json`
- **Acceptance criteria:** 1. Julian answers the ratification poll with Ratify; `status` updated with the date.
- **Out of scope:** phase work.

### Q-002 — Gate `horde-sample` freshness
- **Status:** done 2026-10-03 (trace: traces/2026-10-03-q-002-sample-freshness.md)
- **Scope:** `tools/convert-sample.mjs`, `verify`
- **Acceptance criteria:** 1. `convert-sample.mjs` accepts an output dir; 2. `./verify fast` regenerates into a temp dir and fails on any byte difference from `schema/examples/horde-sample/`; 3. proven by planting an edit in `prototype/data/sample-horde.js`.
- **Out of scope:** changing the sample's content.

### Q-003 — Prior-art landscape (PA)
- **Status:** done 2026-10-11 (`docs/prior-art.md`; traces: 2026-10-10-prior-art.md, 2026-10-11-prior-art-rulings.md)
- **Scope:** `docs/prior-art.md`
- **Acceptance criteria:** see PA gate.

### Q-009 — Operational lens: seeds from the build (P1)
- **Status:** open (prototype lens done 2026-10-08, ADR 0019 update; operational = reachable from entry points)
- **Scope:** P1 crawler, `design/prototype/lens.js`
- **Acceptance criteria:** 1. lens seeds come from the product build target's sources (CMake File API codemodel, ADR 0027; `compile_commands.json` names no targets / CMake
  target), not file names; 2. platform conditions are read from the build, so `hypersaw_gui_win.cpp`-style files
  are classified by target, not reported as unshipped; 3. build-time code (sources of `generates` edges into the lens,
  followed transitively) is its own class in the view; 4. on HORDE, the 11 product-named-but-unshipped files are
  re-checked against the build and each is confirmed or cleared.

### Q-010 — Schema 0.3 (human gate: schema change)
- **Status:** open; decisions accepted, fields not yet written
- **Scope:** `schema/*.schema.json`, `docs/graph-schema.md`, `tools/loupe-check.mjs`, mutation tests, examples
- **Acceptance criteria:** 1. conditions on edges and on target membership, and the list of configurations covered
  and not evaluated (0026); 2. `resolution` extended with `build` and `syntactic` and required on crawled edges
  (0028); 3. `settings.offsets` with the no-overlap check (0020; replaces Q-006); 4. `lens` once 0019 is accepted;
  5. a mutation case for each new rule; 6. Julian approves the schema diff before it lands.

### Q-011 — Every bundle opens to its edges (0029, first half)
- **Status:** open
- **Scope:** `design/prototype/`
- **Acceptance criteria:** 1. clicking a `×N` bundle lists its member edges in the inspector; 2. a test or
  `conserve()` check that the listed edges equal the edges the meter attributes to that bundle; 3. critic review.

### Q-004 — Prototype v5: fix the v4 review findings (in-house since 0022)
- **Status:** open; worklist `docs/design-review-v4.md`
- **Scope:** `design/`
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
- **Status:** folded into Q-010 (2026-10-11)
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

- **HORDE brief loupe-002** (filed 2026-10-11, respond-by 2026-10-25): may the skill run `cmake` configure in a
  HORDE session (0027)? The answer lands in HORDE's tree; pull `horde/integrations/loupe/` at each wakeup. P1a's
  fixture and crawler work do not wait on it; only the first run on HORDE does.
- **0034:** do exported rules belong in P4 or a phase of their own?

- **Name.** "Loupe" is a working name; the repo is already `Julian-B-Smith/loupe` (public).
- **HORDE thread loupe-001:** answered 2026-10-03, accept with counter-design (ADR 0021). Ball is ours, due at P6 as a notice. Not blocking anything earlier.
- **P7:** does `prototype/` stay once `design/prototype/` exists? Deferred to the P7 gate (spinup poll, 2026-10-01).
- **0007, 0019** are Proposed; P1 and P3 depend on them.

## Graduation criteria

Loupe graduates from interactive prototyping to queue work per phase when the
remaining open questions are infrastructure problems rather than judgment ones.
Judgment column today: visual grammar quality (P2/P7), Structure-agent view
quality (P3), audit-test sufficiency (P4).
