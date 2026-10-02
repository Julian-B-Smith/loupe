# 0014. Primitive verdicts, round 2

- **Status:** Accepted
- **Date:** 2026-09-30
- **Source:** Julian's round 2 verdicts; Lane rule is Claude's recommendation, delegated by Julian
- **Amended by:** 0016 (lanes take their source's line pattern rather than always dotted)

All nine primitives are kept. Section box, Overlap region and Bus / rail were kept in round 1 and left
undecided in round 2, which means no change.

| Primitive | Verdict | Rule that follows |
| --- | --- | --- |
| Layer band | Keep | Every exemption from the downward rule is raised in the Stage 3 dialogue, unless the pattern is already established in this project. |
| Lane | Keep | A lane may rest on config or runtime provenance, drawn dotted, under the guards below. |
| Twins | Keep | Round 2 design (shared interface plate). |
| Hub | Keep | Hub placement is a setting: stay with the group (default) or pull to the center. Worth A/B testing. |
| Ring | Keep | Means a circular dependency, drawn as a warning. |
| Feedback loop | Keep | What proves a loop is intentional stays open until tested on real code; decided case by case in dialogue. |

## Lane on config or runtime provenance (Claude's recommendation)

Allowed, and not irresponsible, as long as three guards hold:

1. The lane names its source: the routing table, config file or trace the order came from.
2. Auditors check the drawn order against that source on every re-run, and flag the lane when it drifts.
3. A lane may never rest on agent inference alone. If the only evidence is the agent's reading, it stays
   a Stage 3 question until config, a trace or Julian confirms it.

## Established exemptions (proposed mechanic)

- An exemption pattern (for example "dispatch from voice_alloc into engines") becomes established after
  Julian approves it in dialogue three times in the same project, or once when he explicitly says
  "always allow this".
- Established exemptions are stored in the project's `.loupe/current/` config, drawn in their own style
  and listed in the audit view, but no longer raised as questions. Julian can revoke one at any time.

## Feedback loops until the criterion settles (proposed)

- A loop the agent finds starts as an unclassified loop, drawn neutrally (neither Ring nor Feedback loop).
- The agent raises it in Stage 3 with its evidence (state element found, annotation, trace). Julian's
  answer classifies it, and the answer is logged so the eventual criterion can be learned from real cases.
