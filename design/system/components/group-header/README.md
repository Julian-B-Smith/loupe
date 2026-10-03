# Group Header

A group header stands in for a collapsed container and every file and edge inside it.

**Audit test.** Its counts equal the files and internal edges it hides.

Shows “N files · M inside”. Edges to hidden files land on the header and fold into count badges. The label truncates before the counts do.

```loupe-spec
{
 "primitive": "group-header",
 "version": 2,
 "parts": {
  "body": {
   "fill": "surface-group",
   "stroke": "rule",
   "strokeWidth": "stroke-group",
   "radius": "radius-group"
  },
  "label": {
   "textStyle": "group-label",
   "textColor": "ink"
  },
  "count": {
   "textStyle": "count",
   "textColor": "ink-faint"
  },
  "toggle": {
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
  "headerHeight": 28,
  "labelPlacement": "inside-start",
  "truncate": "end"
 },
 "overflow": "none",
 "notes": "Shows “N files · M inside”. Edges to hidden files land on the header and fold into count badges. The label truncates before the counts do."
}
```
