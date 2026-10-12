# 0027. Build facts come from the CMake File API, which means running configure

- **Status:** Accepted (Julian, 2026-10-11: "accept the recommended option on all nine ADRs")
- **Date:** 2026-10-10
- **Source:** Prior-art amendment pass (docs/prior-art.md, contradiction C2). 

## Problem

The Operational lens needs to know which files each target compiles (Q-009). `compile_commands.json` names no
targets and no headers. The CMake File API gives targets, sources, include paths, defines and `isGenerated`
(verified), and the JSON trace gives custom commands (verified), but both require **running `cmake` configure**,
which executes the target repo's CMake code. Brief loupe-001, which HORDE accepted, says the crawl "reads tracked
files at a commit and does not execute anything". ROADMAP P1 names `compile_commands.json` as the source.

## Options

1. **Run configure, in the open (recommended).** The skill runs `cmake` configure into a scratch build directory
   outside the tree, with File API queries and the JSON trace, in the target repo's own session (0021). Loupe sends
   HORDE a notice amending the brief before any run. Timestamps and absolute paths are stripped for determinism.
2. **Read a build directory the repo's owner already configured.** No execution by Loupe; depends on a stale or
   absent build dir, and the result is not reproducible from the commit alone.
3. **Parse CMakeLists.txt statically.** Executes nothing; cannot evaluate variables, generator expressions or
   includes reliably, so membership would be approximate and must be marked as such.

## Consequence of the recommendation

A notice to HORDE (their ball is ours for the P6 notice already; this is an amendment to what the crawl does).
Edges and memberships read from the build carry provenance `config`. Option 3 remains the fallback when configure
fails, marked "searched".

## Ruling (2026-10-11)

Option 1, **run `cmake` configure, in the open**: into a scratch build directory outside the tree, with File API queries and the JSON trace, inside the target repo's own session (0021), with timestamps and absolute paths stripped. Static CMakeLists parsing stays as the marked fallback. HORDE is told before any run: brief loupe-002, filed 2026-10-11.
