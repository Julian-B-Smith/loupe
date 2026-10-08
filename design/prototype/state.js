// UI state and its events. Interactions only change state; the page calls render() again on every change.

export const STAGES = [
  { n: 1, id: 'crawl', label: 'Crawl', view: 'flow' },
  { n: 2, id: 'structure', label: 'Structure', view: 'design' },
  { n: 3, id: 'dialogue', label: 'Dialogue', view: 'design' },
  { n: 4, id: 'audit', label: 'Audit', view: 'design' },
  { n: 5, id: 'explain', label: 'Explain', view: 'design' },
  { n: 6, id: 'navigate', label: 'Navigate', view: 'design' }
];

export function initialState(over = {}) {
  return {
    stage: 2,
    view: 'design',            // 'flow' | 'design'
    morph: undefined,          // 0..1 while the flow-to-design transition runs; undefined = settled
    selection: null,           // { type: 'node'|'element'|'edge', id }
    hover: null,               // same shape as selection
    collapsed: [],             // section ids
    unfolded: [],              // section ids shown in full past the fold (layout L.foldAt)
    isolate: null,             // section id shown alone, with inputs and outputs as ports on side rails
    isoOpen: [],               // port keys listing their files
    lens: null,                // focus lens name (lens.js LENSES), design view only; everything outside is one counted box
    story: null,               // 'How it works' view (ADR 0025): story id shown; null = the first
    storyEdits: {},            // Julian's edits per story id (annotated): {steps, added, pos, requests}
    offsets: {},               // top-level section id -> {dx, dy} in world units; user drags, a view preference
    dimmedKinds: [],           // role or kind names
    zoom: { auto: true, k: 1, x: 0, y: 0, focus: null },
    settings: { hubPlacement: null }, // null = use view.json settings
    diff: null,                // null | { side: 'before'|'after' }
    tour: { index: 0, step: 0 },
    theme: 'light',
    ...over
  };
}

export function createStore(init) {
  let state = initialState(init);
  const subs = new Set();
  const store = {
    get: () => state,
    set(patch) {
      const next = typeof patch === 'function' ? patch(state) : patch;
      state = { ...state, ...next };
      subs.forEach(fn => fn(state));
    },
    on(fn) { subs.add(fn); return () => subs.delete(fn); }
  };
  const same = (a, b) => (a && b ? a.type === b.type && a.id === b.id : a === b);
  store.actions = {
    select: sel => store.set(s => ({ selection: same(s.selection, sel) ? null : sel })),
    hover: h => { if (!same(store.get().hover, h)) store.set({ hover: h }); },
    clear: () => store.set({ selection: null }),
    setStage: n => store.set(s => ({ stage: n, view: STAGES[n - 1].view, selection: null, tour: { ...s.tour, step: 0 }, zoom: s.view !== STAGES[n - 1].view ? { ...s.zoom, auto: true } : s.zoom })),
    setView: view => store.set(s => ({ view, zoom: { ...s.zoom, auto: true } })),
    toggleCollapsed: id => store.set(s => ({ collapsed: s.collapsed.includes(id) ? s.collapsed.filter(x => x !== id) : s.collapsed.concat(id) })),
    toggleUnfold: id => store.set(s => ({ unfolded: s.unfolded.includes(id) ? s.unfolded.filter(x => x !== id) : s.unfolded.concat(id) })),
    isolate: id => store.set(s => ({ isolate: id, isoOpen: [], selection: null, hover: null, view: 'design', zoom: { ...s.zoom, auto: true, focus: null } })),
    // Closing a section port also forgets its show-all key (side:all:sec), so reopening starts folded.
    togglePort: k => store.set(s => ({ isoOpen: s.isoOpen.includes(k) ? s.isoOpen.filter(x => x !== k && x !== k.replace(':s:', ':all:')) : s.isoOpen.concat(k) })),
    setStory: id => store.set(s => ({ story: id, selection: null, zoom: { ...s.zoom, auto: true, focus: null } })),
    // Story edits are copied, changed by f, and stored whole: history snapshots must never share a mutated object.
    editStory: (id, f) => store.set(s => ({ storyEdits: { ...s.storyEdits, [id]: f(JSON.parse(JSON.stringify(s.storyEdits[id] || {}))) } })),
    setLens: name => store.set(s => ({ lens: name || null, zoom: { ...s.zoom, auto: true, focus: null } })),
    toggleKind: k => store.set(s => ({ dimmedKinds: s.dimmedKinds.includes(k) ? s.dimmedKinds.filter(x => x !== k) : s.dimmedKinds.concat(k) })),
    setZoom: z => store.set(s => ({ zoom: { ...s.zoom, ...z } })),
    fit: () => store.set(s => ({ zoom: { ...s.zoom, auto: true, focus: null } })),
    setHubPlacement: p => store.set(s => ({ settings: { ...s.settings, hubPlacement: p } })),
    setDiff: d => store.set({ diff: d }),
    moveSection: (id, dx, dy) => store.set(s => ({ offsets: { ...s.offsets, [id]: { dx, dy } } })),
    resetLayout: () => store.set(s => ({ offsets: {}, zoom: { ...s.zoom, auto: true } })),
    setTour: t => store.set(s => ({ tour: { ...s.tour, ...t } })),
    setTheme: theme => store.set({ theme })
  };
  return store;
}

// ---------- history: one stack serves Back/Forward and Undo/Redo (ADR 0024).
// The viewer never edits data, only the view, so a step is a change to these keys. Hover, zoom, pan, the morph and
// the theme are not steps. A drag is one step: pause() at pointerdown, resume() at pointerup. pause is a flag, not a
// counter: with two pointers a counter could be raised twice and lowered once, freezing history silently (critic, 0024).
export const HISTORY_KEYS = ['view', 'stage', 'selection', 'collapsed', 'unfolded', 'isolate', 'isoOpen', 'lens', 'story', 'storyEdits', 'settings', 'dimmedKinds', 'offsets', 'diff', 'tour'];
const LIMIT = 200;

export function createHistory(store, describe = () => '') {
  const pick = s => Object.fromEntries(HISTORY_KEYS.map(k => [k, s[k]]));
  const key = s => JSON.stringify(pick(s));
  const past = [], future = [], subs = new Set();
  let last = pick(store.get()), lastKey = key(store.get()), paused = false, restoring = false;
  const notify = () => subs.forEach(fn => fn(h));
  store.on(s => {
    if (restoring || paused) return;
    const k = key(s); if (k === lastKey) return;
    past.push({ snap: last, label: describe(last, pick(s)) }); if (past.length > LIMIT) past.shift();
    future.length = 0; last = pick(s); lastKey = k; notify();
  });
  const restore = (snap) => {
    const cur = store.get();
    // Leaving or entering an isolate, or switching flow/design, re-fits: the old zoom would point at empty space.
    const refit = snap.isolate !== cur.isolate || snap.view !== cur.view || snap.lens !== cur.lens || snap.story !== cur.story;
    restoring = true;
    store.set({ ...snap, hover: null, morph: undefined, ...(refit ? { zoom: { ...cur.zoom, auto: true, focus: null } } : {}) });
    restoring = false; last = pick(store.get()); lastKey = key(store.get()); notify();
  };
  const h = {
    back() { if (paused) return; const step = past.pop(); if (!step) return; future.push({ snap: last, label: step.label }); restore(step.snap); },
    forward() { if (paused) return; const step = future.pop(); if (!step) return; past.push({ snap: last, label: step.label }); restore(step.snap); },
    pause() { paused = true; },
    resume() { if (paused) { paused = false; const s = store.get(), k = key(s); if (k !== lastKey) { past.push({ snap: last, label: describe(last, pick(s)) }); future.length = 0; last = pick(s); lastKey = k; notify(); } } },
    get canBack() { return past.length > 0; }, get canForward() { return future.length > 0; },
    get backLabel() { return past.length ? past[past.length - 1].label : ''; },
    get forwardLabel() { return future.length ? future[future.length - 1].label : ''; },
    on(fn) { subs.add(fn); return () => subs.delete(fn); }
  };
  return h;
}

