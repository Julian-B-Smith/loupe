# q035-diff-overview — the re-run diff on boxes that stand for files

- **Queue item:** Q-035 (filed 2026-10-27 from the Q-029 critic; blocks Q-029). Evidence then: big-diff at k 0.25 showed
  no mark and no summary.
- **Julian (poll, 2026-10-28):** of four prototypes on one page (tally, bar, tint, waffle; screenshots on big-diff and
  the HORDE sample), the **tally**, with the waffle as a display setting, off by default; also a meter summary, and a
  click that lists the files. Criteria agreed by poll the same day (ROADMAP Q-035). The prototype page is gone.
- **Change:**
  - inspect.js: `diffKindOf` (the one rule for a file's diff kind on a side; render.js now uses it), `diffHeld` (the
    files a stand-in holds, by kind, read off `map.nodes[id].proxy`, the record the meter checks), `diffSummary`.
  - render.js §4b: every stand-in holding marked files (an overview or collapsed section, a fold row, the loose block,
    the lens's outside box, an isolate port) shows a tally: one chip per kind, +added ~changed ⧗stale −removed, in the
    file marks' glyphs and colours; too narrow, a single kind's chip or one Δ total, else straddling the box's right
    edge. Spots are tried clear of the ↑↓ tabs, labels and other tallies. `data-diffbox` opens a panel listing exactly
    `diffHeld`'s files by kind. With `settings.diffWaffle`, a box with room shows one square per file (or per few),
    changed first, unchanged grey.
  - index.html: the meter line leads with `re-run +30 ~4 ⧗5 −12` while the diff is on; a Waffle toggle (design view,
    diff on; in history); the isolate bar's elsewhere count says how many of its files changed.
- **Found while building:** under a diff, marked files never fold (layout pins them), so a fold row and the loose block
  never hold one; the check asserts that instead of a tally that cannot occur. Removed ghosts are not graph nodes, so no
  lens holds them: they count on the outside box. A drawn ghost has no `map.nodes` entry (by design); the checks read
  the svg for it. No stress case puts a marked file behind an isolate port (big-diff's are all elsewhere): port tallies
  are drawn by the same code but untested.
- **Checks (stress.test.mjs, expected from the diff lists and the section tree, not from render()):** big-diff at
  overview, k 0.25 and 0.15, both sides: four tallies, each equal to its box's files and listing exactly them, on its
  box, clear of tabs, labels and each other; every marked file drawn or tallied (the diff's own conservation); two
  collapsed sections; isolate; no fold holds a marked file; 80 loose files; the operational lens on the HORDE sample;
  whole-repo with a diff (40 narrow boxes); the waffle's squares per kind; the waffle off by default; the meter summary.
- **Plants:** pending.
- **Critic (opus):** pending.
- **Verify:** pending.
