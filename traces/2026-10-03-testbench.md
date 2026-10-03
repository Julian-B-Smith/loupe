# testbench — a running Loupe, locally and hosted

- **Queue item:** unqueued (Julian: "see a running version sooner"; poll chose local + hosted, both viewers, v4 first)
- **Why:** testing so far happened only in agent screenshots. Julian wants to drive it himself.
- **Change:** `tools/serve.mjs` (`npm run view`, `.claude/launch.json`), `viewer/index.html` landing, hosted artifact
  https://claude.ai/artifact/K4sfLzhhWGTj2GoXAAyuJN. CI pins Node 24 (the `lts/*` lookup timed out in a GitHub outage
  and failed #3's first run).
- **Evidence:** local: landing renders in dark and light, counts read live; real HORDE crawl and loops snapshot open
  through the landing (loops shows stale, as expected). Server guards: traversal 404, `.git`/`.harness`/`node_modules`
  403, POST 405. Hosted: landing and the real HORDE crawl render (meter 650/650). Every published file read first; the
  JSON data scanned for URLs, paths and secrets (none), and Loupe's tracked tree checked against HORDE's private-name
  list (0 of 4 names present).
- **Gotcha recorded:** the artifact host refuses any published path containing the segment `prototype`.
- **Verify:** `./verify fast` exit 0.
- **Open questions:** republishing after merges is a session duty, not automated.
