# Graph schema

Version 0.3.2 (2026-10-18). Status: 0.3 accepted (PR #17); 0.3.1 accepted (PR #21, Q-016); 0.3.2 approved by Julian (poll, 2026-10-18, Q-009) (decisions 0015, 0018, 0020, 0026, 0027, 0028). Formal schemas live in `schema/`. Three worked examples: `schema/examples/horde-sample/` (invented, exercises every design-view primitive), `schema/examples/horde-probe/` (a real crawl of HORDE at commit c64cfdbc, graph only, one section per folder) and `schema/examples/cmake-basic-0.3/` (the build layer's facts for `fixtures/cmake-basic`, mapped to 0.3 as the table below describes). `tools/loupe-check.mjs` enforces every rule below.

Changed in 0.2: `missing` nodes, file roles, `generates` and `embeds` edges, guards, resolution on sites, and the crawl scope and inventory. Why: decision 0018.

Changed in 0.3.2: every piece of evidence on a `generates` edge says `as` program or input (G10). A program is what makes the output: the first script in a custom command's command line (or, when none is recognised, every script in its DEPENDS, said in `notEvaluated`), the target that owns the command (TARGET form or `add_custom_target`), an executable target the command starts with (bare, or `$<TARGET_FILE:t>`, which the trace keeps unexpanded), or code that writes the file (a site, always a program). An input is anything the command reads or waits for. Why: only the crawler sees the command line, and the Operational lens must tell build-time code (a program) from what is compiled into the product (an input, such as the factory presets and gui2.html). A program the command runs but DEPENDS does not list now gets its own `generates` edge. `as` is allowed only on `generates` evidence and only in a graph that declares 0.3.2, where it is required.

Changed in 0.3.1: site evidence may carry `via`, the compiled sources whose compile's include path found the file, so an auditor knows which compile to open (G9: only on a `build` resolution, and each must be a file in the graph), and `configs`, the configurations in which that directive holds; the edge's `configs` is then the union of its sites' (G7). An include holds where its file is compiled (Julian, 2026-10-16): a file no compile reaches keeps its include edges and is listed in `notEvaluated` as textual only. Both fields are allowed only in a graph that declares 0.3.1 or later.

Changed in 0.3: build `target` nodes with `builds` and `depends` edges (from the build system, 0027); the build configurations a graph covers and what they could not evaluate, with `configs` on any edge or target that holds in only some of them (0026); `resolution` gains `build` and `syntactic` and becomes required on every crawled site and config key (0028); `settings.offsets` in the view (0020; the view schema stays `loupe.view/0.2`, since the field is optional). A graph declares `loupe.graph/0.2` or `loupe.graph/0.3`. A 0.2 graph stays valid as 0.2 and may not carry any 0.3-only field, so a 0.2 reader can trust what it reads; the 0.3 requirements apply only to a graph that declares 0.3. Not in 0.3: `lens`, which waits for 0019 to be accepted.

## A snapshot is three files

| File | Written by | Holds | Deterministic |
| --- | --- | --- | --- |
| `graph.json` | Crawler only | Nodes and crawled edges | Yes: same commit, crawler and dialect give the same bytes |
| `overlay.json` | Agents, traces, Julian | Edges, roles and conditions added on top | No; every entry carries its evidence |
| `view.json` | Structure agent, revised in dialogue | The design view: elements, settings, exemptions | No; every element names who made its claim |

The split is the AI/deterministic boundary in file form. Agents never write `graph.json`, and nothing in the overlay can change or remove a crawled edge. The working graph is graph plus overlay. The flow view is generated from that working graph and is never stored.

Later stages add `audit.json` (findings), `dialogue.json` (questions and answers) and `explain.json` (explainers anchored to node hashes). Their schemas come with those stages.

## Nodes

| Field | Meaning |
| --- | --- |
| `id` | `file:<path>`, `sym:<path>#<qualified name>`, `ext:<package>`, `art:<path or glob>`, `miss:<path>` or `target:<name>` |
| `kind` | file, symbol, external, artifact (a glob or data set referenced as a whole), missing, or target (a build target, 0.3) |
| `targetType` | Target nodes only, required: the build system's type (STATIC_LIBRARY, EXECUTABLE, UTILITY…). A target's `path` is its name |
| `configs` | Target nodes only (0.3): the configurations in which the target exists. Absent means all of them |
| `path` | Repo-relative path; the package name for externals |
| `hash` | `sha256:` of the content, or `none`. Anchors explainers and drives diffs |
| `lang`, `loc` | Language and line count, when known |
| `parent` | A symbol's file. Lets the map zoom from files into symbols later |
| `role`, `roleRule` | What a file is for (product, gui, test, probe, bench, generator, scratch, data, build, tool, doc) and the deterministic rule that said so. Path rules first, then graph rules (anything that generates a file is a generator) |
| `missing` | On missing nodes only: `reason` (generated, external, sibling, unknown) and an optional `note` |

A **missing** node is something the code references that is not in the tree. It is never dropped: a build output, a sibling repo's header or an SDK file is part of the structure even when it is absent. A `generated` missing node needs an incoming `generates` edge or a note saying where it comes from.

v1 crawls files. Symbol nodes are in the schema now so symbol-level crawling (needed to prove feedback loops) adds data without a schema change.

## Crawl scope and inventory

`crawler.scope` records what the crawl looked at: the include and exclude rules, how paths were resolved (`compile-db` from `compile_commands.json`, or `heuristic` path search), and optionally the build target, assumed defines and sibling-repo prefixes. `crawler.inventory` accounts for every tracked file: `files = crawled + Σ excluded`, with each exclusion grouped by reason and extension. `crawled` must equal the number of file nodes. This is the one rule applied to files: nothing in the repo is left out silently.

In 0.3, resolution can also be `build` (read from the build system itself), and `crawler.configurations` is required: each build configuration the crawl ran (`name`, `args`, optional `buildType` and `generator`), from the target repo's `.loupe/config.json`. `crawler.notEvaluated`, also required, lists what those configurations could not evaluate on this host (another OS, an option nobody declared, files built outside the build system), each with a reason; an empty list says everything was evaluated. Not evaluated is never the same as absent (0026).

## Edges

| Field | Meaning |
| --- | --- |
| `id` | `e:` + the first 16 hex of sha256(`src|dst|kind`). Stable across runs, so diffs and annotations stay attached |
| `src`, `dst` | Node ids |
| `kind` | What the crawler saw: include, import, call, reference, inherit, instantiate, test, config, data, generates (a script or build rule produces the file), embeds (a file is compiled into another), builds (0.3: a target compiles or lists a file), depends (0.3: a target needs another built first; linking or ordering only, the build system does not say which) |
| `role` | What it means in this kind of codebase: audio, param, mod… Set by a dialect rule (`roleRule` names it) or, in the overlay, by an agent or a person |
| `provenance` | How we know (below) |
| `configs` | 0.3: the configurations in which the edge holds, by name, sorted. Absent means all of them, and the full list is never written out, so one fact has one encoding |
| `evidence` | The proof: source sites with line, callee signature, `guard` (the preprocessor condition the site sits under) and `resolution` (exact, compile-db, search: a guess worth auditing, build, or syntactic: matched by name in a parse tree, not resolved; required in 0.3); config keys with an optional build-system `guard`; trace ids; annotations; or an agent's rationale |
| `count` | Number of distinct sites |

Several call sites between the same two files with the same kind are one edge with a count, not many edges.

Build edges are checked by shape (G8): `builds` goes from a target to a file or other non-target node, `depends` from a target to a different target, and `generates` may start at a target (its custom command produces a file) but never end at one. No other kind may touch a target, and `builds` and `depends` evidence is resolved by `build`. Every name in `configs` must be a declared configuration, configuration names are unique, `configs` is sorted and never lists them all, and an edge cannot hold in a configuration where its target does not exist (G7).

### From the build layer's facts to 0.3

How the build layer's internal facts (`crawler/build.ts`) map onto the graph. `schema/examples/cmake-basic-0.3/` is this table applied to `fixtures/cmake-basic` by `tools/example-cmake-basic.mjs` (a stand-in until the crawler emits graph.json), and `./verify` checks it.

| Build fact | In the graph |
| --- | --- |
| Configurations that ran | `crawler.configurations`, as declared in `.loupe/config.json` |
| A target | `target:<name>` node with `targetType`; `configs` if it exists in only some configurations. Its build evidence cites the CMake file and line that define it (File API backtrace) |
| A source a target lists | `builds` edge, target → file, with `configs` if not in every configuration |
| A generated source (`${build}/…`) | `miss:${build}/…` node, reason `generated`, plus the `generates` edges that make it |
| A source outside the repo (`${external}/…`) | `miss:${external}/…` node, reason `external` |
| A target's dependencies | `depends` edge, target → target |
| A custom command with OUTPUT or BYPRODUCTS (`add_custom_command`, or `add_custom_target`'s BYPRODUCTS since Q-009) | `generates` edges from each tracked file in DEPENDS, from the program it runs and from the target that owns it, to each output; each says `as` program or input (0.3.2) |
| A tracked source no target claims | an entry in `crawler.notEvaluated` |
| Compile groups (include paths, defines) | Not in the graph: they are how the syntax layer resolves includes, recorded per site as `resolution` and `via` |
| An include (syntax layer) | `include` edge, file → file or `miss:`, one site per directive with `line`, `guard`, `resolution`, `via`; `configs` where narrower than all |
| A computed include, a census-skipped line, an unreadable file, a custom command that yields no edge, an unknown `name:` dependency | an entry in `crawler.notEvaluated` |
| A submodule or a symlink | counted in the inventory (`submodule`, `symlink`), never read |
| A path inside a submodule (a quoted include that lands there, a source the build lists there; Q-025) | `miss:` node, reason `external`, note naming the submodule and its pinned commit; an include is checked on disk when the submodule is checked out (resolution `exact` next to the file, `build` through an include dir; not there: unknown), and said unchecked when it is not |
| A quoted include in a file no compile reaches, found under a parent directory (Q-025) | `include` edge to that file, resolution `search` (a guess about an include path no build states) |
| An include found in the headers the build fetched (FetchContent, `${build}/_deps/…`, listed by name at configure; Q-025) | `miss:${build}/_deps/…` node, reason `external`, resolution `build`; an include not in the listing stays unknown |
| What is still unknown and untracked after that, under a `.loupe/config.json` `siblings` prefix (ending in `/`; ADR 0019, Q-025) | reason `sibling`, note citing the config; a prefix that matched nothing is listed in `notEvaluated`. Two facts naming one missing path: unknown wins |
| A bare file name joined onto a variable named for the repo root (`ROOT / "CMakeLists.txt"`, `join(repo_root, "x")`; Q-025) | `reference` (or `data`, `generates`) from the repo root, resolution `search`; `CMakeLists.txt` is never `data` |
| A file's purpose (Q-024) | `role` (ADR 0018's eleven) on the node, `roleRule` naming what set it, later layers winning: `default:path/{doc-ext, docs-dir, test, build, root-dotfile, repo-tooling, scratch, tools-dir, data-ext, source-dir}`; `dsp-plugin:path/{gui-dir, probe-name, bench-name, check-name}`; `dsp-plugin:build/{product-target, product-reach, test-target, probe-target, bench-target, generator-target, reached-only-by-tests, product-input}`; `graph:runs-command` (the script a custom command runs) and `graph:writes-file` (code that writes a file); `config:roles[i]` (the repo's own patterns, last) |
| A GUI bridge use (dsp-plugin) | `call` edge, role `bridge`, from the HTML/JS file to the file registering the name with `<x>.bind("name", …)`; one site per use line with `signature` = every bound name used on it (comma-joined), resolution `syntactic`; a name registered by a product or gui file draws no edge to a test's re-registration (counted in `notEvaluated`) |
| A Python, JS, HTML or shell import (languages layer, Q-023) | `import` edge, one site per line; resolution `exact` next to the file, `search` from the repo root or by unique module name; else an `ext:` package (`ext:python-std`, `ext:py:<name>`, `ext:npm:<name>`, `ext:node`, `ext:web:<host>`) or a `miss:` node |
| A TypeScript import (`.ts`, `.tsx`, `.mts`, `.cts`; Q-026): static, dynamic, `export ... from`, `require`, `import x = require()` | `import` edge, as for JS; TypeScript's extensions and index files are tried, and `./x.js` finds `x.ts`. An alias from the governing tsconfig (the nearest `tsconfig.json`, or the project a solution-style one references whose `include` covers the file; `extends` lists merged option by option; an inherited `baseUrl` is the base for `paths`) resolves as `search`. An alias that matches but finds no file falls back to module resolution, as tsc does, and is listed in `notEvaluated`; so is a tsconfig that does not parse or extends a package. A bare name that cannot be an npm package (`@/x`) is a `miss:` node, reason `unknown`. `/// <reference path|types>` are edges too. Approximation: tsc assigns a file to a project by `include`/`files`, so a file two projects reach may differ |
| An edge whose every site is type-only (Q-026): `import type`, `export type ... from`, `import type X = require()`, anything a `.d.ts` imports, a triple-slash reference | `role: "type-only"`, `roleRule: "ts:import-type"`: erased at compile time; the Operational lens does not follow it. One runtime site makes the edge runtime. "Runtime" means possibly runtime: `import { type A }` and imports used only as types are kept under `verbatimModuleSyntax` and erased otherwise, which the crawl does not decide; `typeof import('x')` in a type counts as runtime |
| A repo with no `CMakeLists.txt` and no declared configuration (Q-026) | one configuration, `no-build`, with no targets; `crawler.notEvaluated` says no build was run |
| An HTML `script` / `link` / `img` / `iframe` reference, a script invocation, a repo path written in a string | `reference` edge; `data` when the target is a data file; `generates` when the line writes it |
| Whether configurations were declared or defaulted | An entry in `crawler.notEvaluated` when none were declared |

Settled in Q-009: a custom command's data input stays a `generates` edge, marked `as: input`; its script is `as: program`. Settled in Q-016: a POST_BUILD command with no output is listed in `notEvaluated`; a TARGET-form command's outputs are generated by its target; the crawler (`node crawler/cli.ts crawl <repo> --out <dir>`) applies this table; each target's defining file and line now come from the build; an undeclared configuration list is stated in `crawler.notEvaluated`.

### Declared versus observed (build targets)

`crawl` also writes `conformance.json`, outside the graph (the graph holds only what the crawl saw). For each configuration it compares the declared target dependencies (`depends`, followed transitively) with what the targets' compiles actually reach. A target *uses* every file its compiled sources reach through includes. A file's *owner* is the target that lists it, else the one target whose listed sources share its directory, else nobody (Julian, Q-020: measured on the first HORDE crawl, where targets list `.cpp` files but not headers). `used-not-declared`: a target's compiles reach a file another target owns and no dependency path leads to any of its owners; the finding says which rule (`listed` or `directory`) tied the file. `declared-not-seen`: a direct dependency where the user's compiles reach nothing of the dependency's interface (what it lists or its compiles reach); linking may still need it. `generated-by-several`: one generated output listed by two or more targets, some two of them with no dependency path between them, so the build emits its rule twice and a parallel build can run it twice on one file (CMake warns against this; horde B501). Each finding cites its edges and states the weakest resolution among them. What cannot be judged is counted per configuration in `notJudged`: dependencies where a side compiles no repo file, and reached files with no owner.

### Provenance

| Provenance | Lives in | Evidence | Line pattern |
| --- | --- | --- | --- |
| static | graph | a source site | solid |
| config | graph | a config file and key | its own pattern |
| runtime | overlay | a trace | dotted |
| annotated | overlay | a person's note, usually from a dialogue answer | its own pattern |
| inferred | overlay | an agent's rationale | dashed |

An overlay edge's provenance is its strongest evidence, in the fixed order runtime > annotated > inferred. When a trace later confirms an inferred edge, the trace is added and the provenance rises; the earlier evidence stays.

Callee signatures are captured on every site, so bus contracts are checked against real signatures (decision 0012).

## The design view

`view.json` holds no coordinates. It names elements that reference node, edge and element ids:

| Primitive | Key fields | Rules the checker enforces |
| --- | --- | --- |
| section | `members`, `parent` | A node has at most one home section; the section tree has no cycles |
| set | `members` | A named grouping that is not a home (for example Presets) |
| overlap | `sets`, `members` | Sets must be sections or sets |
| bus | `edges`, `contract` | An edge is in at most one bus; members end at the contract target |
| band | `levels` (top to bottom) | Upward edges are findings, never errors; exemptions handle known patterns |
| lane | `steps`, `source` | A static lane needs an edge between every pair of steps. Any other source must name where the order comes from. Never inferred |
| twins | `members` (sections), `interface` | |
| hub | `node`, optional `placement` | |
| loop | `cycle`, `classification`, `evidence` | Circular must be a real cycle; intentional needs evidence; unclassified waits for dialogue |

Every element also carries `claim` (one sentence), `by` (`agent:<name>` or `human:<name>`) and an audit `status` (proposed, confirmed, challenged).

`settings.hubPlacement` is `group` or `center`. `settings.offsets` (added with graph 0.3, decision 0020) holds the sections a person dragged: each key is a top-level section id, `level:<i>` for a band level, or `gutter` for the outside-layers column, with a required `dx` and `dy` in world units. It is a view preference and never changes structure. The checker refuses any other key (V8). Offsets must not make two top-level sections overlap, or a section cover a centered hub, since either could hide a node or an edge. The checker runs the viewer's own layout on `view.json` and refuses any overlap (V9), so an agent's edit is blocked without anyone opening the viewer. The viewer reads its starting offsets from `view.json`, and a drag in the browser is checked by the conservation meter, which shows broken until the sections are moved apart. `exemptions` record patterns exempt from the band rule. An exemption is pending until Julian has approved it 3 times, or once marked `explicit` (decision 0014). The checker refuses an exemption marked established without that.

## Determinism

- **Canonical form.** Keys sorted, nodes and edges sorted by id, evidence sorted, 2-space indent, trailing newline. The checker rejects a `graph.json` that is not byte-identical to its canonical form.
- **No clocks.** The only timestamp is the commit time.
- **Binding.** `overlay.json` and `view.json` record the hash of the graph they were made against. A mismatch means the view is stale, and the conservation meter shows that state.
- **Dirty trees.** A graph crawled from uncommitted changes is marked `dirty` and is never archived.

## Conservation at the data level

The checker proves the arithmetic closes before anything is drawn: the inventory closes (G5), every missing node has a reason (G6), every node is homed in a section or loose (shown at top level), and every edge is in a bus or free. The renderer then proves the drawn side: every edge is drawn, in a bus, folded into a count, or inside a collapsed container.

## Snapshot location

In a target repo, the current snapshot lives in `.loupe/current/`. Every past snapshot is committed to the `loupe-history` branch (decision 0011).

## Tools

| Command | Does |
| --- | --- |
| `node tools/loupe-check.mjs <snapshot dir>` | Validates schemas (when `ajv` is installed) and every rule above; prints the conservation summary |
| `node tools/loupe-check.test.mjs` | 53 cases: deliberately broken snapshots (0.2 and 0.3) plus clean ones; each break must be caught, with schema validation on |
| `node tools/convert-sample.mjs` | Regenerates the HORDE example from the prototype's sample data |
| `node tools/probe-crawl.mjs <repo> <out> [config]` | Probe crawler (not P1): file level, regex based; C/C++, Python, JS, HTML, shell and CMake generation rules. `tools/probe-config/horde.json` holds HORDE's sibling and SDK prefixes |
