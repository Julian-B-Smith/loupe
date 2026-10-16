# p1a-build-layer — the crawler's build layer, on a fixture (Q-012)

- **Queue item:** Q-012 (P1a slice 1). Decisions by poll 2026-10-16: native TypeScript (no dependency), configure
  commands from `.loupe/config.json`, internal build facts (no schema change), gated in `./verify fast`.
- **Change:** `crawler/build.ts`, `crawler/cli.ts`, `crawler/build.test.ts`; `fixtures/cmake-basic/` and its golden;
  `./verify fast` runs the build-layer test.
- **Evidence:** a real File API reply and trace were inspected before the parser was written (absolute paths
  everywhere, a `.rule` pseudo-source, platform flags in compile fragments, 14 of 5,600 trace lines from the project,
  a wall-clock `time` on every line). The golden was read in full against the fixture's CMakeLists (PUBLIC/PRIVATE
  propagation, option-only source, platform-only source unclaimed). 17 test cases; three plants caught (fixture
  change, cleanup removed, `--trace-expand` dropped). Two runs byte-identical; no absolute path; no scratch dir left.
- **Found on the way:** the plain JSON trace keeps variables unexpanded, so a custom command's output cannot be
  matched to the generated source. `--trace-expand` fixes it but adds a flag to the command HORDE named; recorded
  in Q-012 as "ask HORDE before the first run there".
- **Verify:** `./verify fast` exit 0.

## Revision after critic review (same day)

- **Critic (opus): REWORK, three blockers, all fixed and each now held by a test:** defines leaked absolute paths
  (now token-wise normalised; the leak check matches any absolute path, not only after a quote); two external sources
  collapsed into one row (now `${external}/<name>`); config args could move configure out of the scratch dir (now an
  allowlist, DECISIONS H9).
- **Should-fixes fixed:** custom-command parsing (TARGET form and stage, several COMMANDs, unknown keywords, list
  values, relative OUTPUT in the binary dir, relative DEPENDS against the caller's dir, BYPRODUCTS); Ctrl-C (cleanup,
  then exit 130); multi-config generators read in full; CMake environment variables cleared and toolchain variable
  names recorded; a missing git is a note, not an empty list; custom-target stamps filtered; `generated` from any
  configuration; duplicate configuration names refused; the trace is streamed with a substring pre-filter.
- **Oracle gaps closed:** the fixture now has a subdirectory, two external sources, a path-valued define, a
  POST_BUILD command with a marker that must never appear, a list DEPENDS, a custom target, and a CMake file outside
  the repo whose rule must be filtered. 39 test cases.
