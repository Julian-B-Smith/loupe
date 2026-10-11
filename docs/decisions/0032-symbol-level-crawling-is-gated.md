# 0032. Symbol-level crawling is gated on evidence, not assumed

- **Status:** Proposed
- **Date:** 2026-10-10
- **Source:** Prior-art amendment pass (docs/prior-art.md, contradiction C7). Awaiting Julian.

## Problem

Decision 0018 and ROADMAP P1 include symbols in headers, call sites with signatures and roles by signature. The
two nearest products, Sourcetrail and CodeSee, were consumed by symbol-level, per-language indexing (reasons partly
contested; see prior-art.md). The file-level graph is the cheap part and already supports fold, isolate, lenses
and stories.

## Proposal

Split P1. **P1a:** file-level crawl with build facts (0026 to 0028), all of the P1 gates that are file-level, and
the Operational lens seeded from targets. **P1b:** symbols and calls, started only when a named question cannot be
answered at file level (first candidates: the audio, parameter and modulation roles, for which no prior art was
found). P1b's gate includes a measured precision figure against a compiler-based index on HORDE.
