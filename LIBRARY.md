# LIBRARY — Loupe

Durable, evidence-backed lessons. Format and write gate: CLAUDE.md §Self-Improving Knowledge Loop.
Tags: crawler-parsing · graph-schema-conservation · visual-grammar-rendering · agent-orchestration.

<a id="L0001"></a>
[L0001] loupe-check prints OK even when schema validation was skipped | candidate | added: 2026-10-01 | tags: graph-schema-conservation | lesson: `tools/loupe-check.mjs` catches a missing `ajv` and only adds a note ("schema validation skipped"), then exits 0 with OK. Without `npm ci`, schema conformance is silently unchecked. `./verify fast` greps for the note and fails on it. | evidence: spinup 2026-10-01 — `npm run check` before `npm install` printed the skip note and OK; after install the note vanished. | falsifier: loupe-check is changed to hard-fail when ajv is absent (then the verify grep is redundant). | supersedes: —
