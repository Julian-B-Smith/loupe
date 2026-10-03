# Band

A band claims abstraction levels: edges should only point down a level.

**Audit test.** Every upward (counterflow) edge is a finding, unless an exemption covers its pattern.

Levels are full-width stripes ruled top and bottom, recessed to surface-page, labelled “Interface · level 1 of 3”. Files outside every level sit in an “Outside layers” gutter to the right behind a dashed rule. Counterflow flags are a ↑N chip inside the source file’s right end, after any hub count or overlap chip, with the label truncated to make room: solid warn outline when flagged, dashed when pending (raised in dialogue), faint when exempt (established). The full wording is in the tooltip and inspector. Exemptions never recolor an edge.

```loupe-spec
{
 "primitive": "band",
 "version": 2,
 "parts": {
  "level": {
   "fill": "surface-page",
   "stroke": "rule",
   "strokeWidth": "stroke-group"
  },
  "label": {
   "textStyle": "eyebrow",
   "textColor": "ink-faint"
  },
  "gutter": {
   "stroke": "rule",
   "strokeWidth": "stroke-group",
   "dash": "gap"
  },
  "flag": {
   "fill": "surface-panel",
   "stroke": "state-warn",
   "textStyle": "count",
   "textColor": "ink",
   "radius": "radius-pill",
   "glyph": "counterflow"
  }
 },
 "states": {
  "hover": {
   "level": {
    "stroke": "accent"
   }
  },
  "selected": {
   "level": {
    "stroke": "accent",
    "strokeWidth": "stroke-hub",
    "halo": "accent-soft"
   }
  },
  "related": {
   "level": {
    "stroke": "accent"
   }
  },
  "dimmed": {
   "level": {
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
   "level": {
    "fill": "diff-added-soft"
   },
   "mark": {
    "fill": "surface-node",
    "stroke": "diff-added",
    "textColor": "diff-added"
   }
  },
  "diff-removed": {
   "level": {
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
   "level": {
    "fill": "diff-changed-soft"
   },
   "mark": {
    "fill": "surface-node",
    "stroke": "diff-changed",
    "textColor": "diff-changed"
   }
  },
  "diff-stale": {
   "level": {
    "fill": "diff-stale-soft"
   },
   "mark": {
    "fill": "surface-node",
    "stroke": "diff-stale",
    "textColor": "diff-stale"
   }
  },
  "pending": {
   "flag": {
    "stroke": "state-warn",
    "dash": "gap"
   }
  },
  "established": {
   "flag": {
    "stroke": "ink-faint",
    "textColor": "ink-muted",
    "dash": "solid"
   }
  }
 },
 "layout": {
  "orientation": [
   "vertical"
  ],
  "memberGap": 52,
  "headerHeight": 26,
  "labelPlacement": "inside-start"
 },
 "overflow": "wrap",
 "notes": "Levels are full-width stripes ruled top and bottom, recessed to surface-page, labelled “Interface · level 1 of 3”. Files outside every level sit in an “Outside layers” gutter to the right behind a dashed rule. Counterflow flags are a ↑N chip inside the source file’s right end, after any hub count or overlap chip, with the label truncated to make room: solid warn outline when flagged, dashed when pending (raised in dialogue), faint when exempt (established). The full wording is in the tooltip and inspector. Exemptions never recolor an edge."
}
```
