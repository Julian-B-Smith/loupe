import { add } from './util.js';
import fs from 'node:fs';
const _ = require('lodash');
const presets = fs.readFileSync('../data/presets.json', 'utf8');
import('./lazy.js').then((m) => m.run(add(1, 2), presets, _));
window.fxGetLevel = () => 0; // a dev mock defines the name; it does not use the bridge
