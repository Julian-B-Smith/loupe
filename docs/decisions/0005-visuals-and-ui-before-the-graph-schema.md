# 0005. Visuals and UI before the graph schema

- **Status:** Accepted
- **Date:** 2026-09-29
- **Source:** Julian

## Decision

Prototype visuals and UI first; define the graph schema afterward.

## Consequences

In Julian's experience this makes later steps faster, easier to audit and less frustrating, provided the design stays modular enough to absorb extreme structural changes. Consequence: the graph and the view spec are plain data kept separate from the renderer.
