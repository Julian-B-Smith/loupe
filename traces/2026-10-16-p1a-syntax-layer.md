# p1a-syntax-layer — includes from C and C++ with tree-sitter (Q-013)

- **Queue item:** Q-013 (P1a slice 2). Decisions by poll 2026-10-16: the web-tree-sitter runtime as a dependency with
  vendored grammar .wasm files pinned by sha256; C and C++ first.
- **Change:** `crawler/syntax.ts`, `crawler/syntax.test.ts`, `crawler/grammars/` (two .wasm, their MIT licences,
  `GRAMMARS.json`, README); `cli.ts syntax`; `web-tree-sitter` 0.27.1 pinned exactly in `package.json`; the fixture
  gains an include for each rule; the syntax test is gated in `./verify fast`.
- **Evidence:** the three packages were fetched with `npm pack` into a scratch dir and inspected first: the grammar
  packages run `node-gyp-build` on install (so only their .wasm is vendored); web-tree-sitter has no dependencies and
  no install script. A smoke test loaded both grammars (ABI 15 and 14) and parsed `#if`/`#elif`/`#ifdef` structure.
  Every fixture result was read against its rule before the golden was written. Plant: a changed fixture include
  fails the golden. A grammar with one byte changed refuses to load.
- **Found on the way:** without inheriting includer contexts, a header no target lists (most headers) could only
  resolve relatively, so `src/dsp/filter.h` → `platform.h` would read "unknown". Added as a fixpoint and recorded in
  Q-013 criterion 3. A generated header reached through a build include dir is `build`, not `syntactic` (criterion 3
  reworded). The `cmake-basic-0.3` example still matches the fixture at its source commit (3342617), not today's.
- **Verify:** `./verify fast` exit 0 (first version).

## Rework after critic review (same day)

- **Critic (opus): FIX FIRST.** C1 includes vanished silently: inside class bodies and initializers tree-sitter
  parses `#include` as something else, and `.mm`/`.inc`/`#import` were never read (38 include lines in HORDE's
  Objective-C++ files, one a shipped GUI source). H1 wrong guards: `||` precedence, `__has_include` branches,
  `extern "C"` under `#ifdef __cplusplus`. H2 a miss's id shared the repo-path namespace and fed a false `build`
  resolution. Also absolute includes, compile groups merged per target, `configs` semantics, guard idioms.
- **Julian's calls (polls):** a line-oriented directive scanner with a census replaces tree-sitter for includes
  (tree-sitter keeps parse-error counts and P1b symbols); Objective-C/C++ read for includes; header inheritance
  ratified with provenance (`via`), misses never propagate.
- **Fixed:** all of the above, each held by a test marked "(critic)". Ids are now `file:` or `miss:`; guards
  parenthesise each part; the census lists every include-looking line the scanner did not read; absolute spellings
  are never resolved or echoed; backslashes resolve; `.C` is C++; a non-git repo fails with a message. `.npmrc`
  sets `ignore-scripts=true`, so no install script runs, in CI either.
- **Verify:** `./verify fast` exit 0 after `npm ci` with scripts off.

## Second review and the compile-roots rewrite (same day)

- **Critic (opus), second pass: FIX FIRST.** C1 the inherited-context fixpoint never ended on an include cycle (each
  key carried the whole chain), and grew exponentially on diamonds: a first HORDE crawl would likely have hung.
  H1 a header took every context of its includer, giving false cross-configuration edges. H2 `!(`-prefixed
  conditions lost their parentheses. H3 files reached by an include but with an unlisted extension were never read.
  M1 false includes from digit separators, `//`-comment continuations and raw strings.
- **Julian's calls (polls):** compiles are the roots (every non-compiled file, listed headers included, is resolved
  in each compile that reaches it); `via` names the compiled source.
- **Fixed:** contexts are (configuration, compiled source + include dirs), so a file has at most one per compile and
  every cycle ends; a file takes only the contexts in which an include resolved to it; listed headers no compile
  reaches fall back to their target's dirs (a second phase, so no file switches after passing contexts on); every
  tracked file an include reaches is read; raw parts of a condition are always parenthesised; the comment stripper
  models digit separators, `//` continuations, raw strings, `%:` and `<a//b.h>`; absolute spellings are redacted in
  every form; a tracked file deleted on disk is a problem, not a crash. Each finding is held by a test, including
  a cycle, a self-resolving `#include_next` and a 20-layer diamond under a time limit. The fixture's facts were
  unchanged by the rewrite.
- **Verify:** `./verify fast` exit 0. A third, narrow review of the rewritten core is the last gate before the PR.

## Third review (same day)

- **Critic (opus), narrow pass on the rewritten core: FIX FIRST, small.** Termination proven from the code (contexts
  per file bounded by the number of compiles; a 900-header complete diamond in 226 ms; HORDE in 7 s). Found:
  `#include_next` resolved to its own file (a test asserted only "some edge"); a sort tie let input order change the
  bytes; a header's configurations were nowhere in the output.
- **Julian's calls (polls):** a listed header falls back per configuration; a compiled source included by another
  compile (unity builds) is resolved in both.
- **Fixed:** all of it, each with a test; plants of the tie-break and the `include_next` fix each turn a test red.
  `files` entries now carry `configs` (or `inCompile: false`).
- **Verify:** `./verify fast` exit 0.
