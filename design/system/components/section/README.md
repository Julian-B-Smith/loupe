# Section

A section claims a module boundary: its files have more edges inside than across it.

**Audit test.** Normalized cohesion: internal edge density over possible pairs, against crossing density. Verified bus edges are reported separately (decision 0010).

Each top-level section takes a tier hue (tier-1…8 in view order) on a 4px header strip and its outline; nested sections carry tier-N-soft on the strip. Depth also reads by fill: depth 0 is surface-group with a rule outline, depth 1 and deeper alternate to surface-group-nested with no outline, so three levels never stack borders. A section alone in its band level flows its files horizontally. Collapsed, it keeps its header with files and internal edge counts.

```loupe-spec
{
 "primitive": "section",
 "version": 2,
 "parts": {
  "strip": {
   "fill": "tier-1"
  },
  "body": {
   "fill": "surface-group",
   "stroke": "tier-1",
   "strokeWidth": "stroke-group",
   "radius": "radius-group",
   "shape": {
    "type": "rect"
   }
  },
  "nested": {
   "fill": "surface-group-nested",
   "stroke": "none",
   "radius": "radius-node"
  },
  "label": {
   "textStyle": "group-label",
   "textColor": "ink",
   "halo": "surface-group"
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
  "orientation": [
   "vertical",
   "horizontal"
  ],
  "padding": 10,
  "memberGap": 6,
  "headerHeight": 28,
  "minMembers": 1,
  "labelPlacement": "inside-start",
  "truncate": "end"
 },
 "overflow": "wrap",
 "notes": "Each top-level section takes a tier hue (tier-1…8 in view order) on a 4px header strip and its outline; nested sections carry tier-N-soft on the strip. Depth also reads by fill: depth 0 is surface-group with a rule outline, depth 1 and deeper alternate to surface-group-nested with no outline, so three levels never stack borders. A section alone in its band level flows its files horizontally. Collapsed, it keeps its header with files and internal edge counts."
}
```
