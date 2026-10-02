# 0009. Ship first as a Claude Code skill

- **Status:** Accepted (direction); mechanics Proposed
- **Date:** 2026-09-30
- **Source:** Julian

## Decision

The first version of Loupe is a tool invoked as a Claude Skill, with the whole agentic interface runnable
inside Claude Code in the Claude desktop app if possible. The first call runs the full pipeline. Later calls
show a visual diff against the previous map and then update it, archiving each version in the repo.

## Consequences (proposed, not yet agreed)

- Deterministic parts (crawler, graph diff, conservation check, viewer build) are scripts the skill runs.
  Agent parts (Structure, Audit, Explain, Navigate) run as the session plus subagents. Stage 3 dialogue
  happens in the Claude Code chat.
- Snapshots: see decision 0011 (current map in `.loupe/current/`, history on the `loupe-history` branch).
  Each holds the graph, view spec, audit results and explainers. The viewer renders from these files, so the prototype's data/renderer split carries over.
- Re-runs re-crawl, diff the new graph against the last snapshot, and let the Structure agent revise only
  the affected part of the view.
- Open: when a file is deleted from the code, its node leaves the graph. The no-destruction rule governs
  views, not the graph, so the diff should show the removal explicitly rather than hide it.
- Resolved by 0011: current map inside the repo, history on an orphan branch.
