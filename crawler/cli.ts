// Crawler command line (P1a). Today: the build layer only (ROADMAP Q-012).
//   node crawler/cli.ts build <repo> [--out facts.json] [--env environment.json]
// Writes canonical JSON (tools/canon.mjs) so the same input gives the same bytes.
import { writeFileSync } from 'node:fs';
import { canonicalDoc } from '../tools/canon.mjs';
import { buildLayer } from './build.ts';

const [cmd, repo, ...rest] = process.argv.slice(2);
const opt = (k: string) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : null; };
if (cmd !== 'build' || !repo) { console.error('usage: node crawler/cli.ts build <repo> [--out facts.json] [--env environment.json]'); process.exit(2); }
const { facts, environment } = buildLayer(repo);
const text = canonicalDoc(facts);
const out = opt('--out'), env = opt('--env');
if (out) writeFileSync(out, text); else process.stdout.write(text);
if (env) writeFileSync(env, canonicalDoc(environment));
