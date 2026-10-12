# 0033. The audit swarm must not be the author reviewing itself

- **Status:** Accepted (Julian, 2026-10-11: "accept the recommended option on all nine ADRs")
- **Date:** 2026-10-10
- **Source:** Prior-art amendment pass (docs/prior-art.md, contradiction C8). 

## Problem

Stage 4 has agents confirm or challenge the Structure agent's claims. Model errors are correlated across models
and more so within a provider (arXiv 2506.07962, verified in part). This session's own record agrees: critics from
the same lineage caught a great deal, but the lead's two false story steps passed the lead's citation check. The
doctrine already says a reviewer is independent only if sourced separately from the author.

## Proposal

Order the audit by independence. **First, deterministic tests** (the claim tests of the visual grammar, loupe-check,
the lens and story tests): these decide. **Then model auditors**, labelled as measured, not guaranteed, and where
the human enables it, from a different model family than the author. A claim confirmed only by same-lineage agents
is shown as "reviewed", never "confirmed". Model choice above the default tiers stays Julian's call per session.

## Ruling (2026-10-11)

The proposal: deterministic tests decide first; model auditors are labelled measured; a claim confirmed only by same-lineage agents reads "reviewed", never "confirmed". Using a different model family remains Julian's call per session (doctrine: model routing).
