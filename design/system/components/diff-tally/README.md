# Diff Tally

A diff tally states how many of the files a stand-in holds changed since the last run, by kind.

**Audit test.** Each chip's count equals the files of that kind the stand-in holds (`inspect.js` `diffHeld`, read off
the same `map.nodes` proxies the conservation meter checks), and a click lists exactly those files.

Drawn on whatever stands for files the map does not draw one by one: a box zoomed out, a collapsed section, the lens's
outside box, an isolate port (fold rows and the loose block too, but under a diff layout pins every marked file out of
them). One chip per kind present, in this order: `+N` added, `~N` changed, `⧗N` stale, `−N` removed; each chip is
`surface-node` with a `diff-<kind>` outline and `diff-<kind>` text in `type-count`, the glyphs and colours the file
marks carry. Too narrow for the row: one kind's chip, or one `ΔN` total in `diff-changed`; as a last resort the same
in `type-count-compact`. Placement, first clear spot (clear of labels, tabs, pills, other tallies and other boxes):
inside the box (lower left, lower right, upper right); for a port row, left of its edge count; below or above the box
within its width (or centred on a narrower box); straddling its right edge; inside a narrow box, centred or at its
left. Never the left edge. The tooltip names the box and counts its files as its header does (removed ones apart).

The waffle (a display setting, off by default; Julian, 2026-10-28): above the tally, one 5 px square per file with
1.5 px gaps, changed first in their kind's full `diff-<kind>` colour (the token exception recorded in `tokens.json`),
unchanged in `rule`. Drawn only when every file gets its own square and every row is clear; else the tooltip says it
needs more room.

The stories view shows no diff (Julian, 2026-10-28), so it draws no tally.

The values below reach the renderer through `design/prototype/specs.js`, generated from this block by `tools/specs.mjs` (ROADMAP Q-036); `./verify fast` fails when that module is stale. Edit the block, then run `npm run specs`.

```loupe-spec
{
 "primitive": "diff-tally",
 "version": 1,
 "parts": {
  "chip": {
   "fill": "surface-node",
   "strokeWidth": "stroke-edge",
   "textStyle": "count"
  },
  "chip-compact": {
   "textStyle": "count-compact"
  },
  "waffle": {
   "fill": "rule"
  }
 },
 "states": {
  "diff-added": {
   "chip": {
    "stroke": "diff-added",
    "textColor": "diff-added"
   },
   "waffle": {
    "fill": "diff-added"
   }
  },
  "diff-changed": {
   "chip": {
    "stroke": "diff-changed",
    "textColor": "diff-changed"
   },
   "waffle": {
    "fill": "diff-changed"
   }
  },
  "diff-stale": {
   "chip": {
    "stroke": "diff-stale",
    "textColor": "diff-stale"
   },
   "waffle": {
    "fill": "diff-stale"
   }
  },
  "diff-removed": {
   "chip": {
    "stroke": "diff-removed",
    "textColor": "diff-removed"
   },
   "waffle": {
    "fill": "diff-removed"
   }
  }
 },
 "layout": {},
 "sizes": {
  "chipHeight": 13,
  "chipRadius": 3,
  "chipGap": 3,
  "chipPad": 8,
  "chipPadCompact": 5,
  "charWidth": 6.6,
  "charWidthCompact": 5.4,
  "textBaseline": 10,
  "inset": 7,
  "waffleSquare": 5,
  "waffleGap": 1.5,
  "waffleRadius": 1
 },
 "overflow": "none",
 "notes": "Chips in the order +added ~changed ⧗stale −removed (the glyphs file marks carry, kept with them in render.js). The narrow form is one Δ total in the diff-changed chip. The waffle's squares take their kind's full diff colour, unchanged files rule."
}
```
