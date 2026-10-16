# engine2-spec: HORDE's engine2, mapped by an agent from its spec (parked)

**Status: parked, not on the testbench** (Julian, 2026-10-16). The engine2 diagram will be drawn from HORDE's
declared structure (HORDE brief `integrations/hypersaw/brief-engine-structure.md`, ROADMAP Q-014/Q-015). This
inferred map is kept as the future check of Loupe's own inference: how close does an agent reading the spec get to
the declared truth? It is not a diagram to trust: a critic review (2026-10-16) found its citations accurate but its
edge kinds (`call`, `inherit`) claiming code structure the spec does not state, and its lane's `annotated`
provenance self-asserted. Those findings are deliberately not fixed here.

## Inputs (spec-pure)

Only HORDE's `specs/SPEC-ENGINE.md` and `engine2/` (without `data/reference-renders/` and `data/version0-states/`)
at commit `595140e7277d7487c77761389597db9d7d0b27a4`, exported history-free with `git archive`. Every exported file
was compared blob-for-blob with that commit (spec blob `975a6e90ea3a720bf197f83de4c987599f27121f`). HORDE's
clean-room identifier patterns find nothing in these files or the story.

## Rebuild

```
git -C <horde> archive 595140e7277d7487c77761389597db9d7d0b27a4 engine2 specs/SPEC-ENGINE.md | tar -x -C <export>
rm -r <export>/engine2/data/reference-renders <export>/engine2/data/version0-states
git -C <export> init -q && git -C <export> add . && git -C <export> commit -qm export
node tools/probe-crawl.mjs <export> <probe-out> tools/engine2-spec/engine2.json
node tools/engine2-spec/mk-engine2-spec.mjs <probe-out> <export> design/prototype/snapshots/engine2-spec
node tools/engine2-spec/mk-story.mjs design/prototype/stories/horde-595140e7.json
```

`graph.json` is the probe's output unchanged: the probe config names the spec in `crawlPaths` (so it is a node) and
the origin commit in `source`.
