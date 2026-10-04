# 0024. One history for Back/Forward and Undo/Redo; a right-click menu

- **Status:** Accepted (Julian, by poll 2026-10-03)
- **Date:** 2026-10-03
- **Source:** Julian: add fold and isolate to a right-click menu; a back/forward interface, which means a state
  history, "so we might as well add undo and redo hotkeys". Poll: one history; view changes plus selection; every
  control listed below; "isolate" and "return to full view" must be in the right-click menu.

## Decision

- **One stack.** Back = Undo, Forward = Redo. The viewer never edits data (agents write `view.json`), so every
  step is a view change and two stacks would have nothing to separate.
- **Steps:** isolate, fold and unfold, collapse, open ports, flow/design, stage, hub placement, dimmed kinds, a
  finished drag (one step per drag), re-run diff side, tour step, and selection. Not hover, zoom, pan, the
  flow-to-design morph or the theme. At most 200 steps. Undoing across an isolate or a view switch re-fits.
- **Controls:** ← → toolbar buttons whose tooltips name the step; ⌘Z / Ctrl+Z, ⇧⌘Z / Ctrl+Y; Alt or ⌘ + ← →;
  the mouse's back and forward buttons (and ⌘[ / ⌘], which Safari mouse drivers send); Back and Forward at the top of
  the right-click menu; long-press opens the menu on touch screens (iOS fires no right-click event). In-app only: the
  browser's own history is untouched, because it is unreliable inside the hosted artifact frame.
- **Right-click menu** for what is under the pointer: a section (Isolate, Collapse/Expand, show or refold folded
  files), a file (Select, plus its section's actions), a fold row, a port (list files; Isolate that peer section,
  so one can walk from sub-patch to sub-patch and come back with Back), an edge or element (Select). "Back to full
  map" is always there while isolated, plus "Fit to screen". While isolated, hub placement controls are hidden (it
  needs the layer band, which isolate drops).

## Evidence

`tools/history.test.mjs` (13 cases, in `npm test`) pins the rules; a planted bug (a new step not clearing Forward)
makes it fail.
