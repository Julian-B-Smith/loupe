# rules-phase-and-loupe-002 — 0034's open question settled; HORDE's answer integrated

- **Queue item:** none (ADR 0034 open question; ROADMAP P1a precondition).
- **0034:** Julian, by poll: exported rules get their own phase, **P6r**, after P6. P4's gate no longer depends on
  HORDE's CI; it requires claim tests to be pure functions over graph and view. P6r's gate reproduces HORDE's own
  `tools/h2_rules_check.py` verdict (file confirmed at c64cfdbc).
- **loupe-002:** HORDE answered 2026-10-12 (`horde/integrations/loupe/response-002.md`, ratified by Julian on their
  side): counter-design 1, their exact configure command, two conditions (delete the scratch dir; treat output as
  data). Recorded in ROADMAP P1a. Closing notice `horde/integrations/loupe/notice-002.md` written (uncommitted there).
  HORDE corrected our brief: their CMakeLists changed after c64cfdbc (they now fetch the VST3 and AU SDKs themselves).
- **Verify:** `./verify fast` exit 0.
