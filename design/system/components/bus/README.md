# Bus

A bus claims a shared contract: every member edge satisfies one signature.

**Audit test.** Every member edge matches the contract signature and ends at the contract target.

Vertical rails sit in the column gutter before their targets; parallel rails in one gutter offset by 9px. A horizontal rail runs in the gap above its target’s band level. Each tap keeps its own provenance pattern; the rail never does. Hover shows the contract signature in a second pill. Past 20 taps on one side, taps from the same section merge into one with a count.

```loupe-spec
{
 "primitive": "bus",
 "version": 2,
 "parts": {
  "rail": {
   "stroke": "edge-kind",
   "strokeWidth": "stroke-rail"
  },
  "tap": {
   "stroke": "edge-kind",
   "strokeWidth": "stroke-edge",
   "dash": "provenance"
  },
  "junction": {
   "fill": "edge-kind",
   "shape": {
    "type": "circle"
   }
  },
  "exit": {
   "fill": "surface-canvas",
   "stroke": "edge-kind",
   "shape": {
    "type": "circle"
   },
   "glyph": "arrow-filled"
  },
  "label": {
   "fill": "surface-panel",
   "stroke": "edge-kind",
   "textStyle": "count",
   "textColor": "ink",
   "radius": "radius-pill",
   "shape": {
    "type": "pill"
   }
  },
  "contract": {
   "fill": "surface-node",
   "stroke": "edge-kind",
   "textStyle": "count",
   "textColor": "ink",
   "radius": "radius-pill"
  }
 },
 "states": {
  "hover": {
   "rail": {
    "stroke": "accent"
   }
  },
  "selected": {
   "rail": {
    "stroke": "accent",
    "strokeWidth": "stroke-hub",
    "halo": "accent-soft"
   }
  },
  "related": {
   "rail": {
    "stroke": "accent"
   }
  },
  "dimmed": {
   "rail": {
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
   "rail": {
    "fill": "diff-added-soft"
   },
   "mark": {
    "fill": "surface-node",
    "stroke": "diff-added",
    "textColor": "diff-added"
   }
  },
  "diff-removed": {
   "rail": {
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
   "rail": {
    "fill": "diff-changed-soft"
   },
   "mark": {
    "fill": "surface-node",
    "stroke": "diff-changed",
    "textColor": "diff-changed"
   }
  },
  "diff-stale": {
   "rail": {
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
   "vertical",
   "horizontal"
  ],
  "memberGap": 9,
  "minMembers": 2,
  "labelPlacement": "above"
 },
 "overflow": "fold-end",
 "notes": "Vertical rails sit in the column gutter before their targets; parallel rails in one gutter offset by 9px. A horizontal rail runs in the gap above its target’s band level. Each tap keeps its own provenance pattern; the rail never does. Hover shows the contract signature in a second pill. Past 20 taps on one side, taps from the same section merge into one with a count."
}
```
