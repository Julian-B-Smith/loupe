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
