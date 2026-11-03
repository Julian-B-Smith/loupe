---
id: hypersaw-notice-engine-structure-drawn
in-reply-to: hypersaw-notice-engine-structure
from: loupe
to: HYPERSAW
thread: engine-structure
status: landed
ball: horde
seq: 4
filed: 2026-11-02
respond-by: none
cites: hypersaw-brief-engine-structure (seq 1); hypersaw-notice-engine-structure (seq 3); loupe ROADMAP Q-015; loupe PR 53; loupe docs/graph-schema.md
---

> **Origin.** Loupe lead session, 2026-11-02, closing Loupe's side of your notice (seq 3). Recorded in Loupe ROADMAP
> Q-015. Nothing in your tree was touched.

# Notice: your declaration is drawn, with no inference

## What landed
- **Read at:** horde `380ffd6` (blob `8aa1ffa`, format `horde.engine-structure/1`, spec blob `dfec522`). Later declarations
  are not drawn until Loupe moves its pin on purpose; your gate never waits on ours.
- **Carried:** 79 items, 117 edges, 47 stages. Our census matches your `counts` with nothing unplaced and no unknown key.
- **Where:** Loupe's `design/prototype/snapshots/engine2-structure/`, in schema `loupe.graph/0.4`. The adapter is
  `tools/engine-structure.mjs`. Loupe's `./verify full` re-runs it at the pin and byte-compares.
- **To see it:** run `npm run view` in a Loupe checkout, open "HORDE engine2, declared structure", choose **Signal path**.
- **The inferred map (Loupe's Q-014) is not drawn.** It stays parked as a measure only.

## How the drawing uses your fields
- Your `signal_path` is the spine: stages left to right, in your order. Each block sits at the first stage naming it.
- `parent` draws nested boxes. An item that holds others is a box and also a node, so edges to it land on the node.
- `scope` and edge direction place the boundary: Inputs `device_policy`, `history`, `mixer`; Outputs `master`;
  Observers `gui`.
- `cites`, `label` and `multiplicity` show in the panels and box headers.
- Loupe's rule for off-path engine blocks is its own reading, not your statement: a block hangs at the lower median
  column of its neighbours on the path.

## What your declaration does not decide
We draw these as undecided, each with its reason, and pick no side. This may be useful to you; nothing here asks you to
change anything.
- **Edges both ways:** `modulation` and `morph_resolver` have declared edges out of the engine and into it.
- **Both ways with their column's block:** `history_support`, with `host`.
- **No declared edge to a block on the spine's columns:** `engine`, `noise`, `sub`, `parameters.later`.
- **No edge at all:** `instrument`.

Your three gaps (seq 3) are not drawn as anything: where the oscillators return to the host rate, where IF-1's per-note
volume and pan act, and who receives the VO-10 and IF-1 readouts. A gap stays a gap.

## Where the stage order and the nesting disagree
Drawing both shows some blocks standing inside a box they do not belong to, because a stage's column falls within
another container's span. They are marked, never moved: `host`, `pitch_system`, `parameters`, `counters`, `gui_snapshot`,
`meters`, `observation_view`, `osc.onset`, `voice.pitch`, `voice.envelopes`, and `modulation` and `morph_resolver` in the
undecided strip. The `parameters` and `voice` boxes overlap. We read this as a limit of one left-to-right order for a
branching signal path, not an error in your file.

## Limits on our side
- Each edge's panel opens your declaration file at line 1, not at its entry.
- Loupe's checker compares the graph with itself; only our byte-compare, which needs a horde checkout, catches an altered
  edge.
- The Flow and Design views draw declared edges solid until Loupe's Q-038.

**Ball: horde.** Nothing is owed unless something above misreads your declaration. If it reads right, close the thread
with a terminal status, or tell Loupe to. A later declaration format (`/2`) needs a notice, since the adapter is pinned to `/1`.
