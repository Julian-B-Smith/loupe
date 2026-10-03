# Twins

Twins claim parallel implementations: every member exposes the same interface.

**Audit test.** Every twin has a matching edge for each port of the shared interface.

Columns: n for up to 3 twins, then ceil(√n), so 8 twins sit 3 wide. Rows share a height. Each twin header carries one conformity square per port: ✓ static match (state-ok), ~ overlay-only match (state-warn), ✕ none (state-bad). Past 4 ports the strip collapses to one “5/6” chip with the matrix on hover.

```loupe-spec
{
 "primitive": "twins",
 "version": 2,
 "parts": {
  "plate": {
   "fill": "surface-panel",
   "stroke": "ink-faint",
   "strokeWidth": "stroke-group",
   "shape": {
    "type": "plate",
    "inset": 5
   }
  },
  "port": {
   "fill": "surface-node",
   "stroke": "rule",
   "textStyle": "count",
   "textColor": "ink-muted"
  },
  "spine": {
   "stroke": "ink-faint",
   "strokeWidth": "stroke-group"
  },
  "twin": {
   "fill": "surface-group-nested",
   "radius": "radius-group"
  },
  "conformity": {
   "fill": "surface-node",
   "stroke": "state-ok",
   "textStyle": "count"
  },
  "label": {
   "textStyle": "caption",
   "textColor": "ink-muted"
  }
 },
 "states": {
  "hover": {
   "plate": {
    "stroke": "accent"
   }
  },
  "selected": {
   "plate": {
    "stroke": "accent",
    "strokeWidth": "stroke-hub",
    "halo": "accent-soft"
   }
  },
  "related": {
   "plate": {
    "stroke": "accent"
   }
  },
  "dimmed": {
   "plate": {
    "opacity": "opacity-dim"
   }
  },
  "collapsed": {
   "body": {
    "shape": {
     "type": "rect"
    }
   },
   "count": {
    "textStyle": "count",
    "textColor": "ink-faint"
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
   "plate": {
    "fill": "diff-added-soft"
   },
   "mark": {
    "fill": "surface-node",
    "stroke": "diff-added",
    "textColor": "diff-added"
   }
  },
  "diff-removed": {
   "plate": {
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
   "plate": {
    "fill": "diff-changed-soft"
   },
   "mark": {
    "fill": "surface-node",
    "stroke": "diff-changed",
    "textColor": "diff-changed"
   }
  },
  "diff-stale": {
   "plate": {
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
  "orientation": [
   "vertical"
  ],
  "memberGap": 10,
  "headerHeight": 46,
  "minMembers": 2,
  "labelPlacement": "inside-start"
 },
 "overflow": "wrap",
 "notes": "Columns: n for up to 3 twins, then ceil(√n), so 8 twins sit 3 wide. Rows share a height. Each twin header carries one conformity square per port: ✓ static match (state-ok), ~ overlay-only match (state-warn), ✕ none (state-bad). Past 4 ports the strip collapses to one “5/6” chip with the matrix on hover."
}
```
