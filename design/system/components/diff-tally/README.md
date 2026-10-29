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

**No `loupe-spec` block yet.** `schema/loupe-spec.schema.json` lists the primitives a block may name, and `diff-tally`
is not among them; adding it is a schema change, which is a human gate. Until then the values above live in
`design/prototype/render.js` §4b, which is where the stress test (`tools/stress.test.mjs`, the Q-035 block) checks them.
