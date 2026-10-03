# Loupe design system

Loupe turns a codebase into a map: a deterministic crawl builds the dependency graph, agents compose a design view from nine visual primitives, a human questions it, and an audit swarm tests every claim. This system defines how the map and its app chrome look, and ships a working prototype that renders real snapshot files. It follows the handoff packet v2.1 (`reference/design-handoff.md`).

Version: `tokens.json` → `version: 4`. Spec blocks are at `version: 2`.

Sources: the Loupe folder (`CLAUDE.md`, `docs/`, decisions 0001–0017, `schema/`, `schema/examples/horde-sample/`, `prototype/` v1 viewer). No logo exists; the name is set in type.

## What Loupe reads

- `tokens.json`: list shape per family, color themes `light` then `dark`, top-level `version`.
- `components/<id>/README.md`: one `loupe-spec` block each, validated against `schema/loupe-spec.schema.json` (copy in `reference/`). 9 primitives: section, set, overlap, bus, band, lane, twins, hub, loop. 8 glyphs: node, group-header, edge, count-badge, question-pin, audit-pin, tour-step, conservation-meter.
- The three blocks below.

```loupe-dash
{"static": "none", "config": "10 4", "runtime": "0.1 3.6", "annotated": "9 3 1.5 3", "inferred": "4 3.5", "gap": "2 4",
 "cap": {"runtime": "round"}}
```

Patterns differ in kind: solid, long dash, round dots, dash-dot, short dash. Lengths are screen px at every zoom.

```loupe-motion
{"flow-to-design": {"duration": 600, "easing": "cubic-bezier(.2,.7,.2,1)", "staggerBy": "group", "maxTotal": 900,
                    "decor": "primitives fade in over the last 40% (to design) and out over the first 40% (to flow)"},
 "hover": {"duration": 120}, "diff-reveal": {"duration": 400}, "sheet": {"duration": 250},
 "crossFadeAbove": 300, "reduced-motion": "cross-fade only, 150 ms"}
```

Stagger per group is `(maxTotal − duration) / (groups − 1)`, so any map finishes in 900 ms.

```loupe-lod
{"levels": [
  {"name": "overview", "maxScale": 0.32, "nodes": "hidden", "groups": "headers-and-counts", "edges": "bundled-between-groups"},
  {"name": "structure", "maxScale": 0.6, "nodes": "labelled-compact", "groups": "full", "edges": "buses-and-bundles"},
  {"name": "detail", "maxScale": null, "nodes": "labelled", "groups": "full", "edges": "all"}]}
```

Text never scales continuously. It snaps between two tiers: full styles (node-label 11px, group-label 13px) and compact styles (node-label-compact and count-compact 8.5px, group-label-compact 11px) when the box is too small, and only disappears below a 34px-wide node. Thresholds follow the fixed-size label: at 0.6 a 156-unit node is about 94px, the narrowest that holds a useful 11px mono stem. HORDE at fit on a 1440 screen lands in detail; on a phone it opens in overview.

## States and channels

As the packet: interaction (selected > hover > related, dimmed never on those) owns stroke, halo and opacity; audit owns the badge; diff owns the -soft fill and the bottom-right corner mark; structure owns the collapsed shape and its count; classification owns loop line color and the exemption flag outline, never an edge's line. Provenance owns the line pattern; color comes from role, then kind.

## The prototype

`design/prototype/` — plain ES modules, no build step. Open `index.html` (optionally `?snapshot=snapshots/<name>/`).

- `snapshot.js` loads `graph.json`, `overlay.json`, `view.json` (plus the stand-in `stages.sample.json` and `diff.sample.json`), hashes the graph for the stale check, and indexes ids. No structural decisions.
- `layout.js` `layout(data, state)` → world positions. Placeholder engine for infrastructure to replace.
- `render.js` `render(container, data, state)` → element map `{zoom, lod, nodes, edges, elements}`. Draws in screen space: boxes scale, strokes and text stay fixed. Layer order backgrounds, edges, nodes, labels.
- `state.js` the state object (`stage`, `view`, `morph`, `selection`, `hover`, `collapsed`, `dimmedKinds`, `zoom`, `settings.hubPlacement`, `diff`, `tour`, `theme`) and actions.
- `standins.js` `conserve()` (v1 port), `counterflow()` and `conformity()`: logic infrastructure replaces.
- `../tokens.css` hand-made copy of the generated file; replaced on handover.

Sections can be dragged in the design view; so can band levels (drag the stripe or its label) and the Outside layers gutter, which carry every section in them. Offsets live in `state.offsets` (key: top-level section id, `level:<index>` or `gutter` → dx, dy in world units), persist per snapshot, and levels stretch to hold a moved section. `layout()` applies them; whether they should be saved into `view.json` is an open question for infrastructure.

Covers: all six stages, flow ↔ design transition, re-run diff before/after, collapse, hub placement, kind dimming, three LOD levels, phone layout with a bottom-sheet inspector.

## Content fundamentals

Plain, factual, sentence case. File names are stems in mono (`kuramoto_core`) with the full path as tooltip. Counts carry their noun: `5 files`, `Audio bus · 5`, `↑4 counterflow · pending`, `×3`. Agent questions are first person; Loupe's chrome addresses no one. Verdicts are one word. No emoji. Unicode glyphs only where they carry meaning: ✓ ~ ✕, + − ~ ⧗, ↑, → ←, z⁻¹, ∩, ?.

## Visual foundations

- **Ground.** Green-grey drafting paper. Page and band stripes recessed; canvas one step up; sections lighter; nodes near white. Dark mode keeps the ladder on deep green-black.
- **Hierarchy color.** Each top-level section takes a hue (`tier-1…8`, view order): a 4px strip across its header and its outline. Nested sections inherit a lighter step (`tier-N-soft`) on their strip and keep no outline. On hover, the hovered item's edges switch from kind color to the source section's hue so you can see where they come from; at rest edges keep kind color. Tier hues are low chroma so they read as place, not meaning.
- **Color** is otherwise reserved for meaning: 8 edge slots (3:1 on canvas, neighbours alternate lightness), audit, diff, sets, lanes, ring. Accent blue is selection and focus only; hubs have their own teal-grey `hub`.
- **Type.** Schibsted Grotesk for interface and group labels; Martian Mono for file names, counts and eyebrows.
- **Lines carry meaning.** Pattern = provenance, color = role or kind, head = family (filled flow, hollow structure, dot reads), width = emphasis.
- **Containers.** Sections 8px radius, rule only at depth 0. Lanes are parchment chevrons, never boxes. Bands are ruled stripes without sides. Twins hang from a plate.
- **No shadows, no gradients, no blur.** 1px rules separate panels. Translucency only in sets, -soft fills and halos.
- **Interaction.** Hover and related turn strokes accent; everything unrelated dims to 0.22. Selected adds a stroke-hub width and an accent-soft halo. Focus ring 2px offset 2px.

## Iconography

No icon set. Typographic glyphs above plus geometric marks defined in the specs. Chrome uses text buttons.

## Index

- `tokens.json`, `styles.css` → `design/tokens.css`
- `guidelines/*.card.html` foundation specimens
- `components/<id>/` README with `loupe-spec`, `preview.html` drawn by the real renderer
- `design/prototype/` the prototype and its snapshots (`horde-sample`, `loops-synthetic`)
- `reference/` the handoff packet and spec schema as received
- `SKILL.md`
