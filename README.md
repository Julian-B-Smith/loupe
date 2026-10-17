# Loupe

*Working name.* Loupe makes a codebase legible. A deterministic crawler builds the full directed
dependency graph; agents turn it into a visual map a human can question, audit and navigate.
**Nothing can destroy a node or hide an edge**: every view is lossless, and a deterministic
conservation check proves it after every agent edit.

First client: [HORDE](https://github.com/Julian-B-Smith/horde). Ships first as a Claude Code skill
run inside a target repo.

*Part of the autonomous-paradigm ecosystem (kit 2.9.1). Last verified current: 2026-10-17.*

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
| `docs/graph-schema.md`, `schema/` | Data contract: graph, overlay, view, loupe-spec | 0.3.1 accepted |
| `tools/loupe-check.mjs` | Snapshot checker (conservation, ids, provenance) + 62 mutation cases | Built |
| `tools/probe-crawl.mjs` | Regex probe crawler that shaped schema 0.2 | Reference only; not the P1 crawler |
| `prototype/` | Viewer v1 and primitives gallery (open `index.html` in a browser) | Built, on sample data |
| `design/` | Design system and the viewer prototype (flow and design views, meter, fold, isolate, lenses, loose nodes), in-house since ADR 0022 | Built; a headless render test in `./verify` |
| `design/prototype/stories/` | "How it works" stories, agent-written from HORDE's source with file:line evidence | Prototype (ADR 0025) |
| `crawler/` | P1a crawler: CMake build layer, C/C++/Objective-C syntax layer, graph.json at 0.3.1, build-target conformance | Built on a fixture; first HORDE crawl done (`design/prototype/snapshots/horde-crawl/`) |
| `docs/plan-map.html` | The plan as a picture: every part, its status, the path to v1 | Current |
| Structure agent, audit, explainers, the skill in a target repo | P3–P6 | **Not built** (see the plan map) |

Full file map: [CODEMAP.md](CODEMAP.md). Plan and phase gates: [ROADMAP.md](ROADMAP.md); the same plan as a picture, with the path to v1: [docs/plan-map.html](docs/plan-map.html) (served by `npm run view`).
Decisions: [DECISIONS.md](DECISIONS.md) → `docs/decisions/`.

## Status

P0 done. The viewer prototype has fold, isolate, history, the Operational lens and the "How it works" stories (see ROADMAP, Viewer track). Prior-art landscape done 2026-10-11 ([docs/prior-art.md](docs/prior-art.md); ADRs 0026 to 0034 accepted). Current phase: **P1a**, mostly built: the crawler's build, syntax and graph layers, conformance, and a first crawl of HORDE. Four stages to a working v1 (finish P1a, P2 renderer gates, P3 Structure agent and dialogue, P6 delivery as a skill).

## See it running

- **Hosted (any device):** [Loupe Testbench](https://claude.ai/artifact/K4sfLzhhWGTj2GoXAAyuJN), a private artifact. It is republished from `main` after each merge that changes a viewer or a snapshot; its build line names the commit.
- **Local:** `npm run view`, then open http://127.0.0.1:4173/ (or start `loupe-view` in the Claude app's browser pane).

Both open the same landing page (`viewer/index.html`): every viewer on every snapshot, including the real HORDE crawl, with the known issues listed first.

## Run the checks

```bash
npm ci
./verify fast
```
