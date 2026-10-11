# 0029. Every bundle opens to its edges; a matrix lens for dense sections

- **Status:** Accepted (Julian, 2026-10-11: "accept the recommended option on all nine ADRs")
- **Date:** 2026-10-10
- **Source:** Prior-art amendment pass (docs/prior-art.md, contradiction C4). 

## Problem

Edge bundling can make a reader see connections that are not in the data (Wallinger et al., verified). The
conservation meter proves that every edge is counted; it does not prove a reader can tell which edges a `×N`
bundle holds. In the prototype, buses list their members and the lens and story boxes list crossing edges, but a
plain `×N` bundle cannot be opened. Separately, past about 20 nodes matrices beat node-link drawings on most tasks
(Ghoniem et al., verified), and HORDE's `src` section alone has 29 files.

## Proposal

1. **Rule:** anything that stands for more than one edge (a bundle, a bus, a fold row, a port, a counted box) must
   open to the exact list of edges it holds. Audit test: for each such element, the listed edges equal the edges
   the meter attributes to it.
2. **A matrix lens** for one section or a pair of sections: rows and columns are files, cells are edges with their
   provenance. Lossless by construction. Node-link stays the default and the path-following view.

## Consequence

Becomes a P2 gate item. The first half is a small change to the prototype.

## Ruling (2026-10-11)

Both parts: every element that stands for more than one edge opens to its exact edge list (with the audit test), and a matrix lens for dense sections. A P2 gate item; the first half is a prototype change (ROADMAP Q-011).
