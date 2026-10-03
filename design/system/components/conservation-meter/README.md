# Conservation Meter

The conservation meter shows that every node and edge in the snapshot is accounted for in the current view.

**Audit test.** drawn + in buses + folded + collapsed = total edges, and every file is placed.

Three states. Balanced: state-ok dot, “84 of 84 edges accounted” and the breakdown. Broken: state-bad dot, “N not accounted for”; clicking opens the list of ids. Stale: state-warn dot, “view made for an older graph” when view.json is bound to a different graph hash. Never hidden or moved into a menu; on phones the breakdown wraps under the main line.

```loupe-spec
{
 "primitive": "conservation-meter",
 "version": 2,
 "parts": {
  "dot": {
   "fill": "state-ok",
   "shape": {
    "type": "circle"
   }
  },
  "main": {
   "textStyle": "panel-body",
   "textColor": "ink"
  },
  "breakdown": {
   "textStyle": "count",
   "textColor": "ink-faint"
  }
 },
 "states": {
  "hover": {
   "dot": {
    "stroke": "accent"
   }
  },
  "selected": {
   "dot": {
    "stroke": "accent",
    "strokeWidth": "stroke-hub",
    "halo": "accent-soft"
   }
  },
  "related": {
   "dot": {
    "stroke": "accent"
   }
  },
  "dimmed": {
   "dot": {
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
   "dot": {
    "fill": "diff-added-soft"
   },
   "mark": {
    "fill": "surface-node",
    "stroke": "diff-added",
    "textColor": "diff-added"
   }
  },
  "diff-removed": {
   "dot": {
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
   "dot": {
    "fill": "diff-changed-soft"
   },
   "mark": {
    "fill": "surface-node",
    "stroke": "diff-changed",
    "textColor": "diff-changed"
   }
  },
  "diff-stale": {
   "dot": {
    "fill": "diff-stale-soft"
   },
   "mark": {
    "fill": "surface-node",
    "stroke": "diff-stale",
    "textColor": "diff-stale"
   }
  },
  "pending": {
   "dot": {
    "fill": "state-warn"
   }
  }
 },
 "layout": {
  "labelPlacement": "end"
 },
 "overflow": "wrap",
 "notes": "Three states. Balanced: state-ok dot, “84 of 84 edges accounted” and the breakdown. Broken: state-bad dot, “N not accounted for”; clicking opens the list of ids. Stale: state-warn dot, “view made for an older graph” when view.json is bound to a different graph hash. Never hidden or moved into a menu; on phones the breakdown wraps under the main line."
}
```
