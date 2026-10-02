# Vision

## What Loupe is for

Make an unfamiliar codebase legible to a human, including a non-engineer, without lying about it. The map
has to be simple enough to build intuition and complete enough to trust. Loupe gets both by keeping the
crawled graph as ground truth and treating every picture as a view over it that can be checked.

## Pipeline

| # | Stage | Who | Output |
|---|-------|-----|--------|
| 1 | Crawl | Deterministic code | Directed graph: one node per file; typed edges (include, call, audio, param read, mod, test) with data about each dependency |
| 2 | Structure | Governing agent | A visual representation: groups, hierarchies, buses. Reads the graph and skims files |
| 3 | Dialogue | Agent + human | Ambiguities resolved, errors exposed, visual direction set |
| 4 | Audit | Agent swarm | Each claim in the representation confirmed, challenged or left open |
| 5 | Explain | Agents | Explainers for how features work; data-flow summaries |
| 6 | Navigate | Persistent agent | Guided walkthroughs of the finished map |

## Two views (decision 0006)

**Canonical flow view.** Generated with no interpretation from the crawl: a simplified layout that shows
flow. It is the reference that everything else is checked against.

**Design view.** Composed by the Structure agent from a toolkit of visual primitives (see
visual-grammar.md) chosen to give a human intuition for relationships. Every element in it maps back to
nodes in the flow view.

The two views are linked. The conservation check runs between them, and an animated transition that moves
each box between its canonical and designed position is the main tool for auditing what the agent did.

## Edge provenance

- **Static**: found by the crawler (include, call site). Solid line.
- **Inferred**: added by an agent where no direct reference exists (function pointers, table dispatch,
  registration). Dashed line. Most audit effort goes here.
- **Runtime**: observed in a trace. Dotted line.

## Environment

2D prototype first. The long-term target is a 3D environment (possibly Apple Vision Pro), where an axis
carries meaning, for example depth as abstraction layer. The data model must not assume 2D.

## Known risks

- Static crawling misses dependency injection, event buses, reflection, string-keyed routes and
  config-wired plugins. Provenance tagging makes those gaps visible rather than hiding them.
- Code changes. Annotations should anchor to node IDs plus content hashes; a re-crawl diffs the graph and
  flags stale explainers.
- 3D code maps have historically lost to occlusion and navigation cost. 3D has to earn its place.

## Prior art to study

Sourcetrail (discontinued), CodeSee, CodeCharta (code-city metaphor), dependency-cruiser, madge. None had
the agent, dialogue and audit layers, which are Loupe's differentiator.
