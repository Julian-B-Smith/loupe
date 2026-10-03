# design-ingest-v4 — design delivery v4 copied into design/ and reviewed

- **Queue item:** unqueued (handoff step 2 and 3); creates Q-004 to Q-008
- **Why:** Julian asked to triage the design handoff; poll chose "ingest v4 + review", offsets in the view (0020), no network fonts.
- **Evidence consulted:** `design/HANDOFF.md`, `docs/design-handoff.md` (incl. addenda v2.2, v2.3), `docs/design-links.md`,
  a validator run of all 17 loupe-spec blocks and tokens.json against the schema and the required-token list, loupe-check on
  the delivered snapshots, live renders of the prototype on its sample, the repo's 0.2 sample and the HORDE probe crawl, and an
  independent critic review (opus) of the prototype code; I re-read the code behind B1 to B3 before accepting them.
- **Alternatives rejected:** waiting for v5 before ingesting (loses a pinned baseline to diff against); infrastructure patching
  B1 to B3 itself (crosses the design lane).
- **Verify:** `./verify fast` exit 0 on this branch (design/ carries no gate yet; Q-007, Q-008 add them).
- **Open questions:** the design packet doc copy and data kit are still at v2.1 / schema 0.1 and must be republished before v5.
