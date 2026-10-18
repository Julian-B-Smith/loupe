// Tests for the build layer (ROADMAP Q-012). Gated in ./verify fast.
// Run: node crawler/build.test.ts            (compare with the golden)
//      node crawler/build.test.ts --update   (rewrite the golden; a reviewed change only)
// Every case named "(critic)" holds a finding of the 2026-10-16 review, so the fix cannot silently regress.
import { readFileSync, writeFileSync, readdirSync, mkdtempSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { canonicalDoc } from '../tools/canon.mjs';
import { buildLayer, readLoupeConfig, checkArgs } from './build.ts';

let failed = 0;
const check = (name: string, cond: boolean) => { console.log(`${cond ? 'pass' : 'FAIL'}  ${name}`); if (!cond) failed++; };
const throws = (f: () => unknown) => { try { f(); return false; } catch { return true; } };
const FIXTURE = 'fixtures/cmake-basic', GOLDEN = 'fixtures/cmake-basic.facts.golden.json';
const MARKER = join(FIXTURE, 'lib', 'BUILD_RAN.marker');
const scratchCount = () => readdirSync(tmpdir()).filter((d) => d.startsWith('loupe-build-')).length;

const before = scratchCount();
const a = canonicalDoc(buildLayer(FIXTURE).facts), b = canonicalDoc(buildLayer(FIXTURE).facts);
check('two runs give byte-identical facts', a === b);
check('every scratch directory is deleted after the crawl', scratchCount() === before);
check('configure never builds: the post-build marker does not exist (critic)', !existsSync(MARKER));

if (process.argv.includes('--update')) { writeFileSync(GOLDEN, a); console.log(`wrote ${GOLDEN}`); }
check('facts equal the committed golden', a === readFileSync(GOLDEN, 'utf8'));

// No machine identity and no clock. Any absolute path anywhere in a string, not only right after a quote (critic).
check('no absolute path anywhere in the facts (critic)', !/(^|[\s"=:;,'(<])\/(?!\/)(Users|home|private|var|opt|tmp|Library|usr|Volumes|mnt|root|nix|srv)\b/m.test(a) && !/[A-Za-z]:\\\\/.test(a));
check('no timestamp in the facts', !/"time"\s*:/.test(a));

const f = JSON.parse(a);
const m = (src: string, tgt: string) => f.membership.find((x: { source: string; target: string }) => x.source === src && x.target === tgt);
const cfg0 = f.perConfiguration[0];
const T = (name: string) => cfg0.targets.find((t: { name: string }) => t.name === name);
check('both declared configurations ran', f.declared === true && f.configurations.map((c: { name: string }) => c.name).join() === 'release,extra');
check('an option-only source is a member only in its configuration (0026 union)', JSON.stringify(m('src/extra.cpp', 'engine')?.configs) === '["extra"]');
check('a source in every configuration lists them all', JSON.stringify(m('src/engine.cpp', 'engine')?.configs) === '["extra","release"]');
check('a platform-only source shows up as claimed by no target', JSON.stringify(f.unclaimedSources) === '["src/win_only.cpp"]');
check('the generated header is a generated member', m('${build}/generated/table.h', 'engine')?.generated === true);
check('two sources outside the repo stay two rows (critic)', !!m('${external}/outside_a.cpp', 'plugin') && !!m('${external}/outside_b.cpp', 'plugin'));
check('a path-valued define keeps no machine path (critic)', T('engine').compileGroups[0].defines.includes('DATA_DIR="${source}/data"'));
check("a custom target's CMakeFiles stamp is not a member (critic)", !f.membership.some((x: { source: string }) => /CMakeFiles/.test(x.source)));
check('include paths keep their search order', JSON.stringify(T('engine').compileGroups[0].includes) === '["src","${build}/generated"]');
check('target dependencies are named', JSON.stringify(T('plugin').dependencies) === '["engine","stamp"]');

const cc = cfg0.customCommands;
const top = cc.find((c: { file: string }) => c.file === 'CMakeLists.txt');
const lut = cc.find((c: { file: string; target: string | null }) => c.file === 'lib/CMakeLists.txt' && !c.target);
const post = cc.find((c: { target: string | null }) => c.target === 'lut');
check('the top-level custom command: file, line, output and generator', !!top && top.line === 9 && top.outputs[0] === '${build}/generated/table.h' && top.depends.includes('tools/gen_table.py'));
check('custom commands from CMake files outside the repo are filtered out (critic)', cc.length === 5 && !cc.some((c: { outputs: string[] }) => c.outputs.some((o) => o.includes('outside'))));
// add_custom_target is read (Q-009): HORDE's build stamp is one, and its BYPRODUCTS were dropped without a trace.
const stamp = cc.find((c: any) => c.target === 'stamp'), docs = cc.find((c: any) => c.target === 'lut_docs');
check('add_custom_target: its name owns the command, its BYPRODUCTS and its CMake script are read', !!stamp && stamp.stage === 'CUSTOM_TARGET'
  && JSON.stringify(stamp.byproducts) === '["${build}/generated/stamp.h"]' && stamp.commands[0].includes('tools/stamp.cmake'));
check('add_custom_target with the command right after its name (no COMMAND keyword)', !!docs && docs.commands.length === 1 && docs.commands[0].join(' ').endsWith('-E echo lut docs'));
check('a relative OUTPUT is in the subdirectory\'s build dir (critic)', !!lut && JSON.stringify(lut.outputs) === '["${build}/lib/lut.h"]');
check('BYPRODUCTS are kept (critic)', !!lut && JSON.stringify(lut.byproducts) === '["${build}/lib/lut.log"]');
check('a list-valued DEPENDS is split, and relative DEPENDS resolve against the caller\'s dir (critic)', !!lut && JSON.stringify(lut.depends) === '["lib/gen_lut.py","lib/lut.csv"]');
check('several COMMANDs stay separate commands (critic)', !!lut && lut.commands.length === 2 && lut.commands[0][0] === 'python3' && lut.commands[1].includes('touch'));
check('keywords such as COMMAND_EXPAND_LISTS and JOB_POOL do not leak into values (critic)', !!lut && !JSON.stringify(lut).includes('COMMAND_EXPAND_LISTS') && !JSON.stringify(lut).includes('console'));
check('the TARGET form keeps its target and stage (critic)', !!post && post.stage === 'POST_BUILD' && post.outputs.length === 0);

// Configuration args: an allowlist, so a config cannot move configure out of the scratch dir or make it something else.
check('allowed args pass', !throws(() => checkArgs(['-G', 'Unix Makefiles', '-DX=1', '-UY', '-Wno-dev', '--toolchain', 't.cmake', '-C', 'c.cmake'])));
for (const bad of [['-B', '/elsewhere'], ['--build', '.'], ['-E', 'rm', 'x'], ['-P', 'x.cmake'], ['--graphviz=g.dot'], ['--trace-redirect=t'], ['--preset', 'p'], ['--profiling-output=p'], ['-S', '.']])
  check(`refused arg ${bad[0]} (critic)`, throws(() => checkArgs(bad)));

const tmp = mkdtempSync(join(tmpdir(), 'loupe-test-'));
try {
  check('no .loupe/config.json: one default configuration, not declared', (() => { const c = readLoupeConfig(tmp); return c.configurations.length === 1 && c.configurations[0].name === 'default' && !c.declared; })());
  mkdirSync(join(tmp, '.loupe'));
  const cfg = (o: unknown) => writeFileSync(join(tmp, '.loupe', 'config.json'), JSON.stringify(o));
  cfg({ configurations: [{ name: 'x', args: '-DFOO' }] });
  check('a configuration whose args is not an array is refused', throws(() => readLoupeConfig(tmp)));
  cfg({ configurations: [{ name: 'x', args: [] }, { name: 'x', args: ['-DA=1'] }] });
  check('a configuration name used twice is refused (critic)', throws(() => readLoupeConfig(tmp)));

  // HORDE's condition 1 on the failure path: configure fails, the scratch directory still goes.
  writeFileSync(join(tmp, 'CMakeLists.txt'), 'cmake_minimum_required(VERSION 3.20)\nproject(T NONE)\n');
  cfg({ configurations: [{ name: 'bad', args: ['-G', 'No Such Generator'] }] });
  const n = scratchCount();
  check('a failing configure throws and still deletes its scratch directory', throws(() => buildLayer(tmp)) && scratchCount() === n);

  // ...and on Ctrl-C (critic): a configure that sleeps, interrupted, must leave nothing behind.
  writeFileSync(join(tmp, 'CMakeLists.txt'), 'cmake_minimum_required(VERSION 3.20)\nproject(T NONE)\nexecute_process(COMMAND ${CMAKE_COMMAND} -E sleep 20)\n');
  cfg({ configurations: [{ name: 'slow', args: [] }] });
  const n2 = scratchCount();
  const code = await new Promise<number | null>((resolve) => {
    const child = spawn(process.execPath, ['crawler/cli.ts', 'build', tmp], { stdio: 'ignore', detached: true });
    // Interrupt only once configure is running (its scratch dir exists), so the cleanup handler is armed. A fixed
    // 1.5 s timer raced Node's startup under load and could kill the process before the handler existed (2026-10-17).
    const t0 = Date.now(), sig = () => { try { process.kill(-(child.pid as number), 'SIGINT'); } catch { child.kill('SIGINT'); } };
    const poll = setInterval(() => { if (scratchCount() > n2 || Date.now() - t0 > 15000) { clearInterval(poll); setTimeout(sig, 300); } }, 50);
    child.on('exit', (c) => resolve(c));
  });
  check('Ctrl-C during configure exits 130 and deletes the scratch directory (critic)', code === 130 && scratchCount() === n2);
} finally { rmSync(tmp, { recursive: true, force: true }); }

console.log(failed ? `${failed} failed` : 'all build-layer cases behave');
process.exit(failed ? 1 : 0);
