# 0023. Fold long sections; isolate a section as a sub-patch

- **Status:** Accepted (behaviour, Julian by poll 2026-10-03); thresholds and visual treatment Proposed
- **Date:** 2026-10-03
- **Source:** Julian: "some sort of way to collapse really long sections, and also to isolate them (some sort of
  sub-patch view that has all their inputs and outputs along a side rail)". Poll: fold past N rows; one port per
  peer section, expandable to files. Grounded on the real HORDE crawl: `tools` is one section of 120 files;
  `src` takes 138 edges from 93 files.

## Decision

**Fold.** A section with more than 12 file rows (plus a slack of 2, so a fold never hides only one or two files)
shows its 12 most-connected files and one dashed row, `+N more · M edges`. Files that an element makes a claim
about (lane steps, hubs, set and overlap members, loop cycles) are never folded. Edges to folded files land on
the fold row, bundled with a count. Click the row (or "Show all" in the inspector) to unfold; "Fold again" refolds.

**Isolate.** A lens on one section (0019's focus lens, sharpened). Only that section and its subsections are
laid out. Every edge with exactly one end inside becomes a port: inputs on a left rail, outputs on a right rail,
one port per peer section with its edge count. Opening a port lists its files as ports, folded past 12 like a
section. Edges with no end inside are not drawn; they are counted in an "Elsewhere: N files · M edges" chip.

## The one rule

Both are lossless views. A folded file is stood in for by its fold row; an outside file by its port or by the
elsewhere chip. Every edge is drawn, bundled into a count, or counted as elsewhere. The meter must read balanced
in every state. `conserve()` now refuses a node whose stand-in is missing or was not drawn this frame: the
renderer records every stand-in it draws (`map.drawn`), closing review v4 B1 and the oracle gap the critic found.

## Audit tests

- Fold row: its count equals the folded files and the edges touching them; every folded file has degree no
  higher than every shown, unpinned file in the section.
- Port: its count equals the edges crossing the boundary from (or to) that peer section; port counts plus
  inside edges plus elsewhere equals the graph's edge count.

## Open (Proposed)

- 12 and 2 are placeholders in `layout.js` `L.foldAt` / `L.foldSlack`; move them to `loupe-spec` once settled.
- Should isolate be reachable from the map directly (double-click a header) as well as the inspector?
- Search: a folded file is not yet findable except by unfolding. When one is selected (from an inspector list), its
  fold row or port is highlighted. Resolved 2026-10-03 (Julian, poll): highlight only; selection never opens a fold.
- No fixture yet exercises fold with lanes, buses, hubs, a band, a diff or nested sections together (critic,
  2026-10-03). The stress cases (Q-008, P2) should add one.
