# 0002. Six-stage pipeline

- **Status:** Accepted
- **Date:** 2026-09-29
- **Source:** Julian

## Decision

Crawl (deterministic) → Structure (governing agent) → Dialogue (agent + human) → Audit (agent swarm) → Explain (explainers, data-flow summaries) → Navigate (persistent agent).

## Consequences

Each stage gets its own mode in the UI. See docs/vision.md.
