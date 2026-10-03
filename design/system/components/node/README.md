# Node

A node stands for exactly one crawled file.

**Audit test.** Conservation: one node per crawled file, placed, collapsed or ghosted.

156 × 24 world units; the label stays 11px on screen and truncates at the end against measured glyph width, with the full path as the tooltip. Diff states tint the fill with the -soft token and put a 13px mark on the bottom-right corner (+ − ~ ⧗). Removed files stay as dashed ghosts with a struck-through label.

```loupe-spec
{
 "primitive": "node",
 "version": 2,
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
