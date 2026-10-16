// Crawler command line (P1a). Today: the build layer (ROADMAP Q-012) and the syntax layer (Q-013).
//   node crawler/cli.ts build <repo> [--out facts.json] [--env environment.json]
//   node crawler/cli.ts syntax <repo> [--out facts.json]      (runs the build layer first: it needs its include paths)
//   node crawler/cli.ts crawl <repo> --out <dir>                (graph.json + empty overlay/view + conformance.json, Q-016)
// Writes canonical JSON (tools/canon.mjs) so the same input gives the same bytes.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { canonicalDoc } from '../tools/canon.mjs';
import { buildLayer } from './build.ts';
import { syntaxLayer } from './syntax.ts';
import { emitGraph } from './graph.ts';
import { conformance } from './conformance.ts';

const [cmd, repo, ...rest] = process.argv.slice(2);
const opt = (k: string) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : null; };
if (!['build', 'syntax', 'crawl'].includes(cmd) || !repo || (cmd === 'crawl' && !opt('--out'))) { console.error('usage: node crawler/cli.ts build|syntax <repo> [--out facts.json] [--env environment.json] | crawl <repo> --out <dir>'); process.exit(2); }
const { facts, environment } = buildLayer(repo);
if (cmd === 'crawl') {
  const snap = emitGraph(repo, facts, await syntaxLayer(repo, facts)), dir = opt('--out')!;
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'graph.json'), snap.graph); writeFileSync(join(dir, 'overlay.json'), snap.overlay); writeFileSync(join(dir, 'view.json'), snap.view);
  writeFileSync(join(dir, 'conformance.json'), canonicalDoc(conformance(snap.graph)));
  process.exit(0);
}
const text = canonicalDoc(cmd === 'syntax' ? await syntaxLayer(repo, facts) : facts);
const out = opt('--out'), env = opt('--env');
if (out) writeFileSync(out, text); else process.stdout.write(text);
if (env) writeFileSync(env, canonicalDoc(environment));
