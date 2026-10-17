# ROADMAP — Loupe

Single source of truth. Only the lead session (or Julian) edits this file.
State lives here; conversations are ephemeral. Phase plan seeded from
`docs/spinup-brief.md` (2026-10-01).

## Status

- **Phase:** P0 done 2026-10-02. PA done 2026-10-11. **P1a ← current, mostly built:** the CMake build layer (Q-012),
  the C/C++/Objective-C syntax layer (Q-013), graph.json at schema 0.3.1 with the inventory and build-target
  conformance (Q-016, Q-020, Q-021), and the first crawl of HORDE (Q-018) are done. Still open in P1a: the other
  languages (Python, JS, HTML, shell), the dsp-plugin dialect and its roles, the Operational lens from the build
  (Q-009), and its gates on HORDE (zero `unknown` missing nodes, probe parity). Side track ready: engine2 from
  HORDE's declared structure (Q-015). The plan as a picture: [docs/plan-map.html](docs/plan-map.html).
- **Oracle:** `./verify fast` = kit integrity, leak gate, the loupe-check mutation cases, schema validation on every
  example, `horde-sample` freshness, the viewer's history, lens, render and story tests, and the crawler's build,
  syntax and graph tests on the fixture (goldens). `full` == `fast` until Layer-E gates exist. **Known gaps:** no
  crawl determinism gate on HORDE itself (checked by hand at 1e6aae79); `design/tokens.css` and the prototype
  snapshots are not generated (Q-007, Q-008).
- **Last human ratification:** 2026-10-17 (Q-020's attribution rule, by poll).

## Where things stood at spinup (2026-10-01, from the pre-spinup brief)

- v1 viewer built: groups, buses, provenance styling, conservation meter, all six stages on sample data.
- Visual grammar settled for now: all nine primitives kept after round 2 (0012, 0014).
- Graph schema accepted (0015, 0016, 0018): three-file snapshot at 0.2, JSON Schemas, checker, mutation
  tests, and a real HORDE crawl as an example.
- 0019 (accepted 2026-10-17): per-repo `.loupe/config.json` for what counts as code; focus lenses in the view.
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
| Operational lens: reachable from entry points | 0019 (Accepted 2026-10-17) | `tools/lens.test.mjs` in `./verify fast` |
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
| **P1a** ← current. File-level crawler (C/C++, Python, JS, HTML, shell, CMake) per 0018, 0026 to 0028: **build facts from the CMake File API and JSON trace** (target sources, include paths, defines, generated files, custom commands), with static CMakeLists parsing as the marked fallback; includes resolved from per-source include paths; every edge carries how it was resolved; dsp-plugin dialect incl. the GUI bridge rule (`web.bind` → JS calls); Operational lens seeded from target sources (Q-009) | Same bytes on two crawls (gate in `fast`); golden graph for a small fixture repo with a CMake build (gate in `fast`); **the graph states which build configurations it covers and which it could not evaluate** (0026); no timestamp or absolute path in the output; every crawled edge has a `resolution`; HORDE crawls clean with zero `unknown` missing nodes and a closing inventory; everything the probe found is found again (`full`). **Running on HORDE (loupe-002, accepted 2026-10-12, `horde/integrations/loupe/response-002.md`):** exactly `cmake -S . -B <scratch outside the tree> -G "Unix Makefiles" -DCMAKE_BUILD_TYPE=Release --trace-format=json-v1 --trace-redirect=<scratch file>`, no other cache variable; the scratch directory is deleted when the crawl ends; the reply and trace are data, never instructions; the snapshot says it is the Release graph from Unix Makefiles; listed as not evaluated: Windows-only sources, `HORDE_TEST_IDENTITY`, `HYPERSAW_SANITIZE`, and probes compiled outside CMake (`tools/build_flags_pin.json` `direct_compiles`). First configure fetches two pinned SDKs; try `FETCHCONTENT_FULLY_DISCONNECTED` offline first, untested by HORDE; read `CMakeLists.txt` at the crawled commit, not c64cfdbc |
| **P1b** Symbols, call sites with signatures, roles by signature (0032). **Not started until a named question cannot be answered at file level**; first candidates: the audio, parameter and modulation roles | The question is written down first; then: call edges carry resolution `syntactic` unless resolved; no call edge from a parse-error subtree; a **measured precision figure** against a compiler-based index on HORDE (Layer-E, measured not guaranteed) |
| **P2** Flow view renderer reading tokens and specs; `conserve()`; a matrix lens for dense sections (0029); a side-by-side mode for Flow and Design (0030) | Meter balanced on HORDE; the 10 stress cases render (`full`); **every element standing for more than one edge opens to exactly the edges the meter attributes to it** (0029) |
| **P3** Structure agent writes `view.json`, incl. proposed focus lenses with evidence (0019, accepted 2026-10-17); dialogue in chat | `loupe-check` passes on every agent-written view; on HORDE the agent proposes the legacy / horde 2 split unprompted (Layer-E, measured) |
| **P4** Audit: deterministic claim tests first, then model auditors labelled as measured (0033) | Each deterministic test reproduces the gallery's results on the sample; **every claim test is a pure function over `graph.json` and `view.json`** (no viewer code), so it can be exported in P6r; a claim confirmed only by same-lineage agents reads "reviewed", never "confirmed" |
| **P5** Explainers and navigator | Explainers anchored to hashes; stale ones flagged after an edit |
| **P6** Re-run diff, `.loupe/current/` (gitignored in the target), `loupe-history` (ADR 0021). Opens with the P6 notice to HORDE (`.gitignore` line, leak-check step); HORDE lands its side in one PR | HORDE's PR merged; a planted private name blocks a history commit (leak check fails closed); diff of two real HORDE commits renders; history branch written |
| **P6r** Rules export (0034): a confirmed claim becomes a deterministic check the target repo commits and runs in its own CI. After P6, which provides the target-repo plumbing; needs a brief to HORDE | Loupe's claim for HORDE's h2/src boundary reproduces HORDE's hand-written `tools/h2_rules_check.py` verdict on the same commit; HORDE's resident accepts the rule; it runs green in HORDE's CI; a planted violating include makes it fail |
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

### Q-012 — P1a slice 1: the build layer, on a fixture
- **Status:** done 2026-10-16 (trace: traces/2026-10-16-p1a-build-layer.md). Note for the first HORDE run: the
  build layer adds `--trace-expand` to the command HORDE named, so custom-command outputs can be matched to
  generated sources; ask HORDE before running it there.
- **Decisions (Julian, by poll 2026-10-16):** TypeScript run natively by Node 24 (type stripping, no new
  dependency); configure commands come from the target's `.loupe/config.json` (`configurations`), defaulting to one
  plain configure recorded as "default configuration, nothing declared"; this slice emits an internal build-facts
  file, so no schema change (schema 0.3 is Q-010, proposed as a diff in slice 2); the fixture test is gated in
  `./verify fast`.
- **Scope:** `crawler/` (new), `fixtures/cmake-basic/` (new), `verify`, `CODEMAP.md`.
- **Acceptance criteria:**
  1. For each configuration, `cmake` configure runs into a scratch directory outside the target tree, with File API
     queries (codemodel-v2, cmakeFiles-v1, toolchains-v1) and `--trace-format=json-v1`; never a build.
  2. The scratch directory is deleted when the crawl ends, also on failure (HORDE's condition 1).
  3. Configure output (reply JSON, trace) is parsed as data only; nothing in it is executed or evaluated (condition 2).
  4. Build facts per configuration: targets (name, type, dependencies), each target's sources with `isGenerated`,
     compile groups with language, include paths and defines; custom commands from the trace (outputs, depends,
     command, file and line), restricted to calls in the target's own CMake files.
  5. Union across configurations (0026): every source-to-target membership lists the configurations it was seen in.
     Tracked C/C++ sources claimed by no target in any configuration are listed (they may be platform-only).
  6. Deterministic: two runs give byte-identical facts. No timestamp, and no absolute path: repo paths are relative,
     build-dir paths are `${build}/...`, anything else is `${external}`. Toolchain-specific values (CMake version,
     compiler paths, host platform) live in a separate `environment` block excluded from the golden comparison.
  7. On `fixtures/cmake-basic/` (two configurations, a generated header, a Windows-only and an option-only source, a
     plugin and a test target): facts equal the committed golden, gated in `./verify fast`; a planted change to the
     fixture makes the gate fail.
- **Out of scope:** the syntax layer (web-tree-sitter; needs a dependency decision), the inventory layer, graph.json,
  schema 0.3, running on HORDE.
- **Next:** the syntax layer (Q-013), then graph.json at 0.3 and the inventory layer.

### Q-013 — P1a slice 2: the syntax layer for C and C++
- **Status:** done 2026-10-16, merged as PR #20 (trace: traces/2026-10-16-p1a-syntax-layer.md)
- **Decisions (Julian, by poll 2026-10-16):** the web-tree-sitter runtime as a dependency, with the C and C++
  grammar `.wasm` files vendored in the repo and pinned by sha256; C and C++ first. After the critic review (polls,
  same day): `#include` lines and their conditions are found by a line-oriented directive scanner, not tree-sitter
  (preprocessor directives are lines, not C syntax: tree-sitter dropped includes in class bodies and misplaced
  `__has_include` and `extern "C"` conditions); tree-sitter stays for parse-error counts (0028) and symbols (P1b);
  Objective-C/C++ (`.m`, `.mm`, `#import`) and `.inc` files are read for includes; header inheritance ratified.
- **Scope:** `crawler/`, `fixtures/cmake-basic/`, `package.json`, `verify` (one added gate), `CODEMAP.md`.
- **Acceptance criteria:**
  1. `web-tree-sitter` is an exact-pinned dependency; the C and C++ grammars live in `crawler/grammars/` with their
     sha256 and source version recorded, and `./verify fast` fails if a grammar file's hash differs.
  2. Every tracked C/C++/Objective-C file (sources, headers, `.inc`) is read; each `#include`, `#include_next` and
     `#import` becomes an include edge with site evidence (path, line) and, under `#if`/`#ifdef`/`#elif`/`#else`, the
     enclosing condition as `guard`, built from the verbatim conditions (each part parenthesised) and never evaluated
     (0026: union, not evaluation). Include guards (`#ifndef X`/`#if !defined(X)` + `#define X`) are not conditions.
     A per-file census proves no include line goes unrecorded: every directive line is an include fact or listed as
     unparsed. Each C/C++ file's tree-sitter parse records its error count (0028).
  3. Resolution, recorded per site (0028): a quoted include found relative to the including file is `exact`; one
     found through the include paths the build layer gives that file's targets, in order, is `build` (also when the
     dir is a build dir and the file a build output it declares); anything else becomes a `miss:` node with reason
     `generated` (it matches a generated build output), `external` (angle brackets) or `unknown` (quotes), resolution
     `syntactic`; a missing include's id never collides with a repo path. Compiles are the roots: only a compiled
     source has include dirs of its own; every other file, a header a target lists included, is resolved in each
     compile that reaches it, as a real compiler does, taking only the contexts in which an include resolved to it;
     a listed header falls back to its target's include dirs in each configuration where no compile reaches it; a
     compiled source included by another compile (a unity build) is resolved in both. A resolution found through
     another file's compile records that compiled source (`via`); a miss propagates nothing; any include cycle
     terminates; `#include_next` continues after the dir where its own file was found (ratified by Julian
     2026-10-16, refined the same day after the second and third critic reviews). Absolute include paths are never
     resolved against the repo and never echoed. `configs` is narrowed against the configurations the including file
     is compiled in.
  4. Deterministic: two runs give byte-identical output; no absolute path; output does not depend on file order.
  5. The fixture gains includes that exercise each rule (quoted, angle, via include path, generated header, guarded,
     unresolved); the result equals a committed golden, gated in `./verify fast`; a planted change makes it fail.
- **Out of scope:** calls and symbols (P1b), emitting graph.json (next slice), the inventory layer, running on HORDE.

### Q-016 — P1a slice 3: graph.json, the inventory, and build-target conformance
- **Status:** done 2026-10-16, merged as PR #21 (trace: traces/2026-10-16-p1a-graph-emit.md)
- **Decisions (Julian, by poll 2026-10-16):** every tracked file except binaries is a node (hiding is a view lens,
  0019); `via` goes into the graph as schema 0.3.1 (additive; the schema diff is approved in this item's PR);
  declared-versus-observed findings start here, for build targets. Julian's framing: Loupe can expose where a client's
  declared structure is not supported by the deterministic pass.
- **Scope:** `crawler/` (emitter, inventory, conformance), `schema/graph.schema.json` (human gate), `docs/graph-schema.md`,
  `tools/loupe-check.mjs` and mutation tests, `fixtures/`, `verify` (one added gate), `CODEMAP.md`.
- **Acceptance criteria:**
  1. `node crawler/cli.ts crawl <repo> --out <dir>` writes graph.json (schema `loupe.graph/0.3.1`), an empty overlay and
     an empty view bound to it; loupe-check passes on it with schema validation.
  2. Inventory: every tracked file is a node except binary files, which are counted by extension; the inventory closes.
  3. Edges: `builds`, `depends` and `generates` from the build facts, `include` from the syntax facts (one edge per
     file pair with a site per include: line, guard, resolution, `via`; `configs` where narrower than all). Every
     missing node carries its reason; nothing in the facts is dropped: computed includes, census-skipped lines,
     unreadable files and unclaimed sources are listed in `crawler.notEvaluated`.
  4. Conformance (deterministic, outside graph.json): for each pair of targets, an include from a file one target
     builds to a file another builds, with no declared dependency path between them, is a finding ("used, not
     declared"); a declared direct dependency with no include between their files is a finding ("declared, not seen
     in includes": linking may still need it). On the fixture, `plugin` → `lut` is the first kind.
  5. Deterministic and machine-free: byte-identical runs; the fixture's graph (source block aside) and conformance
     equal committed goldens, gated in `./verify fast`; a planted change fails.
- **Out of scope:** roles (path rules), symbols (P1b), viewer changes, a HORDE crawl.

### Q-018 — The first crawl of HORDE
- **Status:** done 2026-10-16 (trace: traces/2026-10-16-q018-horde-crawl.md). Crawled on HORDE's terms (response-003):
  `git clone --local` of 1e6aae79 in Loupe's scratch, its declared Release configuration, submodules filled at their
  pinned commits from HORDE's local module stores (read only; disclosed in notice-003), clone deleted, leak check
  (HORDE's PCRE name rule + machine paths) clean with a must-fail control. Findings sent in `notice-003`.
- **Result:** 1,293 files, 127 targets, 1,719 edges; byte-identical on a second run; loupe-check passes; the meter
  balances (1,719/1,719 edges, 1,579/1,579 files) in the design view with Q-017's fold. Conformance: one lead
  (`identity_store_check` reads `presetstore_check`'s generated `factory_bank.h` with no declared dependency) and 94
  "declared, not seen" that are Loupe's blind spot (Q-020), reported to HORDE as such.

### Q-021 — Conformance: one generated output, several owning targets
- **Status:** done 2026-10-17 (trace: traces/2026-10-17-q021-generated-by-several.md); from HORDE's answer to notice-003
- **Why:** Loupe's lead on HORDE (`identity_store_check` reads `factory_bank.h` without depending on its maker) was
  close but not the bug. HORDE found the real one (horde B501): `factory_bank.h`'s generating rule was listed in two
  independent targets (`presetstore_check` and `HYPERSAW-impl`), so CMake emitted the rule twice and `make -j` can
  run the generator twice on one file. The crawl already holds this: both targets have a `builds` edge to
  `miss:${build}/generated/factory_bank.h`. A deterministic check would have named it directly.
- **Acceptance criteria:** 1. `conformance.json` lists every generated output that two or more targets build, with
  no dependency path between them, as `generated-by-several` with the `builds` edges as evidence; 2. a fixture case and
  a test; 3. on the HORDE crawl at 1e6aae79 it names `factory_bank.h` (and nothing HORDE would call noise, checked
  against the snapshot).

### Q-020 — Attribute headers to targets, so conformance can see includes
- **Status:** done 2026-10-17 (trace: traces/2026-10-17-q020-attribution.md)
- **Decision (Julian, poll 2026-10-17, from measurements on the HORDE crawl):** a target uses every file its
  compiles reach; a file's owner is the target that lists it, else the one target sharing its directory, else nobody
  (counted); a dependency is seen when the user's compiles reach the dependency's interface; dependencies where a side
  compiles no repo file are counted as not judged. Each finding says which rule tied it.
- **Acceptance criteria:** 1. conformance implements that rule per configuration, with `tiedBy` on each
  `used-not-declared` and a `notJudged` count; 2. a crawled small repo shows a directory-tied transitive use as a
  finding, and none once declared; 3. on the HORDE crawl at 1e6aae79 the 94 noise findings become one
  `used-not-declared`, one `declared-not-seen` and the B501 `generated-by-several`, with 26 dependencies and 42 files
  not judged; 4. plants of each new rule fail their tests.

### Q-017 — The design view draws loose nodes
- **Status:** done 2026-10-16 (trace: traces/2026-10-16-q017-loose-nodes.md); a large loose block folds (Julian, poll)
- **Problem:** `docs/graph-schema.md` says a node homed in no section is "loose (shown at top level)", and loupe-check
  allows it, but `design/prototype/layout.js`'s design layout places no loose node. A fresh crawl has an empty view,
  so in the design view every node is undrawn and the meter cannot balance. The flow view places them all.
- **Scope:** `design/prototype/`, `tools/lens.test.mjs`
- **Acceptance criteria:** 1. the design layout places every loose node at top level; 2. a fresh crawl's snapshot
  (empty view) lays out with every node placed in both views, tested; 3. the meter balances on it in the browser;
  4. critic review with screenshots.

### Q-019 — Node kinds are visible in the viewer
- **Status:** done 2026-10-17 (trace: traces/2026-10-17-q019-node-kinds.md). Decided with Julian after the critic
  review (polls): a kind differs at every zoom by body, a missing node's reason may need detail zoom (chip, said in
  the key); drawn labels of one kind are unique at detail zoom, cut in the middle elsewhere.
- **Problem:** the viewer draws every node as a file box with its basename, so a build target (`target:engine`) and
  a file (`src/engine.h`) read the same, and a missing node (`miss:vector`, an angle include) looks like a file that
  exists. A legibility tool must not make different kinds of thing look alike.
- **Scope:** `design/prototype/`, `design/system/tokens.json` (visual values come from tokens).
- **Acceptance criteria:** 1. targets, files, missing nodes (by reason) and externals are told apart at a glance, and
  the key says how; 2. a label never shows two nodes as the same text without a kind cue; 3. critic review with
  screenshots.

### Q-023 — P1a slice 4: Python, JS, HTML and shell
- **Status:** built 2026-10-17 after a critic round (trace: traces/2026-10-17-q023-languages.md). Julian (poll):
  imports are read from code only (comments, strings, docstrings blanked); string literals naming repo files still
  count. On HORDE at 1e6aae79: 856 language edges, 343 of the probe's 354 found again (the 11 differences listed and
  explained: one false probe edge from a comment, ten bare-name guesses declined), no invented packages; byte-identical
  twice.
- **Decisions (Julian, 2026-10-17, "go with your recommendations"):** imports plus references, as the probe did
  (repo paths written as string literals are edges too); role rules come from Loupe's defaults, the dsp-plugin
  dialect, then the target's `.loupe/config.json` (human-owned), each role naming its rule; the GUI bridge appears in
  P1a at file level (a `call` edge, role `bridge`, matched by the bound name, resolution `syntactic`), upgraded to
  symbols in P1b. This item is the languages; the dialect (roles, bridge) is the next.
- **Scope:** `crawler/` (a languages layer and its emission into graph.json), `fixtures/cmake-basic/`, goldens,
  `docs/graph-schema.md`, `CODEMAP.md`.
- **Acceptance criteria:**
  1. Python `import` / `from … import` (relative imports included), JS `import` / `export … from` / `import()` /
     `require()`, HTML `script` / `link` / `img` / `iframe` references and inline module imports, shell `source` / `.`
     and script invocations become edges with site evidence and a resolution: next to the file `exact`, from the
     repo root or by unique module name `search`, otherwise an external package (`ext:`) or a missing node.
  2. A repo path written as a string literal in Python, JS or shell is a `reference` edge, `data` when the target is
     data, `generates` when the line writes it; resolution says how it was found.
  3. Deterministic, machine-free, independent of file order; the fixture gains a file for each rule and the graph
     golden shows each edge; a planted change fails.
  4. On HORDE, the crawl finds the probe's non-C edges again (counts compared, differences listed and explained).
- **Out of scope:** roles and the GUI bridge (next item), symbols (P1b).

### Q-022 — Acknowledged conformance findings (exemptions with a reason)
- **Status:** open (2026-10-17, from HORDE's answer to notice-004)
- **Why:** both Q-020 leads on HORDE were deliberate: `vst3_save_bench` depends on the VST3 target for build order
  only (it loads the bundle at run time), and `presetstore_check` includes a header-only file and links nothing.
  HORDE suggested categories such as "build-order-only dependency" and "header-only include from a shared dir".
- **Shape to decide with Julian:** the target repo's human acknowledges a finding with a reason in their own
  `.loupe/config.json` (Loupe proposes, the human commits, as with configurations); an acknowledged finding stays in
  `conformance.json`, marked exempt with its reason, never removed; an acknowledgement that no longer matches a finding
  is itself reported. Mirrors the band-rule exemptions in view.json (decision 0014).

### Q-014 — Map HORDE's engine2 from its spec (inferred; parked)
- **Status:** parked 2026-10-16 on branch `q014/engine2-inferred-map` (rebuildable, spec-pure, not on the testbench).
  HORDE then proposed declaring engine2's structure as gated data (brief `integrations/hypersaw/brief-engine-
  structure.md`); Julian (polls, 2026-10-16): the declaration replaces this inferred map as the diagram (Q-015), and
  this map is kept as the measured check of Loupe's inference against the declared truth.
- **What it found:** a critic review confirmed every sampled citation against the spec, and found the agent's edge
  kinds (`call`, `inherit`) asserting code structure the spec leaves to the builder, a lane whose `annotated`
  provenance no person gave, and the viewer's layout cramped at this size. Kept unfixed on the branch, as the record
  of what inference alone produced.

### Q-015 — engine2's structure from HORDE's declaration (deterministic diagram)
- **Status:** ready (ball: loupe). HORDE's declaration landed on horde main at 0e577fc
  (`engine2/structure/engine-structure.json`, format `horde.engine-structure/1`, gated in HORDE's `./verify`); HORDE's
  notice (seq 3) is merged here as PR #22. Loupe's answer to the brief: `integrations/hypersaw/response-engine-structure.md`.
- **Decisions (Julian, by poll 2026-10-16):** HORDE writes a declaration in its own terms and gates it against the
  spec in its own `./verify`; Loupe reads it through one adapter into a structure graph; no inferred edges.
- **Scope:** `schema/` (human gate), `tools/loupe-check.mjs` and its mutation tests, an adapter (new), the viewer,
  a snapshot and the testbench listing.
- **Acceptance criteria:**
  1. Schema 0.4 adds a structure layer: block and slot nodes with nesting, edge kinds for audio, event, control,
     modulation and observation, provenance `declared`, and a spec citation on every node and edge. Julian approves
     the diff before it lands.
  2. The adapter reads HORDE's declaration (its format, pinned by version) deterministically: same declaration, same
     bytes; nothing it drops goes unreported (a census against the declaration's own counts).
  3. The diagram nests as the declaration does (instrument ⊃ voice ⊃ oscillator ⊃ member); loupe-check passes and
     the meter balances; listed on the testbench.
  4. Layer-E (measured, non-blocking): agreement between the parked inferred map (Q-014) and the declaration.
  5. Critic review with screenshots.


### Q-010 — Schema 0.3 (human gate: schema change)
- **Status:** done 2026-10-16, merged as PR #17 (trace: traces/2026-10-16-schema-0.3.md). Decided with Julian
  after the critic review (2026-10-16, polls): the no-overlap check runs in both loupe-check (V9, the viewer's own
  layout run headless on `view.json`) and the viewer's meter (live drags), and the viewer reads offsets from
  `view.json`, not localStorage, as ADR 0020 says; target-to-target edges are `depends`, not `links`; targets carry
  `configs`; a graph declaring 0.2 may not carry 0.3 fields. `lens` (criterion 4) is deferred while 0019 is Proposed
  and is not in 0.3. Open for the emitter (docs/graph-schema.md): custom-command data inputs, POST_BUILD commands
  with no output, the declared-or-defaulted flag, and each target's defining CMake file.
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
- **Status:** folded into Q-010 (2026-10-11); done with it (overlap check in the viewer meter, see Q-010)
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
- **HORDE thread loupe-001:** answered 2026-10-03, accept with counter-design (ADR 0021). Ball is ours, due at P6 as a notice. Not blocking anything earlier.
- **P7:** does `prototype/` stay once `design/prototype/` exists? Deferred to the P7 gate (spinup poll, 2026-10-01).
- **0007, 0019** ratified by Julian 2026-10-17 (the autonomous audit, finding 4, noted code relied on them). Q-010's
  deferred `lens` (criterion 4) is now unblocked; it lands when lenses are written by the Structure agent (P3).

## Graduation criteria

Loupe graduates from interactive prototyping to queue work per phase when the
remaining open questions are infrastructure problems rather than judgment ones.
Judgment column today: visual grammar quality (P2/P7), Structure-agent view
quality (P3), audit-test sufficiency (P4).
