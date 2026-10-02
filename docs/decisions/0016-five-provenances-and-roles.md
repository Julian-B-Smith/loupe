# 0016. Five provenances; roles separate from kinds

- **Status:** Accepted (2026-10-01), on condition that the provenance legend is always on screen.
- **Date:** 2026-09-30
- **Source:** Claude, answering the design agent's review (points 6–8). Amends 0007 and the lane rule in 0014.

## Decision

- Provenance has five values: static and config (crawler, in the graph); runtime, annotated and inferred
  (overlay). Each has its own line pattern. An overlay edge takes its strongest evidence in the fixed order
  runtime > annotated > inferred.
- "Missing" is not a provenance. It is renamed `gap` and marks an absent edge inside a lane.
- Audio, param and mod are roles, not kinds. Dialect rules assign roles deterministically (for example by
  callee signature); an agent may assign one in the overlay, as inferred. An edge's color comes from its
  role if it has one, otherwise from its kind.
- Lanes are drawn with the line pattern of the provenance their order comes from, replacing "drawn dotted"
  in 0014. The other lane guards in 0014 still hold.
