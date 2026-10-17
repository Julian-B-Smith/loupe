# q020-attribution — tying files to targets, so conformance sees what compiles use

- **Queue item:** Q-020, found by the first HORDE crawl: targets list .cpp files, not headers, so tying files to
  targets only through `builds` left 94 "declared, not seen" findings that were Loupe's blind spot.
- **Measured before deciding:** of HORDE's 1,336 "unattributed" includes most point outside the repo; only 56
  included repo files are unlisted, and a directory rule alone ties 11 (`src/` holds 8 targets' sources, `tools/`
  105). Using compile reach for "uses" and interface overlap for "seen" took the 94 to 1. Julian accepted the rule
  with these numbers in front of him (poll, 2026-10-17).
- **Change:** `crawler/conformance.ts` (uses by compile reach; owners by listing, then unique directory; seen by
  interface overlap; `tiedBy`, `notJudged`); a multi-owner file counts as declared if any owner is reachable (the
  shared ownership itself is `generated-by-several`). Tests, golden, snapshot conformance files, docs.
- **Evidence:** HORDE: exactly `used-not-declared` presetstore_check → HYPERSAW-impl (via `src/gui/preset_store.h`,
  tied by directory), `declared-not-seen` vst3_save_bench → HYPERSAW_vst3, and B501's `factory_bank.h`; 26
  dependencies and 42 files not judged. A crawled small repo shows the directory tie through a transitive include,
  and no finding once declared. Plants: breaking the directory rule and the interface rule each fail their tests.
- **Verify:** `./verify fast` exit 0.
