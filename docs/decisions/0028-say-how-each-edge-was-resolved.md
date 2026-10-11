# 0028. Say how each edge was resolved, not only where it came from

- **Status:** Accepted (Julian, 2026-10-11: "accept the recommended option on all nine ADRs")
- **Date:** 2026-10-10
- **Source:** Prior-art amendment pass (docs/prior-art.md, contradiction C3). 

## Problem

Loupe chose web-tree-sitter (WASM, no native builds). tree-sitter runs no preprocessor: includes and defines are
recoverable, but calls inside macro-heavy code, computed includes and `__has_include` are not, and "no native
dependencies" and "correct for C++" cannot both hold everywhere. Decision 0016's provenance says who asserted an
edge (the crawler: `static`) but a call found by name in a syntax tree and a call resolved by a compiler would both
be `static`.

## Proposal

Keep provenance as it is. Schema 0.2 already records, per evidence site, a `resolution` of `exact`, `compile-db`
or `search`, and a preprocessor `guard`; today it is optional and nothing draws it. Extend the list with `build`
(read from the build system, 0027) and `syntactic` (matched by name in a parse tree, unresolved), make it required
on every crawled edge, and draw it (in the inspector and as a count in the meter). A file whose parse had errors
records the error count, and no call edge is emitted from an error subtree. An optional clang-based cross-check may
run where a toolchain exists, as separate evidence, never as a requirement.

## Open

Whether `syntactic` call edges should instead be overlay edges with provenance `inferred`. That would keep `static`
meaning "certain", at the cost of putting crawler output in the overlay, which 0016 reserves for agents and traces.

## Ruling (2026-10-11)

The proposal as written: provenance is unchanged; `resolution` is extended with `build` and `syntactic`, required on every crawled edge, and drawn. The open question is settled by the same ruling ("keep provenance as it is"): a call matched by name stays a crawler edge with resolution `syntactic`; it does not move to the overlay.
