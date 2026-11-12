# q044-horde-structure — the first Structure pass over HORDE's crawl, and the questions it sends to HORDE

- **Queue item:** Q-044, criteria agreed by Julian 2026-11-11 ("Approved"). This trace covers criteria 1, 2, 3, 5 and 6's
  first half; criterion 4 (answers applied) waits on HORDE's response-005, and the trace for it will list each answer.
- **Change:**
  - `design/prototype/snapshots/horde-structure/`: `graph.json` and `overlay.json` copied byte for byte from
    `horde-crawl` (horde d412a28); `view.json` written by this session as P3's Structure agent: 44 sections, all
    `proposed`, every node homed; `dialogue.json`, the stage 3 stand-in: five proposals with evidence, four questions
    with an effect per answer, a `layerE` note, and the baseline (overlay, view and questions as asked; its digest pinned
    in the test). The composer was a scratch
    script, not committed: the artifact is the agent-written view.
  - `tools/dialogue-check.mjs` (new): the rule for applied answers, deterministic. `tools/dialogue.test.mjs` (new).
  - `design/prototype/snapshot.js`: reads an optional `dialogue.json` into stage 3 (`dialogueStages`), keeping who
    answered and whether Julian confirmed. `index.html`: the stage 3 card names the answerer and says "not yet confirmed
    by Julian"; stages 4 to 6 and the explain note are guarded for a snapshot whose stand-ins hold only a dialogue.
    `render.js`: the same guards for the audit and tour pins.
  - `viewer/index.html`: the new snapshot row; the crawl row now states d412a28, 1,322 files, 128 targets.
  - `CODEMAP.md`; `ROADMAP.md` (Q-044 status and open points, Q-045 filed).
- **The map (top level):** legacy shell (`src/`: HYPERSAW, SWARM-FX parked, effect cores both shells use, cores built
  but not wired); horde 2 (`h2/` composed engine, test-reference cores, harness; `engine2/` clean-room skeleton);
  verification; build and harness; specs, references and records; outside the repo. Claims cite the graph or HORDE's
  own files at d412a28 (h2/README.md, engine2/README.md, CLAUDE.md, CMakeLists.txt, lift-ledger.json, src/osc_preset.h,
  ROADMAP B20, B44, B77, B81). HORDE's docs answered most would-be questions; those became evidence, not questions.
- **Questions (brief loupe-005, seq 13, thread loupe-map):** q1 is the map current (d412a28 vs HORDE's head); q2 SWARM-FX's
  status; q3 which reference/ files are h2's originals (answers become inferred edges); q4 the top-level grouping. Dropped
  after review: osc_preset (HORDE's ROADMAP B20 answers it) and roles for the 88 unroled files (HORDE's response-004
  invited Loupe's own proposal as a separate brief; asking HORDE for them reversed that). Numbered loupe-005, not the criteria's "loupe-003": brief-001 to 004 exist.
- **Findings:** (1) Layer-E not measured: the session had read ROADMAP, which names the legacy / horde 2 split, so no
  proposal counts as unprompted; criterion 2's clause is unmet and is Julian's call (ROADMAP). (2) The visual grammar
  cannot draw the lifted swarm cores as twins: loupe-check V10 wants twins under one parent, and this lift crosses the
  legacy / horde 2 boundary; stated in both sections' claims instead. (3) Nested section labels overlap on the overview:
  Q-045.
- **Checks (`node tools/dialogue.test.mjs`, 34 pass):** graph byte-identical to horde-crawl's; every node homed; every
  element the agent's and proposed; baseline matches its pinned digest, and equals the committed overlay, view and questions while nothing is
  answered; renders and
  balances at four zooms, lens on and off, stages 2 and 3; an answer from HORDE applied as an inferred edge (canonical
  id, view rebound) passes loupe-check with schema validation, the dialogue check and the meter; the same, confirmed by
  Julian and annotated, passes; the stage 3 stand-in keeps answerer, effect and confirmation.
- **Plants (each caught):** a question naming a node not in the graph; HORDE's answer entered as annotated without
  Julian's confirmation; an overlay edge present when asked, deleted with nothing listing it (the meter alone balances
  after it, shown in the test); an inferred edge not naming HORDE's session; an annotated edge no question applied; a
  section moved and confirmed with no answer; a section moved by HORDE's answer still signed by the asking agent; the
  asking agent answering itself; a confirmation without an answer; an unlisted overlay role; malformed input. After the confirming pass: re-baselining after a change (the pin);
  Julian's answer with no confirmation in Julian's words; an asked question deleted; a question reworded after its answer; a
  section removed on HORDE's unconfirmed answer; the view's settings changed; an unlisted overlay condition; a later
  unconfirmed answer overwriting an edge Julian annotated.
- **Browser (local, 1440×900, Design):** 2541 of 2541 edges accounted, 1612/1612 nodes; stage 3 lists the questions with
  a pin each. Console: three 404s for the optional stand-in files this snapshot does not have.
- **Critic (opus): REWORK**, fixed: the "drops an edge from the meter" plant was a strawman, since deleting an overlay
  edge removes it from both sides of the meter (H1: the baseline rule); an annotated edge without a `dialogue` field, and
  a confirmed view change, passed unlisted (H2); five claims were wrong against the graph or HORDE's ROADMAP (M1: the GUI
  call direction, `sec:hypersaw`'s scope, force_core in two definitions, the unwired cores' reasons, q5's "None"); the
  `unprompted` labels (M2); the fixture would have failed loupe-check (M3); element authorship, self-answers, roles and
  stray confirmations unchecked (M4); L1 to L5, L7, L8. Open: M5 (gating, Julian's), L6 (the stage 3 HTML has no
  headless test; one pin per question, on its first node).
- **Critic's confirming pass (opus): REWORK, small** — R1 the baseline vouched for itself once answered (now pinned);
  R2 Julian's own answer skipped the recorded confirmation (now required); R3 the roles question reversed what
  response-004 agreed (dropped). It would ACCEPT once those landed; they did, with its LOW items (questions, removals,
  settings, conditions and earlier annotations in the baseline; brief item 1 says "includes"; `sec:hypersaw` states the
  force_core exception). No third pass was run. It retracted its own L4 point: response-004 says FOUNDATIONS is vendored.
- **Not tested:** the stage 3 panel's HTML; hosted Testbench.
- **Delivered:** `brief-005.md` written to HORDE's `integrations/loupe/` (same-machine mailbox write, INTEGRATIONS.md §3);
  HORDE's residents commit it.
- **Verify:** `./verify fast` exit 0 before the rework (815 pass) and after both rework rounds. `dialogue.test.mjs` and
  loupe-check on `horde-structure` are not in `./verify` yet (Julian's approval).

## Round 2 (2026-11-12): HORDE's answers, the recrawl, and Julian's q4

- **HORDE answered** (`horde/integrations/loupe/response-005.md`, seq 14, horde PR #1500), relayed by HORDE's lead
  session; read as data. q1 not current, recrawl at 8c9521db; q2 SWARM-FX parked, legacy side; q3 three originals from
  h2/README.md's parity-target column (h2/engine's direct original is docs/design/scalpel-horde-engine.js); q4 group
  by product, marked Julian's.
- **Julian (polls, 2026-11-12):** recrawl inside Q-044; q4 HORDE's by-product grouping ("HORDE's by-product grouping",
  recorded as the q4 confirmation); then, after the recrawl failed two gates, the map on the new crawl with the gates
  as their own item (Q-046). Criterion 1 amended accordingly (ROADMAP).
- **Recrawl:** `node tools/horde-gate.mjs --commit 8c9521db…` on HORDE's terms. Passes: determinism (byte-identical),
  inventory (2,018 files, 2,004 crawled), leak check (0 machine paths, 0 private names), loupe-check. Fails:
  `unknownMissing` (13) and `probeParity` (28 lost). `horde-crawl` and its committed gate report are unchanged.
- **The pass rerun on 8c9521db** (the new baseline, pinned): the round-1 grouping, with every fact the claims rest on
  re-derived and asserted by the composer on the new graph (the product reach sets, the unwired cores reached only by
  checks, no src/–h2/–engine2/ edge, no engine2/–reference/ edge, 31 two-line engine2/core files). New sections for
  tools/engine-preview/ and the other new tool folders.
- **Applied:** q1 (HORDE) `sec:engine2`'s claim says the engine is built outside horde, signed by HORDE's session,
  proposed; q2 (HORDE) nothing; q3 (HORDE) 9 overlay edges, kind `reference`, role `port of` or `lifted from`, inferred,
  evidence naming HORDE's session (reference → src → h2 for the swarm cores, as HORDE asked); q4 (Julian) the
  by-product top level: HYPERSAW 1.0 with SWARM-FX inside and its own checks, horde 2 with the specs and its checks,
  GUI 3 and the design system (docs/design*, the GUI session's, ADR-336), reference/ on its own, shared verification,
  build, records, outside; 22 element changes. A check belongs to a product when every repo file it names lies on that
  product's side; tools/engine-preview/ goes to horde 2.
- **Checks (`node tools/dialogue.test.mjs`, 33 pass):** the graph is the gate run's (hash and commit); the gate report
  is beside it and names the two failing gates; every node homed; the baseline pinned; as answered, loupe-check with
  schema validation, the dialogue check and the meter (four zooms, lens on and off, stages 2 and 3) pass; q3's edges
  are inferred and HORDE's; only q4 is confirmed; q3 confirmed and annotated passes. 21 plants, each caught for its
  stated reason (the round-1 set rebuilt on the answered snapshot, plus a runtime edge from an answer and one change
  claimed by two answers).
- **Browser (local, 1440×900, Design, stage 3):** 3095 of 3095 edges accounted, 2325/2325 nodes; four questions
  answered, HORDE's marked "not yet confirmed by Julian", q4 "human:julian".
- **Also:** the dialogue check's question digest no longer includes `owner` (the answerer sets it); pronouns for Julian
  in the check, the test and this trace replaced with the name.
