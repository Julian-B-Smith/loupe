# Count Badge

A count badge states how many edges a folded line or aggregate holds.

**Audit test.** The number equals the members it stands for.

Sits at the folded line’s midpoint: “×4”. Mixed kinds use ink-muted; mixed provenance is named in the tooltip, never hidden. Numbers past 999 shorten to 1.2k.

```loupe-spec
{
 "primitive": "count-badge",
 "version": 2,
 "parts": {
  "body": {
   "fill": "surface-panel",
   "stroke": "edge-kind",
   "radius": "radius-pill",
   "shape": {
    "type": "pill"
   }
  },
  "text": {
   "textStyle": "count",
   "textColor": "ink"
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
  "padding": 7
 },
 "overflow": "none",
 "notes": "Sits at the folded line’s midpoint: “×4”. Mixed kinds use ink-muted; mixed provenance is named in the tooltip, never hidden. Numbers past 999 shorten to 1.2k."
}
```
