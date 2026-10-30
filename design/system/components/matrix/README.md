# Matrix

The matrix lens shows one section, or a pair, as files × files (ADR 0029; ROADMAP Q-030). It is a view, not a primitive:
it makes no claim of its own, and every edge it shows is in exactly one place.

**Audit test (of the view).** Every edge between the selection's files is in exactly one cell; every edge with one end
outside is in that file's out or in margin; every other edge is counted on the outside chip; each opens to exactly its
edges (`inspect.js` `heldEdges`), and the conservation meter balances.

Rows send, columns receive. A row's head names its file right-aligned; a column's head names it turned, reading up; a
file the re-run diff marks carries its glyph first, in its `diff-<kind>` colour. A pair's two bands are tinted
(`surface-group`, `surface-group-nested`) and named in a strip at the far left. A rule every five rows; the diagonal
shaded in `rule`. A cell of up to three edges shows one mark per edge: a vertical stroke, 2.2 px, in `edge-<slot>` with its
provenance's dash, the marks 5 units apart; dimmed kinds at 0.2. Past three edges, or when a mark would be shorter on
screen than the longest dash period (16.5 px), the cell shows its count; below 12 px a cell shows a shade instead of a
number, darker with more edges. Margins: an out column right of the rows, an in row below the columns, each a count. The
outside chip sits below the grid. Heads and counts scale with the cells and are left out (the subtitle says to zoom in)
where they could not be read. Clicking a mark opens its edge; clicking a cell, a margin or the chip lists its edges.

Sizes (world units, scaled with the zoom): cell 26, mark inset 3, row heads 168, column heads 150, margins 34, gap 18.
The title and subtitle sit at a fixed size above the grid, below the matrix bar.

**No `loupe-spec` block yet.** It waits on ROADMAP Q-036 (the schema's primitive list, a human gate), with the diff
tally's. Until then the values live in `design/prototype/matrix.js` `MX` and `render.js` `renderMatrix`, where
`tools/stress.test.mjs` (the Q-030 block) checks them.
