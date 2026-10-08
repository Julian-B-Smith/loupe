# how-it-works — a third view that explains behaviour as stories (ADR 0025)

- **Queue item:** unqueued (Julian's request; polls: third view "How it works"; stories; story = lens + inferred layer;
  edits: rearrange, edit, ask the agent, pin)
- **Change:** `design/prototype/{story.js, works.js, stories/horde-c64cfdbc.json}`, index/state wiring, `tools/story.test.mjs`.
  Two HORDE stories written by the Structure agent from source at c64cfdbc ("One audio block", "A note arrives").
- **Critic (opus): REWORK, two blockers, both fixed.** (1) Links with any crawled edge between their steps' files
  were drawn solid, which looks crawled; now every agent link is dashed and crawl support is tooltip context.
  (2) Two steps were false (velocity, scope) and four misleading, despite 33/33 citations landing; all rewritten and
  re-cited (lesson L0004). Should-fixes fixed: card heights measured, edits keyed by stories hash, orphans shown,
  link colours off the 'call' slot, escaping, no-op saves, a key for links and frames. Review v4 B3 fixed on the way.
- **Evidence:** both stories 650/650 and 242/242 with renderer routing = accounting; no solid agent link or frame;
  no overflowing or overlapping card; every edit tool and undo-all exercised; story test 18 cases, a planted
  invented reroute fails it.
- **Verify:** `./verify fast` exit 0. The story test is gated in `./verify fast` (Julian, by poll); a planted link without a reason fails it.
