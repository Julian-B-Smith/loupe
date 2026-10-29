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
  the svg for it. Big-diff puts no marked file behind an isolate port (they are all elsewhere); the HORDE sample isolated
  on Modulation does, and is checked (after the critic).
- **Checks (stress.test.mjs, expected from the diff lists and the section tree, not from render()):** big-diff at
  overview, k 0.25 and 0.15, both sides: four tallies, each equal to its box's files and listing exactly them, on its
  box, clear of tabs, labels and each other; every marked file drawn or tallied (the diff's own conservation); two
  collapsed sections; isolate; no fold holds a marked file; 80 loose files; the operational lens on the HORDE sample;
  whole-repo with a diff (40 narrow boxes); the waffle's squares per kind; the waffle off by default; the meter summary.
  After the critic: the HORDE sample at k 0.3 and 0.22 (tabs and labels counted), its isolate ports, a nested collapsed
  section zoomed out, every tally on a clear spot in eight frames, the panel's words, the before side's summary, the
  waffle's start state, and 300 extra files with the waffle on.
- **Plants, first round (16):** 9 caught at once; 6 more after the checks were fixed (big-diff zoomed out has no tabs
  and the label matcher found none at k 0.15, so "clear of tabs and labels" could not fail: the HORDE sample at k 0.3 and
  0.22 added, the checks now say how many they compared; the collapsed check now needs the full chip row; the waffle's
  order is checked). Two real bugs the new checks found: a tally on a twin's label inside Engines (twin headers were not
  registered zoomed out) and the waffle over those labels. Equivalent (no observable change): diffHeld counting drawn
  files (drawn entries carry no proxy), a first spot off the box (the bounds filter skips it).
- **Critic (opus): REWORK**, fixed. H1: a collapsed box's tally covered its name (header name, count and +/− now keep
  tallies off; a header-high box puts its full tally just below). H2: a port's tally covered its edge count (it sits
  left of the count; the port's name gives way). H3: a collapsed nested section zoomed out drew a second tally and the top
  box came up short (zoomed out a file stands in by its top box, as its edges do). M1: the waffle drew only at one square
  per file (Julian, poll). M2: tokens.json and handoff #4 record the waffle and tally exception (Julian, poll);
  `components/diff-tally/README.md` in prose, its loupe-spec block waiting on adding `diff-tally` to
  `schema/loupe-spec.schema.json` (a human gate, not taken). M3: the panel's and tooltip's words come from inspect.js
  `diffBoxText` and are tested; the waffle's default is read from `initialState()`. M4: the stories view hides the Re-run
  control and summary (Julian, poll). M5: tooltips name the box; no left-edge straddle; outside spots keep out of other
  boxes. M6: "of 11 files (+1 removed)". L1 port names; L2 the label matcher takes turned and untitled labels (it then
  found real collisions on whole-repo, fixed by scanning the whole edge, then inside the box, then a compact chip); L3
  recorded in ROADMAP; L4 the tooltip says when the waffle needs room; L5 the before side's summary says only +N ~N; L8
  an empty panel says to zoom out. L6 (a removed ghost counts outside a lens) is the older rule, now visible.
- **Plants, second round (12 + 3 re-planted):** each caught except two equivalents (the before summary's text never
  showed stale; the turned-label padding moved nothing once the inside scan existed).
- **Browser (1440×900):** the HORDE sample zoomed out (Engines +1 ~1 ⧗1 −1; click lists its 4); isolate Modulation (port
  tallies left of their counts; the bar says "4 of them differ"); big-diff with DSP and STATE collapsed (full tallies
  below the boxes); the before side in light theme ("re-run, before: +30 ~4"); the waffle zoomed out. Not re-reviewed by
  a second critic round.
- **Verify:** `./verify fast` exit 0.
