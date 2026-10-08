# Loupe

*Working name.* Loupe makes a codebase legible. A deterministic crawler builds the full directed
dependency graph; agents turn it into a visual map a human can question, audit and navigate.
**Nothing can destroy a node or hide an edge**: every view is lossless, and a deterministic
conservation check proves it after every agent edit.

First client: [HORDE](https://github.com/Julian-B-Smith/horde). Ships first as a Claude Code skill
run inside a target repo.

*Part of the autonomous-paradigm ecosystem (kit 2.6.5). Last verified current: 2026-10-01 (spinup day).*

## How it works

```
target repo ──crawl (deterministic)──▶ graph.json ──▶ Structure agent ──▶ view.json
                                           │                │                │
                                    canonical flow view   dialogue      audit swarm
                                    (no interpretation)   with Julian   (subagents test
                                                                         every claim)
                                                 └──▶ explainers ──▶ navigator
```

Agents write the overlay and view, never the graph. Every edge carries provenance
(static, config, runtime, annotated, inferred).

## Map

| Where | What | Status |
| --- | --- | --- |
| `docs/vision.md` | Pipeline, two-view split, target experience | Current |
| `docs/visual-grammar.md` | Nine visual primitives, the claim each makes, its audit test | Settled for now |
| `docs/graph-schema.md`, `schema/` | Data contract: graph, overlay, view, loupe-spec (schema 0.2) | Accepted |
| `tools/loupe-check.mjs` | Snapshot checker (conservation, ids, provenance) + 20 mutation cases | Built |
| `tools/probe-crawl.mjs` | Regex probe crawler that shaped schema 0.2 | Reference only; not the P1 crawler |
| `prototype/` | Viewer v1 and primitives gallery (open `index.html` in a browser) | Built, on sample data |
| `design/` | Design system snapshot and prototype v4, designed in-house since ADR 0022 | Built; known issues in `docs/design-review-v4.md` |
| `design/prototype/stories/` | "How it works" stories, agent-written from HORDE's source with file:line evidence | Prototype (ADR 0025) |
| Crawler, renderer, agents, skill | P1–P7 | **Not built** |

Full file map: [CODEMAP.md](CODEMAP.md). Plan and phase gates: [ROADMAP.md](ROADMAP.md).
Decisions: [DECISIONS.md](DECISIONS.md) → `docs/decisions/`.

## Status

P0 (spinup) closing. Next: prior-art landscape, then the multi-language crawler (P1).

## See it running

- **Hosted (any device):** [Loupe Testbench](https://claude.ai/artifact/K4sfLzhhWGTj2GoXAAyuJN), a private artifact. It is republished from `main` after each merge that changes a viewer or a snapshot; its build line names the commit.
- **Local:** `npm run view`, then open http://127.0.0.1:4173/ (or start `loupe-view` in the Claude app's browser pane).

Both open the same landing page (`viewer/index.html`): every viewer on every snapshot, including the real HORDE crawl, with the known issues listed first.

## Run the checks

```bash
npm ci
./verify fast
```
