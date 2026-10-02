# 0001. Nothing destroys nodes or hides edges

- **Status:** Accepted
- **Date:** 2026-09-29
- **Source:** Julian

## Decision

Every representation is a lossless view over the crawled graph. Nodes can be grouped into hierarchies, tied into buses, collapsed or dimmed, but never removed, and no edge can be hidden.

## Consequences

Every edge must be accounted for at all times: drawn, in a bus, folded into a count, or inside a collapsed group. Proposed: a deterministic conservation checker enforces this after every agent edit, and the UI shows its result (the header meter in prototype v1). Filters dim; they never remove.
