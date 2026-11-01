# q037-code-from-map — see the code from the map: GitHub, editor, Finder and a code pane

- **Queue item:** Q-037 (Julian, 2026-10-30: "view the code from within Loupe, or at least have a 'show in finder' and
  'open in [code editor]' in the right click menu"). Human gates: editing `./verify` (approved by poll 2026-10-31).
- **Julian (polls, 2026-10-30):** all four actions in the first version; the local helper is `npm run view` extended;
  hosted, the pane reads GitHub at the crawled commit; menu on files, edges and sections, the same actions in the panel;
  plain line-numbered pane. **(2026-10-31, after the critic):** serve every dot-directory but `.git`; wire the test.
- **Change:**
  - `design/prototype/code.js` (new, pure): `codeSource` (exact only for a clean crawl of a commit hash on GitHub; the
    sample opens nothing, even locally), `githubUrl`/`rawUrl` (segment-encoded), `edgeSite`, `codeTarget` (a file node;
    an edge's first evidence, at its line; a section's computed common folder), `codeActions` (four actions, each
    disabled with its reason), `evidenceMarks`.
  - `tools/serve.mjs`: `createLoupeServer()`; `/helper/info` (token, checkouts, their commit and dirtiness),
    `/helper/file`, `/helper/reveal` (`open -R`), `/helper/editor` (`vscode://` or `cursor://file/…:line`). Guards:
    Host is this loopback port, Origin if sent is this origin, token header, `resolveIn` (no absolute path, `.`, `..`
    or `.git`; realpath inside the checkout, separator-aware), `execFile` with no shell, editor allowlist, POST for
    actions, macOS only. Errors reach the page as fixed words; the detail (paths) stays in the server console.
    Locations: gitignored `.loupe-local.json`; HORDE defaults to `LOUPE_HORDE`, then `./verify full`'s default.
  - `design/prototype/index.html`: menu items; a button row in the file, edge and section panels; the code pane (marks
    select their edge on the map, a line with several edges steps through them; the selected edge's lines outlined;
    the header names what was read: the checkout at the crawled commit, or at another commit or dirty, "marked lines
    may have moved", or GitHub at the commit); Escape closes it; editor choice per browser. A snapshot from another
    origin is refused (critic H1), and the edge and node panels escape graph fields they printed raw.
  - `tools/code.test.mjs` (new, in `./verify fast` and `npm test`); `.gitignore`.
- **Checks:** 58 in `code.test.mjs`: where the code is (clean, sample, dirty, no repo, not GitHub, not a hash), the
  URLs, what each element points at, the actions and their reasons (hosted, local, no checkout, not macOS, sample,
  section, missing node), the marks against an independent recount on HORDE's busiest file (143 line-edge pairs), and
  the helper against a throwaway checkout with planted escapes (`..`, a same-prefix sibling, `.git`, `.` segments, an
  absolute path, two symlinks out), wrong token, foreign Origin, rebound Host, unknown repo, unknown editor, GET action,
  off-macOS, a failing `open` (500, fixed words, no hang), roots (relative, `~/`, LOUPE_HORDE), the gitignore.
- **Plants (26, each caught):** `.git` served; every dot-directory refused; prefix without separator; symlinks
  unresolved; no Host, Origin or token check; any editor scheme; no platform check; actions by GET; reveal the root;
  editor without the line; error detail sent to the page; dirty not reported; open errors unanswered; relative root
  from cwd; path not encoded; dirty crawl linked; commit not checked; sample opened locally; a missing node as a file;
  marks deduped per line; section folder one level short; off-macOS actions; hosted editor enabled; gitignore line gone.
  First run: 19 of 20 (the separator-free prefix was hidden by the `..` check; a same-prefix sibling symlink now
  catches it).
- **Browser (local, HORDE crawl, a HORDE checkout at d412a28):** the menu on a file; the pane from a file and from an
  edge at its line; a mark selecting its edge; `.claude/` files opening; a foreign `?snapshot=` refused; the sample and
  the dirty fixture crawl showing every action disabled with its reason; phone width. A fetch of raw.githubusercontent
  at the commit from the page returned the file.
- **Critic (opus): REWORK**, fixed: H1 (foreign snapshot + unescaped fields → token → private files), H2 (dot-directories,
  by Julian's poll), H3 (wired), M1 (paths in errors), M2 (dirty checkout called exact), and the lows (commit hash,
  relative roots, "the repo root" label, the panel width shared through `--panel-w`).
- **Not tested, said here:** the page wiring in `index.html` (no headless test of the page, as before); macOS really
  opening Finder or an editor (the test records the exact `open` arguments; not run, to keep windows off Julian's
  screen); the hosted Testbench's CSP for the GitHub fetch and `window.open` from the artifact frame (checked after the
  merge's republish). Open: the pane can cover the edge a mark selects on a narrow screen; nothing pans to it.
- **Verify:** `./verify fast` exit 0 at 3e6cc19 (647 passing check lines). `full` not run (no HORDE checkout at `LOUPE_HORDE`).
