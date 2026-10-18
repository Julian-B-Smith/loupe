// The P1a gates on HORDE (ROADMAP Q-025), from one command. Deterministic; runs no HORDE code except its CMake
// configure (inside the crawler, on HORDE's terms) and reads its leak-check name list as data.
//   node tools/horde-gate.mjs --horde <HORDE checkout> --commit <sha> --out <dir> [--dialect dsp-plugin] [--config <proposed config.json>]
// --dialect is passed to the crawl (HORDE's committed config does not name one yet; once it does, the config wins).
//
// HORDE's terms (response-002/003, ROADMAP Q-018): a local clone of a named commit in Loupe's scratch, its declared
// configuration, the clone deleted when the run ends, HORDE's leak check before anything leaves the scratch. The three
// submodules are filled at their pinned commits from HORDE's own module stores (read only; disclosed in notice-003).
// --config writes a PROPOSED .loupe/config.json into the clone: the graph then says dirty, and gate.json says
// "proposedConfig", so a proposal run can never pass for a run on HORDE's committed config.
//
// Writes into --out: the crawl (graph, overlay, view, conformance), parity.json, gate.json. Exit 0 only if every gate
// holds. Gates: zero `unknown` missing nodes; the inventory closes; two crawls byte-identical; HORDE's private-name
// rule and the machine-path pattern find nothing; loupe-check passes; parity on the same commit loses no probe edge.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { canonicalDoc, sha256 } from './canon.mjs';
import { parity } from './parity.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const a = process.argv.slice(2), opt = (k) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : null; };
const horde = opt('--horde'), commit = opt('--commit'), out = opt('--out'), proposal = opt('--config'), dialect = opt('--dialect');
if (!horde || !commit || !out || !/^[0-9a-f]{40}$/.test(commit)) { console.error('usage: node tools/horde-gate.mjs --horde <checkout> --commit <40-hex sha> --out <dir> [--dialect dsp-plugin] [--config <proposed config.json>]'); process.exit(2); }
const git = (cwd, args) => execFileSync('git', ['-C', cwd, ...args], { stdio: ['ignore', 'pipe', 'pipe'] }).toString();
const node = (args) => spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 });

const scratch = mkdtempSync(join(tmpdir(), 'loupe-horde-gate-')), clone = join(scratch, 'horde');
const cleanup = () => rmSync(scratch, { recursive: true, force: true });
// HORDE's terms: the clone is deleted when the run ends, however it ends (critic L7: SIGTERM too).
for (const [sig, code] of [['SIGINT', 130], ['SIGTERM', 143], ['SIGHUP', 129]]) process.on(sig, () => { cleanup(); process.exit(code); });
try {
  git(ROOT, ['clone', '-q', '--local', '--no-hardlinks', '--no-checkout', horde, clone]);
  git(clone, ['checkout', '-q', commit]);
  for (const l of git(clone, ['ls-files', '-s', '-z']).split('\0').filter((x) => x.startsWith('160000 '))) {
    const sha = l.split(' ')[1], p = l.slice(l.indexOf('\t') + 1), store = join(horde, '.git', 'modules', p);
    if (!existsSync(store)) throw new Error(`submodule ${p}: no module store in the HORDE checkout`);
    rmSync(join(clone, p), { recursive: true, force: true });
    git(ROOT, ['clone', '-q', '--no-hardlinks', '--no-checkout', store, join(clone, p)]);
    git(join(clone, p), ['checkout', '-q', sha]);
  }
  git(clone, ['remote', 'set-url', 'origin', git(horde, ['remote', 'get-url', 'origin']).trim()]);
  if (proposal) { mkdirSync(join(clone, '.loupe'), { recursive: true }); copyFileSync(proposal, join(clone, '.loupe', 'config.json')); }

  const run = (dir) => { const r = node(['crawler/cli.ts', 'crawl', clone, '--out', dir, ...(dialect ? ['--dialect', dialect] : [])]); if (r.status !== 0) throw new Error('crawl failed: ' + r.stderr.slice(-2000)); };
  const A = join(scratch, 'a'), B = join(scratch, 'b');
  run(A); run(B);
  const files = readdirSync(A).filter((f) => f.endsWith('.json')).sort();
  const identical = files.every((f) => readFileSync(join(A, f)).equals(readFileSync(join(B, f))));
  const G = JSON.parse(readFileSync(join(A, 'graph.json'), 'utf8'));

  // HORDE's private-name rule (tools/private_name_check.py): every non-comment, non-blank line of .leakcheck-names is a
  // PCRE, joined as one alternation, case-sensitive. Perl, because the rule is PCRE; prints counts only, never text.
  // The name list is local to HORDE's checkout and untracked (it holds the names it guards), so it is read in place,
  // never copied or committed.
  const names = join(horde, '.leakcheck-names');
  if (!existsSync(names)) throw new Error('the HORDE checkout has no .leakcheck-names: the leak check cannot run');
  const perl = `my @p = grep { !/^\\s*(#|$)/ } map { chomp; $_ } do { open(my $f, '<', shift) or die; <$f> }; my $re = '(?:' . join('|', @p) . ')'; my $h = 0; for my $x (@ARGV) { open(my $i, '<', $x) or die; while (<$i>) { $h++ if /$re/ } } print $h;`;
  const leaks = (paths) => ({ names: Number(execFileSync('perl', ['-e', perl, names, ...paths]).toString().trim()),
    machine: paths.reduce((n, f) => n + (readFileSync(f, 'utf8').match(/(^|[^A-Za-z0-9_])\/(Users|home|private\/var|var\/folders)\//gm) || []).length, 0) });
  const crawlLeaks = leaks(files.map((f) => join(A, f)));
  const check = node(['tools/loupe-check.mjs', A]);

  const P = join(scratch, 'probe'), pr = node(['tools/probe-crawl.mjs', clone, P, 'tools/probe-config/horde.json']);
  if (pr.status !== 0) throw new Error('probe failed: ' + pr.stderr.slice(-2000));
  // Written reasons hold for the commit they were checked at, and only that one (critic M5).
  const expl = JSON.parse(readFileSync(join(ROOT, 'tools', 'horde-parity-explained.json'), 'utf8'));
  const par = parity(JSON.parse(readFileSync(join(P, 'graph.json'), 'utf8')), G, expl.commit === commit ? expl.explained : {});

  const inv = G.crawler.inventory, excluded = inv.excluded.reduce((n, x) => n + x.count, 0);
  const unknown = G.nodes.filter((n) => n.kind === 'missing' && n.missing.reason === 'unknown').map((n) => n.id).sort();
  const gate = {
    schema: 'loupe.horde-gate/0.0-internal', commit, proposedConfig: !!proposal, dirty: G.source.dirty, dialect: dialect || null,
    graph: { hash: sha256(readFileSync(join(A, 'graph.json'), 'utf8')) },
    gates: {
      unknownMissing: { pass: unknown.length === 0, count: unknown.length, ids: unknown },
      inventoryCloses: { pass: inv.crawled + excluded === inv.files, files: inv.files, crawled: inv.crawled, excluded },
      byteIdentical: { pass: identical, files },
      leakCheck: { pass: crawlLeaks.names === 0 && crawlLeaks.machine === 0, privateNameHits: crawlLeaks.names, machinePaths: crawlLeaks.machine },
      loupeCheck: { pass: check.status === 0, tail: check.stdout.trim().split('\n').slice(-1)[0] },
      probeParity: { pass: par.sameCommit && par.counts.lost === 0, ...par.counts },
    },
  };
  gate.pass = Object.values(gate.gates).every((g) => g.pass);
  // Only leak-clean output leaves the scratch: the reports too, since parity names HORDE's paths (critic M4). A leak
  // writes nothing out at all; the counts are printed, never the matched text.
  const R = join(scratch, 'reports'); mkdirSync(R);
  writeFileSync(join(R, 'parity.json'), canonicalDoc(par)); writeFileSync(join(R, 'gate.json'), canonicalDoc(gate));
  const reportLeaks = leaks([join(R, 'parity.json'), join(R, 'gate.json')]);
  if (!gate.gates.leakCheck.pass || reportLeaks.names || reportLeaks.machine) {
    console.error(`horde-gate: leak check failed (crawl: ${crawlLeaks.names} names, ${crawlLeaks.machine} paths; reports: ${reportLeaks.names} names, ${reportLeaks.machine} paths): nothing written to ${out}`);
    process.exitCode = 1;
  } else {
    mkdirSync(out, { recursive: true });
    for (const f of files) copyFileSync(join(A, f), join(out, f));
    for (const f of ['parity.json', 'gate.json']) copyFileSync(join(R, f), join(out, f));
  }
  console.log(JSON.stringify({ pass: gate.pass, ...Object.fromEntries(Object.entries(gate.gates).map(([k, g]) => [k, g.pass])) }));
  if (process.exitCode !== 1) process.exitCode = gate.pass ? 0 : 1;
} finally { cleanup(); }
