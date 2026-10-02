# 0019. Crawl config and focus lenses

- **Status:** Proposed
- **Date:** 2026-10-01
- **Source:** Julian asked for a way to focus on the files that feed one version (HORDE is splitting into a
  legacy system and horde 2) without knowing in advance where each project's fault lines are, and asked for
  guidance on the per-repo config file. Supersedes the scope part of 0018.

## Problem

Two different wishes were sharing one mechanism. "Don't crawl the 377 trace notes" is about what counts as
code. "Don't show me the legacy files every time" is about what one is looking at. If both are crawl
exclusions, the second breaks the one rule: legacy files vanish from the graph, and so do any edges that
leak between the two systems, which are exactly the edges worth seeing.

## Decision

Two layers, owned by different parties.

### 1. Crawl config: what counts as code (human-owned, rarely changes)

`.loupe/config.json`, committed in the target repo next to `.loupe/current/`.

- Holds only facts the crawler cannot discover: bulk non-code to exclude (traces, notes), sibling repo
  prefixes, external SDK prefixes, and where to find `compile_commands.json` or which build target to assume.
- A missing file is fine. Defaults exclude Markdown, binaries and VCS/tool folders and crawl everything
  else. Every exclusion, default or configured, is still counted in the inventory (0018, rule G5).
- The config is an input to the crawl, so its hash is recorded in `crawler.scope`. Same commit, same
  crawler, same config: same bytes.
- Agents may propose a config change (for example after seeing 377 trace files), but only Julian commits it,
  the same way exemptions work (0014).
- Never used to hide a version or a subsystem. That is what lenses are for.

### 2. Focus lenses: what you are looking at (agent-proposed, settled in dialogue)

A new view element, `lens`, in `view.json`.

- **Defined by seeds plus a rule**, so membership is computed deterministically, not hand-listed:
  seeds are paths, globs, files or (later) build targets; the rule is `seeds-only`, `upstream` (everything
  the seeds depend on), `downstream`, or `both`. A lens can also exclude seeds (for example "everything
  except legacy/").
- **The rest of the graph stays counted.** Outside nodes collapse into one labeled container with its count.
  Edges that cross the boundary are always drawn, as a count on the container edge, and listed. A lens
  whose boundary leaks is a finding, not something to tidy away.
- **The conservation meter reads in focus / outside / crossing**, and still has to balance.
- **The agent finds the fault lines.** After the first crawl the Structure agent proposes lenses with
  evidence: a near-zero cut in the graph, a folder the repo's own rules treat as a boundary, a build target,
  a naming convention. The proposal goes into dialogue like any claim, and the audit swarm checks it
  (the claim "these two systems barely touch" is tested by counting crossings).
- **Several lenses can exist; one can be the default.** Switching lens is instant because the graph does
  not change. Diffs on re-run are reported per lens and in total.

## HORDE as the test case

The fault line is already written down: `tools/h2_rules_check.py` enforces ADR-186 ("nothing under h2/
includes a file from src/, nothing under src/ includes a file from h2/"). The probe crawl at c64cfdbc agrees:
0 edges between `h2/` and `src/`; 7 tools reach only h2, 93 reach only legacy, 1 (the rules check itself)
reads both. The expected first proposal is two lenses, "horde 2" (seeds `h2/**`, rule `both`) and
"legacy" (seeds `src/**`, rule `both`), with "horde 2" as the default once h2 has a product build.

## Consequences

- Schema: `lens` added to the view schema in 0.3; `crawler.scope` gains `configHash`. Checker: a lens's
  membership must equal what its seeds and rule compute; crossings must be reported.
- Design: the outside container, the crossing count and the lens switcher are new design work.
- The probe's hardcoded scope rules and `tools/probe-config/horde.json` become the defaults and a sample
  `.loupe/config.json`.
