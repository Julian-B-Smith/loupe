// Tests for the syntax layer (ROADMAP Q-013). Gated in ./verify fast.
// Run: node crawler/syntax.test.ts            (compare with the golden)
//      node crawler/syntax.test.ts --update   (rewrite the golden; a reviewed change only)
// Cases marked "(critic)" hold a finding of the 2026-10-16 review: each was a silent loss or a wrong condition.
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { canonicalDoc } from '../tools/canon.mjs';
import { buildLayer } from './build.ts';
import { syntaxLayer, scanIncludes, census, loadGrammar, grammarManifest } from './syntax.ts';

let failed = 0;
const check = (name: string, cond: boolean) => { console.log(`${cond ? 'pass' : 'FAIL'}  ${name}`); if (!cond) failed++; };
const rejects = async (f: () => Promise<unknown>) => { try { await f(); return false; } catch { return true; } };
const FIXTURE = 'fixtures/cmake-basic', GOLDEN = 'fixtures/cmake-basic.syntax.golden.json';

// ---- pinned grammars (criterion 1)
const man = grammarManifest();
for (const [k, g] of Object.entries(man))
  check(`grammar ${k} matches its pinned sha256`, createHash('sha256').update(readFileSync(join('crawler/grammars', g.file))).digest('hex') === g.sha256);
const tamper = mkdtempSync(join(tmpdir(), 'loupe-grammar-'));
try {
  const b = readFileSync(join('crawler/grammars', man.c.file)); b[b.length - 1] ^= 1; writeFileSync(join(tamper, man.c.file), b);
  check('a grammar whose bytes changed refuses to load', await rejects(() => loadGrammar('c', tamper)));
} finally { rmSync(tamper, { recursive: true, force: true }); }

// ---- the fixture (criteria 2, 3, 5)
const build = buildLayer(FIXTURE).facts;
const a = canonicalDoc(await syntaxLayer(FIXTURE, build)), b = canonicalDoc(await syntaxLayer(FIXTURE, build));
check('two runs give byte-identical facts', a === b);
if (process.argv.includes('--update')) { writeFileSync(GOLDEN, a); console.log(`wrote ${GOLDEN}`); }
check('facts equal the committed golden', a === readFileSync(GOLDEN, 'utf8'));
check('no absolute path anywhere in the facts', !/(^|[\s"=:;,'(<])\/(?!\/)(Users|home|private|var|opt|tmp|Library|usr|Volumes|mnt|root|nix|srv)\b/m.test(a));
const f = JSON.parse(a);
// `one` insists on exactly one match, so a check can never pass because the include went missing (critic).
const one = (from: string, spelled: string) => {
  const x = f.includes.filter((i: any) => i.from === from && i.spelled === spelled);
  if (x.length !== 1) { console.log(`   expected one include of ${spelled} in ${from}, got ${x.length}`); return {}; }
  return x[0];
};
check('a quoted include next to the file is exact', one('src/engine.cpp', 'engine.h').resolution === 'exact' && one('src/engine.cpp', 'engine.h').to === 'file:src/engine.h');
check("an include found through the target's include path is build", one('tests/engine_test.cpp', 'engine.h').resolution === 'build' && one('tests/engine_test.cpp', 'engine.h').to === 'file:src/engine.h');
check('a generated header on an include dir is build, to the build output', one('src/engine.cpp', 'table.h').resolution === 'build' && one('src/engine.cpp', 'table.h').to === 'miss:${build}/generated/table.h');
check('a generated header no include dir reaches is missing (generated), syntactic', one('src/plugin_entry.cpp', 'lut.h').missing === 'generated' && one('src/plugin_entry.cpp', 'lut.h').resolution === 'syntactic');
check('an angle include not in the repo is missing (external), in the miss: namespace', one('src/engine.cpp', 'vector').missing === 'external' && one('src/engine.cpp', 'vector').to === 'miss:vector');
check('an unresolved quoted include is missing (unknown)', one('src/engine.cpp', 'missing_extra.h').missing === 'unknown');
check("a header no target lists inherits its includer's include path, and says through whom", one('src/dsp/filter.h', 'platform.h').resolution === 'build' && JSON.stringify(one('src/dsp/filter.h', 'platform.h').via) === '["src/engine.cpp"]');
check('an include guard is not a condition', one('src/engine.h', 'platform.h').resolution === 'exact' && !('guard' in one('src/engine.h', 'platform.h')));
check('#ifdef becomes defined(X)', one('src/engine.cpp', 'missing_extra.h').guard === 'defined(FIX_EXTRA)');
check('#elif and #else carry the negation of every earlier branch, each part parenthesised',
  one('src/platform.h', 'windows.h').guard === '!(defined(__APPLE__)) && (defined(_WIN32))'
  && one('src/platform.h', 'platform_posix.h').guard === '!(defined(__APPLE__)) && !(defined(_WIN32))');
check('every tracked C/C++ file is read, headers included', f.files.length === 11 && f.files.some((x: any) => x.path === 'src/dsp/filter.h'));
check('every C/C++ file records its parse-error count (0028)', f.files.every((x: any) => Number.isInteger(x.parseErrors)));
check('the census finds no include line unaccounted for in the fixture', f.skipped.length === 0 && f.problems.length === 0);

// ---- the scanner on single files
const S = (src: string) => scanIncludes(src).includes;
const g = (src: string, spelled: string) => S(src).find((i) => i.spelled === spelled)?.guard;
check('an include inside a class body is found (critic)', S('class K {\n#ifdef A\n#include "a.inc"\n#endif\n};\n')[0]?.guard === 'defined(A)');
check('an X-macro include inside an initializer is found (critic)', S('int t[] = {\n#include "t.inc"\n};\n')[0]?.spelled === 't.inc');
check('#import and #include_next are includes (critic)', S('#import <Cocoa/Cocoa.h>\n#include_next <stdio.h>\n').map((i) => i.directive).join() === 'import,include_next');
check('#include<a.h> with no space, and # include with one', S('#include<a.h>\n# include "b.h"\n').map((i) => i.spelled).join() === 'a.h,b.h');
check('|| keeps its precedence under an outer condition (critic)', g('#if C\n#if A || B\n#include "a.h"\n#endif\n#endif\n', 'a.h') === '(C) && (A || B)');
check('__has_include branches keep their conditions (critic)', g('#if __has_include("a.h")\n#include "a.h"\n#else\n#include "b.h"\n#endif\n', 'b.h') === '!(__has_include("a.h"))');
check('extern "C" opened under #ifdef __cplusplus gives no condition after #endif (critic)', g('#ifdef __cplusplus\nextern "C" {\n#endif\n#include "a.h"\n', 'a.h') === '');
check('a computed include is kept as computed, not guessed', S('#define HDR "x.h"\n#include HDR\n')[0]?.computed === true);
check('a continued #if line reads as one condition', g('#if A && \\\n    B\n#include "a.h"\n#endif\n', 'a.h') === 'A && B');
for (const [name, src] of [['#define X_H 1', '#ifndef X_H\n#define X_H 1\n#include "a.h"\n#endif\n'], ['#if !defined(X_H)', '#if !defined(X_H)\n#define X_H\n#include "a.h"\n#endif\n'],
  ['#pragma once before the guard', '#pragma once\n// c\n#ifndef X_H\n#define X_H\n#include "a.h"\n#endif\n']] as const)
  check(`include guard form ${name} is not a condition (critic)`, g(src, 'a.h') === '');
check('an #ifndef with code before it is a real condition, not an include guard', g('int x;\n#ifndef FOO\n#define FOO\n#include "a.h"\n#endif\n', 'a.h') === '!defined(FOO)');
check('includes in comments are not includes', S('// #include "a.h"\n/*\n#include "b.h"\n*/\n').length === 0);
check('the census lists an include line the scanner did not read, with why', JSON.stringify(census('/*\n#include "b.h"\n*/\n', [])) === '[{"line":2,"reason":"inside a comment or literal"}]');
check('!(A) || B stays one part under an outer condition (second review)', g('#if C\n#if !(A) || B\n#include "a.h"\n#endif\n#endif\n', 'a.h') === '(C) && (!(A) || B)');
check('a digit separator is not a char literal (second review)', S("int x = 1'000; /* old:\n#include \"old.h\"\n*/\n").length === 0);
check('a // comment ending in a backslash continues onto the next line (second review)', S('// note \\\n#include "a.h"\n').length === 0);
check('a raw string holds no include and no condition (second review)', S('auto s = R"x(\n#include "fake.h"\n#if X\n)x";\n#include "real.h"\n').map((i) => i.spelled + '|' + i.guard).join() === 'real.h|');
check('%:include is an include (digraph)', S('%:include "a.h"\n')[0]?.spelled === 'a.h');
check('<foo//bar.h> is an angle include, not a comment', S('#include <foo//bar.h>\n')[0]?.spelled === 'foo//bar.h');
check('an #ifndef frame with an #else is not an include guard', g('#ifndef X\n#define X\n#else\n#include "a.h"\n#endif\n', 'a.h') === '!(!defined(X))');
check('a "/*" inside a string does not hide the next include', S('const char* s = "/*";\n#include "a.h"\n')[0]?.spelled === 'a.h');

// ---- small repos: resolution rules that need a tree
async function repo(files: Record<string, string>, facts: any) {
  const t = mkdtempSync(join(tmpdir(), 'loupe-syntax-'));
  for (const [p, txt] of Object.entries(files)) { mkdirSync(join(t, dirname(p)), { recursive: true }); writeFileSync(join(t, p), txt); }
  execFileSync('git', ['-C', t, 'init', '-q']); execFileSync('git', ['-C', t, 'add', '.']);
  try { return { s: await syntaxLayer(t, facts), again: (f2: any) => syntaxLayer(t, f2) }; } finally { rmSync(t, { recursive: true, force: true }); }
}
const tgt = (name: string, groups: { includes: string[]; sources: string[] }[]) => ({ name, sources: groups.flatMap((x) => x.sources).map((path) => ({ path })), compileGroups: groups });
const facts = (cfgs: [string, any[]][]) => ({ configurations: cfgs.map(([name]) => ({ name })), membership: [], perConfiguration: cfgs.map(([name, targets]) => ({ name, targets, customCommands: [] })) });

{ // configurations (0026): an include dir present in one configuration only
  const F = facts([['a', [tgt('t', [{ includes: ['inc'], sources: ['src/m.cpp'] }])]], ['b', [tgt('t', [{ includes: [], sources: ['src/m.cpp'] }])]]]);
  const { s } = await repo({ 'inc/cfg.h': '#pragma once\n', 'src/m.cpp': '#include "cfg.h"\n' }, F);
  const hit = s.includes.find((i) => i.resolution === 'build'), miss = s.includes.find((i) => i.missing);
  check('an include that resolves in one configuration holds there only, and is missing in the other',
    hit?.to === 'file:inc/cfg.h' && JSON.stringify(hit?.configs) === '["a"]' && JSON.stringify(miss?.configs) === '["b"]');
  const R = { ...F, perConfiguration: [...F.perConfiguration].reverse(), configurations: [...F.configurations].reverse() };
  const { s: s2 } = await repo({ 'inc/cfg.h': '#pragma once\n', 'src/m.cpp': '#include "cfg.h"\n' }, R);
  check('input order does not change the facts', canonicalDoc(s2) === canonicalDoc(s));
}
{ // a miss never propagates contexts, even when its name equals a repo file (critic H2)
  const F = facts([['a', [tgt('t', [{ includes: ['inc'], sources: ['src/a/x.cpp'] }])]]]);
  const { s } = await repo({ 'src/a/x.cpp': '#include "config.h"\n', 'config.h': '#include "dep.h"\n', 'inc/dep.h': '' }, F);
  const dep = s.includes.find((i) => i.from === 'config.h');
  check('a missing include does not hand its includer\'s paths to a same-named repo file (critic)', s.includes.find((i) => i.from === 'src/a/x.cpp')?.to === 'miss:config.h' && dep?.missing === 'unknown');
}
{ // two compile groups of one target, different include dirs (critic M2)
  const F = facts([['a', [tgt('t', [{ includes: ['i1'], sources: ['a.cpp'] }, { includes: ['i2'], sources: ['b.cpp'] }])]]]);
  const { s } = await repo({ 'a.cpp': '#include "h.h"\n', 'b.cpp': '#include "h.h"\n', 'h.h': '#include "q.h"\n', 'i2/q.h': '' }, F);
  const q = s.includes.find((i) => i.from === 'h.h' && i.resolution === 'build');
  check('each compile group keeps its own include dirs (critic)', q?.to === 'file:i2/q.h' && JSON.stringify(q?.via) === '["b.cpp"]');
}
{ // absolute and backslash spellings (critic M1, Low)
  const { s } = await repo({ 'src/a/x.cpp': '#include "/x.h"\n#include "..\\\\inc\\\\d.h"\n', 'src/a/x.h': '', 'src/inc/d.h': '' }, facts([['a', []]]));
  const abs = s.includes.find((i) => i.line === 1), bs = s.includes.find((i) => i.line === 2);
  check('an absolute include is never resolved against the repo, nor echoed (critic)', abs?.missing === 'external' && abs?.to === 'miss:${external}/x.h' && !JSON.stringify(s).includes('"/x.h"'));
  check('a backslash include resolves like a slash one', bs?.to === 'file:src/inc/d.h' && bs?.resolution === 'exact');
}
{ // Objective-C++ (Julian, 2026-10-16): read for includes, no grammar
  const { s } = await repo({ 'gui.mm': '#import <Cocoa/Cocoa.h>\n#include "gui.h"\n', 'gui.h': '' }, facts([['a', []]]));
  const mm = s.files.find((x) => x.path === 'gui.mm');
  check('an .mm file is read for #import and #include, and says it was not parsed', !!mm && mm.grammar === null && mm.parseErrors === null
    && s.includes.filter((i) => i.from === 'gui.mm').length === 2);
}
{ // census: an include-looking line inside a raw string is not an include, and the census says so
  const { s } = await repo({ 'r.cpp': 'const char* s = R"(\n#include "hidden.h"\n)";\n' }, facts([['a', []]]));
  check('a raw string\'s include-like line is listed by the census, not taken as an include', s.includes.length === 0 && s.skipped.length === 1 && s.skipped[0].line === 2);
}
// ---- the second review (2026-10-16): termination, propagation, reach
const timed = async (ms: number, f: () => Promise<any>) => { const t0 = Date.now(); const r = await f(); return { r, ok: Date.now() - t0 < ms }; };
{ // an include cycle among uncompiled headers ends
  const F = facts([['a', [tgt('t', [{ includes: [], sources: ['a.cpp'] }])]]]);
  const { r, ok } = await timed(5000, () => repo({ 'a.cpp': '#include "h1.h"\n', 'h1.h': '#pragma once\n#include "h2.h"\n', 'h2.h': '#pragma once\n#include "h1.h"\n' }, F));
  check('an include cycle ends (second review)', ok && r.s.includes.length === 3);
}
{ // #include_next continues after its own dir, and never finds itself (third review)
  const F = facts([['a', [tgt('t', [{ includes: ['compat', 'sys'], sources: ['a.cpp'] }])]]]);
  const { r, ok } = await timed(5000, () => repo({ 'a.cpp': '#include <stdio.h>\n', 'compat/stdio.h': '#include_next <stdio.h>\n', 'sys/stdio.h': '' }, F));
  const nx = r.s.includes.filter((i: any) => i.from === 'compat/stdio.h');
  check('#include_next finds the next header, not itself (third review)', ok && nx.length === 1 && nx[0].to === 'file:sys/stdio.h');
}
{ // two resolutions of one include in different configurations: output order must not depend on input order
  const mk = (rev: boolean) => { const p: [string, any[]][] = [['a', [tgt('t', [{ includes: ['${build}/generated'], sources: ['m.cpp'] }])]], ['b', [tgt('t', [{ includes: [], sources: ['m.cpp'] }])]]];
    const F: any = facts(rev ? [...p].reverse() : p); F.perConfiguration[0].customCommands = [{ outputs: ['${build}/generated/table.h'], byproducts: [] }]; return F; };
  const files = { 'm.cpp': '#include "h.h"\n', 'h.h': '#include "table.h"\n' };
  const A = await repo(files, mk(false)), B = await repo(files, mk(true));
  check('a build and a syntactic resolution of one include sort the same either way (third review)', canonicalDoc(A.s) === canonicalDoc(B.s));
}
{ // a header's configurations are stated, so an include without configs is readable
  const F = facts([['a', [tgt('t', [{ includes: ['inc'], sources: ['m.cpp'] }])]], ['b', [tgt('u', [{ includes: [], sources: ['n.cpp'] }])]]]);
  const { s } = await repo({ 'm.cpp': '#include "h.h"\n', 'n.cpp': '', 'h.h': '#include "q.h"\n', 'inc/q.h': '' }, F);
  check('a header reached in one configuration says so (third review)', JSON.stringify((s.files as any[]).find((x) => x.path === 'h.h')?.configs) === '["a"]');
}
{ // a listed header falls back per configuration (Julian, 2026-10-16)
  const L = (cfg: string) => ({ name: 'L', sources: [{ path: 'L.h' }], compileGroups: [{ includes: ['ib'], sources: ['l.cpp'] }] });
  const F = facts([['a', [L('a'), tgt('M', [{ includes: ['ia'], sources: ['m.cpp'] }])]], ['b', [L('b')]]]);
  const { s } = await repo({ 'm.cpp': '#include "L.h"\n', 'l.cpp': '', 'L.h': '#include "q.h"\n', 'ia/q.h': '', 'ib/q.h': '' }, F);
  const q = s.includes.filter((i) => i.from === 'L.h').map((i) => i.to + '@' + (i.configs || []).join('+')).sort().join();
  check('a listed header reached in one configuration falls back to its target\'s dirs in the other', q === 'file:ia/q.h@a,file:ib/q.h@b');
}
{ // unity build: a compiled source included by another compile is resolved in both (Julian, 2026-10-16)
  const F = facts([['a', [tgt('t', [{ includes: ['iu'], sources: ['u.cpp'] }, { includes: [], sources: ['a.cpp'] }])]]]);
  const { s } = await repo({ 'u.cpp': '#include "a.cpp"\n', 'a.cpp': '#include <q.h>\n', 'iu/q.h': '' }, F);
  const q = s.includes.filter((i) => i.from === 'a.cpp');
  check('a compiled source included by another compile is resolved in that compile too', q.some((i) => i.to === 'file:iu/q.h' && JSON.stringify(i.via) === '["u.cpp"]') && q.some((i) => i.missing === 'external'));
}
{ // a 20-layer diamond stays fast: contexts are per compile, not per path
  const files: Record<string, string> = { 'a.cpp': '#include "d0a.h"\n#include "d0b.h"\n' };
  for (let i = 0; i < 20; i++) for (const x of ['a', 'b']) files[`d${i}${x}.h`] = i < 19 ? `#include "d${i + 1}a.h"\n#include "d${i + 1}b.h"\n` : '';
  const { ok } = await timed(5000, () => repo(files, facts([['a', [tgt('t', [{ includes: [], sources: ['a.cpp'] }])]]])));
  check('a 20-layer include diamond finishes quickly', ok);
}
{ // a header takes only the contexts in which an include resolved to it
  const F = facts([['a', [tgt('t', [{ includes: ['ia', 'qa'], sources: ['m.cpp'] }])]], ['b', [tgt('t', [{ includes: ['ib', 'qb'], sources: ['m.cpp'] }])]]]);
  const { s } = await repo({ 'm.cpp': '#include "h.h"\n', 'ia/h.h': '#include "q.h"\n', 'ib/h.h': '#include "q.h"\n', 'qa/q.h': '', 'qb/q.h': '' }, F);
  const pairs = s.includes.filter((i) => i.from.endsWith('h.h')).map((i) => i.from + '>' + i.to).sort().join();
  check('no false edge between configurations (second review)', pairs === 'ia/h.h>file:qa/q.h,ib/h.h>file:qb/q.h');
}
{ // via names the compiled source two levels up
  const F = facts([['a', [tgt('t', [{ includes: ['inc'], sources: ['a.cpp'] }])]]]);
  const { s } = await repo({ 'a.cpp': '#include "h1.h"\n', 'h1.h': '#include "h2.h"\n', 'h2.h': '#include "q.h"\n', 'inc/q.h': '' }, F);
  check('via names the compiled source whose include path found it (Julian, 2026-10-16)', JSON.stringify(s.includes.find((i) => i.from === 'h2.h')?.via) === '["a.cpp"]');
}
{ // a header a target lists is resolved in another target's compile that includes it
  const F = facts([['a', [{ name: 'A', sources: [{ path: 'h.h' }], compileGroups: [] }, tgt('B', [{ includes: ['ib'], sources: ['b.cpp'] }])]]]);
  const { s } = await repo({ 'b.cpp': '#include "h.h"\n', 'h.h': '#include "q.h"\n', 'ib/q.h': '' }, F);
  check('a listed header is resolved in the compiles that reach it (Julian, 2026-10-16)', s.includes.find((i) => i.from === 'h.h')?.to === 'file:ib/q.h');
}
{ // files an include reaches are read whatever their extension; uppercase extensions too
  const { s } = await repo({ 'a.cpp': '#include "ops.def"\n#include "impl.tcc"\n#include "Up.HPP"\n', 'ops.def': '#include "h1.h"\n', 'impl.tcc': '#include "h2.h"\n', 'Up.HPP': '#include "h3.h"\n', 'B.CPP': '#include "h4.h"\n' }, facts([['a', []]]));
  check('includes inside .def, .tcc, .HPP and .CPP files are found (second review)', ['h1.h', 'h2.h', 'h3.h', 'h4.h'].every((h) => s.includes.some((i) => i.spelled === h)));
}
{ // absolute spellings never reach the output
  const { s } = await repo({ 'a.cpp': '#include "\\usr\\include\\x.h"\n#include "//server/share/y.h"\n#include /opt/sdk/z.h\n' }, facts([['a', []]]));
  const txt = JSON.stringify(s);
  check('backslash, UNC and unquoted absolute spellings are redacted (second review)', !/\/usr\/include|\/\/server|\/opt\/sdk/.test(txt) && txt.includes('${external}/x.h') && txt.includes('${external}/z.h'));
}
{ // a tracked file deleted on disk is a problem, not a crash
  const t = mkdtempSync(join(tmpdir(), 'loupe-syntax-'));
  try {
    writeFileSync(join(t, 'a.cpp'), ''); writeFileSync(join(t, 'gone.h'), '');
    execFileSync('git', ['-C', t, 'init', '-q']); execFileSync('git', ['-C', t, 'add', '.']); rmSync(join(t, 'gone.h'));
    const s = await syntaxLayer(t, facts([['a', []]]));
    check('a tracked file missing on disk is listed as a problem', s.problems.some((p) => p.from === 'gone.h'));
  } finally { rmSync(t, { recursive: true, force: true }); }
}

console.log(failed ? `${failed} failed` : 'all syntax-layer cases behave');
process.exit(failed ? 1 : 0);
