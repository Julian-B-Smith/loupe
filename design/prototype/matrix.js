// The matrix lens (ADR 0029, second half; ROADMAP Q-030; Julian, poll 2026-10-29). For one section, or a pair, rows and
// columns are its files (a pair: the first section's files, then the second's) and the cell at row r, column c holds the
// edges r → c, one mark per edge (kind colour, provenance dash), past MX.marks a count. Lossless by construction, and the
// meter checks it: every edge is in exactly one place in map.edges —
//   a cell, drawn (≤ MX.marks edges) or folded into its count; ends ['x:<src>|<dst>'];
//   a row's out-margin (to a file outside the matrix) or a column's in-margin (from one), folded; 'x:out|<f>', 'x:in|<f>';
//   'elsewhere' (both ends outside), folded into the one chip above the grid.
// Every one of those keys opens to exactly its edges (inspect.js heldEdges reads `ends`). Files inside are drawn as row
// and column heads; every other file stands in by the elsewhere chip. Pure layout here; render.js hands the frame over
// when state.matrix is set in the Design view, and node-link stays the default and the path view.

// The matrix's sizes come from its loupe-spec block (design/system/components/matrix, via the generated specs.js: Q-036).
// A mark spans the cell less `inset` at each end: 20 at cell 26, so its provenance dash reads from zoom 0.83 (the longest
// period, annotated, is 16.5 px on screen); below that the cell shows its count (Julian, poll 2026-10-29). Past `marks`
// edges a cell shows its count. MX is the block's own object, not a copy, so a test that changes it sees the drawing move.
import { SPECS } from './specs.js';
export const MX = SPECS.matrix.sizes;

// The selection's files in a stable order: each section's subtree in tree order, its members as the view lists them.
export function matrixFiles(data, m) {
  const secs = [m.a, ...(m.b && m.b !== m.a ? [m.b] : [])].filter((s) => data.elements[s] && data.elements[s].primitive === 'section');
  const seen = new Set(), files = [], bands = [];
  secs.forEach((s) => {
    const start = files.length;
    data.descendants(s).forEach((d) => (data.elements[d].members || []).forEach((f) => { if (data.nodes[f] && !seen.has(f)) { seen.add(f); files.push(f); } }));
    bands.push({ sec: s, from: start, to: files.length });
  });
  return { secs, files, bands };
}

// The partition: each edge's one place. Pure: no DOM, no state beyond the selection.
export function matrixPartition(data, m) {
  const { secs, files, bands } = matrixFiles(data, m), idx = new Map(files.map((f, i) => [f, i]));
  const cells = new Map(), out = new Map(), inn = new Map(), elsewhere = [];
  const push = (mp, k, e) => { if (!mp.has(k)) mp.set(k, []); mp.get(k).push(e); };
  data.edges.forEach((e) => {
    const a = idx.has(e.src), b = idx.has(e.dst);
    if (a && b) push(cells, `x:${e.src}|${e.dst}`, e);
    else if (a) push(out, `x:out|${e.src}`, e);
    else if (b) push(inn, `x:in|${e.dst}`, e);
    else elsewhere.push(e);
  });
  return { secs, files, bands, idx, cells, out, inn, elsewhere };
}
