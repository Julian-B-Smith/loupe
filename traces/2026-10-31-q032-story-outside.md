# q032-story-outside — the "How it works" box of files not in the story opens to its edges

- **Queue item:** Q-032 (from Q-028's critic, M3; ADR 0029). Julian chose it next by poll, 2026-10-31.
- **Change:**
  - `design/prototype/works.js`: every edge records `ends` (a file's card `n:<id>`, or `story-outside` for an end off
    the cards); the box carries `data-holds="story-outside"` and `data-count` (edges among outside files + crossing).
    The box stays accented while its edge list is open; its tooltip names right-click.
  - `design/prototype/index.html`: the box's menu gains "List the N edges this box stands for"; its file panel gains a
    button to the same list (its click still lists files: `hit()` checks `data-storyout` first). Each row says which of
    the box's two counts it belongs to ("among outside" or "crossing in"), from the meter's record.
  - `design/prototype/inspect.js`: the key documented. `tools/render.test.mjs`: a new block.
- **Checks:** for both HORDE probe stories, plain, one step deleted, cut to the first step, a step added with a file
  not in the graph and a known outside file, and every step deleted (10 frames): the box's count equals its list; the
  list equals every edge with an end off the cards, computed from the story's files (`storyAccounting`), not from
  what works.js recorded; every edge's recorded ends are exactly its cards or the box; the meter balances.
- **Plants (8, 7 caught):** crossing edges off the box; the count only edges among; edges between cards on the box;
  no ends; no `data-holds`; a card end named wrong; a card end dropped. **Not caught:** a file not in the graph marked
  as drawn. No edge ends at such a file, so the box's list cannot change; the plant is not a fault of this rule.
- **Browser (local, horde-probe, "One audio block"):** the menu says 627 edges; the meter says 493 among outside + 134
  crossing; the list shows 627 rows, 493 "among outside" and 134 "crossing in"; the box's click still opens its file
  panel; the box stays accented while the list is open. Screenshots in the PR.
- **Critic (opus): ACCEPT**, with notes, fixed: M1 (rows say which count they support), M2 (unknown file and every step
  deleted tested), L1 (ends checked complete, not only correct), L2 (accent), L4 (the button's count from the list; the
  tooltip). Left: L3 (a list left selected after switching views says "pick it again", as for every other key), L5
  (`hit()`'s order is inline code, untested, as for every element).
- **Also:** `./verify full` ran for the first time on a local HORDE checkout (at b37d255, before this change): exit 0,
  every HORDE gate passing.
- **Verify:** `./verify fast` exit 0 (660 passing check lines).
