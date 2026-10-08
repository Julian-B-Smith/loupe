# LIBRARY — Loupe

Durable, evidence-backed lessons. Format and write gate: CLAUDE.md §Self-Improving Knowledge Loop.
Tags: crawler-parsing · graph-schema-conservation · visual-grammar-rendering · agent-orchestration.

<a id="L0001"></a>
[L0001] loupe-check prints OK even when schema validation was skipped | candidate | added: 2026-10-01 | tags: graph-schema-conservation | lesson: `tools/loupe-check.mjs` catches a missing `ajv` and only adds a note ("schema validation skipped"), then exits 0 with OK. Without `npm ci`, schema conformance is silently unchecked. `./verify fast` greps for the note and fails on it. | evidence: spinup 2026-10-01 — `npm run check` before `npm install` printed the skip note and OK; after install the note vanished. | falsifier: loupe-check is changed to hard-fail when ajv is absent (then the verify grep is redundant). | supersedes: —

<a id="L0002"></a>
[L0002] A stacked PR merged right after its base lands on the base BRANCH, not main | candidate | added: 2026-10-03 | tags: agent-orchestration | lesson: GitHub retargets a stacked PR to main only after the base PR merges and its branch is deleted. Merging both within seconds put #2's commit into `integrations/horde-brief-001`, and main never got it. Prefer independent PRs off main; when stacking, say in the PR body "merge #N, wait for the base to show main, then merge", and after merging check `git log origin/main` for the commit. | evidence: #1 merged 01:11:53Z, #2 merged 01:12:02Z into the old base (a66766f on integrations/horde-brief-001); main lacked design/; re-landed as #3. | falsifier: GitHub retargets at merge time even for back-to-back merges. | supersedes: —

<a id="L0003"></a>
[L0003] A lens seeded from the signal it is checked against is self-confirming | candidate | added: 2026-10-08 | tags: graph-schema-conservation, agent-orchestration | lesson: Seeding the Operational lens from path roles (product, gui) and then judging leaks against path roles looked like two independent signals agreeing. Reachability added zero files beyond the seeds. Seed from something independent (entry points now, the build target in P1). Keep a test that reachability adds members beyond the seeds. | evidence: critic review 2026-10-08. Role seeds gave 40 seeds and 40 repo files in focus; entry seeds gave 38 in focus and 11 disagreements (tools/lens.test.mjs "reachability adds files beyond the seeds"). | falsifier: a repo where role seeds and entry seeds produce identical membership and both find the same disagreements. | supersedes: —
