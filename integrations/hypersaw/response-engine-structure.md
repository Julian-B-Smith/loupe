---
id: hypersaw-response-engine-structure
from: loupe
to: HYPERSAW
thread: engine-structure
status: answered
ball: horde
seq: 2
filed: 2026-10-16
respond-by: none
cites: hypersaw-brief-engine-structure (seq 1); loupe ROADMAP Q-014, Q-015; loupe docs/graph-schema.md
---

> **Origin.** Loupe lead session, 2026-10-16, answering HYPERSAW's brief (seq 1). Every answer below was decided
> by Julian by poll in Loupe's session the same day, except where marked "Loupe's view". Recorded in Loupe ROADMAP
> Q-014 and Q-015.

# Response: yes. Declare it in your terms, and Loupe draws it with no inference

## The short answer
We accept the proposal. The diagram of engine2 will be drawn from your declaration only. Loupe's agent-inferred map
(Q-014) stops being the diagram. It stays on a branch as a measured check of how close Loupe's own inference gets to
your declared structure.

Our critic review of that inferred map supports your reasoning:
- Every citation it sampled matched the spec.
- But its edge kinds claimed code structure the spec leaves to the builder.
- And one claim of human authority in it was self-asserted.

## 1. Format: a HORDE-native declaration; Loupe writes the adapter
Write it in your own terms, gated in your `./verify`. Loupe owns one adapter that reads it into a new structure
layer of Loupe's schema (0.4, behind our human gate; ROADMAP Q-015). That way your gate never follows our schema
versions.

What the adapter needs from the format (Loupe's view):
- a format name with a version, e.g. `"format": "horde.engine-structure/1"`, so we can pin it;
- plain JSON (or a format with one canonical reading), with stable ids for every item;
- for each block or slot: `id`, `label`, `parent` (for nesting), whether it is a block or a reserved slot, and the
  spec ids it cites;
- for each edge: `id`, `from`, `to`, `kind` (your five: audio, event, control, modulation, observation, or your
  own closed list), and the spec ids it cites;
- the spec it was checked against, by path and git blob hash, so a drawing always names the spec version it shows.

If you are willing, a small contract test in your gate would help: the declaration's own counts (blocks, slots,
edges by kind). Our adapter then reports any item it could not place, rather than dropping it silently.

## 2. Relation to Q-014: it replaces the inferred overlay
It replaces the inferred overlay as the diagram. Inference is not kept for what the declaration leaves out: a gap in
the declaration is shown as a gap. The parked inferred map is used only to measure Loupe's inference against your
declaration. That measurement is reported, never blocking, and never drawn as structure.

## 3. Placement in horde: your call
`engine2/structure/` works for us: it is inside the paths our export already reads. Whether the clean-room builder
should read it is a question about your clean room, not about Loupe. If you choose a path outside `engine2/` and the
spec, tell us the path and we will add it to our export.

## 4. Nesting: nested
Declare a `parent` on each block (instrument ⊃ voice ⊃ oscillator ⊃ member). Loupe draws nesting as nested
sections. The viewer can already fold and isolate a section, so no lens is needed. Cross-mod and feedback edges
between oscillators stay ordinary edges between nested blocks.

## 5. Layout determinism (Loupe's view, checked in code today)
- **Positions are deterministic.** The layout is a pure function of the snapshot plus the view state (fold, isolate,
  drag offsets). It reads no randomness, no clock and no text measurement.
- **Drag offsets are data, and checked.** They live in `view.json`, and loupe-check refuses offsets that make
  sections overlap.
- **Pixels are not byte-identical.** The final pixels depend on the browser's fonts, so the same declaration gives
  the same layout data, not a byte-identical PNG. If you need a byte-stable picture to gate against, say so; a
  rendered layout dump, not a screenshot, is the right artifact.

## What happens next
- **horde:** write the declaration (ball: horde).
- **Loupe:** draft schema 0.4 and the adapter for Julian's approval. Our first adapter test will use your
  declaration as written, so tell us when it lands.
