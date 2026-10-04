// Deterministic tests for the viewer's history (design/prototype/state.js, ADR 0024).
// One stack serves Back/Forward and Undo/Redo; a drag is one step; hover, zoom and theme are not steps.
// Run: node tools/history.test.mjs
import { createStore, createHistory } from '../design/prototype/state.js';

let failed = 0;
const check = (name, cond) => { console.log(`${cond ? 'pass' : 'FAIL'}  ${name}`); if (!cond) failed++; };
const fresh = () => { const store = createStore({}); return { store, A: store.actions, H: createHistory(store, (a, b) => (a.isolate !== b.isolate ? `isolate ${b.isolate}` : 'step')) }; };

{
  const { store, A, H } = fresh();
  check('starts empty', !H.canBack && !H.canForward);
  A.isolate('sec:src'); A.isolate('sec:tools');
  check('two view changes are two steps', H.canBack && H.backLabel === 'isolate sec:tools');
  H.back(); check('back undoes the last step', store.get().isolate === 'sec:src' && H.canForward);
  H.back(); check('back again reaches the start', store.get().isolate === null && !H.canBack);
  H.forward(); H.forward(); check('forward redoes both', store.get().isolate === 'sec:tools' && !H.canForward);
  H.back(); A.toggleCollapsed('sec:x');
  check('a new step after back clears forward', !H.canForward && store.get().isolate === 'sec:src');
}
{
  const { store, A, H } = fresh();
  A.hover({ type: 'node', id: 'n' }); A.setZoom({ auto: false, k: 2, x: 1, y: 1 }); A.setTheme('dark');
  check('hover, zoom and theme are not steps', !H.canBack);
  A.select({ type: 'node', id: 'file:a' });
  check('selection is a step', H.canBack);
  H.back(); check('back clears the selection and keeps the theme', store.get().selection === null && store.get().theme === 'dark');
}
{
  const { store, A, H } = fresh();
  H.pause(); for (let i = 1; i <= 20; i++) A.moveSection('sec:a', i, i); H.resume();
  check('a drag of 20 moves is one step', H.canBack && (H.back(), !H.canBack) && !store.get().offsets['sec:a']);
  H.pause(); H.resume(); check('a click without movement adds no step', !H.canBack);
  H.pause(); H.pause(); A.moveSection('sec:b', 5, 5); H.resume();
  check('two pauses and one resume do not freeze history', H.canBack && (A.isolate('x'), H.backLabel === 'isolate x'));
  H.pause(); A.isolate('y'); H.back(); check('back is ignored mid-drag', store.get().isolate === 'y'); H.resume();
}
{
  const { store, A, H } = fresh();
  A.isolate('sec:src'); A.setZoom({ auto: false, k: 3, x: 0, y: 0 }); H.back();
  check('undoing an isolate re-fits the view', store.get().zoom.auto === true);
  for (let i = 0; i < 250; i++) A.toggleCollapsed('s' + (i % 2));
  let n = 0; while (H.canBack) { H.back(); n++; }
  check('history keeps at most 200 steps', n === 200);
}
console.log(failed ? `${failed} failed` : 'all history cases behave');
process.exit(failed ? 1 : 0);
