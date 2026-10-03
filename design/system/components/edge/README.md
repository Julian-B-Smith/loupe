# Edge

An edge is one directed dependency: color from its role, else its kind; line pattern from its provenance.

**Audit test.** Conservation: every edge is drawn, in a bus, folded into a count, or inside a collapsed container.

Heads by family: filled arrow for flow (call, audio, mod, instantiate), hollow arrow for structure (include, import, inherit, test), dot for reads (param, data, config, reference). Patterns: static solid, config long dash 10 4, runtime round dots, annotated dash-dot, inferred short dash 4 3.5. Strokes and dashes are screen px at every zoom. States never change the pattern.

```loupe-spec
{
 "primitive": "edge",
 "version": 2,
 "parts": {
  "line": {
   "stroke": "edge-kind",
   "strokeWidth": "stroke-edge",
   "dash": "provenance"
  },
  "head": {
   "fill": "edge-kind",
   "glyph": "arrow-filled"
  }
 },
 "states": {
  "hover": {
   "line": {
    "strokeWidth": "stroke-edge-emph"
   }
  },
  "selected": {
   "line": {
    "strokeWidth": "stroke-edge-emph"
   }
  },
  "related": {
   "line": {
    "strokeWidth": "stroke-edge-emph"
   }
  },
  "dimmed": {
   "line": {
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
   "line": {
    "fill": "diff-added-soft"
   },
   "mark": {
    "fill": "surface-node",
    "stroke": "diff-added",
    "textColor": "diff-added"
   }
  },
  "diff-removed": {
   "line": {
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
   "line": {
    "fill": "diff-changed-soft"
   },
   "mark": {
    "fill": "surface-node",
    "stroke": "diff-changed",
    "textColor": "diff-changed"
   }
  },
  "diff-stale": {
   "line": {
    "fill": "diff-stale-soft"
   },
   "mark": {
    "fill": "surface-node",
    "stroke": "diff-stale",
    "textColor": "diff-stale"
   }
  }
 },
 "layout": {},
 "overflow": "none",
 "notes": "Heads by family: filled arrow for flow (call, audio, mod, instantiate), hollow arrow for structure (include, import, inherit, test), dot for reads (param, data, config, reference). Patterns: static solid, config long dash 10 4, runtime round dots, annotated dash-dot, inferred short dash 4 3.5. Strokes and dashes are screen px at every zoom. States never change the pattern."
}
```
