# Prior-art landscape

**Dated 2026-10-10.** ROADMAP phase PA, run as an **amendment pass** (DECISIONS H8): Loupe's design was already
committed (ADRs 0001–0025 and a working viewer), so this pass checks that design against what exists and what is
known. Its rule: **every contradiction with a committed decision becomes a Proposed ADR for Julian. None is absorbed
or discarded.**

> **Rulings, 2026-10-11:** Julian reviewed this document and accepted the recommended option on all nine ADRs
> (0026 to 0034). Brief loupe-002 to HORDE follows from 0027.

## How this was made, and how far to trust it

Four research subagents (Sonnet) each surveyed one lane and were told to state contradictions plainly and to mark what
they could not verify. Their full reports are appendices in [`prior-art/`](prior-art/). Scouts work from search
results and summarised pages, so the lead then opened primary sources for every claim this document relies on.

| Mark | Meaning |
| --- | --- |
| ✅ | The lead read a primary source on 2026-10-10 (paper, official docs, vendor announcement) and it says this |
| ◐ | Real, but narrower or more mixed than the scout reported; the wording here is the corrected one |
| ❌ | Checked and not upheld |
| ? | Scout's claim; not checked by the lead. Do not build on it without checking |

One scout claim failed on reading (❌ C-x1 below), and two were narrower than reported. That rate is the reason for
the marks: a citation that exists is not a claim that is true (LIBRARY L0004).

## The short version

1. **What looks new in Loupe**, found in none of the four lanes: a deterministic **conservation check** (every edge
   drawn, counted or inside a collapsed group); **provenance classes on every edge**; **visual primitives that each
   carry a testable claim**; and **human edits that survive regeneration**. Existing tools omit silently and do not
   count what they omit. (Absence of evidence across about 50 tools, not proof.)
2. **What is not new**: lenses and filters, baseline diffs, hierarchy-based bundling, deterministic build graphs for
   agents (RIG/SPADE, January 2026), and LLM-written repo explanations with line links (Windsurf Codemaps, October
   2025; DeepWiki and its open clones). "Deterministic graph plus LLM narrative" is becoming commodity.
3. **The biggest risks the evidence points at**: (a) the crawler, not the viewer: per-language, compiler-grade
   indexing is what consumed Sourcetrail and CodeSee; (b) a graph that is silently partial because it reflects one
   build configuration; (c) standalone maps that nobody keeps opening.
4. **Nine Proposed ADRs** follow from the contradictions (0026–0034). None changes the one rule.

## Lane 1: code-map and architecture tools

Appendix: [scout-1](prior-art/scout-1-code-map-tools.md).

| Tool | Status | What matters for Loupe | |
| --- | --- | --- | --- |
| Sourcetrail | Discontinued 2021 (archived blog post); a community fork continues (?) | Symbol-level, Clang-based, multi-language indexers. Reasons for stopping are contested: the scout's reading of the post is founders' other jobs, indexer upkeep and waning interest; secondary sources add too few paying customers | ◐ |
| CodeSee | Acquired by GitKraken, announced 2024-05-14 ([press release](https://www.gitkraken.com/press/gitkraken-acquires-codesee-launches-devex-platform)) | Auto-updating code maps; its wind-down notice reportedly cites the cost of ever more languages and stacks (?) | ✅ acquisition |
| Structure101 | Acquired by Sonar, 2024-10-15 ([press release](https://www.sonarsource.com/company/press-releases/sonar-acquires-structure101-to-strengthen-code-quality-offering)) | Survived by being absorbed into a tool people already run | ✅ |
| Doxygen | Active | Truncates graphs at `DOT_GRAPH_MAX_NODES` (default 50), marks a truncated node with a red box, does not count what it dropped | ✅ |
| ArchUnit, dependency-cruiser, jQAssistant, NDepend, Lattix | Active (?) | Rules and gates outlive pictures: structure as checked rules, with a baseline that only reports new violations | ? |
| CodeScene | Active (?) | Change coupling from git history: an edge class that is inferred yet deterministic | ? |
| CMake `--graphviz`, Bazel query | Current | Target-level only | ✅ CMake |

## Lane 2: LLM-era codebase tools

Appendix: [scout-2](prior-art/scout-2-ai-codebase-tools.md).

| Tool or paper | Date | What matters for Loupe | |
| --- | --- | --- | --- |
| Windsurf Codemaps ([announcement](https://cognition.ai/blog/codemaps)) | 2025-10-29 | "AI-annotated structured maps", generated per task, each node linking to exact lines. No audit, no accounting of what is left out, no persistent edits (?) | ✅ exists and links to lines |
| RIG / SPADE, *Repository Intelligence Graph* ([arXiv 2601.10112](https://arxiv.org/abs/2601.10112)) | 2026-01-15 | A **deterministic** build-level map from the **CMake File API and CTest**, with evidence traced to build definitions. Across 8 repos and 3 coding agents: +12.2% accuracy, −53.9% time. The closest published cousin of Loupe's crawler | ✅ |
| *Correlated Errors in Large Language Models* ([arXiv 2506.07962](https://arxiv.org/abs/2506.07962)) | 2025-06-09 | Across 350+ models, models agree 60% of the time when both are wrong; shared provider and architecture drive it. Bears on agents auditing agents | ◐ (the scout's "judges inflate their own provider's scores" was not confirmed from the abstract) |
| DeepWiki, DeepWiki-Open, GitDiagram, Google Code Wiki | 2025–26 | Free repo-to-wiki and repo-to-diagram tools; complaints of wrong architecture are anecdotal; no published accuracy evaluation | ? |
| aider repo map | Active (?) | Ranks symbols and fits a token budget, omitting the rest silently | ? |
| Query2Diagram, AutoSketchEval, ArchAgent benchmark | 2025–26 | Rubrics and benchmarks for diagram-versus-code accuracy; possible evaluation sets for the Structure agent | ? |

## Lane 3: research

Appendix: [scout-3](prior-art/scout-3-research.md).

| Work | Result | For Loupe | |
| --- | --- | --- | --- |
| Ghoniem, Fekete, Castagliola (InfoVis 2004; *Information Visualization* 2005) | Past about 20 vertices, matrices beat node-link diagrams on most tasks; path finding still favours node-link | A matrix lens for dense sections; node-link for following a path | ✅ |
| Wallinger et al., *Edge-Path Bundling* (TVCG 2022, [arXiv 2108.05467](https://arxiv.org/abs/2108.05467)) | Bundling "can result in ambiguous connections that do not exist in the data" | A count on a bundle is not enough; the reader must be able to see its members | ✅ |
| Archambault, Purchase, Pinaud (TVCG 2011, doi 10.1109/TVCG.2010.78) | For graphs changing over time, small multiples were faster than animation; animation had fewer errors on which nodes and edges were added; preserving the mental map made little difference | Offer side by side as well as the animated transition | ◐ |
| Blake et al., *The Impact of Shape on the Perception of Euler Diagrams* (Diagrams 2014) | Circles best, then squares; ellipses and rectangles jointly worst | Do not draw overlaps as rectangular regions | ✅ |
| Sterzik et al., *Perception of Line Attributes for Visualization* (IEEE VIS 2023, [arXiv 2308.04150](https://arxiv.org/abs/2308.04150)) | 23 distinguishable levels for width, 13 for dashing, 14 wave amplitude, 11 luminance (isolated lines, one parameter varied) | Five dash patterns is within the measured range. Combinations and categorical patterns were not tested | ✅ |
| Petre, *UML in practice* (ICSE 2013) | Interviews with 50 engineers in 50 companies, sorted into five patterns of use. The scout reports that 35 of the 50 used no UML; the lead confirmed the study, not that count | If the count holds: diagrams are rarely kept as standing documents, so generate on demand | ◐ |
| Padoan et al., *Charting a Path to Efficient Onboarding* ([arXiv 2401.09605](https://arxiv.org/abs/2401.09605), 2024) | Practitioners do not systematically use visualization tools in onboarding, from lack of awareness | Adoption is a risk; this is not evidence that maps fail when used | ◐ |
| Murphy, Notkin, Sullivan, software reflexion models (TSE 2001) | Compare a stated model with extracted facts: convergence, divergence, absence | The ancestor of Loupe's testable claims; adopt its vocabulary | ? |
| Garcia, Ivkovic, Medvidovic (ASE 2013) | Architecture-recovery techniques had low accuracy against ground truth | Supports auditing every agent-composed grouping | ? |
| Wettel, Lanza, Robbes (ICSE 2011) | A city-metaphor tool beat non-visual tools in a controlled experiment | Evidence that a visual map can help; not evidence for 3D over 2D | ? |

## Lane 4: graph extraction (for the P1 crawler)

Appendix: [scout-4](prior-art/scout-4-graph-extraction.md), which has a 27-row tool table.

| Fact | Source | |
| --- | --- | --- |
| The **CMake File API** (codemodel v2) lists, per target, `sources` with `path`, `compileGroupIndex` and `isGenerated`, and per compile group `language`, `includes`, `defines`. It needs configure and generate only, not a build | [cmake-file-api(7)](https://cmake.org/cmake/help/latest/manual/cmake-file-api.7.html) | ✅ |
| The codemodel is **per build configuration** (`configurations` array) and reflects the platform it was configured on | same | ✅ |
| The codemodel does **not** expose custom commands (what generates what) | same | ✅ |
| `cmake --trace-format=json-v1` records every command call with `file`, `line`, `cmd`, `args`; it also carries a `time` stamp, which must be dropped for byte-identical output | [cmake(1)](https://cmake.org/cmake/help/latest/manual/cmake.1.html) | ✅ |
| `compile_commands.json` names no targets and lists no headers, so it cannot give target membership | scout 4 | ? |
| GitHub **stack-graphs** was archived on 2025-09-09, with no successor named | [repository](https://github.com/github/stack-graphs) | ✅ |
| tree-sitter's C and C++ grammars run no preprocessor; includes and defines are recoverable, calls inside macro-heavy code degrade | scout 4 | ? |
| scip-clang, Kythe, clangd's indexer and CodeQL all need native toolchains (scip-clang also a finished build) | scout 4 | ? |
| SCIP, Kythe and CodeQL do not make Loupe's graph schema redundant: none carries provenance classes, missing nodes or an inventory | scout 4 | ? |

**Recommended shape for P1** (scout 4, adopted as the starting proposal in ADR 0027): three deterministic layers,
each edge tagged with its layer. *Build*: CMake File API plus the JSON trace. *Syntax*: web-tree-sitter for includes,
imports, definitions and call names, with include resolution from the codemodel's per-source include paths and a
marked fallback. *Inventory*: `git ls-files` closure and missing nodes.

## Reuse

| Borrow | From | Where it lands |
| --- | --- | --- |
| Target membership and include paths from the CMake File API | CMake; RIG/SPADE | P1, Q-009 (ADR 0027) |
| Baseline and ratchet: store the known state, report only what changed | ArchUnit (?) | P6 re-run diff; exemptions |
| Claims exported as runnable rules, so the map has a second job in CI | dependency-cruiser, jQAssistant, Lattix (?) | P4 audit (ADR 0034) |
| A matrix lens over the same edge set for dense sections | Ghoniem et al. ✅ | P2 (ADR 0029) |
| Reflexion vocabulary: convergence, divergence, absence | Murphy et al. (?) | P4 audit findings |
| A hallucination rubric for audit findings; public architecture docs as an evaluation set | Query2Diagram, ArchAgent (?) | P3, P4 |
| Change coupling from git history as a deterministic, inferred edge class | CodeScene (?) | later; needs an ADR if taken up |
| A human-owned steering file that survives regeneration | DeepWiki (?) | already Loupe's `.loupe/config.json` |

## Avoid

- **Compiler-grade indexing per language.** It is what the two nearest products spent themselves on. Keep the crawler
  thin and state precision loss as provenance (ADR 0028).
- **Silent omission.** Every tool surveyed that caps, budgets or truncates does so without counting. Loupe's rule
  already forbids it; the crawler must also say what it could not extract.
- **Standalone maps with one job.** Survivors were absorbed into workflows or are gates. Loupe ships inside a coding
  session already; give the map a second job (ADR 0034).
- **Same-lineage audits presented as independent.** (ADR 0033; the doctrine already says this.)
- **Whole-repo model passes on every change.** Regenerate incrementally.

## Contradictions register

Each row is a finding that challenges a committed decision, and the Proposed ADR that puts it to Julian.

Each row is now an accepted ADR.

| # | Evidence | Challenges | ADR |
| --- | --- | --- | --- |
| C1 | The File API answers per configuration and platform ✅. HORDE has a Windows-only file the probe cannot classify | "Same commit, same config: same bytes" (0018, 0019) says nothing about which platform's build the graph reflects; one configure silently under-reports | [0026](decisions/0026-one-graph-per-build-configuration-or-a-union.md) |
| C2 | Target membership needs the File API, which needs `cmake` configure to run ✅; compile_commands.json has no targets (?) | Brief loupe-001, accepted by HORDE, says the crawl "does not execute anything"; ROADMAP P1 names compile_commands.json as the source | [0027](decisions/0027-build-facts-from-the-cmake-file-api.md) |
| C3 | tree-sitter runs no preprocessor (?); "no native deps" and "correct for C++" cannot both hold for computed includes | Stack choice (web-tree-sitter only) and calling syntactically found calls `static` (0016) | [0028](decisions/0028-say-how-each-edge-was-resolved.md) |
| C4 | Bundles create connections that are not in the data ✅; matrices beat node-link past about 20 nodes ✅ | The meter proves counts, not that a reader can tell which edge is which; `×N` bundles in the prototype cannot be opened | [0029](decisions/0029-every-bundle-opens-and-a-matrix-lens.md) |
| C5 | Small multiples were faster than animation for changing graphs; animation had fewer errors on additions ◐ | The animated Flow-to-Design transition as *the* audit tool (vision.md, 0006) | [0030](decisions/0030-side-by-side-as-well-as-the-transition.md) |
| C6 | Rectangles are the worst shape for Euler diagrams ✅ | The overlap primitive (0012, 0014) drawn between rectangular section boxes | [0031](decisions/0031-overlaps-as-marks-not-regions.md) |
| C7 | Sourcetrail and CodeSee were consumed by symbol-level, per-language indexing ◐ | "Later symbols and calls" in P1 (0018) | [0032](decisions/0032-symbol-level-crawling-is-gated.md) |
| C8 | Model errors are correlated across models and more so within a provider ◐ | An audit swarm of the same model family as the Structure agent (0002, stage 4) | [0033](decisions/0033-audit-independence.md) |
| C9 | Maps are rarely kept as standing artefacts ◐; standalone map products ended or were absorbed ✅; LLM repo explanations are free and good enough for many ? | The premise that a map is wanted for its own sake (vision.md) | [0034](decisions/0034-the-map-earns-a-second-job.md) |

### Checked and not upheld

| # | Claim | Why not |
| --- | --- | --- |
| C-x1 | "Five provenance line patterns are too many to tell apart" (scout 3, citing Sterzik et al.) | ❌ The paper measured 13 distinguishable dashing levels. Five is inside that. It remains untested for Loupe's own patterns on real maps, which is an open question below, not a contradiction |

### Open empirical questions (no evidence either way)

No study was found on any of these; they are things to test on the testbench, not decisions to reopen.

- Whether readers actually use edge-provenance encodings.
- The fold threshold of 12 rows (0023), and the three-set limit for overlaps.
- Whether file-level granularity is the right one for comprehension.
- Whether 3D helps or harms (0003).

## What changes because of this pass

- Nine ADRs, 0026 to 0034, all accepted on 2026-10-11. P1 is split into P1a (file level) and P1b (symbols, gated).
- ROADMAP P1 and Q-009 now point at the CMake File API; the P1 gate gains "the graph states which build
  configuration it reflects".
- A pre-ship re-scan (ROADMAP PX) repeats this pass and adds the patent and IP landscape.
