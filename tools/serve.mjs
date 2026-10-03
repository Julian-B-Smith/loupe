#!/usr/bin/env node
// Local testbench server: `npm run view` → http://127.0.0.1:4173/
// Zero dependencies, read-only, bound to loopback. Serves the repo root so the
// viewers' relative paths (../tokens.css, ../../schema/examples/...) resolve
// exactly as they do in the hosted artifact, which mirrors the same layout.
//
// `/` is viewer/index.html wrapped in the same minimal skeleton the artifact
// host adds at publish time: the page is authored WITHOUT doctype/head/body so
// one file serves both places. `/build.json` reports the commit being served.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.env.PORT || process.argv[2] || 4173);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml' };

export const SKELETON = (body) => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body>
${body}</body></html>`;

export function buildInfo(cwd = ROOT) {
  const git = (a) => { try { return execSync(`git ${a}`, { cwd, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return ''; } };
  return { commit: git('rev-parse --short HEAD') || 'unknown', branch: git('rev-parse --abbrev-ref HEAD') || 'unknown',
    dirty: git('status --porcelain') !== '', where: 'local' };
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const send = (code, type, body) => { res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' }); res.end(body); };
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(405, 'text/plain', 'read-only');
  if (url.pathname === '/' || url.pathname === '/index.html')
    return send(200, TYPES['.html'], SKELETON(await readFile(join(ROOT, 'viewer/index.html'), 'utf8')));
  if (url.pathname === '/build.json') return send(200, TYPES['.json'], JSON.stringify(buildInfo()));
  // Path traversal guard: the normalized path must stay inside ROOT, and
  // dot-directories (.git, .harness, .claude, .kit) are never served.
  const rel = normalize(decodeURIComponent(url.pathname)).replace(/^[/\\]+/, '');
  const file = join(ROOT, rel);
  if (!file.startsWith(ROOT) || rel.split(sep).some((p) => p.startsWith('.') || p === 'node_modules')) return send(403, 'text/plain', 'forbidden');
  try {
    const st = await stat(file);
    if (st.isDirectory()) return send(404, 'text/plain', 'not found');
    send(200, TYPES[extname(file)] || 'application/octet-stream', await readFile(file));
  } catch { send(404, 'text/plain', 'not found'); }
});

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  server.listen(PORT, '127.0.0.1', () => {
    const b = buildInfo();
    console.log(`Loupe testbench: http://127.0.0.1:${PORT}/  (${b.branch} @ ${b.commit}${b.dirty ? ', uncommitted changes' : ''})`);
  });
}
