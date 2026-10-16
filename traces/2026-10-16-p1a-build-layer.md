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
