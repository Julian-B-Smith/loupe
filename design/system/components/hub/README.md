# Hub

A hub claims one-to-many: its fan-in or fan-out is in the top tenth of the graph.

**Audit test.** Fan-in or fan-out at or above the 90th percentile.

A double outline in hub with a hub-soft ring, and the fan-in count inline at the node’s right end. Placement with group (default) keeps it in its section. Centered moves it to the middle of the gap above its level, where a horizontal bus meets it from both sides, with a dotted tether to its home section.

```loupe-spec
{
 "primitive": "hub",
 "version": 2,
 "parts": {
  "outer": {
   "fill": "hub-soft",
   "stroke": "hub",
   "strokeWidth": "stroke-hub",
   "radius": "radius-group",
   "shape": {
    "type": "rect",
    "inset": 3.5
   }
  },
  "body": {
   "stroke": "hub",
   "strokeWidth": "stroke-hub"
  },
  "count": {
   "textStyle": "count",
   "textColor": "hub"
  },
  "tether": {
   "stroke": "hub",
   "dash": "gap"
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
  "labelPlacement": "end"
 },
 "overflow": "none",
 "notes": "A double outline in hub with a hub-soft ring, and the fan-in count inline at the node’s right end. Placement with group (default) keeps it in its section. Centered moves it to the middle of the gap above its level, where a horizontal bus meets it from both sides, with a dotted tether to its home section."
}
```
