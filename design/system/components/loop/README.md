# Loop

A loop claims a cycle, drawn one of three ways: circular dependency, intentional feedback, or unclassified.

**Audit test.** Circular: a real cycle exists. Intentional: the cycle passes a state element (delay, buffer, previous block) with evidence. Unclassified waits for dialogue.

Circular: a ring-colored hull around the cycle with a “cycle · N files” pill; ring is magenta so it never reads as an audit warning. Intentional: a return arc in the edges’ own color with a z⁻¹ delay plate. Unclassified: the same arc dashed in neutral loop-unclassified with a ? disc, until dialogue settles it.

```loupe-spec
{
 "primitive": "loop",
 "version": 2,
 "parts": {
  "ring": {
   "stroke": "ring",
   "strokeWidth": "stroke-edge-emph",
   "shape": {
    "type": "ellipse",
    "inset": 9
   }
  },
  "arc": {
   "stroke": "edge-kind",
   "strokeWidth": "stroke-edge-emph",
   "glyph": "arrow-filled"
  },
  "delay": {
   "fill": "surface-panel",
   "stroke": "ink",
   "textStyle": "count",
   "textColor": "ink",
   "glyph": "delay"
  },
  "label": {
   "fill": "surface-panel",
   "stroke": "ring",
   "textStyle": "count",
   "textColor": "ink",
   "radius": "radius-pill"
  }
 },
 "states": {
  "hover": {
   "arc": {
    "stroke": "accent"
   }
  },
  "selected": {
   "arc": {
    "stroke": "accent",
    "strokeWidth": "stroke-hub",
    "halo": "accent-soft"
   }
  },
  "related": {
   "arc": {
    "stroke": "accent"
   }
  },
  "dimmed": {
   "arc": {
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
   "arc": {
    "fill": "diff-added-soft"
   },
   "mark": {
    "fill": "surface-node",
    "stroke": "diff-added",
    "textColor": "diff-added"
   }
  },
  "diff-removed": {
   "arc": {
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
   "arc": {
    "fill": "diff-changed-soft"
   },
   "mark": {
    "fill": "surface-node",
    "stroke": "diff-changed",
    "textColor": "diff-changed"
   }
  },
  "diff-stale": {
   "arc": {
    "fill": "diff-stale-soft"
   },
   "mark": {
    "fill": "surface-node",
    "stroke": "diff-stale",
    "textColor": "diff-stale"
   }
  },
  "unclassified": {
   "arc": {
    "stroke": "loop-unclassified",
    "dash": "gap"
   },
   "delay": {
    "stroke": "loop-unclassified",
    "textColor": "loop-unclassified",
    "glyph": "loop-mark"
   }
  }
 },
 "layout": {
  "minMembers": 1
 },
 "overflow": "none",
 "notes": "Circular: a ring-colored hull around the cycle with a “cycle · N files” pill; ring is magenta so it never reads as an audit warning. Intentional: a return arc in the edges’ own color with a z⁻¹ delay plate. Unclassified: the same arc dashed in neutral loop-unclassified with a ? disc, until dialogue settles it."
}
```
