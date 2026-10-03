# Audit Pin

An audit pin shows an auditor’s verdict on a file or element.

**Audit test.** Each pin maps to one audit finding.

A 15px disc: ✓ confirmed, ! open, ✕ challenged, always glyph plus color. On elements it straddles the top-right corner of the box.

```loupe-spec
{
 "primitive": "audit-pin",
 "version": 2,
 "parts": {
  "body": {
   "fill": "state-ok",
   "stroke": "surface-canvas",
   "textStyle": "count",
   "textColor": "surface-node",
   "shape": {
    "type": "circle"
   }
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
 "notes": "A 15px disc: ✓ confirmed, ! open, ✕ challenged, always glyph plus color. On elements it straddles the top-right corner of the box."
}
```
