# Design review: delivery v4

> **Since 2026-10-03 (ADR 0022) this is our own worklist**, not a message to a design agent. Design is in-house.

Infrastructure's reply to the Claude Design delivery of 2026-10-02 (tokens.json v4, loupe-spec v2, prototype
v4, built against packet v2.1). This is step 3 of "How the handoff runs" in `docs/design-handoff.md`. Julian
relays it to the design agent. Line numbers refer to `design/prototype/` as delivered.

**Verdict.** The design system passes. The prototype needs rework: three findings break the one rule or an
accepted contract condition. Most of the rest comes from one cause: the packet addenda v2.2 and v2.3 and
schema 0.2 never reached you. The doc copy and the data kit you read were both still at v2.1 / schema 0.1.

## What passed

| Check | Result |
| --- | --- |
| 17 `loupe-spec` blocks against `schema/loupe-spec.schema.json` | All valid. Folder names equal `primitive` (9 primitives, 8 glyphs) |
| `loupe-dash`, `loupe-motion`, `loupe-lod` in `system/README.md` | Present, valid JSON |
| `tokens.json` | All 55 required tokens; every token has `usage`; themes `light` then `dark`; no `var()` or `color-mix()` |
| Prototype on its own sample | Renders; meter 84 of 84; no console errors |
| Prototype on the repo's schema 0.2 sample | Renders; meter 84 of 84 |
| Prototype on the real HORDE crawl (`schema/examples/horde-probe`) | Meter 650 of 650. The placeholder layout stacks 15 sections in one narrow column (expected: infrastructure replaces `layout.js`) |
| Determinism | No `Math.random` or clock reads in layout or render; dash kinds per Q7, fixed on screen; provenance never sets stroke color; `opacity-dim` ≥ 0.2; fixed layer order |

## Blockers

1. **Loose nodes vanish while counted as placed.** `layout.js` places only section members; `render.js:506`
   records any other node as `{state:'collapsed', proxy:null}` and `standins.js:13` counts it as placed. The
   schema allows loose nodes ("shown at top level"). A centered hub homed in the gutter or loose is dropped the
   same way (`layout.js:52`, `:217-218`). Draw loose nodes in a top-level group; a collapsed node must have a
   proxy that is drawn.
2. **A bus edge can count as drawn and not be drawn.** `render.js:419` records `via:'drawn'`, then
   `:421-422` returns when `busFade` is 0 (a bus edge with a proxied endpoint left alone in its bundle). The
   rail count drops too (`:433`). Record the edge only after the draw decision, and fade only when both ends
   are real nodes.
3. **The provenance key can disappear.** `index.html:49` hides every column when the key is closed, and
   `:247` closes it when the canvas is under 760 px. Addendum v2.3 #1: it may collapse to a compact strip of
   the five patterns, never disappear. Decision 0016 was accepted on that condition.

## Should fix

4. Bundles with mixed provenance are drawn solid, which reads as static (`render.js:404,409`). Bundle by
   provenance too.
5. Self-loops are recorded as collapsed and never drawn (`render.js:388`). Symbol-level crawls will produce them.
6. Some aggregates have no count: collapsed twin sections and narrow collapsed sections (`render.js:276-283`),
   hub fan-in outside the detail level (`:529-530`).
7. `localeCompare` (`layout.js:294`) makes the canonical flow view depend on the browser's locale. Compare by
   code point.
8. Tethers (`1 3`, round caps, `render.js:472`) and the unclassified loop arc (`2 3`, `:489`) reuse line
   patterns that mean provenance. Rail trunks and exit stubs are solid whatever their members' provenance.
9. Element ids from `view.json` go into `innerHTML` unescaped (`data-el="${id}"`), and `?snapshot=` accepts any
   URL. Escape ids; restrict snapshots to relative paths.
10. Exemptions: `standins.js:33-34` handles only `src` + `dstIn`; `srcIn` never matches and `dst` is ignored,
    so it over-exempts. `loupe-check` supports all four.
11. **Fonts:** `tokens.css` imports Google Fonts over the network. The viewer must work offline: infrastructure
    will generate `tokens.css` with local font files under `design/` or a system-font fallback. Please name the
    fallback stack you want in `tokens.json`.
12. **Drag offsets** move into `view.json` `settings.offsets` (decision 0020). Stop writing them to
    localStorage; a drag becomes a view change. Infrastructure adds the schema field and a no-overlap check.

## Not yet built because the addenda did not reach you

Please read addenda v2.2 and v2.3 at the end of `docs/design-handoff.md` and the 0.2 example
`schema/examples/horde-probe/`:

- `missing` nodes, with their reason (generated, external, sibling, unknown); unknown should stand out.
- Edge kinds `generates` (Flow arrowhead) and `embeds` (Structure, hollow). Today both fall back to slot 8 and
  `embeds` gets a filled arrow.
- File roles as a compact badge, never a color.
- The inventory (files excluded from the crawl, with rules) and evidence `guard` / `resolution` in the inspector.
- Focus lenses (0019, Proposed): the outside container, the crossing count, a lens switcher, meter states.
- The header says "not crawled" for every snapshot (`index.html:211`); read it from `graph.json`.

## Delivered snapshots

`snapshots/horde-sample/` is a schema 0.1 copy (loupe-check: S1). `snapshots/loops-synthetic/` fails V1: its
view is bound to a different graph hash. Infrastructure will regenerate both at 0.2.

## Answers to your open questions

1. **Drag offsets:** in `view.json`, see 12.
2. **Schemas for audit, dialogue, explain and the re-run diff:** infrastructure writes them (ROADMAP Q-005),
   starting from the fields your stand-in files read.
3. **Placement constraints** (hubs above their level, the gutter, the twins plate): infrastructure takes them
   into the layout engine in P2. Keep stating them in the specs.
