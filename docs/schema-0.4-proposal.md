# Schema 0.4 proposal: the declared structure layer (ROADMAP Q-015)

Status: **Approved in shape by Julian (poll, 2026-11-01), now in schema/ as `loupe.graph/0.4`**; every question below is answered (the Answers line). Rework, same day (Julian's polls after the critic): the `declaration` block, not the version, decides crawl against declaration; D7 runs both ways; agents may add `proposed` elements to a declaration's view and only adapter sections say `declared` (D8). The checks as built are in docs/graph-schema.md.
Answers: A drop `path` and `hash` on declared nodes; B `declared.cites` on nodes and edges (as proposed); C keep
HORDE's `scope` word under `declared`; D a new view status `declared`; E the declared dash moves into the edge spec block.
Drawn first, as the domain invariant asks: the Signal path view of HORDE's engine2 declaration
(`design/prototype/snapshots/engine2-structure/`, the snapshot is `loupe.graph/0.4`) is the picture this schema froze.

## What 0.4 adds

A graph is either a **crawl** (0.2 to 0.3.2, unchanged) or a **declaration**: a structure a target repo states
about itself, gated in its own `./verify`, read by one deterministic adapter. A 0.4 graph is one or the other,
never both (Julian, 2026-10-31: its own snapshot; nothing links a block to a file).

| Where | 0.4 adds | Why |
|---|---|---|
| `schema` | `loupe.graph/0.4` | Older graphs stay valid at their own version. |
| top level | `declaration` (required in a declaration graph; `crawler` forbidden there, required in a crawl) | Which file, format, blob and spec it was read from; the declaration's own counts; the signal path. |
| `declaration` | `format`, `path`, `blob`, `spec {path, blob}`, `counts`, `signalPath[] {stage, ids, refs}` | `ids` are the declaration's own; `refs` are Loupe ids, so loupe-check validates every stage. |
| `nodeId` | prefix `decl:<declared id>` | A declared item is not a file. |
| node `kind` | `block`, `slot` (declaration graphs only) | A slot is a reserved, unbuilt place. |
| node | `declared {id, label, scope, multiplicity, parent, cites}`; no `path`, no `hash` | See question A. |
| edge `kind` | `audio`, `control`, `event`, `modulation`, `observation` (declaration graphs only) | HORDE's closed list, pinned by `declaration.format`. |
| edge `provenance` | `declared` (in the graph, not the overlay) | A fact the target states and gates, never Loupe's inference. Its own dash (0016 legend). |
| edge | `declared {label, cites}`; evidence `{type: "declaration", path, id}` | One rule for citations on nodes and edges (question B). |
| edge id | unchanged: `sha256(src|dst|kind)`; a second declared edge with the same three merges its evidence | Ids stay one rule across crawl and declaration. |

## New loupe-check rules (each with a mutation case)

- **D1** a declaration graph has `declaration` and no `crawler`; a crawl has the reverse.
- **D2** every node is `block` or `slot` with `declared`; every edge is `declared` with declaration evidence.
- **D3** every `declared.parent` names a node; parents form no cycle.
- **D4** every `signalPath[].refs` entry names a node or edge; `ids` and `refs` have the same length.
- **D5** every node and edge cites at least one spec id (criterion 1: "a spec citation on every node and edge").
- **D6** `declaration.counts` equals what the graph holds (the census, now in the checker, not only the test).
- **D7** a view over a declaration graph may group but not invent: every section is a declared parent.

## Questions (Julian's, from the critic's M7; all answered, see the Answers line)

- **A. Node path and hash.** Drop `path` and `hash` on declared nodes (labels come from `declared.id`), or keep
  `path` = the declared id and `hash` = `none` as in the draft?
- **B. Citations.** Nodes and edges both carry `declared.cites` (proposed), or cites live in evidence for both?
- **C. `scope: "external"`.** Keep HORDE's word under `declared.scope` (proposed: it is namespaced, so it cannot be
  read as the crawl's node kind `external`), or map it to a Loupe word such as `boundary`?
- **D. The adapter's own view.** The adapter writes view.json with `status: "accepted"`, `by: "adapter:engine-structure"`.
  Allow a new status `declared` for elements that only restate the declaration (proposed), or keep `accepted`?
- **E. The declared dash** (`12 3 1 2 1 3`, long dash and two dots) moves from spine.js into the edge loupe-spec block
  with this change.
