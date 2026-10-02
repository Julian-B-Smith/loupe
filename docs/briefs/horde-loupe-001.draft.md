---
id: loupe-001
from: loupe
to: horde
status: draft (not filed — deferred to P6, spinup poll 2026-10-01)
ball: provider
filed: 2026-10-01
respond-by: 2026-10-31
cites: none
seq: 1
---

# Brief: Loupe will propose a `.loupe/` map and a `loupe-history` branch in HORDE

> **Origin:** loupe resident session, 2026-10-01, during `/spinup` (survey Q6: Loupe is a provider
> to HORDE). Motivating decisions: loupe ADRs 0004 (HORDE is the first client), 0011 (where
> snapshots live), 0019 (crawl config, Proposed). Filed rather than written — writes stay home.

## Need

Nothing changes in HORDE yet. Loupe reaches HORDE at P6 (ROADMAP). We are asking HORDE's residents
to agree, in advance, to three things that would then land in HORDE's tree by HORDE's own sessions
running the Loupe skill:

1. `.loupe/current/`: the current map (graph, overlay, view, audit results, explainers) committed in HORDE.
2. An orphan branch `loupe-history` holding every past snapshot.
3. `.loupe/config.json`: human-owned. Loupe proposes changes to it; Julian commits them.

## Proposed interface delta

None to HORDE's code. A read-only crawl of tracked files at a pinned commit; HORDE's `./verify` is
untouched. If HORDE prefers the map outside its tree, say so: that changes ADR 0011.

## Contract tests offered

The Loupe crawl of HORDE at a pinned commit is deterministic (two crawls, same bytes) and its
inventory closes (every tracked file is a node or a recorded exclusion). Both are Loupe-side gates.

## Respond

accept / counter-design (e.g. map outside the tree) / defer to P6.
