# 0018. Graph schema 0.2, from the first real crawl

- **Status:** Accepted (2026-10-01), except crawl scope and per-repo config, which moved to 0019 (Proposed).
- **Date:** 2026-10-01
- **Source:** Claude, after probing HORDE at commit c64cfdbc (2026-09-30)

## Context

A throwaway probe crawler (`tools/probe-crawl.mjs`) ran schema 0.1 against HORDE. Six things in the repo
had no place in the schema:

1. **Files referenced but not present.** 47 quoted includes did not resolve. Some are build outputs
   (`gui_html.h`, `factory_bank.h`, `build_stamp.h`), some live in a sibling repo (`foundations/note.h`), and
   some come from an SDK fetched at configure time (`pluginterfaces/…`). 0.1 could only call all of them "artifact".
2. **What a file is for.** Tools outnumber product files about 5 to 1, and most edges run from checks into
   `src/`. Without a role on each file, the map is dominated by test scaffolding.
3. **Generation and embedding.** CMake runs `tools/embed_file.py` to compile `src/gui/gui2.html` into a
   header, and `tools/gen_depends_header.py` writes `src/depends_graph.h` from a TSV. 0.1 had no edge kind
   for "produces" or "is compiled into".
4. **Platform guards.** 14 includes sit under `#if defined(_WIN32)`, `__APPLE__`, `__linux__` or `__SSE2__`. CMake
   picks `gui.html` or `gui2.html` behind an option. 0.1 recorded neither.
5. **What the crawl looked at.** HORDE has 900 tracked files. The probe read 134. Nothing said which 766
   were left out or why, so an omission was indistinguishable from a file that does not exist.
6. **How a path was resolved.** Every include was resolved by searching likely folders. The real answer
   comes from the build's include paths; a guessed resolution should be visible so an auditor can check it.

## Decision

Schema 0.2 (all three files move to `/0.2`):

- **`missing` node kind** (`miss:<path>`) with a required reason: `generated`, `external`, `sibling` or
  `unknown`, plus an optional note. Checker rule G6: a missing node needs a reason; a `generated` one needs
  an incoming `generates` edge or a note saying where it comes from.
- **File roles.** `role` and `roleRule` on nodes, assigned by deterministic rules (path patterns first, then
  graph rules such as "anything that generates a file is a generator"). Roles are product, gui, test, probe,
  bench, generator, scratch, data, build, tool, doc. The dialect can add more.
- **Two edge kinds:** `generates` (a script or build rule produces a file) and `embeds` (a file is compiled
  into another).
- **Guards.** `guard` on site evidence (preprocessor condition) and on config evidence (build-system condition).
- **Crawl scope and inventory** in `crawler`: the include and exclude rules, the resolution method
  (`compile-db` or `heuristic`), optional target, defines and sibling prefixes, and an inventory where
  `files = crawled + Σ excluded`, grouped by reason and extension. Checker rule G5 enforces the arithmetic
  and that `crawled` equals the number of file nodes. This extends the one rule from edges to files:
  nothing in the repo is left out silently.
- **Resolution on sites:** `exact`, `compile-db` or `search`. `search` marks a guess worth auditing.

## Result on HORDE (probe v2)

900 files: 223 crawled, 677 excluded with reasons (traces 377, docs 133, docs assets 118, reference 32,
repo tooling 12, binary 5). 242 nodes, 650 edges: include 397, import 132, reference 97, data 16, generates 5,
embeds 3. Every unresolved include now has a reason: 3 generated (each traced to its CMake rule and script),
2 sibling, 6 external (VST3 SDK). Zero unknown. Two crawls give identical bytes. Stored as
`schema/examples/horde-probe/`.

## Still not expressible, deferred to P1

- **The GUI bridge.** `gui2.html` calls 48 of the 49 `web.bind("hz…")` functions registered in
  `src/gui/hypersaw_gui_common.h`; legacy `gui.html` calls 11. These string-keyed calls are deterministic
  and are the main path between the GUI and the plugin, but they need symbol nodes and a dialect rule (a
  `call` edge with role `bridge`), not a new schema field.
- **Build targets.** About 95 tool `.cpp` files are separate CMake executables. Targets are not nodes yet;
  the CMake File API (or `compile_commands.json`) should supply them along with include paths and defines.
- **Header-only fan-in.** `src/hypersaw_clap_entry.h` has 49 incoming includes. At file level it is a star;
  at symbol level it would show which parts each consumer uses.
- **Writes through computed paths** (for example a generator that builds its output path in code) are not
  caught by literal-path matching.

## Consequences for P1

The P1 crawler should be multi-language from the start (C/C++, Python, JS, HTML, shell, CMake), read
`compile_commands.json` when present (falling back to search, marked as such), crawl symbols in headers,
and ship the bridge rule in the dsp-plugin dialect.
