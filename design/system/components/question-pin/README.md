# Question Pin

A question pin marks a file the structure agent is asking about in Stage 3.

**Audit test.** Each pin maps to one dialogue entry.

A 15px square “?” on the node’s top-right corner, stacking leftward 18px apart with other pins. Open questions are filled; answered ones are outlined. Past 3 pins the third reads +N.

```loupe-spec
{
 "primitive": "question-pin",
 "version": 2,
 "parts": {
  "body": {
   "fill": "state-warn",
   "textStyle": "count",
   "textColor": "surface-node",
   "radius": "radius-node"
  },
  "answered": {
   "fill": "surface-panel",
   "stroke": "ink-faint",
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
  "labelPlacement": "end",
  "memberGap": 18
 },
 "overflow": "fold-end",
 "notes": "A 15px square “?” on the node’s top-right corner, stacking leftward 18px apart with other pins. Open questions are filled; answered ones are outlined. Past 3 pins the third reads +N."
}
```
