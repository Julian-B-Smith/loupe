// Tests for the build layer (ROADMAP Q-012). Gated in ./verify fast.
// Run: node crawler/build.test.ts            (compare with the golden)
//      node crawler/build.test.ts --update   (rewrite the golden; a reviewed change only)
import { readFileSync, writeFileSync, readdirSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { canonicalDoc } from '../tools/canon.mjs';
import { buildLayer, readLoupeConfig } from './build.ts';

let failed = 0;
const check = (name: string, cond: boolean) => { console.log(`${cond ? 'pass' : 'FAIL'}  ${name}`); if (!cond) failed++; };
const FIXTURE = 'fixtures/cmake-basic', GOLDEN = 'fixtures/cmake-basic.facts.golden.json';
const scratchCount = () => readdirSync(tmpdir()).filter((d) => d.startsWith('loupe-build-')).length;

const before = scratchCount();
const a = canonicalDoc(buildLayer(FIXTURE).facts), b = canonicalDoc(buildLayer(FIXTURE).facts);
check('two runs give byte-identical facts', a === b);
check('every scratch directory is deleted after the crawl', scratchCount() === before);

if (process.argv.includes('--update')) { writeFileSync(GOLDEN, a); console.log(`wrote ${GOLDEN}`); }
check('facts equal the committed golden', a === readFileSync(GOLDEN, 'utf8'));

// No machine identity and no clock in what is kept (environment is separate and not compared).
check('no absolute path in the facts', !/"\/(Users|home|private|var|opt|tmp|Library|usr)\//.test(a) && !/[A-Za-z]:\\\\/.test(a));
check('no timestamp in the facts', !/"time"\s*:/.test(a));

const f = JSON.parse(a);
const m = (src: string, tgt: string) => f.membership.find((x: { source: string; target: string }) => x.source === src && x.target === tgt);
check('both declared configurations ran', f.declared === true && f.configurations.map((c: { name: string }) => c.name).join() === 'release,extra');
check('an option-only source is a member only in its configuration (0026 union)', JSON.stringify(m('src/extra.cpp', 'engine')?.configs) === '["extra"]');
check('a source in every configuration lists them all', JSON.stringify(m('src/engine.cpp', 'engine')?.configs) === '["extra","release"]');
check('a platform-only source shows up as claimed by no target', JSON.stringify(f.unclaimedSources) === '["src/win_only.cpp"]');
const gen = m('${build}/generated/table.h', 'engine');
check('the generated header is a generated member', !!gen && gen.generated === true);
const cc = f.perConfiguration[0].customCommands;
check('the custom command is read from the trace with file and line', cc.length === 1 && cc[0].file === 'CMakeLists.txt' && cc[0].line === 9);
check('its output matches the generated source and its generator is the script', cc[0].outputs[0] === '${build}/generated/table.h' && cc[0].depends.includes('tools/gen_table.py'));
const eng = f.perConfiguration[0].targets.find((t: { name: string }) => t.name === 'engine');
check('include paths keep their search order', JSON.stringify(eng.compileGroups[0].includes) === '["src","${build}/generated"]');
check('target dependencies are named', JSON.stringify(f.perConfiguration[0].targets.find((t: { name: string }) => t.name === 'plugin').dependencies) === '["engine"]');

// Config handling: none declared means one default configuration, said so; a malformed one is refused.
const tmp = mkdtempSync(join(tmpdir(), 'loupe-test-'));
try {
  check('no .loupe/config.json: one default configuration, not declared', (() => { const c = readLoupeConfig(tmp); return c.configurations.length === 1 && c.configurations[0].name === 'default' && !c.declared; })());
  mkdirSync(join(tmp, '.loupe'));
  writeFileSync(join(tmp, '.loupe', 'config.json'), JSON.stringify({ configurations: [{ name: 'x', args: '-DFOO' }] }));
  let threw = false; try { readLoupeConfig(tmp); } catch { threw = true; }
  check('a configuration whose args is not an array is refused', threw);

  // HORDE's condition 1 on the failure path: configure fails, the scratch directory still goes.
  writeFileSync(join(tmp, 'CMakeLists.txt'), 'cmake_minimum_required(VERSION 3.20)\nproject(T NONE)\n');
  writeFileSync(join(tmp, '.loupe', 'config.json'), JSON.stringify({ configurations: [{ name: 'bad', args: ['-G', 'No Such Generator'] }] }));
  const n = scratchCount(); let failedRun = false;
  try { buildLayer(tmp); } catch { failedRun = true; }
  check('a failing configure throws and still deletes its scratch directory', failedRun && scratchCount() === n);
} finally { rmSync(tmp, { recursive: true, force: true }); }

console.log(failed ? `${failed} failed` : 'all build-layer cases behave');
process.exit(failed ? 1 : 0);
