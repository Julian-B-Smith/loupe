# Agent Charter — Loupe

Everything above §Domain is the invariant harness layer. Do not edit it
per-project. Project-specific facts live in §Domain and in ROADMAP.md.
**The global doctrine (imported via `~/.claude/CLAUDE.md`) applies on top of
this charter and is not restated here** — this file carries only what doctrine
doesn't: the operational contract of THIS harness. (Context budget: slimmed
2026-07-16, Decision 28.)

## Truth contract

- **ROADMAP.md is the single source of truth.** Task state, acceptance
  criteria, invariants, and open questions live there and only there. If the
  conversation and ROADMAP.md disagree, ROADMAP.md wins; if ROADMAP.md is
  wrong, fixing it is the first task.
- **Passing ≠ done.** Done = `./verify full` green AND the ROADMAP acceptance
  criteria satisfied AND a trace entry written in `traces/`. Never collapse
  these into each other.
- **Grounded refusal is a success class.** "I cannot do this within the brief
  because X" with evidence is a correct output. Guessing to appear productive
  is a failure.

## Provenance

- Every nontrivial claim about the codebase must cite its evidence: a file
  path and line, a verify run, or a ROADMAP entry. No provenance → phrase it
  as a hypothesis, not a fact.
- Every merged change gets an entry in `traces/` (see the provenance skill):
  what changed, why, evidence consulted, verify result + git hash.

## Delegation policy (lead session)

- The lead plans, delegates, integrates, and is the **only** writer of
  ROADMAP.md. Subagents never touch it.
- Delegation briefs are self-contained: subagents start with zero conversation
  history. Every brief states (1) files in scope, (2) acceptance criteria
  copied verbatim from ROADMAP.md, (3) the verify target, (4) what is
  explicitly out of scope.
- Use built-in Explore for codebase reconnaissance. Use `implementer` for
  scoped changes, `verifier` for oracle runs, `critic` (Opus) for adversarial
  review of anything architectural, irreversible, or touching an invariant.
- One queue item per implementer dispatch. Parallel dispatches only for items
  with disjoint file scopes.
- Do not start work on an item whose acceptance criteria are missing or
  ambiguous. Surface the gap to the human; that is the deliverable.

## Oracle discipline

- Run `./verify fast` after any change set; `./verify full` before declaring
  a queue item done. Report oracle output verbatim — never summarize a failure
  into vagueness.
- A red oracle halts forward work. Fix or revert; do not stack changes on red.
- Never weaken a gate (skip a test, relax a threshold, mark xfail) without an
  explicit human decision recorded in ROADMAP.md.

## Human gates

Stop and ask before: deleting files, changing the public interface of
anything, editing `./verify` or the gates it runs, adding a dependency,
any git operation beyond add/commit on the working branch, and anything §Domain
lists as protected.

---

## §Domain — Loupe

Working name (placeholder). A tool that makes a codebase legible: a deterministic crawler builds the full
directed dependency graph, then agents turn it into a visual map a human can reason about, question, audit
and navigate. Ships first as a Claude Code skill run in a target repo (decision 0009). First client: HORDE
(github.com/Julian-B-Smith/horde). Map of the repo: [CODEMAP.md](CODEMAP.md). State: [ROADMAP.md](ROADMAP.md).

**The one rule.** Nothing can destroy a node or hide an edge. Every representation is a lossless view over
the crawled graph. Nodes may be grouped, nested, bundled into buses, collapsed or dimmed. Every edge must
always be accounted for: drawn, in a bus, folded into a count, or inside a collapsed group. A deterministic
conservation check enforces this after every agent edit. It is code, not a prompt instruction.

**Pipeline** (docs/vision.md): 1 Crawl (deterministic: files → nodes; includes, calls, audio paths, parameter
reads, tests → edges) · 2 Structure (agent composes the view) · 3 Dialogue (agent + Julian resolve
ambiguities) · 4 Audit (subagent swarm confirms or challenges claims) · 5 Explain · 6 Navigate. The
representation is split (0006): a **canonical flow view** with no interpretation, and a **design view** the
agent composes from visual primitives (docs/visual-grammar.md).

**Delivery** (0009, 0011): first call runs the full pipeline; later calls show a visual diff, then update.
Current map in the target repo at `.loupe/current/`; past snapshots on an orphan `loupe-history` branch.

**Stack & entrypoints.** TypeScript on Node (crawler, checker, skill scripts); web-tree-sitter (WASM);
static HTML/CSS/JS viewer, no build step; JSON Schema (draft-07) as the contract. Today: `tools/*.mjs`,
`npm test` (mutation tests), `npm run check` (loupe-check on examples). `npm ci` before `./verify`.

**Domain invariants** (the critic checks against these):
- Deterministic core, never agent-owned: crawl, canonical JSON and ids, overlay merge, every check, diffs.
- Agents never write `graph.json`; they write overlay and view only. Hiding a version or subsystem is a
  view-level lens, never a crawl exclusion (0019).
- Every edge carries provenance (0016): static and config (crawler); runtime, annotated, inferred (overlay).
  Never mix them silently. The provenance legend is always on screen.
- Every visual primitive makes a claim an auditor can test. No test → decoration.
- 2D first; nothing in the data model may assume 2D (3D / Vision Pro later).
- Visuals and UI are prototyped before schema changes; graph and view spec are plain data, separate from
  the renderer.

**Lanes & protected paths.** `design/` belongs to the Claude Design agent, which works in this folder at the
same time: never write there except the generated `design/tokens.css` and `design/primitives.json`.
Infrastructure owns `schema/`, `tools/`, `docs/`. Human gate before: changing `schema/*.schema.json`,
regenerating `schema/examples/*`, or editing an Accepted ADR. Writes into a target repo are limited to
`.loupe/current/` and `loupe-history`; `.loupe/config.json` there is human-owned (Loupe proposes).

**Decisions.** ADRs in `docs/decisions/` (numbered, Accepted only when Julian agrees, else Proposed).
`DECISIONS.md` points at their index (docs/decisions/README.md) and holds harness decisions.

**Verify targets.** `fast` (~2 s): kit integrity, leak gate, 20 mutation tests, loupe-check with schema
validation required on every `schema/examples/*`, `horde-sample` regenerated and byte-compared. `full`: currently == fast; P1/P2 add HORDE golden crawl
and stress-case renders.

## Mailbox

- **`integrations/` in THIS repo is the only place briefs to Loupe land.** If a brief is not here, it is
  not ours to answer.
- **Responses to OUR briefs live in the PROVIDER's tree** (e.g. `horde/integrations/loupe/`), not here.
  Nothing signals us when one arrives; pull and read them deliberately.
- **Other repos' exchanges may be READ freely, but never ACTED on** and never raised to Julian as ours.
  If one genuinely concerns Loupe, file our own brief.
<!-- /kit:mailbox:2.1.0 -->

<!-- KNOWLEDGE-LOOP:START -->
## Self-Improving Knowledge Loop

Each session: read accumulated knowledge before acting, write distilled knowledge
after. This meta-layer sits on top of my primary role and never overrides it.

### Every session
1. **ORIENT** — Read INDEX.md in full (kept small on purpose). Pull ONLY the matching
   entries from LIBRARY.md into context. Never load all of LIBRARY by default.
2. **ACT** — Do the work, applying retrieved lessons. If a lesson proves wrong,
   correcting it outranks adding a new one.
3. **REFLECT** — Ask: "What did I learn that a future session needs and could not
   cheaply re-derive?" A lesson qualifies only if durable, evidenced (tied to a
   concrete trigger), and non-obvious. If nothing qualifies, write nothing.
4. **WRITE (atomic)** — Append the lesson to LIBRARY.md and a one-line pointer to
   INDEX.md in the same change. New lessons enter as `tier: candidate`; promote to
   `canonical` only when a second occurrence is SHOWN independent — a different
   root cause, not the same shared file, prompt, or tool seen twice; say why in
   the promotion note — or on human review. Recurrence alone never promotes.

### Write gate (anti-poisoning)
This loop feeds its own output back as input, so a wrong lesson, written once, is
retrieved and reinforced forever. Therefore: prefer not writing over writing
unverified; every lesson states what would falsify it; if a retrieved lesson
contradicts present evidence, trust the evidence and demote the lesson.

### Consolidation (periodic)
When LIBRARY exceeds ~30 entries, merge duplicates, delete superseded entries,
promote recurring candidates, tighten tags. Refactor it like code; don't grow it
like a log.

### LIBRARY entry template
`[Lxxxx] <title> | tier | added: YYYY-MM-DD | tags: … | lesson: … | evidence: … | falsifier: … | supersedes: …`
<!-- KNOWLEDGE-LOOP:END -->
