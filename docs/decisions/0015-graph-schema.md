# 0015. Graph schema 0.1

- **Status:** Accepted (2026-10-01). Julian confirmed agents can never write the graph file.
- **Date:** 2026-09-30
- **Source:** Claude, after Julian asked to proceed with the schema

## Decision

A snapshot is three files: `graph.json` (crawler only, deterministic), `overlay.json` (agent, trace and
human additions, each with evidence) and `view.json` (the design view, ids only, no coordinates). Full
description in `docs/graph-schema.md`; JSON Schemas in `schema/`; rules enforced by `tools/loupe-check.mjs`.

## Key choices

- The AI/deterministic boundary is a file boundary: agents never write `graph.json`, and the overlay can
  add but never change or remove a crawled edge.
- Edge ids are derived (`sha256(src|dst|kind)`), so they survive re-crawls and anchor annotations and diffs.
- Kinds (what the crawler saw) are separate from roles (what an edge means in this kind of codebase).
- Symbol nodes exist in the schema now; v1 crawls files.
- Canonical JSON makes the crawl byte-reproducible. Verified: the sample regenerated on Julian's machine
  matched this session's bytes exactly.
- One `loop` primitive with a classification (circular, intentional, unclassified) instead of separate
  Ring and Feedback loop elements, so the dialogue can reclassify a loop without changing its identity.
