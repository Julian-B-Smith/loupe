# Lane

A lane claims ordered stages: the drawn order matches its named source.

**Audit test.** Static: an edge between every pair of steps. Config or runtime: the drawn order matches the named source on every re-run. Never inferred.

Inside one section the lane wraps its steps in a chevron with numbered discs on a spine; the outline and spine take the source’s provenance pattern and the caption names the source. Across sections it becomes a route: a 12px lane-fill ribbon through the steps with a numbered disc inside each file’s left end; the label shifts right to clear it. Past 12 steps the middle folds into a “+N steps” marker. Never reuse the section outline.

```loupe-spec
{
 "primitive": "lane",
 "version": 2,
 "parts": {
  "body": {
   "fill": "lane-fill",
   "stroke": "lane-edge",
   "strokeWidth": "stroke-group",
   "dash": "provenance",
   "shape": {
    "type": "chevron",
    "notch": 10,
    "point": 16
   }
  },
  "step": {
   "fill": "surface-panel",
   "stroke": "lane-edge",
   "textStyle": "count",
   "textColor": "ink",
   "shape": {
    "type": "circle"
   }
  },
  "spine": {
   "stroke": "edge-kind",
   "strokeWidth": "stroke-edge-emph",
   "dash": "provenance"
  },
  "label": {
   "textStyle": "group-label",
   "textColor": "ink"
  },
  "source": {
   "textStyle": "count",
   "textColor": "ink-muted"
  },
  "route": {
   "stroke": "lane-fill"
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
  },
  "collapsed": {
   "body": {
    "shape": {
     "type": "chevron",
     "notch": 10,
     "point": 16
    }
   },
   "count": {
    "textStyle": "count",
    "textColor": "ink-faint"
   }
  }
 },
 "layout": {
  "orientation": [
   "vertical",
   "horizontal"
  ],
  "memberGap": 6,
  "headerHeight": 46,
  "minMembers": 2,
  "foldAbove": 12,
  "labelPlacement": "inside-start"
 },
 "overflow": "fold-middle",
 "notes": "Inside one section the lane wraps its steps in a chevron with numbered discs on a spine; the outline and spine take the source’s provenance pattern and the caption names the source. Across sections it becomes a route: a 12px lane-fill ribbon through the steps with a numbered disc inside each file’s left end; the label shifts right to clear it. Past 12 steps the middle folds into a “+N steps” marker. Never reuse the section outline."
}
```
