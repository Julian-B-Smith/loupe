# Node

A node stands for exactly one node of the graph: usually a crawled file, but also a build target, a file the code
references that is not in the tree (missing), or a package outside the repo (external). The kinds must never look
alike (ROADMAP Q-019: on the first crawl a target and a file both read "engine", and `<vector>` looked like a file
that exists).

**Kinds.** One helper, `kindStyle` in render.js, draws them for nodes, isolate ports and the key alike. A file is the
plain body. A build target is a pill (`kind-target`). A missing node is dashed on the canvas fill with a muted label
(`kind-missing`). A package outside the repo is dashed on the nested-group fill (`kind-external`), so it never reads
as a missing file. An artifact (a set of files read as a whole, in the tree) is solid on the nested-group fill
(`kind-artifact`). Kinds differ at every zoom by body; a missing node's reason (`generated`, `not found`, `sibling`,
`external`) and the other kinds' names show as a chip (`kind-chip`) at detail zoom, when the whole label still fits
beside it and the other marks (Julian, 2026-10-17). A removed or not-yet-added ghost keeps its kind's shape, dashed
(`ghost`), in the diff colour, so it never reads as a missing node.

**Labels.** Two nodes of one kind never share a label: a colliding name keeps its extension, then its parent
directory. On screen a long label is cut in the middle, keeping its start and its distinguishing end; when two labels
of one kind would still cut to the same text, the shared prefix is dropped to show what differs. At detail zoom no
two drawn labels of one kind read the same (checked on the drawn frame by tools/render.test.mjs).

**Audit test.** Conservation: one node per crawled file, placed, collapsed or ghosted.

156 × 24 world units; the label stays 11px on screen and truncates at the end against measured glyph width, with the full path as the tooltip. Diff states tint the fill with the -soft token and put a 13px mark on the bottom-right corner (+ − ~ ⧗). Removed files stay as dashed ghosts with a struck-through label.

```loupe-spec
{
 "primitive": "node",
 "version": 3,
 "parts": {
  "body": {
   "fill": "surface-node",
   "stroke": "rule",
   "strokeWidth": "stroke-group",
   "radius": "radius-node",
   "shape": {
    "type": "rect"
   }
  },
  "label": {
   "textStyle": "node-label",
   "textColor": "ink"
  },
  "mark": {
   "fill": "surface-node",
   "radius": "radius-node",
   "textStyle": "count"
  },
  "ghost": {
   "fill": "surface-canvas",
   "stroke": "diff-removed",
   "dash": "gap",
   "textColor": "ink-faint"
  },
  "kind-target": {
   "fill": "surface-group",
   "stroke": "ink-muted",
   "strokeWidth": "stroke-group",
   "radius": "radius-pill"
  },
  "kind-missing": {
   "fill": "surface-canvas",
   "stroke": "ink-faint",
   "dash": "gap",
   "textColor": "ink-muted"
  },
  "kind-external": {
   "fill": "surface-group-nested",
   "stroke": "ink-muted",
   "dash": "gap",
   "textColor": "ink-muted"
  },
  "kind-chip": {
   "fill": "surface-panel",
   "stroke": "rule",
   "radius": "radius-pill",
   "textStyle": "count",
   "textColor": "ink-muted"
  },
  "kind-artifact": {
   "fill": "surface-group-nested",
   "stroke": "rule",
   "strokeWidth": "stroke-group",
   "radius": "radius-node"
  }
 },
 "states": {
  "hover": {
   "body": {
    "stroke": "accent"
   }
  },
  "selected": {
   "body": {
    "stroke": "accent",
    "strokeWidth": "stroke-hub",
    "halo": "accent-soft"
   }
  },
  "related": {
   "body": {
    "stroke": "accent"
   }
  },
  "dimmed": {
   "body": {
    "opacity": "opacity-dim"
   }
  },
  "audit-pass": {
   "badge": {
    "fill": "state-ok",
    "textColor": "surface-node"
   }
  },
  "audit-warn": {
   "badge": {
    "fill": "state-warn",
    "textColor": "surface-node"
   }
  },
  "audit-fail": {
   "badge": {
    "fill": "state-bad",
    "textColor": "surface-node"
   }
  },
  "diff-added": {
   "body": {
    "fill": "diff-added-soft"
   },
   "mark": {
    "fill": "surface-node",
    "stroke": "diff-added",
    "textColor": "diff-added"
   }
  },
  "diff-removed": {
   "body": {
    "fill": "diff-removed-soft",
    "stroke": "diff-removed"
   },
   "mark": {
    "fill": "surface-node",
    "stroke": "diff-removed",
    "textColor": "diff-removed"
   }
  },
  "diff-changed": {
   "body": {
    "fill": "diff-changed-soft"
   },
   "mark": {
    "fill": "surface-node",
    "stroke": "diff-changed",
    "textColor": "diff-changed"
   }
  },
  "diff-stale": {
   "body": {
    "fill": "diff-stale-soft"
   },
   "mark": {
    "fill": "surface-node",
    "stroke": "diff-stale",
    "textColor": "diff-stale"
   }
  }
 },
 "layout": {
  "padding": 8,
  "labelPlacement": "inside-start",
  "truncate": "end",
  "labelMaxChars": 48
 },
 "overflow": "none",
 "notes": "156 × 24 world units; the label stays 11px on screen and truncates at the end against measured glyph width, with the full path as the tooltip. Diff states tint the fill with the -soft token and put a 13px mark on the bottom-right corner (+ − ~ ⧗). Removed files stay as dashed ghosts with a struck-through label."
}
```
