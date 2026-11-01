// Seeing the code from the map (ROADMAP Q-037, criterion 6): the link building in design/prototype/code.js, which is
// pure, and the local helper's guards in tools/serve.mjs, against a throwaway checkout with planted escapes.
// Run: node tools/code.test.mjs
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, symlinkSync, realpathSync, rmSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { indexSnapshot } from '../design/prototype/snapshot.js';
import { codeSource, githubUrl, rawUrl, edgeSite, codeTarget, codeActions, evidenceMarks, sectionFolder } from '../design/prototype/code.js';
import { createLoupeServer, roots } from './serve.mjs';

let failed = 0;
const check = (name, cond) => { console.log(`${cond ? 'pass' : 'FAIL'}  ${name}`); if (!cond) failed++; };
const load = (dir) => {
  const j = (f) => { try { return JSON.parse(readFileSync(dir + f, 'utf8')); } catch { return null; } };
  return indexSnapshot({ graph: j('graph.json'), overlay: j('overlay.json'), view: j('view.json'), stages: null, diff: null, hashes: {} });
};
const SNAPS = 'design/prototype/snapshots/';

// ---- 1. Where the code is (criterion 2)
const horde = load(SNAPS + 'horde-crawl/'), H = codeSource(horde.graph);
check('a clean crawl of a commit links exactly', H.exact && H.repo === 'github.com/Julian-B-Smith/horde' && H.commit === horde.graph.source.commit);
check('the sample has no commit to link to, and says so', !codeSource(load(SNAPS + 'horde-sample/').graph).exact && /sample/.test(codeSource(load(SNAPS + 'horde-sample/').graph).why));
check('a crawl of a dirty tree has no commit to link to, and says so', !codeSource(load(SNAPS + 'cmake-basic-crawl/').graph).exact && /uncommitted/.test(codeSource(load(SNAPS + 'cmake-basic-crawl/').graph).why));
check('a graph with no source names no repo', codeSource({}).why === 'the crawl names no repo');
check('a commit that is not a hash is not linked (it would steer the links elsewhere)', !codeSource({ source: { repo: 'github.com/a/b', commit: '../../x/y/blob/main', dirty: false } }).exact);
check('a repo not on GitHub is not linked', !codeSource({ source: { repo: 'gitlab.com/a/b', commit: 'abc', dirty: false } }).exact);
const C = H.commit;
check('a file opens on GitHub at the crawled commit', githubUrl(H, 'src/a.cpp') === `https://github.com/Julian-B-Smith/horde/blob/${C}/src/a.cpp`);
check('a line opens at that line', githubUrl(H, 'src/a.cpp', 12) === `https://github.com/Julian-B-Smith/horde/blob/${C}/src/a.cpp#L12`);
check('a folder opens as a tree', githubUrl(H, 'src', null, true) === `https://github.com/Julian-B-Smith/horde/tree/${C}/src`);
check('a # or space in a file name is encoded, the slashes kept', githubUrl(H, 'a b/c#d.h') === `https://github.com/Julian-B-Smith/horde/blob/${C}/a%20b/c%23d.h`);
check('the raw file is read at the commit', rawUrl(H, 'src/a.cpp') === `https://raw.githubusercontent.com/Julian-B-Smith/horde/${C}/src/a.cpp`);
check('no link is built without an exact commit', githubUrl({ exact: false }, 'a') === null && rawUrl({ exact: false }, 'a') === null);

// ---- 2. What each map element points at (criterion 1)
const file = horde.nodeIds.find((id) => horde.nodes[id].kind === 'file'), kinds = (k) => horde.nodeIds.find((id) => horde.nodes[id].kind === k);
check('a file node points at its path', codeTarget(horde, { type: 'node', id: file }).path === horde.nodes[file].path);
for (const k of ['missing', 'external', 'target']) check(`a ${k} node points at nothing, with its reason`, !!codeTarget(horde, { type: 'node', id: kinds(k) }).why);
const site = horde.edges.find((e) => (e.evidence || []).some((x) => x.type === 'site'));
const s0 = site.evidence.find((x) => x.path);
check('an edge points at its first evidence, at its line', JSON.stringify(edgeSite(site)) === JSON.stringify({ path: s0.path, line: s0.line }));
const cfg = horde.edges.find((e) => (e.evidence || []).every((x) => x.type === 'config'));
check('a config edge points at its build file, with no line', codeTarget(horde, { type: 'edge', id: cfg.id }).path === cfg.evidence[0].path && codeTarget(horde, { type: 'edge', id: cfg.id }).line === null);
// A section's folder is computed from its files: the test recomputes it independently from paths. The crawl has no
// view yet (P3), so the sample's sections stand in.
const hs = load(SNAPS + 'horde-sample/'), sec = hs.sections.find((id) => hs.filesIn(id) > 3);
const secPaths = hs.descendants(sec).flatMap((s) => hs.elements[s].members).filter((m) => hs.nodes[m] && hs.nodes[m].kind === 'file').map((m) => hs.nodes[m].path);
const folder = sectionFolder(hs, sec);
// The longest such folder: some file sits in it directly, or its files sit in two or more of its subfolders.
const rest = secPaths.map((p) => p.slice(folder ? folder.length + 1 : 0).split('/'));
check(`a section opens at the folder all its files share, the longest one (${sec} → ${folder || '(root)'})`, secPaths.every((p) => folder === '' || p.startsWith(folder + '/')) &&
  (rest.some((r) => r.length === 1) || new Set(rest.map((r) => r[0])).size > 1));

// ---- 3. The actions, and why one cannot run (criterion 1, 3)
const ft = codeTarget(horde, { type: 'node', id: file }), by = (acts) => Object.fromEntries(acts.map((a) => [a.id, a]));
const hosted = by(codeActions(H, ft, { helper: null, editor: 'vscode' }));
check('hosted: GitHub and the pane run; editor and Finder are disabled with a reason',
  !hosted.github.disabled && !hosted.pane.disabled && hosted.editor.disabled && /npm run view/.test(hosted.editor.why) && hosted.reveal.disabled);
const local = by(codeActions(H, ft, { helper: { ok: true }, editor: 'cursor' }));
check('local, with the checkout: all four run, and the editor setting names the editor', ['github', 'editor', 'reveal', 'pane'].every((k) => !local[k].disabled) && local.editor.label === 'Open in Cursor');
const nock = by(codeActions(H, ft, { helper: { ok: false, why: 'no checkout of horde on this machine' }, editor: 'vscode' }));
check('local, without the checkout: editor and Finder say which checkout is missing', nock.editor.why === 'no checkout of horde on this machine' && nock.reveal.why === nock.editor.why);
const nomac = by(codeActions(H, ft, { helper: { ok: true, actions: false }, editor: 'vscode' }));
check('local, not macOS: the pane runs; editor and Finder say they need macOS', !nomac.pane.disabled && /macOS/.test(nomac.editor.why) && /macOS/.test(nomac.reveal.why));
const sample = codeSource(hs.graph), sa = by(codeActions(sample, ft, { helper: null, editor: 'vscode' }));
check('the sample, hosted: nothing opens, and each action says why', Object.values(sa).every((a) => a.disabled && a.why));
check('the sample, even with a local checkout: nothing opens (its paths need not exist)', codeActions(sample, ft, { helper: { ok: true }, editor: 'vscode' }).every((a) => a.disabled && /sample/.test(a.why)));
const fo = by(codeActions(H, codeTarget(hs, { type: 'element', id: sec }), { helper: { ok: true }, editor: 'vscode' }));
check('a section: GitHub and Finder for its folder; no editor or pane', !fo.github.disabled && fo.github.url.includes('/tree/') && !fo.reveal.disabled && fo.editor.disabled && !fo.pane);
check('a node with no file lists one disabled action with its reason', codeActions(H, codeTarget(horde, { type: 'node', id: kinds('missing') }), { helper: { ok: true } }).every((a) => a.disabled && a.why));

// ---- 4. The pane's marks: a mark selects exactly the edges whose evidence is on that line (criterion 4)
const busy = Object.entries(horde.edges.reduce((m, e) => { (e.evidence || []).forEach((x) => { if (x.line) m[x.path] = (m[x.path] || 0) + 1; }); return m; }, {})).sort((a, b) => b[1] - a[1])[0][0];
const marks = evidenceMarks(horde, busy);
const want = new Set(horde.edges.flatMap((e) => (e.evidence || []).filter((x) => x.path === busy && x.line).map((x) => `${x.line}|${e.id}`)));
const got = new Set(marks.flatMap((m) => m.edges.map((id) => `${m.line}|${id}`)));
check(`every site on ${busy} is one mark, and no mark is anything else (${want.size} line-edge pairs)`, want.size > 3 && want.size === got.size && [...want].every((x) => got.has(x)));
check('marks are in line order', marks.every((m, i) => !i || marks[i - 1].line < m.line));

// ---- 5. The helper's guards (criterion 5), against a throwaway checkout with planted escapes
const base = realpathSync(mkdtempSync(join(tmpdir(), 'loupe-code-'))), repo = join(base, 'horde');
mkdirSync(join(repo, 'src'), { recursive: true }); mkdirSync(join(repo, '.git')); mkdirSync(join(base, 'horde-evil'));
writeFileSync(join(repo, 'src/a.cpp'), '#include "b.h"\nint x;\n'); mkdirSync(join(repo, '.claude')); writeFileSync(join(repo, '.claude/hook.sh'), 'hook'); writeFileSync(join(repo, '.git/config'), 'secret');
writeFileSync(join(base, 'horde-evil/x.h'), 'outside'); writeFileSync(join(base, 'outside.txt'), 'outside');
symlinkSync(join(base, 'outside.txt'), join(repo, 'src/link.h'));
// A sibling whose name extends the checkout's (horde-evil next to horde): only a separator-aware prefix test refuses it.
symlinkSync(join(base, 'horde-evil/x.h'), join(repo, 'src/sib.h'));
const ran = [];
const R = 'github.com/Julian-B-Smith/horde';
const srv = createLoupeServer({ repoRoots: { [R]: repo }, token: 'T0K', run: async (a) => { ran.push(a); }, platform: 'darwin' });
await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
const port = srv.address().port, host = `127.0.0.1:${port}`;
const call = (path, { method = 'GET', headers = {} } = {}) => new Promise((ok) => {
  const r = request({ host: '127.0.0.1', port, path, method, headers: { host, 'x-loupe-token': 'T0K', ...headers } }, (res) => {
    let b = ''; res.on('data', (d) => (b += d)); res.on('end', () => ok({ code: res.statusCode, body: b }));
  });
  // A helper that throws must still answer; a hung request would stall the oracle, so it fails the case instead.
  r.setTimeout(5000, () => { r.destroy(); ok({ code: 'timeout', body: '' }); });
  r.end();
});
const q = (p) => `/helper/file?repo=${encodeURIComponent(R)}&path=${encodeURIComponent(p)}`;
const info = await call('/helper/info', { headers: { 'x-loupe-token': '' } });
check('the page gets its token and its checkouts from /helper/info', info.code === 200 && JSON.parse(info.body).token === 'T0K' && JSON.parse(info.body).repos[R].ok);
check('a checkout that is not a git repo reports no commit (the pane then warns lines may differ)', JSON.parse(info.body).repos[R].head === null);
check('the checkout reports whether it has uncommitted changes', typeof JSON.parse(info.body).repos[R].dirty === 'boolean');
check('a file in the checkout is read', (await call(q('src/a.cpp'))).body.startsWith('#include'));
check('no token: refused', (await call(q('src/a.cpp'), { headers: { 'x-loupe-token': 'nope' } })).code === 403);
check('another site\'s Origin: refused', (await call(q('src/a.cpp'), { headers: { origin: 'https://evil.example' } })).code === 403);
check('a DNS-rebound Host: refused, even for the token', (await call(q('src/a.cpp'), { headers: { host: `evil.example:${port}` } })).code === 403 && (await call('/helper/info', { headers: { host: `evil.example:${port}` } })).code === 403);
check('this page\'s own Origin: allowed', (await call(q('src/a.cpp'), { headers: { origin: `http://${host}` } })).code === 200);
check('a dot-directory the crawler draws (.claude/) is read', (await call(q('.claude/hook.sh'))).body === 'hook');
for (const [what, p] of [['..', '../outside.txt'], ['a sibling with the same prefix', '../horde-evil/x.h'], ['git\'s own store', '.git/config'], ['git\'s store further in', 'src/.git/x'], ['a . segment', './src/a.cpp'], ['an absolute path', join(base, 'outside.txt')], ['a symlink out of the checkout', 'src/link.h'], ['a symlink into a sibling with the same prefix', 'src/sib.h']])
  check(`${what}: refused`, (await call(q(p))).code === 404);
check('an unknown repo: refused', (await call(`/helper/file?repo=github.com%2Fx%2Fy&path=src%2Fa.cpp`)).code === 404);
const rv = await call(`/helper/reveal?repo=${encodeURIComponent(R)}&path=src`, { method: 'POST' });
check('Show in Finder reveals the resolved path', rv.code === 200 && JSON.stringify(ran.at(-1)) === JSON.stringify(['-R', join(repo, 'src')]));
await call(`/helper/editor?repo=${encodeURIComponent(R)}&path=src%2Fa.cpp&line=2&editor=cursor`, { method: 'POST' });
check('Open in editor opens the editor\'s URL at the line', ran.at(-1)[0] === `cursor://file${join(repo, 'src/a.cpp')}:2`);
check('an unknown editor: refused', (await call(`/helper/editor?repo=${encodeURIComponent(R)}&path=src%2Fa.cpp&editor=sh`, { method: 'POST' })).code === 400);
check('an action by GET: refused', (await call(`/helper/reveal?repo=${encodeURIComponent(R)}&path=src`)).code === 405);
const before = ran.length;
check('an action without the token runs nothing', (await call(`/helper/reveal?repo=${encodeURIComponent(R)}&path=src`, { method: 'POST', headers: { 'x-loupe-token': '' } })).code === 403 && ran.length === before);
srv.close();
// `open` failing (no editor installed, Finder busy) answers 500 with the reason, which the page shows as a toast.
const brk = createLoupeServer({ repoRoots: { [R]: repo }, token: 'T0K', run: async () => { throw new Error('no app'); }, platform: 'darwin', log: () => {} });
await new Promise((ok) => brk.listen(0, '127.0.0.1', ok));
const bp = brk.address().port;
const br = await new Promise((ok) => { const r = request({ host: '127.0.0.1', port: bp, path: `/helper/reveal?repo=${encodeURIComponent(R)}&path=src`, method: 'POST', headers: { host: `127.0.0.1:${bp}`, 'x-loupe-token': 'T0K' } }, (res) => { let b = ''; res.on('data', (d) => (b += d)); res.on('end', () => ok({ code: res.statusCode, body: b })); }); r.setTimeout(5000, () => { r.destroy(); ok({ code: 'timeout' }); }); r.end(); });
check('a failing open answers 500 in fixed words, never with its detail or a path, and never hangs', br.code === 500 && !/no app|\//.test(JSON.parse(br.body).error));
brk.close();
const lin = createLoupeServer({ repoRoots: { [R]: repo }, token: 'T0K', run: async (a) => { ran.push(a); }, platform: 'linux' });
await new Promise((ok) => lin.listen(0, '127.0.0.1', ok));
const lp = lin.address().port;
const lr = await new Promise((ok) => { const r = request({ host: '127.0.0.1', port: lp, path: `/helper/reveal?repo=${encodeURIComponent(R)}&path=src`, method: 'POST', headers: { host: `127.0.0.1:${lp}`, 'x-loupe-token': 'T0K' } }, (res) => ok(res.statusCode)); r.end(); });
check('not macOS: Finder and editor refuse, and run nothing', lr === 501 && ran.length === before);
lin.close();
// Roots: the locations file is the gitignored one, HORDE falls back to the verify default; nothing is absolute in code.
check('HORDE\'s checkout defaults to LOUPE_HORDE', roots(base, { LOUPE_HORDE: '/x/horde' })[R] === '/x/horde');
writeFileSync(join(base, '.loupe-local.json'), JSON.stringify({ roots: { 'github.com/a/b': '~/b' } }));
writeFileSync(join(base, '.loupe-local.json'), JSON.stringify({ roots: { 'github.com/a/c': 'rel/c' } }));
check('a relative location is relative to the repo, not the working directory', roots(base, {})['github.com/a/c'] === join(base, 'rel/c'));
writeFileSync(join(base, '.loupe-local.json'), JSON.stringify({ roots: { 'github.com/a/b': '~/b' } }));
check('.loupe-local.json adds checkouts, ~/ expanded here', roots(base, {})['github.com/a/b'].endsWith('/b') && !roots(base, {})['github.com/a/b'].startsWith('~'));
check('.loupe-local.json is gitignored', readFileSync('.gitignore', 'utf8').split('\n').includes('.loupe-local.json'));
rmSync(base, { recursive: true, force: true });

console.log(failed ? `${failed} failed` : 'all code-view cases behave');
process.exit(failed ? 1 : 0);
