# Spinup brief

For the Claude Code agent running `/spinup` in this folder (updated 2026-10-01). It says what already exists, what must survive the spinup, and the facts the spinup survey will need. Where this brief and the autonomous doctrine disagree, the doctrine wins and the disagreement goes to Julian.

## Read first

1. `CLAUDE.md`: the project brief, the one rule, current state.
2. `docs/decisions/README.md` and the 19 decisions it lists.
3. `docs/graph-schema.md` and `schema/`: the data contract.
4. `docs/design-handoff.md`: the contract with the design agent, who works in this folder at the same time.

## What exists

| Path | What it is | Keep as is? |
| --- | --- | --- |
| `CLAUDE.md` | Project brief | Layer it under the doctrine's CLAUDE.md structure; keep its content |
| `docs/decisions/0001–0019` | Numbered ADRs with Accepted/Proposed status | Yes. Do not renumber or rewrite. Point the doctrine's `DECISIONS.md` at them, or import them as entries that link back |
| `docs/vision.md`, `docs/visual-grammar.md` | Pipeline, two views, the nine primitives and their tests | Yes |
| `docs/graph-schema.md`, `schema/*.schema.json` | Graph, overlay, view and loupe-spec schemas (JSON Schema draft-07) | Yes |
| `schema/examples/horde-sample/` | Schema-valid example snapshot generated from the invented HORDE sample | Generated; regenerate with `node tools/convert-sample.mjs` |
| `tools/canon.mjs`, `tools/loupe-check.mjs`, `tools/loupe-check.test.mjs` | Canonical JSON and ids; the snapshot checker; 19 mutation tests | Yes. These are the seed of `./verify` |
| `tools/probe-crawl.mjs`, `tools/probe-config/` | Probe crawler used to shape schema 0.2 (decision 0018). Not the P1 crawler | Reference for P1; retire when P1 lands |
| `schema/examples/horde-probe/` | Real crawl of HORDE at c64cfdbc: 900 files, 242 nodes, 650 edges | Use as P1's first comparison point, not as a golden (the probe is regex based) |
| `prototype/` | Viewer v1 and the primitives gallery (static HTML) | Yes, as reference. Superseded later by `design/prototype/` |
| `design/` | Reserved for the design agent | Never write here except `design/tokens.css` and `design/primitives.json`, which are generated |
| `package.json` | Declares `ajv` for schema validation | Merge into whatever the doctrine scaffolds |

## Facts for the spinup survey

| Topic | Answer |
| --- | --- |
| What it is | A codebase-legibility tool: a deterministic crawler builds the dependency graph; agents compose a visual map that a human questions and an agent swarm audits. Every view is lossless |
| Who it is for | Julian first; later, people who need to understand a codebase they did not write, including non-engineers |
| First target | HORDE (github.com/Julian-B-Smith/horde), a C++ CLAP plugin with a webview GUI (HTML/JS), Python generators, CMake build rules and many JS lab tools |
| Delivery | A Claude Code skill run in a target repo (decision 0009). First run: full pipeline. Later runs: visual diff, then update |
| Writes outside this repo | Only `.loupe/current/` and the `loupe-history` branch of the target repo (decision 0011). `.loupe/config.json` there is human-owned: Loupe proposes changes, Julian commits them (0019) |
| Stack (confirmed by Julian 2026-10-01) | TypeScript on Node for crawler, checker and skill scripts; web-tree-sitter (WASM, no native builds) for parsing, C++ first; the viewer is static HTML, CSS and JS modules with no build step; JSON Schema as the shared contract |
| AI/deterministic boundary | Deterministic: crawl, canonical JSON, ids, overlay merge, every check, diffs. Agents: the Structure agent (writes `view.json`), auditors, explainers, navigator. Agents write the overlay and view, never the graph |
| Agent architecture | Rung 2, thread plus subagents (confirmed by Julian 2026-10-01): the main session is the Structure agent and runs the dialogue; the audit swarm runs as parallel subagents |
| Oracle | `./verify fast`: schema validation, `loupe-check` on every example, the mutation tests, crawler determinism (crawl a fixture twice, bytes must match). `./verify full`: crawl HORDE at a pinned commit and compare to its golden graph; render the stress cases |
| Visual review | The viewer renders every snapshot; the conservation meter must read balanced |
| Concurrency | The design agent writes `design/`. Infrastructure writes `schema/`, `tools/`, `docs/`. The spinup should record these lanes in the doctrine's form |

## Roadmap phases (proposed gates)

| Phase | Builds | Gate to pass |
| --- | --- | --- |
| P0 | Spinup, `./verify`, CI | `./verify fast` green on the existing tools |
| P1 | Multi-language crawler (C/C++, Python, JS, HTML, shell, CMake) per decision 0018: include paths and defines from `compile_commands.json` with search fallback marked; symbols in headers; signatures on call sites; the dsp-plugin dialect, including the GUI bridge rule (`web.bind` names to JS calls) | Same bytes on two crawls; a golden graph for a small fixture repo; HORDE crawls clean with zero `unknown` missing nodes and an inventory that closes; everything the probe found is found again |
| P2 | Flow view renderer reading tokens and specs; `conserve()` | Meter balanced on HORDE; the 10 stress cases render |
| P3 | Structure agent writes `view.json`, including proposed focus lenses with evidence (0019, once accepted); dialogue in chat | `loupe-check` passes on every view the agent writes; on HORDE the agent proposes the legacy / horde 2 split unprompted |
| P4 | Audit swarm; one test per primitive | Each test reproduces the gallery's results on the sample |
| P5 | Explainers and navigator | Explainers anchored to hashes; stale ones flagged after an edit |
| P6 | Re-run diff, `.loupe/current/`, `loupe-history` | Diff of two real HORDE commits renders; history branch written |
| P7 | Design system integration | `tokens.css` and `primitives.json` generated from the design agent's artifact; `design/prototype/` wired to real data |

## Do not decide these silently

- Repo name and visibility (proposed github.com/Julian-B-Smith/loupe). "Loupe" is a working name.
- Whether `prototype/` stays in the repo once `design/prototype/` exists.
- How the doctrine's `DECISIONS.md` relates to `docs/decisions/`.
