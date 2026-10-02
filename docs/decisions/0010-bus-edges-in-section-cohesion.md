# 0010. Bus edges in section cohesion

- **Status:** Accepted
- **Date:** 2026-09-30
- **Source:** Claude's recommendation, accepted by Julian

## Decision

A section box's cohesion test reports two ratios: internal density vs boundary density with verified bus
edges left out, and the same ratio with them counted.

- A bus edge counts as verified only if it is static (found by the crawler) and meets its bus's contract.
  Inferred bus members still count against the section.
- The section passes if the ratio without verified bus edges is at least 2×.
- If it passes only because verified bus edges were left out (the with-bus ratio is below 2×), it is
  flagged as "leans on its buses" for the auditors and the human.

## Why

- A bus is a declared contract with its own test. Counting its edges against every section that uses it
  double-counts the same coupling and turns the test into noise for any module that uses shared services.
- The Structure agent chooses what becomes a bus. Leaving out only verified edges, and flagging boxes that
  depend on the exclusion, keeps the agent from making a weak boundary pass by declaring buses.

## On the HORDE sample

- FX chain: 10 of 15 crossing edges travel on verified buses. 16.0× without them, 5.3× with. Pass.
- Modulation: 6 of 16. 7.8× without, 4.9× with. Pass.

Implemented in `prototype/primitives.html`.
