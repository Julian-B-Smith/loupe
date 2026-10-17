# Node

A node stands for exactly one node of the graph: usually a crawled file, but also a build target, a file the code
references that is not in the tree (missing), or a package outside the repo (external). The kinds must never look
alike (ROADMAP Q-019: on the first crawl a target and a file both read "engine", and `<vector>` looked like a file
that exists).

**Kinds.** A file is the plain body. A build target is a pill (`kind-target`). A missing node is dashed on the canvas
fill with a muted label (`kind-missing`); an external package the same with a darker stroke (`kind-external`). Every
non-file node also carries a chip on its right end saying what it is (`kind-chip`): `target`, `generated`,
`not found`, `sibling`, `external`, `package` or `artifact`. Shape and dash survive at every zoom; the chip shows
where the label does. Two nodes of the same kind never share a label: a colliding name keeps its extension, then its
parent directory.

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
   "fill": "surface-canvas",
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
