# Set

A set claims a named grouping that is not a home: members keep their home section.

**Audit test.** Every member has an edge that the set’s claim names (for Presets: reads or writes corner presets).

When every member shares a home section, drawn as a translucent convex hull around them with a 10px rounded stroke in the same fill. When members sit in different sections a hull would sweep across unrelated boxes, so each member gets its own set-colored halo and a small name tag on its top-left corner instead; hovering the set highlights all members. Slots set-1 to set-3 are assigned in view order; set-4 is reserved for the membership strip.

```loupe-spec
{
 "primitive": "set",
 "version": 2,
 "parts": {
  "region": {
   "fill": "set-1",
   "stroke": "set-1",
   "shape": {
    "type": "ellipse",
    "inset": 7
   }
  },
  "label": {
   "textStyle": "count",
   "textColor": "ink-muted",
   "halo": "surface-canvas"
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
  "padding": 7,
  "minMembers": 2,
  "labelPlacement": "above"
 },
 "overflow": "none",
 "notes": "When every member shares a home section, drawn as a translucent convex hull around them with a 10px rounded stroke in the same fill. When members sit in different sections a hull would sweep across unrelated boxes, so each member gets its own set-colored halo and a small name tag on its top-left corner instead; hovering the set highlights all members. Slots set-1 to set-3 are assigned in view order; set-4 is reserved for the membership strip."
}
```
