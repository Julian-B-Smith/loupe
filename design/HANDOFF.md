# Loupe design delivery

Date: 2026-10-02. Built against handoff packet v2.1, graph schema 0.1.

## Versions

- `tokens.json` version: 4
- `loupe-spec` blocks: version 2 (17 specs)

## What goes where

Unpack this folder over the Loupe repo root. Everything sits under `design/`, the only folder design writes to.

- `design/prototype/`: the working prototype. Plain ES modules, no build step. Copy as is.
  - `index.html` loads a snapshot (`?snapshot=snapshots/<name>/`, default `horde-sample`) and links `../tokens.css`.
  - `render.js`: `render(container, data, state)` returns the element map `{zoom, lod, nodes, edges, elements, layout}`.
  - `layout.js`: `layout(data, state)` returns positions only. Placeholder, for infrastructure to replace.
  - `state.js`: the state object and its actions.
  - `snapshot.js` loads `graph.json`, `overlay.json` and `view.json`, hashes the graph for the stale check, and indexes ids.
  - `standins.js`: `conserve()`, `counterflow()` and `conformity()`. Logic infrastructure replaces.
  - `snapshots/horde-sample/`: the example snapshot from `schema/examples/`, plus stand-ins `stages.sample.json` (dialogue, audit, explain, tours) and `diff.sample.json` (re-run diff). These are needed until those formats have schemas.
  - `snapshots/loops-synthetic/`: a small made-up snapshot with all three loop types, because HORDE has none.
- `design/tokens.css`: a hand-made copy, so the prototype runs today. Replace it with the generated file. It must define every `--loupe-<name>` in `tokens.json`, plus `--loupe-type-<name>` (font shorthand), `--loupe-tracking-<name>` and `--loupe-font-ui` / `--loupe-font-mono`.
- `design/system/`: a snapshot of the design system for reference and checking (`README.md`, `tokens.json`, `components/<id>/README.md`). The real source is the Loupe design system link. The `preview.html` files only run from that project, so they are left out here.

## For the validator

- Every `components/<id>/README.md` holds one `loupe-spec` block. Folder names match the `primitive` values exactly: 9 primitives and 8 glyphs.
- `design/system/README.md` holds the `loupe-dash`, `loupe-motion` and `loupe-lod` blocks.
- Spec values that aren't token names: `edge-kind` (resolved per edge, from role then kind), `provenance` (for `dash`) and `none`.

## Changes since packet v2.1

- Tokens added beyond the required list:
  - `tier-1` to `tier-8` and `tier-N-soft`: hierarchy hue per top-level section, shown as a header strip and outline; edges pick it up on hover only
  - `node-label-compact`, `group-label-compact`, `count-compact`: text snaps to these when boxes are small, instead of disappearing
- Middle zoom level ("structure"): file boxes now show compact labels instead of no labels.
- Sets whose members sit in different sections draw a halo on each member instead of one shape around them all.
- Sections, band levels and the Outside layers gutter can be dragged. Offsets live in `state.offsets` (key: top-level section id, `level:<i>` or `gutter`; value: `dx`, `dy` in world units) and are kept in the browser for each snapshot.

## Open questions for infrastructure

1. Should drag offsets be saved into `view.json` (for example as `settings.offsets`), or stay a local preference?
2. Schemas for `audit.json`, `dialogue.json`, `explain.json` and the re-run diff. The stand-in files show the fields the prototype reads.
3. Placement constraints, if the real layout engine needs them: hubs centered in the gap above their level, the Outside layers gutter, the twins plate.

## Not built yet

- Folding a lane past 12 steps
- The membership strip for a file in more than 3 sets
- Merging the twins conformity row into one chip past 4 ports
- Stress cases beyond HORDE
- Dragging a single twin on its own
