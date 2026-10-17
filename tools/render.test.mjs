// Headless render test (Q-017; critic, 2026-10-16: no oracle ran render(), so a crash at one zoom level passed every
// layout test). Renders the design view with a stub DOM at each level of detail and asserts the conservation meter
// balances: every node and edge accounted for in the frame that was actually built.
// Run: node tools/render.test.mjs
import { readFileSync } from 'node:fs';

// The DOM render() touches: one canvas for text width, one <svg>, the container's size. Nothing else is needed.
const svg = { setAttribute() {}, getAttribute: () => 'l1', style: {}, innerHTML: '' };
globalThis.document = { createElement: () => ({ getContext: () => ({ font: '', measureText: () => ({ width: 27 * 7.2 }) }) }), createElementNS: () => svg, fonts: null };
const container = { querySelector: () => svg, appendChild() {}, clientWidth: 1440, clientHeight: 900 };

const { indexSnapshot } = await import('../design/prototype/snapshot.js');
const { render } = await import('../design/prototype/render.js');
const { conserve } = await import('../design/prototype/standins.js');

let failed = 0;
const check = (name, cond) => { console.log(`${cond ? 'pass' : 'FAIL'}  ${name}`); if (!cond) failed++; };
const j = (p) => JSON.parse(readFileSync(p, 'utf8'));
const snap = (dir, edit = (raw) => raw) => {
  const raw = edit({ graph: j(dir + 'graph.json'), overlay: j(dir + 'overlay.json'), view: j(dir + 'view.json') });
  return indexSnapshot({ ...raw, stages: null, diff: null, hashes: {} });
};
const ZOOMS = [{ auto: true }, { k: 1, x: 0, y: 0 }, { k: 0.5, x: 0, y: 0 }, { k: 0.2, x: 0, y: 0 }];
function sweep(name, data, extra = {}) {
  const bad = [];
  for (const zoom of ZOOMS) for (const lens of [null, 'operational']) {
    const state = { view: 'design', stage: 2, settings: {}, zoom, ...(lens ? { lens } : {}), ...extra };
    try {
      const map = render(container, data, state);
      const c = conserve(data, state, map);
      if (c.status === 'broken') bad.push(`${JSON.stringify(zoom)}${lens ? ' lens' : ''}: ${c.unaccounted.slice(0, 2).join(', ')}`);
    } catch (e) { bad.push(`${JSON.stringify(zoom)}${lens ? ' lens' : ''}: threw ${e.message}`); }
  }
  check(`${name}: renders and balances at every level of detail, with and without a lens${bad.length ? ' — ' + bad.join(' | ') : ''}`, bad.length === 0);
}

sweep('crawler snapshot, every file loose', snap('design/prototype/snapshots/cmake-basic-crawl/'));
// The critic's case: some files homed, some loose, an edge between them (structure zoom crashed here).
sweep('mixed view: sectioned and loose files', snap('schema/examples/horde-sample/', (raw) => {
  const top = raw.view.elements.find((e) => e.primitive === 'section' && !e.parent);
  top.members = top.members.slice(2);
  return raw;
}));
// HORDE's size with an empty view: the loose block folds; the fold row (or the block, zoomed out) stands in.
const big = snap('schema/examples/horde-probe/', (raw) => ({ ...raw, view: { ...raw.view, elements: [] } }));
sweep('large empty view (folded loose block)', big);
sweep('large empty view, unfolded', big, { unfolded: ['loose'] });

console.log(failed ? `${failed} failed` : 'all render cases behave');
process.exit(failed ? 1 : 0);
