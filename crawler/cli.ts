// Crawler command line (P1a). Today: the build layer (ROADMAP Q-012) and the syntax layer (Q-013).
//   node crawler/cli.ts build <repo> [--out facts.json] [--env environment.json]
//   node crawler/cli.ts syntax <repo> [--out facts.json]      (runs the build layer first: it needs its include paths)
// Writes canonical JSON (tools/canon.mjs) so the same input gives the same bytes.
import { writeFileSync } from 'node:fs';
import { canonicalDoc } from '../tools/canon.mjs';
import { buildLayer } from './build.ts';
import { syntaxLayer } from './syntax.ts';

const [cmd, repo, ...rest] = process.argv.slice(2);
const opt = (k: string) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : null; };
if (!['build', 'syntax'].includes(cmd) || !repo) { console.error('usage: node crawler/cli.ts build|syntax <repo> [--out facts.json] [--env environment.json]'); process.exit(2); }
const { facts, environment } = buildLayer(repo);
const text = canonicalDoc(cmd === 'syntax' ? await syntaxLayer(repo, facts) : facts);
const out = opt('--out'), env = opt('--env');
if (out) writeFileSync(out, text); else process.stdout.write(text);
if (env) writeFileSync(env, canonicalDoc(environment));
