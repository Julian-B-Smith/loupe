# q021-generated-by-several — one generated output, several owning targets

- **Queue item:** Q-021. HORDE's answer to notice-003: Loupe's lead (`identity_store_check` reads `factory_bank.h`)
  sat beside the real bug, `factory_bank.h`'s rule listed in two independent targets (horde B501). The crawl already
  held it as two `builds` edges to one generated node.
- **Change:** `crawler/conformance.ts` adds `generated-by-several`: a generated output (missing: generated, or the
  target of a generates edge) built by two or more targets, some two with no dependency path between them in either
  direction, per configuration; findings carry `owners` and the `builds` edges. Snapshot `conformance.json` files
  regenerated (a pure function of each graph); docs updated.
- **Evidence:** on the HORDE crawl at 1e6aae79 it names exactly `factory_bank.h`, owned by `HYPERSAW-impl` and
  `presetstore_check`, and nothing else; on the fixture, nothing. A crawled small repo shows the finding for two
  unordered owners and none once one depends on the other. Plants: always-on fails the ordered case, always-off fails
  the other two.
- **Verify:** `./verify fast` exit 0.
