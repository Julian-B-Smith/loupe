# Overlap

An overlap claims that a file belongs to two or three sets at once.

**Audit test.** The member has real edges into every set it overlaps.

Up to three sets draw as regions: the section box and the set hull meet around the member, which gets a tinted halo and an ∩N chip under its left edge. Past three sets the regions stop and the node carries a membership strip: one 6px chip per set, wrapping, and the audit flags it.

```loupe-spec
{
 "primitive": "overlap",
 "version": 2,
 "parts": {
  "region": {
   "fill": "set-1",
   "stroke": "set-1",
   "shape": {
    "type": "rect",
    "inset": 3
   }
  },
  "chip": {
   "fill": "surface-node",
   "stroke": "set-1",
   "textStyle": "count",
   "textColor": "ink",
   "radius": "radius-pill"
  },
  "strip": {
   "fill": "set-4",
   "radius": "radius-pill"
  }
 },
 "states": {
  "hover": {
   "region": {
    "stroke": "accent"
   }
  },
  "selected": {
   "region": {
    "stroke": "accent",
    "strokeWidth": "stroke-hub",
    "halo": "accent-soft"
   }
  },
  "related": {
   "region": {
    "stroke": "accent"
   }
  },
  "dimmed": {
   "region": {
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
   "region": {
    "fill": "diff-added-soft"
   },
   "mark": {
    "fill": "surface-node",
    "stroke": "diff-added",
    "textColor": "diff-added"
   }
  },
  "diff-removed": {
   "region": {
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
   "region": {
    "fill": "diff-changed-soft"
   },
   "mark": {
    "fill": "surface-node",
    "stroke": "diff-changed",
    "textColor": "diff-changed"
   }
  },
  "diff-stale": {
   "region": {
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
  "minMembers": 1,
  "labelPlacement": "below"
 },
 "overflow": "wrap",
 "notes": "Up to three sets draw as regions: the section box and the set hull meet around the member, which gets a tinted halo and an ∩N chip under its left edge. Past three sets the regions stop and the node carries a membership strip: one 6px chip per set, wrapping, and the audit flags it."
}
```
