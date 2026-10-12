# prior-art-rulings — nine ADRs accepted; P1 split; HORDE told about cmake

- **Queue item:** Q-003 closes; PA done; P1a becomes current.
- **Why:** Julian merged the prior-art landscape (#13) and ruled: "accept the recommended option on all nine ADRs".
- **Change:** ADRs 0026 to 0034 marked Accepted, each with a Ruling section stating exactly what was accepted.
  0028's open question is settled by the same ruling (name-matched calls stay crawler edges with resolution
  `syntactic`). 0034's open question (P4 or its own phase) stays open. `docs/vision.md` reworded (0030),
  `docs/visual-grammar.md` overlap primitive changed (0031). ROADMAP: P1 split into P1a and P1b (0032), gates for
  0026, 0028, 0029, 0030, 0033, 0034; Q-010 (schema 0.3, human gate), Q-011 (bundles open); Q-006 folded into Q-010.
- **Cross-repo:** brief loupe-002 written into `horde/integrations/loupe/brief-002.md` (uncommitted there; their
  resident commits). It corrects loupe-001's "does not execute anything": the skill would run `cmake` configure in
  a horde session. Facts cited from HORDE's CMakeLists.txt at c64cfdbc and checked line by line: line 24 forces SDK
  downloads at configure; lines 81 and 87 run read-only git commands; generators run only at build.
- **Verify:** `./verify fast` exit 0.
- **Open questions:** HORDE's answer (respond-by 2026-10-25). Schema 0.3 needs Julian's approval of the diff.
