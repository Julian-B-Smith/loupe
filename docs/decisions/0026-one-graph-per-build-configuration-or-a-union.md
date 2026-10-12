# 0026. One graph per build configuration, or a union

- **Status:** Accepted (Julian, 2026-10-11: "accept the recommended option on all nine ADRs")
- **Date:** 2026-10-10
- **Source:** Prior-art amendment pass (docs/prior-art.md, contradiction C1). 

## Problem

A build system answers "which files does this target compile" for one configuration on one platform. The CMake
File API is organised that way (verified). A crawl configured on macOS never sees HORDE's Windows-only GUI file as
part of the product; the Operational lens reports it as "not shipped". Decisions 0018 and 0019 promise the same
bytes for the same commit and config, but never say which platform's build the graph describes. A graph that is
silently partial is the failure the one rule exists to prevent, one level down.

## Options

1. **Union with conditions (recommended).** Crawl every configuration the repo declares that can be configured on
   this machine; an edge or membership seen only under some configurations carries that condition. What could not be
   configured here (another OS) is listed in the inventory as "not evaluated", never as absent.
2. **One configuration, named.** The graph records exactly which configuration it reflects and says so on screen.
   Simple; under-reports by design.
3. **Per-platform graphs** merged later by a deterministic tool.

## Consequence of the recommendation

Schema 0.3 gains a condition on edges and on target membership (0018 already has `guard` evidence for `#if`); the
P1 gate gains "the graph states the configurations it covers and those it could not evaluate".

## Ruling (2026-10-11)

Option 1, **union with conditions**. The crawl covers every configuration the repo declares that can be configured on the machine; membership or an edge seen only under some configurations carries that condition; configurations that could not be evaluated (another OS) are listed in the inventory as not evaluated, never as absent.
