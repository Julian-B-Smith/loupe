# 0025. A third view: "How it works", told as stories

- **Status:** Accepted (direction, Julian by poll 2026-10-08); story format and edit storage Proposed
- **Date:** 2026-10-08
- **Source:** Julian: a view "focused on visualizing how the code actually works rather than simply how it connects",
  "explicitly more inferred", with "more direct judgment from the agent and more options for manual redesign".
  Poll: a third view named "How it works" (stage 2 keeps "Structure"); content is stories; the one rule holds by
  treating a story as a lens plus an inferred layer; manual edits: rearrange, edit the story, ask the agent to
  redraw, pin as truth.

## Decision

- **Three views.** Flow (crawled, no interpretation, 0006) · Design (the agent arranges files into primitives) ·
  **How it works** (the agent explains behaviour). Same toolbar switch.
- **Stories.** A story answers one question ("What happens each time the host asks for audio?"). It is a set of
  **steps** (concepts such as *voice* or *audio block*, each saying what it does) joined by **links** that say what
  passes between them (audio, events, data, control). Several stories per repo; one shown at a time.
- **Anchored.** Every step names the files that do the work and cites evidence (file and line). A step with no
  file is allowed only if marked as a gap.
- **The one rule holds.** Files a story names appear on its cards; every other file folds into a counted
  "not in this story" box. Every edge is counted: among story files, crossing into the box, or inside the box.
  Concepts are added on top of files; they never replace or hide one. The meter balances in this view too.
- **Provenance is visible.** Agent-written steps are `inferred` (drawn with the inferred line pattern). Julian's
  edits are `annotated` and win over the agent's version when the agent redraws. A pinned step is treated as
  established: auditors check it but the agent never rewrites it.
- **Manual redesign:** drag steps; edit a step's name and description; add, delete or reorder steps; pin; and
  send the agent a redraw request, which it answers as a proposal in dialogue (stage 3), never silently.

## Audit tests

- Every cited line exists at the crawled commit and mentions what the step says it does (checked for HORDE's two
  first stories at c64cfdbc: 33 of 33 citations land on the cited code).
- Every file a step names is in the graph; a link between two steps is supported by at least one crawled edge
  between their files, or is marked inferred with a reason.

## Open (Proposed)

- Story format: `design/prototype/stories/<repo>-<commit>.json` is a stand-in; a schema comes with schema 0.3.
- Where Julian's edits live: the prototype keeps them in the browser and exports them as JSON for the agent to
  commit. The durable home (view.json vs overlay) is a schema decision.

## Update 2026-10-08: after the critic review

- **Two steps were false and four misleading in the first draft**, although all 33 citations landed on the cited
  lines: velocity is used for gain (`setNoteVelocity`; `swarm_core.h:1228`), not ignored; the scope taps each
  oscillator, not the master output; Bass Mono is off by default; GUI edits bypass the event loop; intent
  resolution sits behind a dev flag that ships off; the note-on paths branch three ways (SPECTRA, SAW poly, SAW mono)
  and a mono retarget reaches sound without a new voice. All corrected. A citation that exists is not a claim that
  is true: auditors must read the cited code in context (LIBRARY L0004).
- **Agent links are never drawn solid.** A crawled edge between two steps' files is shown as context in the
  tooltip, never as proof; solid would read as crawled (0016). Pinned is shown by colour, never by line pattern.
- **A link with no crawled edge between its steps' files must state a `reason`** (enforced by `tools/story.test.mjs`).
- **A step with no files is drawn as a gap** (warning colour).
- **Reorder** is done by dragging; changing which step follows which is a redraw request, because it changes a claim.
- **Edits are keyed by the stories file's content hash**, so a rewritten stories file never inherits edits meant for
  different steps; edits that no longer match are shown, and orphaned added steps are kept at the end.

