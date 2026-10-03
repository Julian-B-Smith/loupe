# Loupe — DECISIONS (append-only index)

> Append only: never edit or delete a prior entry; supersede with a new one that
> cites it. Project decisions are ADRs in [docs/decisions/](docs/decisions/)
> (numbered; Accepted only when Julian agrees, otherwise Proposed). Harness
> decisions with no ADR are recorded here in full. (Resolution chosen at
> spinup, 2026-10-01: point, not import — one home per decision.)

## Project decisions

The ADR index is [docs/decisions/README.md](docs/decisions/README.md) (0001–0019 at spinup). It stays
the one list of ADRs; this file does not copy it, so the two cannot drift.

## Harness decisions

- **H1 (2026-10-01, spinup poll).** Kit 2.6.5 harness adopted; rung 2 (thread + subagents); oracle =
  invariants + small goldens; provider to HORDE; no audit thread yet; long-lived, supervised.
  See `project.manifest.json`.
- **H2 (2026-10-01).** `./verify fast` treats loupe-check's "schema validation skipped" note as a failure:
  a skipped validator that still prints OK is a declared-not-effective gate. `ajv` is installed via the
  existing `package.json` (lockfile committed; CI runs `npm ci`).
- **H3 (2026-10-01, spinup poll).** Repo stays public at github.com/Julian-B-Smith/loupe.
- **H4 (2026-10-01).** Knowledge-loop forks: candidate lessons inline in LIBRARY (`tier: candidate`);
  reflection voluntary (interactive, supervised project). Kit defaults, not polled.
- **H5 (2026-10-01, ratification poll).** Manifest ratified. First push to `main` is Julian's (the harness
  keeps denying agent pushes to main). HORDE intake brief loupe-001 drafted at
  `docs/briefs/horde-loupe-001.draft.md`; filing deferred to the start of P6.
- **H6 (2026-10-02, poll; supersedes the brief-timing part of H5).** The HORDE brief is filed now, not at P6,
  at autonomous' request (`integrations/autonomous/notice-intake.md`). Reading chosen: the Loupe skill runs
  inside a HORDE session and HORDE's resident makes every write in HORDE's tree; a Loupe session never writes
  there. Filed as `HYPERSAW/integrations/loupe/brief-001.md` (id loupe-001); closing notice in
  `autonomous/integrations/loupe/notice-001.md`.
