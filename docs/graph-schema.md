# Graph schema

Version 0.2 (2026-10-01). Status: Proposed (decisions 0015, 0018). Formal schemas live in `schema/`. Two worked examples: `schema/examples/horde-sample/` (invented, exercises every design-view primitive) and `schema/examples/horde-probe/` (a real crawl of HORDE at commit c64cfdbc, graph only, one section per folder). `tools/loupe-check.mjs` enforces every rule below.

Changed in 0.2: `missing` nodes, file roles, `generates` and `embeds` edges, guards, resolution on sites, and the crawl scope and inventory. Why: decision 0018.

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
| `id` | `file:<path>`, `sym:<path>#<qualified name>`, `ext:<package>`, `art:<path or glob>` or `miss:<path>` |
| `kind` | file, symbol, external, artifact (a glob or data set referenced as a whole) or missing |
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

## Edges

| Field | Meaning |
| --- | --- |
| `id` | `e:` + the first 16 hex of sha256(`src|dst|kind`). Stable across runs, so diffs and annotations stay attached |
| `src`, `dst` | Node ids |
| `kind` | What the crawler saw: include, import, call, reference, inherit, instantiate, test, config, data, generates (a script or build rule produces the file), embeds (a file is compiled into another) |
| `role` | What it means in this kind of codebase: audio, param, mod… Set by a dialect rule (`roleRule` names it) or, in the overlay, by an agent or a person |
| `provenance` | How we know (below) |
| `evidence` | The proof: source sites with line, callee signature, `guard` (the preprocessor condition the site sits under) and `resolution` (exact, compile-db, or search: a guess worth auditing); config keys with an optional build-system `guard`; trace ids; annotations; or an agent's rationale |
| `count` | Number of distinct sites |

Several call sites between the same two files with the same kind are one edge with a count, not many edges.

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

`settings.hubPlacement` is `group` or `center`. `exemptions` record patterns exempt from the band rule. An exemption is pending until Julian has approved it 3 times, or once marked `explicit` (decision 0014). The checker refuses an exemption marked established without that.

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
| `node tools/loupe-check.test.mjs` | 19 deliberately broken snapshots plus the clean sample; each break must be caught |
| `node tools/convert-sample.mjs` | Regenerates the HORDE example from the prototype's sample data |
| `node tools/probe-crawl.mjs <repo> <out> [config]` | Probe crawler (not P1): file level, regex based; C/C++, Python, JS, HTML, shell and CMake generation rules. `tools/probe-config/horde.json` holds HORDE's sibling and SDK prefixes |
