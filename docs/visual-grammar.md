# Visual grammar

Status: all nine primitives kept after round 2 (decisions 0012 and 0014). Visual styling belongs to the
Claude Design agent (decision 0013, `docs/design-handoff.md`); this file keeps the claims, the tests and
the rules below.

Rules from round 2:

- Layer band: exemptions are raised in dialogue unless the pattern is established in this project.
- Lane: may rest on config, runtime or annotated provenance (drawn in that provenance's line pattern,
  source named, re-audited each run), never on agent inference alone (0016).
- Hub: placement is a setting, with the group (default) or centered.
- Feedback loop: the proof of intent stays open; loops start unclassified and are settled in dialogue. In the
  data, Ring and Feedback loop are one `loop` element with a classification (0015).

## Principle

Every primitive makes a claim about the code, and every claim has a test the audit swarm can run. A
primitive with no test is decoration.

Primitives are typed data the Structure agent emits; the renderer interprets them. A new dialect is new
data, not new code.

## Primitives

| Primitive | Claim | Audit test |
|-----------|-------|------------|
| Section box with header | Ownership or module boundary | More edges inside than across the boundary (cohesion vs coupling) |
| Overlap region (Euler/Venn) | Shared membership or cross-cutting concern | The node has real edges into every set it overlaps |
| Bus / rail | Shared contract | Every member edge satisfies the contract's signature |
| Layer band | Abstraction level (UI / logic / foundation) | Upward (counterflow) edges are surfaced as findings, each read as a smell, a misplaced file, or a pattern the rule does not model |
| Lane | Ordered stages | Order matches edge direction |
| Twins / small multiples | Parallel implementations | Members expose the same interface |
| Hub | One-to-many | Fan-in or fan-out above a threshold |
| Ring | Circular dependency (drawn as a warning) | A real cycle exists in the graph |
| Feedback loop | Intentional signal feedback | The loop passes through a state element (delay, buffer, previous block); needs a symbol-level crawl or an annotation |

Venn/Euler diagrams stop being readable past three sets. Fall back to tags or a membership strip (a row of set chips on the node), and have
auditors flag any overlap that exceeds three sets.

## Dialects

A dialect is a subset of primitives plus layout rules. The Structure agent picks one in Stage 2 and names
it; the human can challenge it in Stage 3.

- **DSP plugin**: signal-flow lanes; bands for audio rate vs control rate; twins for engines; hubs for
  parameter storage.
- **Web app**: layers (UI / API / data) plus request-lifecycle lanes.
- **Event-driven**: hubs and pub/sub buses.
- **ECS game**: Venn fits naturally; entities sit in the overlaps of component sets.
- **React front end**: component-tree sections plus state and prop buses.

## First application (HORDE sample)

- FX chain as a lane.
- SAW, CHOIR, STATION and WARP as twins.
- FOUNDATIONS as a layer band.
- quantum_morph in the overlap of Modulation and Presets (resolves the agent's open Stage 3 question).

## Findings from running the tests on the HORDE sample (2026-09-30)

These come from `prototype/primitives.html`. They are observations for the workshop, not decisions.

- **Section box:** raw edge counts reject every hub-like module (FX chain: 4 inside vs 15 crossing).
  Normalizing by possible pairs passes both FX chain and Modulation at roughly 5× denser inside.
- **Overlap:** quantum_morph passes (edges into both Modulation and Presets); placing lfo_env there fails.
  Open: may an overlap invent a new set such as Presets?
- **Bus:** Param bus passes. Audio bus warns because simplex_shaper's membership is only inferred. The test
  checks edge kind and target as a proxy; a real contract check needs signatures captured by the crawler.
- **Layer band:** fails on the sample. voice_alloc sits in FOUNDATIONS but calls up into all four engines.
  Also, the 4 Verification files belong to no band.
- **Lane:** the note-on path passes. The FX chain fails: statically fx_router fans out to every stage, and
  the serial order lives in a routing table the crawler cannot see.
- **Twins:** 4 of 4 engines expose voice in / audio out / param read, but WARP matches only through
  inferred edges.
- **Hub:** a percentile threshold (top 10% fan-in) replaces a fixed number. param_store (11) passes;
  dsp_math (5) sits exactly on the line.
- **Ring:** no file-level cycles exist in the sample. DSP feedback lives inside single files, so a
  file-level ring and a signal-feedback loop may need to be separate primitives.

## Resolved: bus edges in section cohesion (2026-09-30)

See decision 0010. Verified bus edges (static, and meeting the bus contract) are reported separately rather
than counted against a section. A section passes on the ratio without them, and is flagged if it only
passes because of them. FX chain: 16.0× without, 5.3× with. Modulation: 7.8× without, 4.9× with.

Snapshot location is resolved separately in decision 0011.
