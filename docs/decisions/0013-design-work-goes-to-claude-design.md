# 0013. Visual design goes to Claude Design

- **Status:** Accepted (direction); handoff format Proposed
- **Date:** 2026-09-30
- **Source:** Julian (direction); Claude (format)

## Decision

Julian works on aesthetics in parallel with a Claude Design agent while this project builds the
infrastructure. The design agent owns how Loupe looks; infrastructure owns what is drawn and where.

## Consequences

- The contract is `docs/design-handoff.md` (also published as a doc for the design agent).
- Design delivers a Design System artifact ("Loupe": tokens, one spec per primitive in a `loupe-spec`
  block) and a Design canvas ("Loupe screens": app chrome references).
- Infrastructure converts tokens to `design/tokens.css` and specs to `design/primitives.json`, both
  generated. Links and pinned versions go in `docs/design-links.md`.
- The renderer must read every visual value from tokens and specs, never hard-code one, so design
  changes land without code changes.
