#!/usr/bin/env node
// Local testbench server: `npm run view` → http://127.0.0.1:4173/
// Zero dependencies, bound to loopback. Serves the repo root read-only so the
// viewers' relative paths (../tokens.css, ../../schema/examples/...) resolve
// exactly as they do in the hosted artifact, which mirrors the same layout.
//
// It is also the local helper for seeing the code from the map (ROADMAP Q-037;
// Julian, poll 2026-10-30): /helper/* reads a crawled repo's files from its
// checkout on this machine and asks macOS to show one in Finder or open it in an
// editor. A browser page cannot do either, so these work only here, never from
// the hosted Testbench. Where each repo lives is machine-local: `.loupe-local.json`
// (gitignored; see roots()), so no disk path is ever committed or sent to the page:
// errors reach the page as fixed words; their detail, which names paths, stays in this console.
//
// `/` is viewer/index.html wrapped in the same minimal skeleton the artifact
// host adds at publish time: the page is authored WITHOUT doctype/head/body so
// one file serves both places. `/build.json` reports the commit being served.
import { createServer } from 'node:http';
import { readFile, stat, realpath } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { execSync, execFile } from 'node:child_process';
import { extname, join, normalize, sep, isAbsolute } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.env.PORT || process.argv[2] || 4173);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml' };

// Published paths differ from repo paths in one place: the artifact host reserves
// "prototype" as a path segment, so both viewers publish under neutral names. The
// landing page links the published names; these aliases make them work locally too.
export const ALIASES = { 'design/proto/': 'design/prototype/', 'v1/': 'prototype/' };

export const SKELETON = (body) => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body>
${body}</body></html>`;

const git = (cwd, a) => { try { return execSync(`git ${a}`, { cwd, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return ''; } };
export function buildInfo(cwd = ROOT) {
  const git1 = (a) => git(cwd, a);
  return { commit: git1('rev-parse --short HEAD') || 'unknown', branch: git1('rev-parse --abbrev-ref HEAD') || 'unknown',
    dirty: git1('status --porcelain') !== '', where: 'local' };
}

// Where each crawled repo is checked out on this machine, keyed by graph.json `source.repo`. Read from the gitignored
// `.loupe-local.json` ({"roots": {"github.com/owner/name": "~/path"}}); HORDE falls back to LOUPE_HORDE, then the
// same ~/-relative default `./verify full` uses, so one checkout serves both. `~/` is expanded here, never written.
export function roots(root = ROOT, env = process.env) {
  const out = {}, home = (p) => (p.startsWith('~/') ? join(homedir(), p.slice(2)) : p);
  out['github.com/Julian-B-Smith/horde'] = home(env.LOUPE_HORDE || '~/Documents/Claude/synthetic-worlds/horde');
  try { Object.assign(out, JSON.parse(readFileSync(join(root, '.loupe-local.json'), 'utf8')).roots || {}); } catch {}
  // A relative location is relative to this repo, not to wherever the server was started (critic, low).
  for (const k of Object.keys(out)) out[k] = isAbsolute(home(out[k])) ? home(out[k]) : join(root, out[k]);
  return out;
}

// A repo-relative path, resolved inside its checkout or refused. Refused: absolute paths, `.` or `..` anywhere, `.git`
// (git's own store, which the crawler never draws), and a symlink whose real target leaves the checkout (realpath on
// both sides; a plain prefix test would let `/a/horde-evil` pass for `/a/horde`, hence the trailing separator). Other
// dot-directories are served: the crawler draws .claude/ and .github/ files, and the map must open what it shows
// (Julian, poll 2026-10-31).
export async function resolveIn(base, rel) {
  if (typeof rel !== 'string' || isAbsolute(rel) || rel.includes('\0')) return null;
  const parts = rel.split('/');
  if (parts.some((p) => p === '.' || p === '..' || p === '.git')) return null;
  try {
    const rb = await realpath(base), rf = await realpath(join(rb, ...parts.filter(Boolean)));
    return rf === rb || rf.startsWith(rb + sep) ? rf : null;
  } catch { return null; }
}

// Every helper request must come from this server's own page: Host names this loopback port (a DNS-rebound name
// fails), Origin, when the browser sends one, is this origin (another site's page can send a request, it just
// cannot carry our Origin), and the per-run token travels in a header (a custom header forces a CORS preflight,
// which this server never answers, and the token itself is only readable same-origin from /helper/info).
export function allowed(req, port, token) {
  const hosts = [`127.0.0.1:${port}`, `localhost:${port}`];
  if (!hosts.includes(req.headers.host)) return 'host';
  const o = req.headers.origin;
  if (o && !hosts.some((h) => o === `http://${h}`)) return 'origin';
  if (req.headers['x-loupe-token'] !== token) return 'token';
  return null;
}

// `open` is macOS's: -R reveals in Finder; a vscode:// or cursor:// URL opens the editor at file:line. execFile,
// never a shell: the path is an argument, not a command line.
const macOpen = (args) => new Promise((ok, no) => execFile('open', args, (err) => (err ? no(err) : ok())));
const EDITOR = { vscode: 'vscode', cursor: 'cursor' };

// `opts` exist for tools/code.test.mjs: a fixture checkout, a fixed token, a recorded `run` in place of macOS's open,
// a quiet `log`.
export function createLoupeServer({ root = ROOT, repoRoots = roots(root), token = randomBytes(24).toString('hex'), run = macOpen, platform = process.platform, log = console.error } = {}) {
  let port = 0;
  const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const send = (code, type, body) => { res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' }); res.end(body); };
  // A helper error answers 500: an unanswered request would leave the page's pane at "Reading…" for good.
  if (url.pathname.startsWith('/helper/')) return helper(req, res, url, send).catch((err) => { log('helper:', err); send(500, TYPES['.json'], JSON.stringify({ error: 'the helper failed (see the npm run view console)' })); });
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(405, 'text/plain', 'read-only');
  if (url.pathname === '/' || url.pathname === '/index.html')
    return send(200, TYPES['.html'], SKELETON(await readFile(join(ROOT, 'viewer/index.html'), 'utf8')));
  if (url.pathname === '/build.json') return send(200, TYPES['.json'], JSON.stringify(buildInfo()));
  // Path traversal guard: the normalized path must stay inside ROOT, and
  // dot-directories (.git, .harness, .claude, .kit) are never served.
  let rel = normalize(decodeURIComponent(url.pathname)).replace(/^[/\\]+/, '');
  for (const [pub, src] of Object.entries(ALIASES)) if (rel === pub.slice(0, -1) || rel.startsWith(pub)) { rel = src + rel.slice(pub.length); break; }
  const file = join(ROOT, rel);
  if (!file.startsWith(ROOT) || rel.split(sep).some((p) => p.startsWith('.') || p === 'node_modules')) return send(403, 'text/plain', 'forbidden');
  try {
    const st = await stat(file);
    if (st.isDirectory()) return send(404, 'text/plain', 'not found');
    send(200, TYPES[extname(file)] || 'application/octet-stream', await readFile(file));
  } catch { send(404, 'text/plain', 'not found'); }
  });

  async function helper(req, res, url, send) {
    const json = (code, body) => send(code, TYPES['.json'], JSON.stringify(body));
    // /helper/info hands the page its token: the only helper path without one, and readable by this origin only.
    if (url.pathname === '/helper/info') {
      const bad = allowed({ headers: { ...req.headers, 'x-loupe-token': token } }, port, token);
      if (bad) return json(403, { error: bad });
      const repos = {};
      // `head` is the checkout's commit: when it is not the crawled one, the pane says its lines may not match the map.
      for (const [repo, dir] of Object.entries(repoRoots)) repos[repo] = (await resolveIn(dir, '')) ? { ok: true, head: git(dir, 'rev-parse HEAD') || null, dirty: git(dir, 'status --porcelain') !== '' } : { ok: false, why: `no checkout of ${repo.split('/').pop()} on this machine (see .loupe-local.json)` };
      return json(200, { token, repos, actions: platform === 'darwin' });
    }
    const bad = allowed(req, port, token);
    if (bad) return json(403, { error: bad });
    const repo = url.searchParams.get('repo'), rel = url.searchParams.get('path') || '';
    const dir = repoRoots[repo];
    if (!dir) return json(404, { error: 'unknown repo' });
    const file = await resolveIn(dir, rel);
    if (!file) return json(404, { error: 'not in the checkout' });
    if (url.pathname === '/helper/file' && req.method === 'GET') {
      const st = await stat(file);
      if (!st.isFile()) return json(400, { error: 'not a file' });
      // A crawled file the size of a book is still text; the cap keeps a stray binary from freezing the pane.
      if (st.size > 2_000_000) return json(413, { error: 'over 2 MB' });
      return send(200, 'text/plain; charset=utf-8', await readFile(file));
    }
    if (req.method !== 'POST') return json(405, { error: 'POST' });
    if (platform !== 'darwin') return json(501, { error: 'Finder and editor links need macOS' });
    try {
      if (url.pathname === '/helper/reveal') { await run(['-R', file]); return json(200, { ok: true }); }
      if (url.pathname === '/helper/editor') {
        const ed = EDITOR[url.searchParams.get('editor')], line = Number(url.searchParams.get('line')) || 0;
        if (!ed) return json(400, { error: 'unknown editor' });
        // vscode://file/<abs path>[:line]; Cursor takes the same form. Each segment encoded, the slashes kept.
        await run([`${ed}://file${file.split(sep).map(encodeURIComponent).join('/')}${line > 0 ? ':' + Math.floor(line) : ''}`]);
        return json(200, { ok: true });
      }
    } catch (err) { log('helper:', err); return json(500, { error: 'macOS could not open it (see the npm run view console)' }); }
    return json(404, { error: 'no such action' });
  }

  server.on('listening', () => { port = server.address().port; });
  return server;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const server = createLoupeServer();
  server.listen(PORT, '127.0.0.1', () => {
    const b = buildInfo();
    console.log(`Loupe testbench: http://127.0.0.1:${PORT}/  (${b.branch} @ ${b.commit}${b.dirty ? ', uncommitted changes' : ''})`);
  });
}
