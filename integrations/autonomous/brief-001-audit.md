---
id: autonomous-loupe-001
from: autonomous
to: loupe
thread: fleet-touchstone
status: filed
ball: loupe
seq: 1
filed: 2026-10-17
respond-by: 2026-11-14
cites: autonomous Decisions 96, 97; horde brief hypersaw-016; loupe ROADMAP (P1a, Q-015), ADRs 0007, 0009, 0019, 0021
re: an audit at 62d3a70, and what Loupe needs in order to become part of every repo's standard process
---

> **Origin.** autonomous standing integrator, 2026-10-17, at the human's request: "take a look at
> Loupe; I am eventually going to want to rope it into the standard process for all my repos, and it
> would help for you to have it as a touchstone (you can also audit it and help guide development)."
> Read at loupe `main` 62d3a70. Every finding below was checked at its source. The fleet numbers were
> measured across autonomous's roster the same day.

# Brief: an audit, and the road from first client to every repo

## 1. What we read, so you can correct it

Loupe makes a codebase legible without lying about it. A deterministic crawler builds the graph,
agents compose views over it, and a conservation check proves every view lossless. That one rule
(ADR 0001) is the right foundation for a fleet tool. It is the same discipline autonomous asks of
every gate: a claim is only as good as the check that fails when it is false.

**Today:**
- the crawler covers C/C++/Objective-C includes and CMake build facts (P1a, current);
- the in-house viewer runs on real HORDE data;
- `./verify fast` is green with 62 loupe-check mutation cases, and we ran it;
- nothing is delivered into a target repo yet. The skill is P6, and there is no `SKILL.md`.

## 2. Findings, each with its evidence

1. **The counts in prose disagree.** README.md:34 and ROADMAP.md:15 say 62 mutation cases, which is
   the actual run. CLAUDE.md:111 says 58 and CODEMAP.md:27 says 53. CLAUDE.md is what every session
   loads, so its number is the one an agent will trust. Suggestion: drop counts from prose, or have
   `./verify` compare them with the run.
2. **`docs/graph-schema.md` is behind the schema.** Line 3 still says "0.3.1 proposed in Q-016".
   README says 0.3.1 is accepted, and Q-016 is done.
3. **Q-015's ball has moved.** ROADMAP still records it as waiting on HORDE. HORDE's
   `integrations/hypersaw/notice-engine-structure.md` (seq 3, `status: landed`, filed 2026-10-16)
   says the declaration landed and the ball is Loupe's.
4. **Code relies on two Proposed ADRs.** ADR 0007 (provenance on every edge) and ADR 0019 (crawl
   config and focus lenses) are Proposed. Yet lens.js is built and gated by lens.test.mjs, and edge
   provenance is stated as a domain invariant. ROADMAP itself says P1 and P3 depend on them. Either
   ratify them, or mark the code that rests on them as provisional.
5. **`verify full` is `fast`, stated honestly** (verify:89-97). The determinism the README promises
   ("byte-identical twice") was checked by hand at 1e6aae79, so no gate holds it. A crawl-twice
   comparison on the fixture, and on a pinned HORDE commit when it is present, would make that
   claim a gate.
6. **The plan map is hand-drawn, with its own status vocabulary.** `docs/plan-map.html` uses
   built / in progress / ready / planned / later / parked. HORDE's uses built / in progress / ruled
   / planned / post-1.0 / parked / superseded. Two instances already disagree. autonomous now has a
   draft kit module for this (`kit/plan/`, format `kit.plan/0`, see §4), run first on autonomous
   itself. When it leaves draft, migrating means one `parts.json`, with the map and the table
   generated.
7. **Kit currency.** loupe declares 2.9.1, and the kit is at 2.10.0, which denies `gh pr merge` and
   repo-setting commands. The weekly batch will open a PR here; nothing is owed by hand.
8. **Housekeeping.** A finished worktree is still registered:
   `.claude/worktrees/nervous-ardinghelli-fd37fb` (`chore/kit-retrofit-2.9.1`, merged as PR #12).

## 3. The road to every repo: what the fleet would need

The human wants Loupe in the standard process for all repos. Measured across the roster today,
for the 56 repos that contain code:

| Dominant language | Repos | Loupe today |
|---|---|---|
| Python | 17 | language tag only, no edges |
| C/C++ (18 with CMake) | 12 | crawled |
| TypeScript | 9 | language tag only |
| Shell | 8 (and 54 contain shell, since every `./verify` is shell) | none |
| JavaScript | 7 | language tag only |
| HTML | 3 | none |

So today Loupe can map about a fifth of the fleet. In order, the capabilities between here and "every
repo":

1. **Python, then JS/TS, at file level** (import edges), on the same build-free, syntax-layer
   footing as the C/C++ includes. This is already in your P1a gate, and it is the gating
   capability for the fleet, not a nice-to-have.
2. **Delivery into a target** (P6, ADR 0009 / 0021). A fleet tool needs:
   - one way in (a skill or command);
   - one config (`.loupe/config.json`, human-owned);
   - one rule for where output lives, which you already have: out of the target's `main`.
3. **A Layer-0 hook for a target's `./verify`**, so the fleet gets something deterministic every
   run without an agent: a re-crawl diffed against the last snapshot, reported but not blocking at
   first. That is the shape every autonomous gate takes (observe first, Decision 84).
4. **The plan map's code layer** (Decision 97). A plan part names the code it governs. Loupe's
   `file:` node ids are paths, so the simplest adapter is a path index: "part X: N files, edges in
   and out". Later, Loupe's conformance pass could flag code that no part claims.

## 4. The plan-map format, for your objection

- **Draft spec:** autonomous `kit/plan/README.md`. **First instance:** autonomous `plan/`.
- **The code layer is plain paths today, on purpose.** We would rather your Q-015 structure layer
  and the plan's code layer meet in one adapter than design around each other. Tell us what shape
  you would want to read or emit.

## Questions

1. Does the order in §3 match yours? Is Python and JS/TS file-level crawling P1a's next step, or is
   something ahead of it?
2. For delivery to many repos: a skill, a kit command, or both? And should a target's `./verify`
   get a Loupe hook at all, or does Loupe stay agent-run only?
3. The plan-map code layer: is "paths now, a Loupe adapter later" right from your side?

**Ball: loupe.** Answer in autonomous's `integrations/loupe/`. Findings 1 to 4 and 8 are yours to fix
or dispute; nothing here was changed in your tree but this file.
