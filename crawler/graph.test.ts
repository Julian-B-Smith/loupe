// Tests for graph.json emission and build-target conformance (ROADMAP Q-016). Gated in ./verify fast.
// Run: node crawler/graph.test.ts            (compare with the goldens)
//      node crawler/graph.test.ts --update   (rewrite the goldens; a reviewed change only)
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { canonicalDoc, canonicalGraph } from '../tools/canon.mjs';
import { check as loupeCheck } from '../tools/loupe-check.mjs';
import { buildLayer } from './build.ts';
import { syntaxLayer } from './syntax.ts';
import { emitGraph, repoNameOf } from './graph.ts';
import { conformance } from './conformance.ts';
import { langLayer } from './langs.ts';
import { indexSnapshot } from '../design/prototype/snapshot.js';
import { layout } from '../design/prototype/layout.js';

let failed = 0;
const check = (name: string, cond: boolean) => { console.log(`${cond ? 'pass' : 'FAIL'}  ${name}`); if (!cond) failed++; };
const FIXTURE = 'fixtures/cmake-basic', GOLDEN = 'fixtures/cmake-basic.graph.golden.json', CGOLDEN = 'fixtures/cmake-basic.conformance.golden.json';
const SCHEMA = 'schema';
// The source block names the commit the fixture was crawled at, which moves with every commit of this repo; the
// golden compares everything else.
const unsourced = (g: string) => { const x = JSON.parse(g); x.source = { repo: 'pinned-by-test', commit: 'pinned-by-test', commitTime: 'pinned-by-test', dirty: false }; return canonicalGraph(x); };
const write = (dir: string, s: { graph: string; overlay: string; view: string }) => { mkdirSync(dir, { recursive: true }); for (const k of ['graph', 'overlay', 'view'] as const) writeFileSync(join(dir, `${k}.json`), s[k]); };

const build = buildLayer(FIXTURE).facts, syntax = await syntaxLayer(FIXTURE, build);
const s1 = emitGraph(FIXTURE, build, syntax), s2 = emitGraph(FIXTURE, build, syntax);
check('two runs give byte-identical snapshots', JSON.stringify(s1) === JSON.stringify(s2));
const g = unsourced(s1.graph), conf = canonicalDoc(conformance(s1.graph));
if (process.argv.includes('--update')) { writeFileSync(GOLDEN, g); writeFileSync(CGOLDEN, canonicalDoc({ ...JSON.parse(conf), graph: { hash: 'pinned-by-test' } })); console.log(`wrote ${GOLDEN}, ${CGOLDEN}`); }
check('the graph equals the committed golden (source block aside)', g === readFileSync(GOLDEN, 'utf8'));
check('conformance equals the committed golden', canonicalDoc({ ...JSON.parse(conf), graph: { hash: 'pinned-by-test' } }) === readFileSync(CGOLDEN, 'utf8'));
check('no absolute path anywhere in the snapshot', !/(^|[\s"=:;,'(<])\/(?!\/)(Users|home|private|var|opt|tmp|Library|usr|Volumes|mnt|root|nix|srv)\b/m.test(s1.graph));

const tmp = mkdtempSync(join(tmpdir(), 'loupe-graph-'));
try {
  write(join(tmp, 'snap'), s1);
  const r = loupeCheck(join(tmp, 'snap'), { schemaDir: SCHEMA });
  check(`loupe-check passes on the emitted snapshot, with schema validation (${r.errors.slice(0, 2).join(' | ') || 'clean'})`, r.errors.length === 0 && !r.notes.some((n: string) => /skipped/.test(n)));
} finally { rmSync(tmp, { recursive: true, force: true }); }

// ---- the one rule: every fact the layers produced lands in the graph
const G = JSON.parse(s1.graph);
const sites = G.edges.filter((e: any) => e.kind === 'include').flatMap((e: any) => e.evidence.map((x: any) => `${x.path}:${x.line}>${e.dst}`)).sort();
const facts = syntax.includes.map((i: any) => `${i.from}:${i.line}>${i.to.startsWith('file:') ? i.to : 'miss:' + i.to.slice(5)}`).sort();
check('every include fact is a site on an include edge, and nothing else is', JSON.stringify(sites) === JSON.stringify(facts));
check('every membership is a builds edge', build.membership.every((m: any) => G.edges.some((e: any) => e.kind === 'builds' && e.src === 'target:' + m.target && (e.dst === 'file:' + m.source || e.dst === 'miss:' + m.source))));
check('every target dependency is a depends edge', build.perConfiguration.every((pc: any) => pc.targets.every((t: any) => t.dependencies.every((d: string) => G.edges.some((e: any) => e.kind === 'depends' && e.src === 'target:' + t.name && e.dst === 'target:' + d)))));
check('an unclaimed source is listed as not evaluated', G.crawler.notEvaluated.some((n: any) => n.what === 'src/win_only.cpp'));
check('a source in one configuration only is a builds edge with that configuration', JSON.stringify(G.edges.find((e: any) => e.kind === 'builds' && e.dst === 'file:src/extra.cpp')?.configs) === '["extra"]');
check('build evidence cites the file that defines the target', G.edges.find((e: any) => e.kind === 'builds' && e.src === 'target:lut')?.evidence[0].path === 'lib/CMakeLists.txt');
check('one fact seen in two configurations is one piece of evidence', G.edges.filter((e: any) => e.kind === 'generates').every((e: any) => e.count === 1));
check('via reaches the graph (0.3.1)', JSON.stringify(G.edges.find((e: any) => e.src === 'file:src/dsp/filter.h')?.evidence[0].via) === '["src/engine.cpp"]');
{ // the viewer can draw a real crawl: every node placed in both views
  const d = indexSnapshot({ graph: G, overlay: JSON.parse(s1.overlay), view: JSON.parse(s1.view), stages: null, diff: null, hashes: {} });
  const placed = (P: any) => d.nodeIds.every((id: string) => P.nodes[id] || P.proxy[id]);
  // Both views: a fresh crawl has an empty view, so in the design view every node is loose (Q-017).
  check('the viewer lays out the crawled graph, every node placed, in both views', placed(layout(d, { view: 'design', settings: {} })) && placed(layout(d, { view: 'flow', settings: {} })));
}
// The testbench copy of this crawl must stay what the crawler makes, or the testbench shows a stale crawler (critic).
check('the testbench snapshot cmake-basic-crawl equals the crawler\'s output (regenerate: node crawler/cli.ts crawl fixtures/cmake-basic --out design/prototype/snapshots/cmake-basic-crawl)',
  unsourced(readFileSync('design/prototype/snapshots/cmake-basic-crawl/graph.json', 'utf8')) === g);
// ---- Python, JS, HTML, shell (Q-023): one check per rule on the fixture
{
  const has = (kind: string, src: string, dst: string, res?: string) => G.edges.some((e: any) => e.kind === kind && e.src === 'file:' + src && e.dst === dst && (!res || e.evidence.every((x: any) => x.resolution === res)));
  check('Python: a sibling module is an exact import', has('import', 'tools/gen_table.py', 'file:tools/common.py', 'exact'));
  check('Python: `from pkg import mod` points at the module, not __init__', has('import', 'tools/gen_table.py', 'file:tools/pkg/fmt.py'));
  check('Python: a relative import inside a package, and a missing one', has('import', 'tools/pkg/fmt.py', 'file:tools/pkg/util.py', 'exact') && has('import', 'tools/pkg/fmt.py', 'miss:tools/pkg/missing.py', 'syntactic'));
  check('Python: the standard library and third-party packages are external', has('import', 'tools/gen_table.py', 'ext:python-std') && has('import', 'tools/gen_table.py', 'ext:py:numpy'));
  check('Python: a data path in a string is a data edge, found from the repo root', has('data', 'tools/gen_table.py', 'file:lib/lut.csv', 'search'));
  check('JS: relative import, dynamic import, node: and npm packages', has('import', 'web/app.js', 'file:web/util.js', 'exact') && has('import', 'web/app.js', 'file:web/lazy.js') && has('import', 'web/app.js', 'ext:node') && has('import', 'web/app.js', 'ext:npm:lodash'));
  check('JS: an import specifier is not also a string-literal reference', !has('reference', 'web/app.js', 'file:web/util.js') && !has('reference', 'web/app.js', 'file:web/lazy.js'));
  check('JS: a data file read by a relative path', has('data', 'web/app.js', 'file:data/presets.json', 'exact'));
  check('HTML: script src, inline module import, CDN host, missing stylesheet', has('reference', 'web/index.html', 'file:web/app.js') && has('import', 'web/index.html', 'file:web/util.js')
    && has('reference', 'web/index.html', 'ext:web:cdn.example.com') && has('reference', 'web/index.html', 'miss:web/style.css'));
  check('shell: source, an interpreter call, a read, and a file written with >', has('import', 'tools/run.sh', 'file:tools/env.sh') && has('reference', 'tools/run.sh', 'file:tools/gen_table.py')
    && has('reference', 'tools/run.sh', 'file:tools/presets.in') && has('generates', 'tools/run.sh', 'file:data/presets.json'));
}
// ---- precision (critic, 2026-10-17; Julian: imports from code only, a missed edge over a made-up one)
{
  const lang = (files: Record<string, string>) => {
    const t = mkdtempSync(join(tmpdir(), 'loupe-langs-'));
    try { for (const [p, txt] of Object.entries(files)) { mkdirSync(join(t, dirname(p)), { recursive: true }); writeFileSync(join(t, p), txt); }
      return langLayer(t, Object.keys(files).sort()); } finally { rmSync(t, { recursive: true, force: true }); }
  };
  const to = (r: any) => r.edges.map((e: any) => e.kind + ' ' + e.to);
  const junk = lang({ 'a.js': 'x = "x-import" && (el.getAttribute("y");\nconst l = [\'export\', \'lib-export\', libExport, \'z\'];\nconst s = "import { x } from \'y\';";\n/* import a from \'./gone.js\' */\nconst t = `import z from \'./gone3.js\'`;\nfoo.import(\'./x.js\');\n',
    'p.html': '<p id="b-export" class="c">x</p>\n<!-- <script src="gone.js"></script> -->\n' });
  check(`JS/HTML: text in strings, comments, templates and attributes is never an import (critic C1/H1)${junk.edges.length ? ' — got ' + JSON.stringify(to(junk)) : ''}`, junk.edges.length === 0);
  const py = lang({ 'm.py': '"""\nimport secretmod\n"""\nx = \'import other\'\n# import commented\nimport os; import json\nfrom pkg import (a,\n    b)\n', 'pkg/__init__.py': '', 'pkg/a.py': '', 'pkg/b.py': '' });
  check(`Python: docstrings, strings and comments are not imports; ';' and parenthesised forms are (critic H3/M4) — ${JSON.stringify(to(py).sort())}`, JSON.stringify(to(py).sort()) === JSON.stringify(['import ext:python-std', 'import file:pkg/a.py', 'import file:pkg/b.py'].sort()));
  const rw = lang({ 'w.py': 'open("data/out.json", "w").write(open("data/in.json").read())\nopen("assets/in.json")\n', 'data/out.json': '', 'data/in.json': '', 'assets/in.json': '',
    'w.js': 'fs.readFileSync("data/in.json"); // writeFileSync later\nfs.writeFileSync("data/out.json", x);\n', 'w.sh': 'cat "data/in.json" > /dev/null\ncat data/in.json > data/out.json\n' });
  const gen = rw.edges.filter((e: any) => e.kind === 'generates').map((e: any) => e.from + '>' + e.to.slice(5)).sort();
  check(`a write is the literal that is written, not the line (critic H2) — ${JSON.stringify(gen)}`, JSON.stringify(gen) === JSON.stringify(['w.js>data/out.json', 'w.py>data/out.json', 'w.sh>data/out.json']));
  const shadow = lang({ 'a.py': 'import random\n', 'lib/random.py': '' });
  check('the standard library wins over a stray same-named repo file (critic M2)', JSON.stringify(to(shadow)) === '["import ext:python-std"]');
  check('Node built-ins via require are ext:node (critic M2)', JSON.stringify(to(lang({ 'a.js': "const fs = require('fs');\n" }))) === '["import ext:node"]');
  const comp = lang({ 'a.js': 'import(name);\nrequire(mod + ".js");\n', 'b.py': 'm = __import__(name)\n', 'c.sh': 'source $DIR/env.sh\n' });
  check(`computed imports are listed, not dropped (critic M3)${comp.computed.length !== 4 ? ' — got ' + JSON.stringify(comp.computed.map((c: any) => c.text)) : ''}`, comp.computed.length === 4 && comp.edges.length === 0);
  const lex = lang({ 'a.js': 'const r = /"/g;\nimport x from \'./b.js\';\nconst t = `pre ${require(\'./c.js\')} post`;\nconst u = `${`nested`} import y from \'./no.js\'`;\n', 'b.js': '', 'c.js': '' });
  check(`JS lexer: a regex literal with a quote does not hide later code; code inside \${} is code; template text is not (critic, HORDE morph_order) — ${JSON.stringify(to(lex))}`, JSON.stringify(to(lex).sort()) === JSON.stringify(['import file:b.js', 'import file:c.js']));
  check('a bare file name resolves only next to the file, never from the repo root', lang({ 'tools/x.js': 'join(outDir, "index.html");\n', 'index.html': '' }).edges.length === 0);
}
const C = JSON.parse(conf);
check('an include holds where its file is compiled: extra.cpp is compiled in extra only (Julian, 2026-10-16)', JSON.stringify(G.edges.find((e: any) => e.src === 'file:src/extra.cpp' && e.kind === 'include')?.configs) === '["extra"]'
  && JSON.stringify(G.edges.find((e: any) => e.src === 'file:src/extra.cpp' && e.kind === 'include')?.evidence[0].configs) === '["extra"]');
check('a file in no compile keeps its includes, listed as textual only', G.edges.some((e: any) => e.src === 'file:src/win_only.cpp') && G.crawler.notEvaluated.some((n: any) => n.what === 'src/win_only.cpp' && /textual only/.test(n.reason)));
check('every custom command lands: an edge, or listed (the POST_BUILD step with no output)', build.perConfiguration[0].customCommands.every((c: any) =>
  G.edges.some((e: any) => e.kind === 'generates' && e.evidence.some((x: any) => x.path === c.file && x.key === `add_custom_command line ${c.line}`)) || G.crawler.notEvaluated.some((n: any) => n.what === `${c.file}:${c.line}`)));
check('conformance: plugin uses lut without declaring it', C.findings.length === 1 && C.findings[0].kind === 'used-not-declared' && C.findings[0].from === 'target:plugin' && C.findings[0].to === 'target:lut' && C.findings[0].weakestResolution === 'syntactic');
check('conformance counts what it could not judge, per configuration', Object.keys(C.notJudged).join() === 'extra,release' && Number.isInteger(C.notJudged.release.unownedFiles));
check('a finding says which rule tied the file to its owner', JSON.stringify(C.findings[0].tiedBy) === '["listed"]');

// ---- small repos
async function crawlTree(files: Record<string, string | Buffer>, buildFacts: any) {
  const t = mkdtempSync(join(tmpdir(), 'loupe-graph-'));
  try {
    for (const [p, txt] of Object.entries(files)) { mkdirSync(join(t, dirname(p)), { recursive: true }); writeFileSync(join(t, p), txt); }
    commitAll(t);
    const snap = emitGraph(t, buildFacts, await syntaxLayer(t, buildFacts));
    // Every small graph must pass the checker too, not only the fixture's (critic).
    const d = join(t, '.snap'); write(d, snap);
    const r = loupeCheck(d, { schemaDir: SCHEMA });
    if (r.errors.length) { console.log('   loupe-check:', r.errors.slice(0, 3).join(' | ')); failed++; }
    return JSON.parse(snap.graph);
  } finally { rmSync(t, { recursive: true, force: true }); }
}
// A fixed identity and date: the test must not depend on this machine's git config or the clock.
const GIT_ENV = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.invalid', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.invalid',
  GIT_AUTHOR_DATE: '2026-01-01T00:00:00Z', GIT_COMMITTER_DATE: '2026-01-01T00:00:00Z' };
function commitAll(t: string) {
  execFileSync('git', ['-C', t, 'init', '-q'], { env: GIT_ENV }); execFileSync('git', ['-C', t, 'add', '.'], { env: GIT_ENV });
  execFileSync('git', ['-C', t, 'commit', '-q', '--no-gpg-sign', '-m', 'test'], { env: GIT_ENV });
}
const noBuild = { configurations: [{ name: 'default', args: [] }], declared: false, membership: [], unclaimedSources: [], perConfiguration: [{ name: 'default', targets: [], customCommands: [] }] };
{
  const g2 = await crawlTree({ 'a.cpp': '#define H "x.h"\n#include H\n', 'docs/n.md': '# n\n', 'img.png': Buffer.from([0x89, 0x50, 0, 0, 1]) }, noBuild);
  const inv = g2.crawler.inventory;
  check('every tracked text file is a node; binary files are counted, not dropped', g2.nodes.some((n: any) => n.id === 'file:docs/n.md') && !g2.nodes.some((n: any) => n.id === 'file:img.png')
    && inv.files === 3 && inv.crawled === 2 && inv.excluded[0].reason === 'binary' && inv.excluded[0].byExt['.png'] === 1);
  check('a computed include is listed as not evaluated', g2.crawler.notEvaluated.some((n: any) => n.what === 'a.cpp:2' && /computed include/.test(n.reason)));
  check('no configurations declared is said, not assumed', g2.crawler.notEvaluated.some((n: any) => n.what === 'configurations'));
}
{ // declared-not-seen: a dependency nothing includes
  const T = (name: string, src: string, deps: string[] = []) => ({ name, type: 'STATIC_LIBRARY', definedIn: { file: 'CMakeLists.txt', line: 1 }, dependencies: deps, sources: [{ path: src }], compileGroups: [{ includes: [], sources: [src] }] });
  const bf = { configurations: [{ name: 'default', args: [] }], declared: true, unclaimedSources: [],
    membership: [{ source: 'a.cpp', target: 'A', generated: false, configs: ['default'] }, { source: 'b.cpp', target: 'B', generated: false, configs: ['default'] }],
    perConfiguration: [{ name: 'default', targets: [T('A', 'a.cpp', ['B']), T('B', 'b.cpp')], customCommands: [] }] };
  const g3 = await crawlTree({ 'a.cpp': 'int a;\n', 'b.cpp': 'int b;\n' }, bf);
  const c3 = conformance(canonicalGraph(g3));
  check('conformance: a declared dependency no include supports is listed as declared-not-seen', c3.findings.length === 1 && c3.findings[0].kind === 'declared-not-seen' && c3.findings[0].from === 'target:A');
}

{ // generated-by-several (Q-021): one generated output listed by two targets with no dependency between them
  const T = (name: string, deps: string[] = []) => ({ name, type: 'STATIC_LIBRARY', definedIn: { file: 'CMakeLists.txt', line: 1 }, dependencies: deps,
    sources: [{ path: '${build}/gen/bank.h' }], compileGroups: [] });
  const mk = (deps: string[]) => ({ configurations: [{ name: 'default', args: [] }], declared: true, unclaimedSources: [],
    membership: ['A', 'B'].map((t) => ({ source: '${build}/gen/bank.h', target: t, generated: true, configs: ['default'] })),
    perConfiguration: [{ name: 'default', targets: [T('A'), T('B', deps)], customCommands: [{ file: 'CMakeLists.txt', line: 2, target: null, stage: null, outputs: ['${build}/gen/bank.h'], byproducts: [], depends: ['gen.py'], commands: [] }] }] });
  const several = async (deps: string[]) => conformance(canonicalGraph(await crawlTree({ 'gen.py': 'print(1)\n' }, mk(deps)))).findings.filter((f: any) => f.kind === 'generated-by-several');
  const un = await several([]);
  check('one generated output owned by two unordered targets is a finding, naming both (Q-021)', un.length === 1 && un[0].from === 'miss:${build}/gen/bank.h' && JSON.stringify(un[0].owners) === '["target:A","target:B"]' && un[0].evidence.length === 2);
  check('the same output owned by two targets that are ordered (B depends on A) is not', (await several(['A'])).length === 0);
}
{ // Q-020 (Julian, 2026-10-17): uses by compile reach, owners by listing then unique directory, seen by interface
  const T = (name: string, srcs: string[], deps: string[] = []) => ({ name, type: 'EXECUTABLE', definedIn: { file: 'CMakeLists.txt', line: 1 }, dependencies: deps,
    sources: srcs.map((path) => ({ path })), compileGroups: [{ includes: [], sources: srcs.filter((x) => /\.cpp$/.test(x)) }] });
  const mk = (deps: string[]) => ({ configurations: [{ name: 'default', args: [] }], declared: true, unclaimedSources: [],
    membership: [['lib/a.cpp', 'LIB'], ['app/m.cpp', 'APP']].map(([source, target]) => ({ source, target, generated: false, configs: ['default'] })),
    perConfiguration: [{ name: 'default', targets: [T('LIB', ['lib/a.cpp']), T('APP', ['app/m.cpp'], deps)], customCommands: [] }] });
  // lib/api.h is listed by no target: only its directory ties it to LIB. app/m.cpp reaches it through app/glue.h.
  const files = { 'lib/a.cpp': '#include "api.h"\n', 'lib/api.h': '', 'app/m.cpp': '#include "glue.h"\n', 'app/glue.h': '#include "../lib/api.h"\n' };
  const und = conformance(canonicalGraph(await crawlTree(files, mk([])))).findings;
  check('a header listed by no target is tied by directory, through a transitive include (Q-020)', und.length === 1 && und[0].kind === 'used-not-declared' && und[0].from === 'target:APP' && und[0].to === 'target:LIB' && JSON.stringify(und[0].tiedBy) === '["directory"]');
  const ok = conformance(canonicalGraph(await crawlTree(files, mk(['LIB'])))).findings;
  check('with the dependency declared, the same use is no finding, and the dependency counts as seen (interface overlap)', ok.length === 0);
}
{ // on HORDE at 1e6aae79: the Q-020 rule turns 94 noise findings into one of each kind, plus B501
  const H = conformance(readFileSync('design/prototype/snapshots/horde-crawl/graph.json', 'utf8'));
  check('on the HORDE crawl: one used-not-declared, one declared-not-seen, one generated-by-several (Q-020)',
    H.findings.map((f: any) => f.kind).join() === 'declared-not-seen,generated-by-several,used-not-declared'
    && H.notJudged.release.dependencies === 26 && H.notJudged.release.unownedFiles === 42);
}
{ // on HORDE at 1e6aae79 it names factory_bank.h, the bug HORDE fixed as B501, and nothing else
  const h = conformance(readFileSync('design/prototype/snapshots/horde-crawl/graph.json', 'utf8')).findings.filter((f: any) => f.kind === 'generated-by-several');
  check('on the HORDE crawl, generated-by-several names exactly factory_bank.h (horde B501)', h.length === 1 && h[0].from === 'miss:${build}/generated/factory_bank.h'
    && JSON.stringify(h[0].owners) === '["target:HYPERSAW-impl","target:presetstore_check"]');
}
{ // custom commands: a TARGET-form command's byproduct, a name: DEPENDS on another output, an unknown name:
  const bf = { configurations: [{ name: 'default', args: [] }], declared: true, unclaimedSources: [], membership: [],
    perConfiguration: [{ name: 'default', targets: [{ name: 'A', type: 'UTILITY', definedIn: null, dependencies: [], sources: [], compileGroups: [] }], customCommands: [
      { file: 'CMakeLists.txt', line: 1, target: null, stage: null, outputs: ['${build}/a.h'], byproducts: [], depends: ['gen.py'], commands: [] },
      { file: 'CMakeLists.txt', line: 2, target: null, stage: null, outputs: ['${build}/b.h'], byproducts: [], depends: ['name:a.h', 'name:nowhere'], commands: [] },
      { file: 'CMakeLists.txt', line: 3, target: 'A', stage: 'POST_BUILD', outputs: [], byproducts: ['${build}/A.stamp'], depends: [], commands: [] }] }] };
  const g4 = await crawlTree({ 'gen.py': 'print(1)\n' }, bf);
  const gen = (src: string, dst: string) => g4.edges.some((e: any) => e.kind === 'generates' && e.src === src && e.dst === dst);
  check('a name: DEPENDS on another command\'s output is a generates edge from it (critic)', gen('miss:${build}/a.h', 'miss:${build}/b.h'));
  check('an unknown name: DEPENDS is listed, not dropped (critic)', g4.crawler.notEvaluated.some((n: any) => n.what === 'CMakeLists.txt:2' && /nowhere/.test(n.reason)));
  check('a TARGET-form command\'s byproduct is generated by its target (critic)', gen('target:A', 'miss:${build}/A.stamp'));
}
{ // submodules and symlinks are counted, never read; a repo with no commit is refused
  const t = mkdtempSync(join(tmpdir(), 'loupe-graph-'));
  try {
    writeFileSync(join(t, 'a.cpp'), 'int a;\n'); symlinkSync('/etc/hosts', join(t, 'link.h'));
    commitAll(t);
    execFileSync('git', ['-C', t, 'update-index', '--add', '--cacheinfo', `160000,${'a'.repeat(40)},vendor/sub`], { env: GIT_ENV });
    const g5 = JSON.parse(emitGraph(t, noBuild, await syntaxLayer(t, noBuild)).graph);
    const ex = Object.fromEntries(g5.crawler.inventory.excluded.map((x: any) => [x.reason, x.count]));
    check('a symlink and a submodule are counted in the inventory, not read (critic)', ex.symlink === 1 && ex.submodule === 1 && !g5.nodes.some((n: any) => n.path === 'link.h'));
  } finally { rmSync(t, { recursive: true, force: true }); }
  const t2 = mkdtempSync(join(tmpdir(), 'loupe-graph-'));
  try { execFileSync('git', ['-C', t2, 'init', '-q']); check('a repo with no commit is refused, not given a made-up commit (critic)', (() => { try { emitGraph(t2, noBuild, { includes: [], computed: [], skipped: [], problems: [], files: [] }); return false; } catch { return true; } })()); }
  finally { rmSync(t2, { recursive: true, force: true }); }
}
{ // the repo name never carries a local path or a credential
  // Machine-style paths are the inputs under test; assembled here so this file holds none literally (leak gate).
  const WIN_HOME = 'C:/' + 'Users/', NIX_HOME = '/' + 'home/';
  const cases: [string, string][] = [['https://github.com/o/r.git', 'github.com/o/r'], ['git@github.com:o/r.git', 'github.com/o/r'], ['ssh://git@host.example.com:22/o/r', 'host.example.com/o/r'],
    ['https://u:p@ss@host.com/o/r', 'host.com/o/r'], ['../sibling/repo', 'local'], ['~/code/repo', 'local'], [WIN_HOME + 'x/repo', 'local'], ['nas:' + NIX_HOME + 'x/repo.git', 'local'], ['/abs/repo', 'local'], ['file:///abs/repo', 'local']];
  const bad = cases.filter(([u, want]) => repoNameOf(u) !== want);
  check(`the repo name comes only from a hosted remote, without credentials (critic)${bad.length ? ': ' + bad.map(([u]) => u + '→' + repoNameOf(u)).join(', ') : ''}`, bad.length === 0);
}

console.log(failed ? `${failed} failed` : 'all graph cases behave');
process.exit(failed ? 1 : 0);
