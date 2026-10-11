# 0030. Side by side as well as the animated transition

- **Status:** Proposed
- **Date:** 2026-10-10
- **Source:** Prior-art amendment pass (docs/prior-art.md, contradiction C5). Awaiting Julian.

## Problem

Vision and decision 0006 make the animated transition between Flow and Design "the main tool for auditing what
the agent did". For graphs that change over time, small multiples were faster than animation, while animation made
fewer errors on which nodes and edges were added (Archambault et al., verified; a different task from comparing
two layouts of one graph). Evidence for animation comes mostly from statistical charts.

## Proposal

Keep the transition. Add a side-by-side mode showing Flow and Design at once with linked selection, and make the
audit not depend on either: the conservation check and the claim tests are the audit; both views are ways to look
at its result. Reword vision.md accordingly.
