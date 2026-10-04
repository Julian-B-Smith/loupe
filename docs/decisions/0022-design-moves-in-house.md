# 0022. Design moves in-house

- **Status:** Accepted (direction, Julian 2026-10-03); the subagent setup is Proposed
- **Date:** 2026-10-03
- **Source:** Julian, answering the build-path poll for fold and isolate: "I want to move away from the clunky
  design pass-off, and we should handle future designs here (possibly with sub-agents)." Supersedes 0013 and the
  handoff mechanics of 0017.

## Decision

Visual design is done in this repo by Loupe's own sessions. There is no separate design agent, no handoff packet
and no delivery to review. `design/` is ordinary project code: the prototype in `design/prototype/` (delivery v4,
2026-10-02) is the starting point, and this repo edits it directly.

## What stays

- The rule from 0013 that the renderer reads every visual value from tokens and specs (`design/system/tokens.json`,
  the `loupe-spec` blocks), never hard-coded. A design change is a token or spec change first.
- 0017's goal: a working prototype that renders real snapshots.
- The visual grammar's discipline: every primitive makes a claim an auditor can test, and the one rule holds.
- `docs/design-handoff.md` stays as the record of the packet; it is no longer a live contract.

## Subagents (Proposed)

Design work runs in the lead session, which composes and builds. Judgment-heavy review goes to the existing
`critic` (Opus): a visual change is checked against the one rule, the provenance rules and the grammar, with
screenshots as evidence. Scoped mechanical changes may go to `implementer` (Sonnet). A dedicated design subagent is
added only if this proves the bottleneck (rung 2, no escalation by default).

## Consequences

- `docs/design-review-v4.md` becomes our own worklist (B1 to B3 and the should-fixes), not a message to relay.
- ROADMAP Q-004 changes owner from design to this repo. Republishing the packet and data kit is dropped.
- The `design/` lane rule in CLAUDE.md and the manifest is removed.
