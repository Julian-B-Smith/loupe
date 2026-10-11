# 0031. Overlaps are marks on members, not rectangular regions

- **Status:** Accepted (Julian, 2026-10-11: "accept the recommended option on all nine ADRs")
- **Date:** 2026-10-10
- **Source:** Prior-art amendment pass (docs/prior-art.md, contradiction C6). 

## Problem

The overlap primitive (0012, 0014) is drawn as a region shared between sets. In a controlled study rectangles and
ellipses were the worst shapes for Euler diagrams and circles the best (Blake et al., verified); Loupe's sections
are rectangles. The prototype already draws a set whose members sit in different sections as a halo and chip on
each member, because a hull swept across unrelated boxes.

## Proposal

Make that the rule: membership in a second set is a mark on the member (halo and chip), never an overlapping
rectangular region. The three-set limit becomes a limit on chips per file before a membership strip is used.
No empirical source was found for "three"; treat it as a default to test.

## Ruling (2026-10-11)

The proposal: membership in a further set is a mark on the member (halo and chip), never an overlapping rectangular region. The three-set limit becomes a chip limit to test. `docs/visual-grammar.md` updated.
