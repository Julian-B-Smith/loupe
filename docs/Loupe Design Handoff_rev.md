# Loupe Design Handoff

Sep 30, 2026 · @Julian Beall Smith

Version 2. Claude Design owns how Loupe looks: the design system and a visual prototype that renders Loupe's real data files. Loupe's infrastructure owns what gets drawn and where, and the logic behind it. This packet is the contract between the two. The canonical copy is `docs/design-handoff.md` in the Loupe folder.

## What changed in v2

v2 answers the design agent's 18 review points (numbered as in that review) and adds the prototype contract.

| # | Point | Answer |
| --- | --- | --- |
| 1 | Combined states | Each state family owns one channel; states inside a family are exclusive. See "States and channels". |
| 2 | `loupe-spec` keys | Formal schema: `schema/loupe-spec.schema.json`. States are nested objects (part → style), not dotted paths. Type styles go in `textStyle`, colors in `textColor`. |
| 3 | Free text in JSON | `shape` is now structured (`{"type": "chevron", "notch": 14, "point": 22}`). Only `notes` is free text, and it is never parsed. |
| 4 | Level of detail | New `loupe-lod` block in the README. See Deliverable 1. |
| 5 | Type styles, scaling | Each style needs fontSize, lineHeight, fontWeight, letterSpacing. Strokes and label text stay a fixed size on screen; boxes scale with zoom; level of detail swaps content past thresholds. |
| 6 | Provenance count | Five provenances: static, config, runtime, annotated, inferred. `missing` is renamed `gap`: it marks an absent edge in a lane, and is not a provenance. The edge matrix is 8 slots × 5 provenances. |
| 7 | Config lanes | Config is now a real provenance with its own line pattern. A lane is drawn with the pattern of the provenance its order comes from. |
| 8 | Modulation source | The crawler emits syntactic kinds (call, include, test…). Audio, param and mod are roles, assigned by deterministic dialect rules (for example by callee signature) or by an agent (then inferred). An edge's color slot is its role if it has one, else its kind. |
| 9 | Overlap fallback | Membership strip: a row of set chips on the node. `visual-grammar.md` is corrected to match. |
| 10 | Accent doing two jobs | Split: `accent` is selection and focus only. Hubs get their own `hub` and `hub-soft` tokens. |
| 11 | Files outside every band | They sit in a side gutter labelled "Outside layers", styled by design. |
| 12 | Unclassified loop, Ring warning | New tokens `loop-unclassified` and `ring`. Ring must not reuse `state-warn`; unclassified must differ from both Ring and Feedback loop. |
| 13 | Which primitives collapse | Section, twins, band level and lane (lane folds its middle steps). Not hub, bus, loop, set or overlap. |
| 14 | Conservation meter | Three states: balanced, broken (names what does not add up, opens the list of unaccounted ids), stale (the view was made for an older graph). |
| 15 | Dimmed contrast | Dimmed elements are exempt from contrast minimums. |
| 16 | Kinds told apart by color | Add a second cue: arrowhead glyph by family (flow: filled arrow; structure: hollow arrow; reads: dot), plus the kind and role name on hover. |
| 17 | Motion at scale | Stagger by group, not by file. A whole transition stays under 900 ms; above 300 visible elements, groups cross-fade. |
| 18 | System version | Use the integer `version` at the top of `tokens.json`. `design-links.md` pins it. |

## What Loupe is, and the rules no design can break

Loupe turns a codebase into a map. A deterministic crawler builds the dependency graph: files are nodes; includes, calls, tests and data reads are directed edges. Agents group nodes into visual structures, a human questions them, and an audit swarm checks every claim.

There are two views of the same graph. The **flow view** is laid out mechanically with no interpretation. The **design view** is composed by an agent from a toolkit of nine primitives, each making a claim an auditor can test. Design styles that toolkit; it does not invent structure.

Hard rules. A design that breaks one cannot ship:

1. **Nothing is hidden.** Every node and edge stays visible or accounted for. Dimming is allowed down to `opacity-dim`; removal is not.
2. **Every aggregate shows its count.** A bus, a folded bundle, a collapsed container or a fan-in always carries a number.
3. **Text is never under a line.** Layer order is fixed: backgrounds, edges, nodes, labels.
4. **Provenance reads without color.** The five provenances differ by line pattern, so color stays free for kind and role.
5. **Both themes, always.** Every color token has a light and a dark value.
6. **Designs are parametric.** The renderer computes positions; design sets rules, never coordinates.
7. **It must scale.** From 2 members to 50, and from a 40-file plugin to a 4,000-file app.

## Who owns what, and where each side writes

| Area | Design owns | Infrastructure owns |
| --- | --- | --- |
| Tokens | Every visual value, both themes | Converting tokens to CSS variables |
| Primitives | Anatomy, part styling, states, spacing rules, overflow | Which primitive applies, membership, audit tests |
| Edges | Kind and role colors, provenance patterns, arrowheads, badges | Routing, bundling, what counts as a bus |
| Prototype | Rendering, interaction feel, the layout module's look | Data files, the logic API, the real layout engine later |
| Motion | Timings, easing, choreography | Triggering from state changes |
| Level of detail | What each zoom level shows | Thresholds and performance |

Both agents can work in the Loupe folder. To avoid collisions, design writes only under `design/`. Infrastructure writes `schema/`, `tools/` and `docs/`, and never edits `design/` except the generated files named at the end of this packet.

## Deliverable 1: the Loupe design system

A **Design System artifact** named "Loupe". Loupe reads `project/README.md`, `project/tokens.json` and one README per primitive.

**`tokens.json` uses the Design System type's list shape**: every family is `{"tokens":[{"name","value","usage"}]}`, color carries `themes` with ids `light` then `dark`, and the file has a top-level integer `version`. Values: hex, `rgb()`/`rgba()`, `hsl()` or `oklch()`, or an alias `"{other-token}"`. No named colors, `var()` or `color-mix()`, which the type drops silently. Test a small file early. Every token needs a `usage` note.

Required color tokens (each once, both themes):

| Token | Role |
| --- | --- |
| `surface-page`, `surface-canvas`, `surface-panel` | Page, map drawing area, inspector and sheets |
| `surface-group`, `surface-group-nested` | Section fill at depth 0, and at depth 1 and deeper |
| `surface-node` | File node fill |
| `ink`, `ink-muted`, `ink-faint` | Text, secondary text, captions and counts |
| `rule` | Borders and dividers |
| `accent`, `accent-soft`, `focus-ring` | Selection and focus only |
| `hub`, `hub-soft` | Hub outline and fill |
| `edge-1` … `edge-8` | Color slots for edge roles and kinds (DSP mapping below) |
| `state-ok`, `state-warn`, `state-bad` | Audit pass, warn, fail |
| `diff-added`, `diff-removed`, `diff-changed`, `diff-stale` | Re-run diff marks |
| `set-1` … `set-4` | Translucent overlap and set fills |
| `lane-fill`, `lane-edge` | Lane body and outline |
| `ring`, `loop-unclassified` | Circular dependency; loop not yet classified |

DSP slot mapping: `edge-1` call, `edge-2` include, `edge-3` audio (role), `edge-4` param (role), `edge-5` mod (role), `edge-6` test, `edge-7` data and config, `edge-8` spare. Each slot needs 3:1 contrast on `surface-canvas` in both themes, and neighbouring slots should differ in lightness, not hue alone.

Other required families, same list shape:

| Family | Tokens |
| --- | --- |
| `spacing` | `space-1` … `space-6` |
| `radius` | `radius-node`, `radius-group`, `radius-panel`, `radius-pill` |
| `stroke` | `stroke-edge`, `stroke-edge-emph`, `stroke-rail`, `stroke-group`, `stroke-hub` |
| `opacity` | `opacity-dim` (not below 0.2; dimmed elements are exempt from contrast rules) |

Type: families `ui` and `mono`. Styles `node-label`, `group-label`, `caption`, `count`, `panel-title`, `panel-body`, `eyebrow`, each with fontSize, lineHeight, fontWeight and letterSpacing.

Three things the token format cannot hold go in the README as fenced blocks:

```loupe-dash
{"static": "none", "config": "10 4", "runtime": "1.2 3.6", "annotated": "8 3 2 3", "inferred": "5 4", "gap": "2 3"}
```

```loupe-motion
{"flow-to-design": {"duration": 700, "easing": "cubic-bezier(.2,.7,.2,1)", "staggerBy": "group", "maxTotal": 900},
 "hover": {"duration": 120}, "diff-reveal": {"duration": 400},
 "crossFadeAbove": 300, "reduced-motion": "cross-fade only, 150 ms"}
```

```loupe-lod
{"levels": [
  {"name": "overview", "maxScale": 0.35, "nodes": "hidden", "groups": "headers-and-counts", "edges": "bundled-between-groups"},
  {"name": "structure", "maxScale": 0.75, "nodes": "dots", "groups": "full", "edges": "buses-and-bundles"},
  {"name": "detail", "maxScale": null, "nodes": "labelled", "groups": "full", "edges": "all"}]}
```

The values above are placeholders; design sets the real ones.

## Deliverable 2: one spec per primitive and base glyph

For each, a component in the design system: `components/<Name>/README.md` plus `components/<Name>/preview.html`. The preview is a static reference drawing on the HORDE sample. The README's first sentence is the summary, and it carries one fenced `loupe-spec` block that validates against `schema/loupe-spec.schema.json`:

```loupe-spec
{"primitive": "lane", "version": 1,
 "parts": {
   "body":  {"fill": "lane-fill", "stroke": "lane-edge", "strokeWidth": "stroke-group",
             "shape": {"type": "chevron", "notch": 14, "point": 22}},
   "step":  {"fill": "surface-panel", "stroke": "lane-edge", "textStyle": "count", "textColor": "lane-edge"},
   "spine": {"stroke": "edge-kind", "strokeWidth": "stroke-edge-emph", "dash": "provenance"}},
 "states": {
   "hover":      {"body": {"stroke": "accent"}},
   "selected":   {"body": {"halo": "accent-soft"}},
   "dimmed":     {"body": {"opacity": "opacity-dim"}},
   "audit-fail": {"badge": {"fill": "state-bad"}},
   "diff-added": {"body": {"fill": "diff-added"}}},
 "layout": {"orientation": ["vertical", "horizontal"], "memberGap": "space-5", "minMembers": 2, "foldAbove": 12},
 "overflow": "fold-middle",
 "notes": "Never reuse the section outline. Step numbers never sit under the spine."}
```

Primitives: section, set, overlap, bus, band, lane, twins, hub, loop. Base glyphs: node, group-header, edge, count-badge, question-pin, audit-pin, tour-step, conservation-meter.

### States and channels

| Family | States (exclusive within the family) | Channel it owns |
| --- | --- | --- |
| Interaction | hover, selected, related, dimmed | Stroke color, halo, opacity |
| Audit | audit-pass, audit-warn, audit-fail | Badge |
| Diff | diff-added, diff-removed, diff-changed, diff-stale | Fill tint and a corner diff mark |
| Structure | collapsed | Body shape plus its count |
| Classification | unclassified (loops), pending, established (exemptions) | Line color and glyph |

Rules: a family only touches its own channel, so states from different families always combine. `dimmed` never applies to the selection or its related elements. Provenance owns the line pattern, and no state may change it.

### Briefs

| Primitive | Status | Brief |
| --- | --- | --- |
| Section | Kept | Depth up to 3 without heavy nesting borders. Collapses to its header and counts. |
| Set and overlap | Kept | Up to 3 sets drawn as regions. Past 3, a membership strip of set chips on the node. |
| Bus | Kept | Rail, taps, junction dots, a label with member count; contract on hover. |
| Band | Kept | Counterflow flag; pending and established exemption styles; an "Outside layers" gutter. |
| Lane | Kept | Arrow-shaped band with numbered steps. Drawn with its source's provenance pattern, and names that source. Horizontal variant. |
| Twins | Kept | Shared interface plate; scales from 2 to 8 twins and 1 to 8 ports. |
| Hub | Kept | Double outline in `hub`, inline fan-in count. A setting moves hubs to the layout center; design both placements. |
| Loop | Kept | One primitive with three looks: circular (Ring, in `ring`), intentional (Feedback loop, with a z⁻¹ delay glyph), unclassified (neutral, in `loop-unclassified`). |

## Deliverable 3: the prototype

A working visual prototype that renders Loupe's real data, so infrastructure can wire it into the logic. It replaces the earlier screens-canvas deliverable; static mockups are optional.

**Data in.** It loads a snapshot folder with three files that follow the schemas in `schema/`:

- `graph.json`: crawler output (nodes, crawled edges).
- `overlay.json`: edges and roles added by agents, traces or people.
- `view.json`: the design view (elements, settings, exemptions).

Start from `schema/examples/horde-sample/`. `docs/graph-schema.md` explains every field.

**Shape of the code.** Plain HTML, CSS and JavaScript modules with no build step, in `design/prototype/`:

| File | Job |
| --- | --- |
| `index.html` | Loads a snapshot and the tokens, mounts the renderer |
| `tokens.css` | The design system's tokens as `--loupe-<name>` variables |
| `render.js` | `render(container, data, state)` draws everything; returns the element map |
| `layout.js` | `layout(data, state)` returns positions only. A simple version is fine; infrastructure will replace it |
| `state.js` | The UI state object and its events |

`state` holds `stage` (1–6), `selection`, `collapsed`, `dimmedKinds`, `zoom`, `settings.hubPlacement` and an optional `diff`. Interactions only change `state` and call `render` again. Nothing in `render.js` decides structure: no grouping, bundling or membership logic. That all comes from `view.json`.

**Conservation.** After every render, the prototype calls `conserve(data, state, elementMap)` and shows the result in the conservation meter. Infrastructure supplies `conserve`. Until then, use the version in `prototype/index.html` (v1 viewer), which counts edges as drawn, in buses, folded or inside collapsed groups.

**Screens to cover:** workspace in each of the six stages, the re-run diff with a before/after switch, the flow-to-design transition, and a phone layout with the inspector as a bottom sheet.

## Stress cases every design must survive

Draw against these before calling a primitive done. Generated data for each will land in `schema/examples/` as the crawler comes up.

| Case | Tests | Size |
| --- | --- | --- |
| Long file names | Truncation and tooltip | 48-character stem |
| Big bus | Rail length, tap spacing, count label | 50 members |
| Wide hub | Spoke crowding, badge placement | 40 incoming |
| Deep nesting | Container depth | 3 levels |
| Triple overlap | A file in three sets | 3 sets |
| Long lane | Folding | 12 steps |
| Big family | Twins scaling, mixed ✓ \~ ✕ | 8 twins × 6 ports |
| Whole repo | Level of detail at all three levels | 4,000 files |
| Edge matrix | Every slot × provenance legible on one screen | 8 × 5 |
| Big diff | Diff marks at volume | 30 added, 12 removed, 5 stale |

## How the handoff runs

1. Design builds the "Loupe" design system and the prototype from this packet and the primitives gallery.
2. Julian passes the design system link to the infrastructure session; the prototype lives in `design/prototype/`.
3. Infrastructure validates every `loupe-spec` block and `tokens.json`, and replies with anything missing or malformed.
4. Infrastructure wires the prototype to the real logic, renders the stress cases, and reports any conflict with the hard rules.
5. Design revises and bumps versions; infrastructure re-reads only what changed.

Generated by infrastructure, never edited by hand: `design/tokens.css` (from `tokens.json`) and `design/primitives.json` (parsed specs). Links and pinned versions live in `docs/design-links.md`.

## Links

- [Primitives gallery, round 2](https://claude.ai/artifact/Lw7cH6LF7sUgLGCERhgR1Y): every primitive on the HORDE sample, with its live audit test.
- [Loupe viewer v1](https://claude.ai/artifact/9MWcjmEY9umVzobq71a3wW): the current map prototype, all six stages.
- `docs/graph-schema.md`, `schema/`: the data contract the prototype renders.
- Canonical copy of this packet: `docs/design-handoff.md` in the Loupe folder.
