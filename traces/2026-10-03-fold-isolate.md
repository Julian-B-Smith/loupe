# fold-isolate — fold long sections; isolate a section as a sub-patch; design in-house

- **Queue item:** unqueued (Julian's request); ADRs 0022 (design in-house) and 0023 (fold, isolate)
- **Why:** HORDE's `tools` is one section of 120 files and `src` takes 138 edges from 93 files; the map was a tower.
- **Change:** fold past 12 rows (most-connected shown; files with claims, bus endpoints and diff marks never folded);
  isolate with input/output port rails per peer section, ports fold past 12 too; elsewhere count on the map and in the
  banner. Review v4 B1 and B2 fixed. `conserve()` checks every proxy against what the frame drew.
- **Evidence:** horde-probe: 650/650 edges and 242/242 files in every state (folded, overview, isolate tools/src/external,
  open port, show all, unfolded, flow). horde-sample unchanged (84/84). Plants: node without proxy, missing edge, and a
  removed elsewhere chip each read broken. Critic (opus) review: approve with notes; must-fix 1 to 3 fixed and re-tested
  (no null band level when isolating on the sample; nested isolate at overview proxies only drawn sections; diff ghost
  drawn inside its isolated section).
- **Alternatives rejected:** fold by alphabetical order (arbitrary on HORDE: members are sorted by path); one port per
  outside file (93 ports for src).
- **Verify:** `./verify fast` exit 0.
- **Open questions:** should selecting a folded file open its fold? Fold thresholds are placeholders.
