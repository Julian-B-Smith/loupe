# q-002-sample-freshness — ./verify fast fails on a stale horde-sample

- **Queue item:** Q-002
- **Why:** `schema/examples/horde-sample/` is generated from `prototype/data/sample-horde.js` by `tools/convert-sample.mjs`;
  nothing caught an edit to the sample (or to `canon.mjs`) without a re-run, so a stale example could ship.
- **Change:** `convert-sample.mjs` takes an optional output dir (default unchanged). `fast` regenerates into a temp dir
  and `diff -r`s against the committed example.
- **Evidence the gate fires (effective, not declared):** planted `label:'Plugin shell PLANT'` in the sample → exit 1 with
  the diff line; near-miss (comment-only edit, same output) → exit 0; original restored → exit 0, clean tree.
- **Alternatives rejected:** regenerating in place and `git diff --exit-code` (verify would write tracked files).
- **Verify:** `./verify fast` exit 0.
- **Also this session:** the design delivery zip was deleted after all 35 files were shown byte-identical to commit
  316b060 (the ingest). The commit is the archive. #2 merged into #1's branch, not main; re-landed as #3.
- **Open questions:** none.
