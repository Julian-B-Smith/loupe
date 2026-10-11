> **Scout report, kept as an appendix.** Written by a research subagent (Sonnet) on 2026-10-10 from web searches and summarised page fetches. Only the claims listed as verified in [../prior-art.md](../prior-art.md) were checked by the lead against primary sources; treat everything else here as unverified.

# PA scout 2: LLM-era codebase explain/map/document tools (2023-2026)

Origin: scout 2 of 4, Loupe phase PA (prior-art landscape), research date 2026-10-10. Web pages were treated as data. Fetches were summarised by a small model, so claims are only as good as that summary; anything not read in a primary source is marked UNVERIFIED. Coverage gaps: Cursor visual features, Copilot Spaces, Jules, Glean, CodeViz internals were only shallowly checked (see table).

## Tools table

| Tool | Status 2026 | Deterministic part | Model-generated | Evidence anchors | Silent omission | User correction persists? | Accuracy evidence |
|---|---|---|---|---|---|---|---|
| DeepWiki (Cognition/Devin) | Live; free public, paid private (docs, undated) | Repo indexing; links to source | Wiki pages, architecture diagrams, chat | Source links per docs | Yes: page cap (30; 80 enterprise) and "automatic clustering" can skip parts | Steering only, via `.devin/wiki.json` notes and pages. Not edits to output. | Anecdotal complaints only (no published eval) |
| Windsurf Codemaps | Launched 2025-10-29 | "precise code navigation" | Map and trace guides (SWE-1.5 or Sonnet 4.5) | Clickable nodes link to exact lines | Task-scoped by prompt, so omission by design | No editing mentioned | None stated |
| Google Code Wiki | Public preview 2025-11-13, public repos only | Re-scan on each change | Docs, arch/class/sequence diagrams, Gemini chat | Links from concepts to files/classes/functions | Unspecified | Not documented | None published |
| aider repo map | Open source, stable | tree-sitter tags + graph ranking, fully deterministic | none | Map is signatures, not claims | Yes, deliberate: token budget (default 1k) drops low-ranked identifiers | n/a | n/a (a context aid) |
| Cursor indexing | Live | Merkle tree of file hashes, tree-sitter chunking | Embeddings; chat-made Mermaid on request | None in diagrams | Retrieval is top-k | n/a | n/a |
| Sourcegraph Cody / Amp | Cody Free/Pro retired 2025-07-23, Enterprise-only; Amp spun out 2025-12-02 | SCIP code graph (definitions/references) | Chat answers | Cites retrieved context | Retrieval-limited | n/a | n/a |
| GitDiagram | Open source, 18.1k stars (fetched 2026-10) | File tree input; Mermaid render | LLM writes diagram from tree + README | Components link to files/dirs | Yes: LLM sample of repo | Re-generation only (UNVERIFIED) | Third-party: "well-formed but conceptually wrong" with thin README |
| CodeViz (VS Code) | Exists (G2 listing); depth UNVERIFIED | Claims static analysis + AI | Maps, Q&A | Clickable to code (vendor claim) | UNVERIFIED | UNVERIFIED | None found |
| Greptile | Live, code review product | AST parse | Docstrings per node, embeddings, KB docs | Docs list "key files" | Unspecified | Team can edit KB; persistence across updates NOT documented | None |
| Swimm | Pivoted: now "modernization platform" with deterministic engine | "maps dependencies, entry points, data flows, dead code" | AI agents work on top | "traceable system model" (vendor claim) | Unspecified | n/a | None |
| Driver AI (YC W24) | Live per YC/built-in listings, depth UNVERIFIED | UNVERIFIED | Docs, architecture maps | UNVERIFIED | UNVERIFIED | UNVERIFIED | None found |
| Mintlify | Autopilot (Dec 2025) became Automations (2026) | Triggers on merge | Agent reads diff, opens PR | PR diff is the anchor | n/a | Human reviews PR | None |
| Bloop | Repo archived 2025-01-02; company shut 2026-04-10 | n/a | n/a | n/a | n/a | n/a | n/a |
| Claude Code skills (architecture-overview, athola architecture-diagram, Cartograph, Excalidraw generators) | Community, marketplace-listed | Rules only | Whole diagram | None | Yes: "hard cap near 15-20 nodes" | Re-run overwrites (UNVERIFIED) | None |
| Copilot Spaces | Live | none | Chat grounded on chosen sources | n/a | User-selected sources only | Instructions are human-owned | None |

Not covered with a primary source: Jules/Gemini code understanding, Glean code, Cursor "visual" features beyond Mermaid-in-chat.

## Details (most relevant ones)

**DeepWiki.** Docs say it "auto-generates architecture diagrams, documentation, and source links for every repo", with three effort levels and page caps; steering is `repo_notes` and explicit `pages` in `.devin/wiki.json` (https://docs.devin.ai/work-with-devin/deepwiki, undated). Open-source clones DeepWiki-Open (17.2k stars, Mermaid diagrams, RAG "Ask", plus a "codemap" walkthrough) and OpenDeepWiki (https://github.com/AsyncFuncAI/deepwiki-open via https://docsearch.algolia.com/mcp/docs/repo/asyncfuncai/deepwiki-open; https://www.sourcepulse.org/projects/2390586) show the pattern is commodity. Complaints, all anecdotal: an OpenWrt maintainer, 2026-04-26, says users filed "bugs" from DeepWiki text and lists wrong config descriptions and "misleading architecture or dependency information" (https://forum.openwrt.org/t/important-consideration-deepwiki-ai-generated-docs-may-contain-inaccuracies/249471); a Scala contributor, 2026-02-11, says "most details ... are plain wrong" but gave no concrete examples when asked (https://contributors.scala-lang.org/t/ai-slop-claiming-to-be-documentation/7382); a tech-writer essay, 2025-11-15, cites "subtly wrong facts and diagrams" (https://passo.uno/ai-wikis-docs-teather-as-a-service/). A claim that pages are never regenerated and cannot be removed appears only in a search snippet: UNVERIFIED.

**Windsurf Codemaps.** "AI-annotated structured maps" generated per task prompt, with clickable nodes jumping to exact lines and "trace guides"; Fast (SWE-1.5) or Smart (Sonnet 4.5); no editing and no accuracy claims (https://cognition.com/blog/codemaps, 2025-10-29). This is the closest shipped product to "map with line anchors", but it is task-scoped, per-snapshot, and unaudited.

**Google Code Wiki.** Regenerates docs "after each change"; architecture/class/sequence diagrams; links to files, classes, functions; Gemini chat (https://developers.googleblog.com/en/introducing-code-wiki-accelerating-your-code-understanding/, 2025-11-13). Private repos via a Gemini CLI extension was "forthcoming" then; current status UNVERIFIED.

**aider repo map.** Deterministic: tree-sitter definitions, graph ranking, token budget (default 1k) that shows "the most important identifiers" and drops the rest (https://aider.chat/docs/repomap.html, undated). The cleanest example of a deterministic, budgeted structural summary, and also of deliberate silent omission.

**Greptile.** Parses the AST, generates docstrings per node, embeds them; per-repo knowledge base that "your team can read and edit", updated on code changes. Docs do not say whether edits survive updates (https://www.greptile.com/docs/how-greptile-works/knowledge-bases; graph doc: https://www.greptile.com/docs/how-greptile-works/graph-based-codebase-context).

**Swimm.** Pivoted from living docs to "agentic modernization" built on "deterministic code analysis" with a "structured, traceable system model" (https://swimm.io/, fetched 2026-10). Deterministic-model-first is now what a 2023-era docs-sync vendor sells; independent verification of its claims: UNVERIFIED.

**Cursor.** Indexing is Merkle tree + tree-sitter chunks + embeddings (https://cursor.com/blog/secure-codebase-indexing). Diagrams are user-prompted Mermaid in chat or markdown (https://docs.cursor.com/guides/tutorials/architectural-diagrams); forum threads show renderer limits (https://forum.cursor.com/t/built-in-mermaid-renderer-doesnt-support-c4container-diagrams-older-mermaid-version-bundled/162935). No native audited map found.

**Sourcegraph.** Cody Free/Pro retired 2025-07-23, Enterprise only; Amp spun out 2025-12-02 (https://sourcegraph.com/blog/changes-to-cody-free-pro-and-enterprise-starter-plans; spin-out date from a secondary summary, UNVERIFIED primary). Code graph is SCIP-style definitions/references (https://sourcegraph.com/docs/cody/core-concepts/code-graph): deterministic graph feeding retrieval, not a map.

**Claude Code skills.** Marketplace skills generate Mermaid from exploration; one documents "a hard cap near 15-20 nodes" (https://openskillindex.com/skills/athola-claude-night-market-architecture-diagram; also https://skillselion.com/skills/egamma/plugins/architecture-overview). No evidence anchors, no audit.

**Academic.**
- Repository Intelligence Graph / SPADE (arXiv 2601.10112, 2026-01-15): deterministic, evidence-backed map extracted from CMake File API and CTest metadata, edges traced to build definitions; agents using it gained 12.2% accuracy and cut completion time 53.9% (17.7% accuracy gain on multilingual repos). Closest academic cousin to Loupe's crawler, and CMake/C++ specific. https://arxiv.org/abs/2601.10112
- ArchAgent (arXiv 2601.13007, ICASSP 2026): static analysis + adaptive segmentation + LLM synthesis for multi-view diagrams; benchmark of 8 production repos using public architecture docs as ground truth; ablation shows dependency context helps. https://arxiv.org/abs/2601.13007
- LLM architecture recovery (ECSA 2025, Santilli et al.): LLMs do "structural and stylistic elements" but "struggle with complex abstractions such as class relationships and fine-grained design patterns". https://conf.researchr.org/details/ecsa-2025/ecsa-2025-call-for-research-papers/7/Automated-Software-Architecture-Design-Recovery-from-Source-Code-Using-LLMs
- VisDocSketcher (arXiv 2509.11942, 2025-09-15): agent + static analysis visual docs; valid output in 74.4% of cases; AutoSketchEval checks code alignment with AUC >0.87. A deterministic-ish alignment check on diagrams exists in the literature. https://arxiv.org/abs/2509.11942
- Query2Diagram (arXiv 2604.23816): query-focused UML; experts label nodes Sufficiency/Completeness/Hallucination/Verbosity; fine-tuning on manually corrected diagrams beat GPT-4o and Claude 3.5 Sonnet. https://www.alphaxiv.org/abs/2604.23816.md
- CodeMap / AI-guided exploration (arXiv 2508.05799): hybrid UML + LLM; the summary I read describes a Java prototype with empirical evaluation as future work, while a search snippet describes a 10-participant study, so which is right is UNVERIFIED. https://arxiv.org/abs/2508.05799
- Judge reliability: judges "significantly inflate the accuracy of models from the same provider" (https://arxiv.org/pdf/2506.07962); self-preference bias (https://arxiv.org/html/2410.21819v1); self-grading loops can "mistake stagnation for progress" (https://arxiv.org/pdf/2607.25152). Multi-judge doc evaluation uses four LLM judges (https://arxiv.org/abs/2606.09852), so it inherits that bias.

## A. Reuse / borrow

1. **Deterministic build-system extraction as ground truth** (RIG/SPADE: CMake File API, CTest). Directly relevant to the C++ plugin target; consider reading targets/links from the CMake File API as a `config`-provenance edge source. https://arxiv.org/abs/2601.10112
2. **Budgeted, ranked rendering as an explicit, labelled lens** (aider). Use its rank-by-reference idea for default collapse order, but keep the conservation meter counting what is folded. https://aider.chat/docs/repomap.html
3. **Steering file in the repo** (DeepWiki `.devin/wiki.json` notes and pinned pages). A human-owned config that survives regeneration matches Loupe's "user edits win". https://docs.devin.ai/work-with-devin/deepwiki
4. **Line-anchored node links** (Codemaps). Baseline UX for the How-it-works stories. https://cognition.com/blog/codemaps
5. **Alignment metric between diagram and code** (AutoSketchEval, AUC >0.87) and **node-level hallucination labelling** (Query2Diagram: Sufficiency/Completeness/Hallucination/Verbosity). Use the second as the rubric for the audit swarm's findings and the first as inspiration for a deterministic check. https://arxiv.org/abs/2509.11942, https://www.alphaxiv.org/abs/2604.23816.md
6. **ArchAgent benchmark**: public architecture docs as ground truth across 8 repos, a ready evaluation set for Loupe's Structure agent. https://arxiv.org/abs/2601.13007
7. **Corrected-diagram training signal** (Query2Diagram): user edits are labelled data, not just overrides. https://www.alphaxiv.org/abs/2604.23816.md
8. **PR-as-review for doc changes** (Mintlify): a human-reviewed diff as the unit of acceptance. https://www.mintlify.com/blog/autopilot

## B. Avoid

- Confident, unanchored prose and diagrams: "subtly wrong facts and diagrams" (https://passo.uno/ai-wikis-docs-teather-as-a-service/); "misleading architecture or dependency information" (OpenWrt link above). Maintainer reputational cost is real: users filed bugs from wrong wiki text.
- LLM sampling the repo (GitDiagram): diagrams "well-formed but conceptually wrong" and dependent on README quality (https://www.scriptbyai.com/github-repo-visualizer-diagram/ and https://repowise.dev/blog/comparisons/best-codebase-visualization-tools; secondary sources).
- Node caps and token budgets that omit silently (Claude skills' 15-20 node cap; aider budget; DeepWiki 30-page cap). Fine as a lens only if counted and surfaced.
- Cost and effort tiers: DeepWiki medium ~5-10 and high ~20-40 ACUs per generation. Whole-repo LLM passes are expensive; regenerate incrementally.
- Staleness: wikis regenerate on every change (Code Wiki) or never (reported for DeepWiki, UNVERIFIED). Edits that may not survive regeneration (Greptile docs silent on this).
- Same-lineage auditing: judges inflate their own provider's accuracy (arXiv 2506.07962).
- Vendor dependence: Bloop (shut 2026-04-10), Cody consumer tiers (retired 2025), Swimm (pivoted). Prior art in this lane is volatile.

## C. Contradictions (not softened)

1. Evidence: Windsurf Codemaps (2025-10-29) ships AI maps with clickable exact-line anchors, so Loupe's "How it works stories anchored to file:line" may be already done as a feature, though task-scoped, unedited and unaudited. https://cognition.com/blog/codemaps
2. Evidence: RIG/SPADE (arXiv 2601.10112, 2026-01-15) suggests Loupe's "deterministic evidence-backed graph first, agents on top" may be already done, because it extracts a deterministic map from CMake with edges traced to build definitions and measures agent accuracy gains. Loupe's novelty cannot be "deterministic graph for agents". https://arxiv.org/abs/2601.10112
3. Evidence: Swimm's 2026 positioning (deterministic engine mapping "dependencies, entry points, data flows", AI agents on top) and Greptile/Sourcegraph graphs suggest "deterministic graph + LLM narrative" is commodity, not differentiating. https://swimm.io/
4. Evidence: DeepWiki-Open, OpenDeepWiki, Code Wiki, Codemaps, GitDiagram all ship free LLM repo-to-diagram at scale (e.g. 17.2k and 18.1k stars), so an unaudited Design view competes against zero-cost alternatives; users may judge "good enough" and skip audit. https://github.com/AsyncFuncAI/deepwiki-open, https://github.com/ahmedkhaleel2004/gitdiagram
5. Evidence: LLM judges inflate accuracy for same-provider outputs and show self-preference (arXiv 2506.07962, 2410.21819), so Loupe's "agent swarm audits every claim" may not catch errors if auditors share the author's model lineage. The mitigation must be deterministic checks (as Loupe says) or a different-lineage auditor; audit-by-agent alone should not be counted as a guarantee.
6. Evidence: Query2Diagram argues query-focused diagrams "that include only relevant elements" beat exhaustive reverse-engineered ones, and Codemaps are generated per task prompt; this challenges Loupe's lossless "every edge accounted for" default as the primary reading experience. Loupe's counted-fold may answer it, but task-scoped views are where shipped products converged. https://www.alphaxiv.org/abs/2604.23816.md
7. Evidence: academic and product trend toward combining diagrams with chat (CodeMap abstract; Cursor/Copilot Spaces are chat-first) suggests Loupe's Navigator (step 6) and Dialogue (step 3) are not optional extras; maps-only is not what users are being shipped. Evidence of user preference is thin: UNVERIFIED that users prefer chat over maps. https://arxiv.org/abs/2508.05799
8. Evidence: ECSA 2025 finds LLMs "struggle with complex abstractions such as class relationships and fine-grained design patterns", which suggests Loupe's typed primitives (twins, loops, hubs) that need semantic judgement may be wrong often; the audit step then does the real work. https://conf.researchr.org/details/ecsa-2025/ecsa-2025-call-for-research-papers/7/Automated-Software-Architecture-Design-Recovery-from-Source-Code-Using-LLMs

No evidence found of a shipped product doing conservation-checked lossless views, or persistent user-overrides-win stories (searched; absence is not proof).

## D. Whitespace

Not found in this lane: (1) a deterministic conservation check proving every edge is drawn, bundled or inside a collapsed group (aider and the Claude skills omit silently; none count); (2) per-edge provenance classes (static/config/runtime/annotated/inferred) rendered as line patterns; (3) typed visual primitives each carrying a testable claim audited by a swarm; (4) user edits that win across regeneration for behaviour stories (closest: DeepWiki steering file, Greptile editable KB with undocumented persistence). The deterministic-graph-for-agents idea itself is not new (C2, C3). Absence from search is not proof of absence; Cursor, Jules, Glean, Driver and CodeViz were not examined in depth.

## Sources (date = publication or fetch date where known)

- https://docs.devin.ai/work-with-devin/deepwiki (undated, fetched 2026-10-10)
- https://cognition.com/blog/codemaps (2025-10-29)
- https://developers.googleblog.com/en/introducing-code-wiki-accelerating-your-code-understanding/ (2025-11-13)
- https://aider.chat/docs/repomap.html (undated)
- https://cursor.com/blog/secure-codebase-indexing (undated); https://docs.cursor.com/guides/tutorials/architectural-diagrams (undated); https://forum.cursor.com/t/built-in-mermaid-renderer-doesnt-support-c4container-diagrams-older-mermaid-version-bundled/162935 (undated)
- https://sourcegraph.com/blog/changes-to-cody-free-pro-and-enterprise-starter-plans (2025-06); https://sourcegraph.com/docs/cody/core-concepts/code-graph (undated)
- https://github.com/ahmedkhaleel2004/gitdiagram (fetched 2026-10-10)
- https://www.greptile.com/docs/how-greptile-works/knowledge-bases (undated)
- https://swimm.io/ (fetched 2026-10-10)
- https://www.mintlify.com/blog/autopilot (2025-12)
- https://forum.openwrt.org/t/important-consideration-deepwiki-ai-generated-docs-may-contain-inaccuracies/249471 (2026-04-26)
- https://contributors.scala-lang.org/t/ai-slop-claiming-to-be-documentation/7382 (2026-02-11)
- https://passo.uno/ai-wikis-docs-teather-as-a-service/ (2025-11-15)
- https://github.com/AsyncFuncAI/deepwiki-open (search result, undated)
- https://openskillindex.com/skills/athola-claude-night-market-architecture-diagram (undated, secondary)
- https://arxiv.org/abs/2601.10112 (2026-01-15); https://arxiv.org/abs/2601.13007 (2026-01); https://arxiv.org/abs/2509.11942 (2025-09-15); https://arxiv.org/abs/2508.05799 (2025-08-07); https://www.alphaxiv.org/abs/2604.23816.md (2026-04); https://arxiv.org/abs/2606.09852 (2026-06)
- https://conf.researchr.org/details/ecsa-2025/ecsa-2025-call-for-research-papers/7/Automated-Software-Architecture-Design-Recovery-from-Source-Code-Using-LLMs (2025-09-19)
- https://arxiv.org/pdf/2506.07962; https://arxiv.org/html/2410.21819v1; https://arxiv.org/pdf/2607.25152
- Secondary only, treat with caution: https://www.scriptbyai.com/github-repo-visualizer-diagram/, https://repowise.dev/blog/comparisons/best-codebase-visualization-tools, https://www.sourcepulse.org/projects/697539 (Bloop shutdown claim, UNVERIFIED primary)
