# 0034. The map earns a second job: on demand, and as rules

- **Status:** Accepted (Julian, 2026-10-11: "accept the recommended option on all nine ADRs")
- **Date:** 2026-10-10
- **Source:** Prior-art amendment pass (docs/prior-art.md, contradiction C9). 

## Problem

The vision treats a legible map as wanted for its own sake. Standalone code-map products ended or were absorbed
into tools people already run (verified for Structure101 and CodeSee); what survives in the field are rules and
gates. Free LLM repo explanations with line links now exist (Windsurf Codemaps, verified; others unverified) and
are good enough for many readers. Whether engineers keep diagrams as standing artefacts is doubtful (Petre, count
unverified).

## Proposal

1. **On demand, in the workflow.** Loupe already ships as a skill inside a coding session (0009) and regenerates
   instead of being maintained (0021). State that as the positioning: a map is produced when a question is asked.
2. **Claims as rules.** Every confirmed claim (a layer band, a bus contract, "nothing in h2 includes src") can be
   exported as a deterministic check the target repo may run in its own CI. HORDE already hand-wrote one such rule.
3. **What Loupe is for, in one line:** not another picture of a repo, but a picture that accounts for everything and
   says how it knows. That is the part no surveyed tool does.

## Open

Whether exported rules belong in P4 (audit) or a new phase.

## Ruling (2026-10-11)

The proposal: maps on demand inside the workflow; confirmed claims exportable as deterministic rules the target repo can run. Still open, as written: whether exported rules belong in P4 or a phase of their own.

## Ruling on the open question (2026-10-15)

Julian, by poll: **exported rules get their own phase, P6r, after P6**, not P4. Reasons: P4's gate should not depend
on another repository's CI; committed rules need a home in the target repo, which is P6's plumbing (0021); and P4
asks "is the claim true" while export asks "will a repo adopt it", which only adoption answers. P4 keeps one
obligation toward export: every claim test is a pure function over `graph.json` and `view.json`, with no viewer
code, so exporting it later is packaging.

