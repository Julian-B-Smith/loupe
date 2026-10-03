# 0020. Drag offsets live in the view

- **Status:** Accepted
- **Date:** 2026-10-02
- **Source:** Julian, by poll during the triage of design delivery v4 (the design agent's open question 1;
  the critic raised the same issue).

## Problem

Prototype v4 lets a person drag sections, band levels and the Outside layers gutter. It keeps the offsets
in the browser's localStorage, keyed by section id and level index with no view hash. After a re-run they
silently attach to whatever now has that id, and they are coordinates outside every file Loupe audits.

## Decision

Offsets are part of the design view: `view.json` `settings.offsets`, keyed by top-level section id,
`level:<i>` or `gutter`, value `{dx, dy}` in world units. They are committed with the view and covered by
its hash. On a re-run, an offset whose key no longer exists is dropped and the drop is reported, never
reattached.

## Consequences

- Schema 0.3 adds `settings.offsets` (alongside `lens` from 0019, once accepted).
- `loupe-check` gains a rule: an offset must not make two top-level sections overlap (overlap would hide
  nodes behind other nodes, which the one rule forbids).
- The prototype stops writing offsets to localStorage; a drag edits the view through the same path as any
  other view change.
