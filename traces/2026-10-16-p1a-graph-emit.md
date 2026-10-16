# p1a-graph-emit — graph.json at 0.3.1, the inventory, and build-target conformance (Q-016)

- **Queue item:** Q-016 (P1a slice 3). Decisions by poll 2026-10-16: every tracked file except binaries is a node;
  `via` enters the graph as schema 0.3.1; declared-versus-observed findings start here, for build targets (Julian:
  Loupe can expose where a client's declared structure is not supported by the deterministic pass).
- **Change:** `crawler/graph.ts` (emitter + inventory), `crawler/conformance.ts`, `crawler/cli.ts crawl`,
  `crawler/graph.test.ts` gated in `./verify fast`; schema 0.3.1 (`via` on site evidence) with loupe-check G9 and five
  mutation cases (58 in all); the build layer now records each target's defining file and line (File API backtrace),
  so build evidence cites `lib/CMakeLists.txt` for `lut` instead of guessing the top-level file.
- **Evidence:** the fixture's graph was read edge by edge against the fixture (17 static include edges, 10 builds,
  2 depends, 5 generates; 10 missing nodes, each with its reason; `src/win_only.cpp` in notEvaluated); target
  definition lines checked against `grep add_library/add_executable`. An accounting test proves every include fact
  is a site and every membership and dependency an edge. Conformance on the fixture finds exactly one finding,
  `plugin` uses `lut` without declaring it; a plant removing that include removes the finding. A synthetic repo shows
  `declared-not-seen`.
- **Found on the way:** the design view places no loose node, so a fresh crawl draws nothing there (the flow view
  places everything): recorded as Q-017. The first emitter repeated one fact's evidence once per configuration;
  fixed (configs says where, evidence says what).
- **Verify:** `./verify fast` exit 0.

## Revision after critic review (same day)

- **Critic (opus): FIX FIRST.** H1 custom-command facts were dropped (unknown `name:` DEPENDS, TARGET-form
  byproducts, commands with no output, the fixture's own POST_BUILD step among them); H2 an include's configurations
  lost its file's compile scope (`extra.cpp → engine.h` claimed to hold in `release`). Also: per-site configs lost in
  the edge union, wrong missing reasons (dead `genOut`), `repoName` able to emit local paths or part of a password,
  conformance not saying how weak its evidence is, submodules and symlinks, a commitless repo given a made-up commit.
- **Julian's calls (polls):** an include holds where its file is compiled; sites carry `configs` in schema 0.3.1.
- **Fixed:** all of it, each with a test; every small test graph is now also run through loupe-check; the repo name is
  checked against a table of ten remote forms; four mutation cases (62 in all). The leak gate caught machine-style
  test inputs twice; they are assembled at runtime, the gate untouched.
- **Verify:** `./verify fast` exit 0. The fixes were not given a second critic pass.
