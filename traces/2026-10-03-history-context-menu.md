# history-context-menu — Back/Forward = Undo/Redo, and a right-click menu (ADR 0024)

- **Queue item:** unqueued (Julian's request; poll: one history, view changes + selection, all controls, Isolate and
  Back to full map in the menu)
- **Change:** `createHistory` in `design/prototype/state.js`; toolbar ← →, hotkeys (⌘Z/⇧⌘Z, Ctrl+Z/Ctrl+Y, Alt/⌘+←→,
  ⌘[ ⌘]), mouse side buttons, touch long-press; context menu per target in `index.html`.
- **Evidence:** `tools/history.test.mjs` 15 cases (in `npm test`); a planted bug fails it. Browser (Chromium pane,
  synthetic events): walk src → tools via a port menu, ⌘Z, mouse button 3, ⇧⌘Z, ⌘[ ⌘] all step correctly; menu press
  does not select; Tab closes the menu; meter balanced throughout.
- **Critic (opus):** REWORK on one blocker (a pause counter could freeze history with two pointers). Fixed: pause is a
  flag, a new press ends a stale drag, lostpointercapture ends drags. Should-fixes fixed (Ctrl+click on macOS, Safari
  ⌘[ ⌘], step labels); most notes fixed.
- **Not proven:** real mouse side buttons in Safari, Firefox and the hosted iframe; iOS long-press on a device.
- **Verify:** `./verify fast` exit 0.
- **Follow-up (Julian, poll):** edges offer Isolate for both ends' sections; `./verify fast` now runs the history tests.
