# Matrix

The matrix lens shows one section, or a pair, as files × files (ADR 0029; ROADMAP Q-030). It is a view, not a primitive:
it makes no claim of its own, and every edge it shows is in exactly one place.

**Audit test (of the view).** Every edge between the selection's files is in exactly one cell; every edge with one end
outside is in that file's out or in margin; every other edge is counted on the outside chip; each opens to exactly its
edges (`inspect.js` `heldEdges`), and the conservation meter balances.

Rows send, columns receive. A row's head names its file right-aligned; a column's head names it turned, reading up; a
file the re-run diff marks carries its glyph first, in its `diff-<kind>` colour. A pair's two bands are tinted
(`surface-group`, `surface-group-nested`) and named in a strip at the far left. A rule every five rows; the diagonal
shaded in `rule`. A cell of up to three edges shows one mark per edge: a vertical stroke (`markWidth`) in `edge-<slot>` with its
provenance's dash, the marks `markSpacing` apart; dimmed kinds at `dimOpacity`. Past `marks` edges, or when a mark would be shorter
on screen than the longest dash period (16.5 px), the cell shows its count; below `countMin` a cell shows a shade instead of a
number, darker with more edges. Margins: an out column right of the rows, an in row below the columns, each a count. The
outside chip sits below the grid. Heads and counts scale with the cells and are left out (the subtitle says to zoom in)
where they could not be read. Clicking a mark opens its edge; clicking a cell, a margin or the chip lists its edges.

Every size is in the block's `sizes` below (its notes say which scale with the zoom). Placement offsets, such as the title band and
the gaps beside the heads, are layout logic and stay in `render.js` (Julian, poll 2026-10-30).
The title and subtitle sit at a fixed size above the grid, below the matrix bar.

The values below reach the renderer through `design/prototype/specs.js`, generated from this block by `tools/specs.mjs` (ROADMAP Q-036); `./verify fast` fails when that module is stale. Edit the block, then run `npm run specs`.

```loupe-spec
{
 "lens": "matrix",
 "version": 1,
 "parts": {
  "band": {
   "fill": "surface-group"
  },
  "band-alt": {
   "fill": "surface-group-nested"
  },
  "band-label": {
   "stroke": "ink-faint",
   "textStyle": "group-label-compact",
   "textColor": "ink-muted"
  },
  "rule": {
   "stroke": "rule"
  },
  "rule-strong": {
   "stroke": "ink-faint"
  },
  "diagonal": {
   "fill": "rule"
  },
  "mark": {
   "stroke": "edge-kind",
   "dash": "provenance"
  },
  "cell": {
   "fill": "surface-node",
   "textColor": "ink"
  },
  "margin": {
   "fill": "surface-panel",
   "stroke": "rule",
   "textColor": "ink-muted"
  },
  "margin-label": {
   "textStyle": "count",
   "textColor": "ink-faint"
  },
  "head": {
   "textColor": "ink"
  },
  "title": {
   "textStyle": "group-label",
   "textColor": "ink"
  },
  "subtitle": {
   "textStyle": "count",
   "textColor": "ink-muted"
  },
  "chip": {
   "fill": "surface-panel",
   "stroke": "rule",
   "textStyle": "count",
   "textColor": "ink-muted"
  },
  "shade": {
   "fill": "ink"
  }
 },
 "states": {
  "selected": {
   "head": {
    "fill": "accent-soft",
    "textColor": "accent"
   },
   "cell": {
    "stroke": "accent"
   }
  }
 },
 "layout": {},
 "sizes": {
  "cell": 26,
  "inset": 3,
  "rowHead": 168,
  "colHead": 150,
  "margin": 34,
  "gap": 18,
  "marks": 3,
  "markWidth": 2.2,
  "markWidthSelected": 3.4,
  "markSpacing": 5,
  "dimOpacity": 0.2,
  "ruleEvery": 5,
  "ruleWidth": 0.5,
  "ruleStrongWidth": 1,
  "bandColumnOpacity": 0.6,
  "diagonalOpacity": 0.5,
  "countMin": 12,
  "headMin": 6,
  "headMax": 11,
  "chipHeight": 17,
  "cellRingWidth": 2,
  "marginRadius": 3,
  "marginStrokeWidth": 1,
  "bandRuleWidth": 1,
  "shadeBase": 0.25,
  "shadeStep": 0.15,
  "shadeMax": 0.9,
  "countMax": 10,
  "countScale": 0.5,
  "countWeight": 500,
  "headScale": 0.55,
  "headWeight": 500,
  "chipPad": 14,
  "chipBaseline": 12
 },
 "notes": "World units scale with the zoom: cell, inset, rowHead, colHead, margin, gap, markSpacing. Screen px: markWidth, markWidthSelected, cellRingWidth, marginRadius, marginStrokeWidth, bandRuleWidth, ruleWidth, ruleStrongWidth, chipHeight, chipPad, chipBaseline, countMin (a cell narrower shows a shade, not a number), countMax, headMin and headMax (the heads' font size). headScale and countScale: font size per screen px of cell. A shaded cell's opacity: shadeBase + shadeStep per edge, at most shadeMax. A cell past `marks` edges shows its count. The outside chip's outline is token dash-outside. A cell holding the selected edge, and the chip holding a selected file, take the holds mark (token dash-holds). Placement offsets stay in render.js (layout logic)."
}
```
