# 0011. Where map snapshots live

- **Status:** Accepted
- **Date:** 2026-09-30
- **Source:** Claude's recommendation, accepted by Julian (Julian noted snapshots may help agent navigators)

## Decision

- **Current map, inside the repo.** The latest snapshot (graph, view spec, audit results, explainers) is
  committed in the target repo at `.loupe/current/`. Agents working in the repo can read the map directly
  without knowing to look anywhere else.
- **History, on its own branch.** Every past snapshot is committed to an orphan branch, `loupe-history`,
  in the same repo: one commit per snapshot, recording the source commit it describes.

## Why

- Keeping the current map in the working tree serves navigator agents, which was Julian's concern.
- Keeping history off the main branch avoids a pile of snapshot files in every commit and PR.
- An orphan branch keeps history versioned with the code, pushed to GitHub and available on every machine.
  A gitignored local folder would lose it across computers.

## Open

- Revisit if managing the orphan branch from the skill proves awkward.
