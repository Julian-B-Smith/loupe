# 0021. The current map stays out of the target repo's main branch

- **Status:** Accepted
- **Date:** 2026-10-03
- **Source:** HORDE's counter-design to brief loupe-001 (`horde/integrations/loupe/response-001.md`), ratified by
  Julian on HORDE's side on 2026-10-03 (HORDE ROADMAP B422). Supersedes the "current map, inside the repo"
  part of 0011.

## Decision

- **Who writes.** The Loupe skill runs inside a session of the target repo. Every write there is that repo's
  resident's own commit, under its hooks and `./verify`. A Loupe session never writes into a target repo.
- **`.loupe/config.json`**: committed on the target's `main`, human-owned. The skill proposes; Julian commits.
- **`.loupe/current/`**: generated, **gitignored** in the target repo, and regenerated on each run. Not tracked.
- **`loupe-history`**: an orphan branch, the only committed home of snapshots. No PR targets it; the skill pushes
  it from the target repo's session.
- **Leak check, fail closed.** Before a snapshot is committed to `loupe-history`, the skill runs the target
  repo's leak check against it (for HORDE: its untracked `.leakcheck-names` list, read in place, plus the
  machine-path pattern). Any hit blocks the write.
- **Read only at a commit.** The crawl reads tracked files at a commit and never writes them (HORDE names its
  pinned goldens under `docs/design/` explicitly).
- **Contract tests stay Loupe-side.** Byte-identical crawls, inventory closure and `loupe-check` are Loupe's
  gates; the target repo does not wire them into its `./verify`.

## Why

Generated map churn in `main` would reach every diff, the target's leak gate, its private-name checks and its
CI path filters. A regenerable artifact earns no place in tracked history. 0011's concern, navigator agents
finding the map, is still met: the map is in the working tree after a run, just not tracked.

## Consequences

- P6 gate adds: the leak check runs before every history commit and a planted name blocks it.
- P6 opens with a notice to HORDE giving the exact `.gitignore` line (`/.loupe/current/`) and confirming the
  leak-check step; HORDE then lands `.gitignore`, `paths-ignore: .loupe/**` and `config.json` in one PR.
- 0011's "history on its own branch" stands.
