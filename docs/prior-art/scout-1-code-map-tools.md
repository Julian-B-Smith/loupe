> **Scout report, kept as an appendix.** Written by a research subagent (Sonnet) on 2026-10-10 from web searches and summarised page fetches. Only the claims listed as verified in [../prior-art.md](../prior-art.md) were checked by the lead against primary sources; treat everything else here as unverified.

# PA scout 1: code-map / dependency-visualization / architecture tools
Origin: loupe PA research scout 1 (lane: code-map tools), 2026-10-10. Verification date for all "status" claims = 2026-10-10 unless stated.
Legend: [P] primary source fetched this session; [S] secondary / search-snippet only; UNVERIFIED = could not confirm from a primary source.
Caveat: WebFetch summarises pages with a small model; where I could, I confirmed with raw curl (Sourcetrail post, Doxygen config). Several vendor sites (scitools.com, codesee.io) were unreachable (403/SSL).

## Tools table
| Tool | What | Status 2026-10-10 | Graph source | Scale handling | Lossless? | Provenance/confidence | User-editable views |
|---|---|---|---|---|---|---|---|
| Sourcetrail | C/C++/Java/Python source explorer, interactive graph + code side by side | Original archived 2021-12-14 [P]; community fork petermost/Sourcetrail alive, release 2026.10, maintainer says reduced time [P] | Clang AST indexing (C/C++, LLVM/Clang 11) [P] | Neighbourhood-only graph (UNVERIFIED detail); slowed past ~10M LOC [S] | No (shows focus node's neighbourhood) | None seen | No |
| CodeSee | Auto-generated code maps, service/file dependency, PR impact | Shutdown announced (Thu Feb 22; year per Thursday = 2024) [S]; GitKraken acquired 2024-05-14 [S] | Repo + APM/traces | UNVERIFIED | UNVERIFIED | UNVERIFIED | "filtered views / code knowledge views" claimed on marketing page [P, archive] |
| SciTools Understand | Entity/reference DB; butterfly, include, calls, dependency, architecture graphs; C/C++ | Docs live [S]; site 403 so release status UNVERIFIED | Own parser DB | Cluster variants of graphs, user-defined "architectures" [S] | UNVERIFIED | None | Yes (custom architectures) UNVERIFIED |
| Structure101 | Hierarchy + tangle/"XS" structure analysis | Acquired by Sonar 2024-10-15, capabilities folding into SonarQube [P] | Static analysis | Hierarchical composite nodes | UNVERIFIED | n/a | UNVERIFIED |
| NDepend | .NET dependency graph, matrix, CQLinq rules, baseline diff | Alive (features page) [P]; .NET only [P] | .NET assemblies | Graph + matrix pair; "graph good for spaghetti, matrix for coupling" [S] | UNVERIFIED | n/a | Rules are user-editable (CQLinq) |
| Lattix | Dependency Structure Matrix (DSM), rule checking | Alive: 2025.1.7 release [S] | Multi-language incl C++ | DSM partitioning/hierarchy | UNVERIFIED | n/a | Yes (rules, partitions) |
| CodeScene | Behavioral analysis: hotspots, change coupling from git history | Alive [S docs] | VCS history, not code | Hotspots at file / architectural-component / function level [S] | n/a | n/a | Architectural components configurable |
| Sourcegraph | Code search + SCIP precise nav | Alive; Cody consumer plans retired 2025-07-23, enterprise only [S]; SCIP going independent governance 2026-03 [S] | SCIP indexers (incl C++) | n/a (nav, not maps) | n/a | precise vs search-based nav distinction [S] | n/a |
| dependency-cruiser | JS/TS dep validation + graphs (dot/html/mermaid) | Alive, 7.3k stars [P] | Acorn static parse; cannot see dynamic imports [P] | Collapse via config (UNVERIFIED detail) | No: silently misses dynamic/computed imports [P] | Rule-based, no confidence | Rules in config |
| Emerge | Interactive D3 force graphs; C, C++, many langs | Alive v2.0.0 [P] | Parsers; Louvain clustering | Community colouring | UNVERIFIED | none | YAML config |
| CodeCharta | 3D "city" of files by metrics | Active OSS (MaibornWolff) [P] | Importers (Sonar, etc.), metrics not edges | Metric-driven | n/a (no edges) | none | n/a |
| Gource | Animated tree of VCS history | Alive, v0.56 2026-03-06 [P] | VCS log | n/a | n/a | n/a | n/a |
| ArchUnit | Java architecture tests as unit tests | Alive (docs) [P] | Bytecode import | n/a | Partial: incomplete off-classpath [P] | none | Rules are code; FreezingArchRule baselines |
| jQAssistant | Neo4j graph + Cypher rules | Alive, 2.9.1 docs; no C++ plugin mentioned [P] | Scanner plugins into Neo4j | n/a | n/a | none | Rules (concepts/constraints) |
| Doxygen graphs | include/call/collab graphs via dot | Alive | Doxygen parser | DOT_GRAPH_MAX_NODES default 50 truncates; MAX_DOT_GRAPH_DEPTH omits [P] | No | none | config only |
| CMake --graphviz | Target-level dependency dot | Built in [S] | CMake model | per-target dot files, ignore options | Target level only | none | via CMakeGraphVizOptions |
| Bazel query | Build-target graph, --output graph | Built in [P] | BUILD files | somepath/allpaths filters | Target level only; implicit deps included unless flagged [P] | none | n/a |
| IWYU | Include hygiene on clang | Alive, follows clang_22 [P] | Clang | n/a | n/a ("experimental") [P] | n/a | pragma/mapping files |
| VS Dependency (layer) diagrams / Code Map | Layer rules validated in Roslyn | Alive in modified form (UML designers removed; validate build action removed) [S] | Roslyn | n/a | n/a | none | Yes (drawn layers) |

## Details (most relevant)
**Sourcetrail.** Archived 2021-12-14; README says archived by original authors [P https://github.com/CoatiSoftware/Sourcetrail]. Authors' own post (raw, Wayback copy 2021-11-15): the cause was founders taking jobs after closing the startup, a hard-to-maintain multi-platform/multi-language/multi-dependency codebase, and loss of interest ("lost interest in working in the field of language analysis and software visualization") [P https://web.archive.org/web/20211115131149/https://www.sourcetrail.com/blog/discontinue_sourcetrail/]. Earlier commercial failure: not enough paying customers (Wikipedia, [S] https://en.wikipedia.org/wiki/Sourcetrail). Community fork petermost/Sourcetrail released 2026.10, drops Python support, maintainer warns of reduced time [P https://github.com/petermost/Sourcetrail]. Lesson: the product people loved died of maintenance cost of per-language indexers, not of lack of insight value.

**CodeSee.** Marketing page claims auto-updating maps and file-dependency views ("CodeSee shows all the file dependencies") [P archive https://web.archive.org/web/2025/https://www.codesee.io/]. Shutdown rationale (only via search snippet of the company notice, primary page unreachable, so UNVERIFIED as quoted): inconsistent sales growth; solving code understanding needs "more complex codebases, more IDEs, more tech stacks, more programming languages"; Gen AI "made this space even more complex" [S https://www.codesee.io/newsletter]. Date note: the notice says "Thursday, Feb 22", which is a 2024 date (Feb 22 2025 is a Saturday), and GitKraken acquisition was announced 2024-05-14 [S https://www.alternativeto.net/news/2024/5/gitkraken-acquires-codesee-and-launches-new-developer-experience-platform-named-devex/]. Search snippets conflated the order; treat the sequence as UNVERIFIED.

**Structure101.** Acquired by Sonar, announced 2024-10-15; capabilities to fold into SonarQube Server/Cloud; post does not say standalone continues [P https://community.sonarsource.com/t/structure101-joins-sonar/128103; press release https://www.sonarsource.com/de/company/press-releases/sonar-acquires-structure101-to-strengthen-code-quality-offering/]. Pattern: structure-visibility tools survive by being absorbed into a quality/gating product.

**dependency-cruiser.** Validates against declared rules, emits dot/HTML/mermaid; explicitly cannot detect dynamic imports or programmatically built paths [P https://github.com/sverweij/dependency-cruiser]. Its model: rules are the point; the picture is secondary. Silent omission of dynamic edges is exactly Loupe's "no hidden edge" risk, but dependency-cruiser does not label the gap.

**Doxygen graphs.** Config doc (raw config.xml): DOT_GRAPH_MAX_NODES default 50; over it "Doxygen will truncate the graph, which is visualized by representing a node as a red box"; if root's direct children exceed it, "the graph will not be shown at all"; MAX_DOT_GRAPH_DEPTH nodes beyond depth "will be omitted" [P https://raw.githubusercontent.com/doxygen/doxygen/master/src/config.xml]. Truncation is marked (red box) but the omitted edges are not counted: a lossy view with a flag, no accounting.

**Lattix / NDepend.** Both pair a graph with a dependency-structure matrix; NDepend positions graph for spaghetti spotting and matrix for coupling [S https://blog.octo.com/static-analysis-tooling-for-c-and-.net-ndepend-in-depth]. Lattix "2025.1.7" with Python API and risk metrics [S]. Rule checking (Lattix, NDepend CQLinq, ArchUnit, jQAssistant, dependency-cruiser, VS layers) is the sustainable commercial/OSS niche.

**ArchUnit.** FreezingArchRule "records all existing violations" and reports only new ones [P https://www.archunit.org/userguide/html/000_Index.html]: baseline-and-ratchet pattern.

**CodeScene / Gource / CodeCharta.** Orthogonal axis: history and metrics rather than structure. CodeScene's change coupling = files modified together (same commit, same author window, same ticket) [S https://codescene.io/docs/terminology/codescene-terminology.html]. CodeCharta: files as buildings, metrics as dimensions, no dependency edges [P https://codecharta.com/].

**Sourcegraph.** SCIP-based precise navigation incl. C++; precise nav is Enterprise-only; Cody consumer plans retired 2025-07-23 [S https://sourcegraph.com/docs/code-search/code-navigation/precise_code_navigation ; https://costbench.com/changelog/sourcegraph-cody-plan-removed-2026-07/]. Note: costbench is a listicle-tier source.

**Build-level graphs (CMake, Bazel, IWYU).** CMake --graphviz emits project dot plus per-target `.dot.<target>` and `.dependers` files [S https://cmake.org/cmake/help/v3.6/module/CMakeGraphVizOptions.html]. Bazel query works at target level only; `--noimplicit_deps` must be requested [P https://bazel.build/query/guide]. IWYU is "experimental", tracks clang closely [P https://github.com/include-what-you-use/include-what-you-use]. These are cheap ground truth for a C++ crawler's cross-check (target membership), not a map.

## A. REUSE
1. **Baseline-and-ratchet** (ArchUnit FreezingArchRule): store known state, report only deltas. Fits Loupe's "visual diff on later calls" and the conservation meter as a gate. Source: ArchUnit guide above.
2. **Rules as the durable core, picture as view** (dependency-cruiser, Lattix, NDepend CQLinq, jQAssistant concepts/constraints): Loupe's typed primitives each making a testable claim is the same idea; consider exporting claims as runnable rules (CI) so the map earns a second use beyond viewing. Sources above.
3. **Graph + matrix duality** (NDepend, Lattix; Ghoniem et al. 2005: past ~20 vertices matrix beats node-link on most tasks, node-link wins only path-finding) [S https://hal.archives-ouvertes.fr/hal-00343819]. Offer a matrix lens over the same lossless edge set; it is trivially lossless and handles density.
4. **Hierarchical edge bundling** (Holten 2006) uses the containment hierarchy to route edges, which matches Loupe's buses/groups and "edge inside collapsed group" accounting [S https://research.tue.nl/nl/publications/hierarchical-edge-bundles-visualization-of-adjacency-relations-in/].
5. **Truncation marked in the picture** (Doxygen red box) as a minimum; Loupe should go further (counted).
6. **Change coupling as an inferred-provenance edge class** (CodeScene) from git history: gives a "inferred" edge type with a deterministic source. Source above.
7. **Build-graph import** (CMake file API/graphviz, Bazel query) as a config-provenance edge source and cross-check of file-to-target membership.
8. **Clang-based indexing for C++** (Sourcetrail; IWYU) as the reference for what "correct C++ edges" take (macros, generated code, include resolution), and the fork's existing C++ indexer as a study object (GPLv3, licence caution).
9. **Git-history animation / time axis** (Gource) is a cheap affordance for the "visual diff on later calls" if wanted.

## B. AVOID (documented failure modes)
1. **Per-language indexer maintenance sinks the team** (Sourcetrail post [P]; CodeSee notice "more IDEs, more tech stacks, more languages" [S]). Keep the crawler thin: web-tree-sitter + declared adapters, not a compiler-grade indexer per language, or state the accuracy loss as provenance.
2. **Hairballs**: node-link beyond ~20 nodes loses to matrices on most tasks (Ghoniem [S]). Doxygen's default cap of 50 nodes shows vendors give up and truncate.
3. **Silent omission**: dependency-cruiser cannot see dynamic imports [P]; Doxygen drops beyond-depth nodes [P]; Bazel/CMake are target-level only [P/S]. Users cannot tell absence from not-seen. Loupe's provenance must include a "not extractable here" class (e.g. macro-generated includes), or the conservation claim is only over the crawled graph.
4. **Standalone visualization with no sustained use** (Sourcetrail not enough paying customers [S]; CodeSee inconsistent sales [S]; practitioners don't systematically adopt viz tools, lacking awareness [P https://arxiv.org/abs/2401.09605]). Absorbed products (Structure101 into Sonar [P]) are the survivors. Ship inside a workflow people already run (Claude Code skill: good) and give the map a second job (gate, onboarding doc).
5. **Stale diagrams**: CodeSee's marketing leans on "auto generate and auto update" [P archive] precisely because hand-drawn maps rot. Loupe's `.loupe/current/` regeneration is right; "How it works" prose and user edits are the new stale risk.
6. **3D / novelty metaphors for adoption**: CodeCity won a 41-person controlled experiment on correctness/time [S https://2011.icse-conferences.org/content/software-systems-cities-controlled-experiment.html] yet 3D city tools (CodeCharta) remain niche; Loupe already chose 2D first.
7. **Sole-founder, GPL, multi-platform GUI build** (Sourcetrail: Qt, LLVM, JDK, Python versions per release; fork needed Qt5 to Qt6 migration [P]). Static HTML viewer with no build step is the right hedge.

## C. CONTRADICTIONS (not softened)
C1. Evidence: Ghoniem et al. (2005) controlled experiment: for graphs over about 20 vertices matrix representations beat node-link on most tasks; only path-finding favoured node-link [S https://hal.archives-ouvertes.fr/hal-00343819]. Suggests Loupe's decision to make a node-link, box-and-bus visual map the primary representation may be wrong for dense regions because a 2D lossless node-link of a file-level C++ include graph will exceed that threshold almost immediately, and typed primitives (buses, bands) reduce clutter by interpretation, not by readability of the underlying graph. Caveat: study used generic tasks on random graphs, not code graphs, and its recommendation for "bigger than 20" arguably supports bundling/collapsing, which Loupe has.
C2. Evidence: Doxygen caps graphs at 50 nodes by default and offers depth cuts; dependency-cruiser, CMake, Bazel all work at a coarser or filtered granularity [P config.xml; P bazel guide]. Suggests Loupe's committed "full file-level graph, every edge accounted for" may be wrong as the thing users read, because the mature tools converge on lossy-by-default for readability. Loupe's counter is the conservation meter, but no tool in this lane demonstrates that a fully accounted view stays usable at C++ scale; this is untested, not refuted.
C3. Evidence: Sourcetrail died of indexer maintenance cost and lost interest, CodeSee of needing to cover ever more languages/IDEs/stacks (both [P/S] above). Suggests Loupe's plan to start with a deterministic crawler "later symbols/calls" may be wrong in scope because symbol/call-level C++ edges (the part Sourcetrail needed Clang for) are what consumed those teams; include-level file graphs are the cheap part and are not what made those products valuable. Staying at file-level protects maintenance but may deliver less insight than the competing tools users valued.
C4. Evidence: practitioner study finds low awareness and no systematic adoption of visualization tools in onboarding [P https://arxiv.org/abs/2401.09605]; the two nearest products (Sourcetrail, CodeSee) both ended. Suggests Loupe's bet that humans want a persistent visual map may be wrong, because the market evidence is that standalone maps get closed down while rule-checking and quality gates survive (Structure101 absorbed into Sonar, ArchUnit/jQAssistant/dependency-cruiser alive). Counter: n=1 small study, and Sourcetrail's cause per its authors was maintainer attrition, not user disinterest.
C5. Evidence: CodeSee cited Gen AI making code understanding "more complex" as a reason to close [S]. Suggests Loupe's committed premise that agent-composed Design/How-it-works views add value may be wrong or at least unproven because the closest funded team judged AI shifted the problem against a map-first product. Source is a snippet of the notice; UNVERIFIED wording.
C6. Evidence: all lane tools that label confidence at all do so per rule, not per edge (none of the table shows edge-level provenance). Suggests Loupe's five-way provenance with line patterns may be wrong as UI weight if users can't act on it; there is no prior-art evidence that users read provenance encodings. (Absence of evidence, not contrary evidence; included because instructions say do not soften.)

## D. WHITESPACE (what looks new vs this lane)
- A deterministic **conservation check** over every view (edge drawn, bundled-with-count, or in collapsed group). Nothing in this lane does it; Doxygen marks truncation but does not count (config.xml [P]). I searched Sourcetrail, Understand docs, dependency-cruiser, Emerge, CodeCharta; did not find equivalent. Limited search: UNVERIFIED as universally absent.
- **Per-edge provenance classes** (static/config/runtime/annotated/inferred) in the legend. Not seen in any tool here. CodeScene's change-coupling is the only inferred-edge analogue.
- **Typed visual primitives each carrying a testable claim**, with an auditor swarm. No analogue in this lane (Structure101/Lattix partition rules are closest: rule-checked structure).
- **User-edited narrative anchored to file:line where user edits win**. CodeSee advertised user "code knowledge views" [P archive]; no one in the lane combined it with machine auditing.
- Genuinely not new: lenses/filters (Understand architectures, CodeSee filtered views), baseline diffs (NDepend baseline compare, ArchUnit freeze), graph+hierarchy bundling.

## Sources (accessed 2026-10-10 unless noted)
- https://github.com/CoatiSoftware/Sourcetrail (archived 2021-12-14)
- https://web.archive.org/web/20211115131149/https://www.sourcetrail.com/blog/discontinue_sourcetrail/ (post, ~Sep-Nov 2021; fetched via curl)
- https://github.com/petermost/Sourcetrail (release 2026.10; note Aug 2026)
- https://en.wikipedia.org/wiki/Sourcetrail
- https://web.archive.org/web/2025/https://www.codesee.io/ (marketing page, capture 2024-25)
- https://www.codesee.io/newsletter (snippet via search only; page unreachable by fetch)
- https://www.alternativeto.net/news/2024/5/gitkraken-acquires-codesee-and-launches-new-developer-experience-platform-named-devex/ (2024-05)
- https://community.sonarsource.com/t/structure101-joins-sonar/128103 (2024-10-15)
- https://www.sonarsource.com/de/company/press-releases/sonar-acquires-structure101-to-strengthen-code-quality-offering/
- https://github.com/sverweij/dependency-cruiser
- https://raw.githubusercontent.com/doxygen/doxygen/master/src/config.xml
- https://www.archunit.org/userguide/html/000_Index.html
- https://jqassistant.github.io/jqassistant/current/
- https://github.com/glato/emerge
- https://codecharta.com/
- https://gource.io/ (0.56, 2026-03-06)
- https://github.com/include-what-you-use/include-what-you-use
- https://bazel.build/query/guide
- https://cmake.org/cmake/help/v3.6/module/CMakeGraphVizOptions.html (via search snippet)
- https://www.ndepend.com/features/ ; https://blog.octo.com/static-analysis-tooling-for-c-and-.net-ndepend-in-depth
- https://codescene.io/docs/terminology/codescene-terminology.html (search snippet)
- https://sourcegraph.com/docs/code-search/code-navigation/precise_code_navigation (search snippet); https://costbench.com/changelog/sourcegraph-cody-plan-removed-2026-07/ (weak source)
- https://docs.scitools.com/graphs/Butterfly.html (search snippet; scitools.com 403)
- https://devblogs.microsoft.com/devops/uml-designers-have-been-removed-layer-designer-now-supports-live-architectural-analysis/ (2016-10, snippet)
- https://docs.lattix.com/lattix/userGuide/Working_with_the_Dependency_Structure_Matrix_DSM (snippet; "2025.1.7" claim UNVERIFIED primary)
- https://hal.archives-ouvertes.fr/hal-00343819 (Ghoniem et al., 2005)
- https://research.tue.nl/nl/publications/hierarchical-edge-bundles-visualization-of-adjacency-relations-in/ (Holten, 2006)
- https://2011.icse-conferences.org/content/software-systems-cities-controlled-experiment.html (2011)
- https://arxiv.org/abs/2401.09605 (2024-01-17)
Not covered / gaps: Understand current release status, Lattix and NDepend graph-scale limits, Structure101 post-acquisition status, dependency-cruiser collapse option details, and Visual Studio 2022/2026 current state of Code Map were not verified from primary sources.
