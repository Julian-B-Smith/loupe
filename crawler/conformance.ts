// Declared-versus-observed check for build targets (ROADMAP Q-016; Julian, 2026-10-16: Loupe can expose where a
// client's declared structure is not supported by the deterministic pass). A pure function of graph.json: no agent,
// no clock, nothing read but the graph.
//
// Declared: the build's target dependencies (`depends` edges), followed transitively, since a dependency's own
// dependencies are visible to its users. Observed, by the rule Julian accepted for Q-020 (2026-10-17), measured on
// the first HORDE crawl where tying files only through `builds` left 94 noise findings (targets list .cpp, not headers):
//   uses     a target uses every file its compiles reach (its compiled sources, then their includes, transitively).
//            Compiled = a listed source with a compiled extension, the build layer's COMPILED_EXT.
//   owner    the target(s) that list the file (rule `listed`); else the one target whose listed sources share the
//            file's directory (rule `directory`); else no owner: counted per configuration, not judged.
//   seen     A -> B is seen when A's compiles reach any file of B's interface (what B lists or B's compiles reach).
// Worked per configuration (0026); a finding lists the configurations it holds in.
//
// Kinds, none a verdict:
//   used-not-declared   A's compiles reach a file B owns, and A has no dependency path to any of its owners. The
//                       build may still work (include paths leak, or the order happens to be right), but the
//                       structure does not say so. The finding names the rule that tied the file to B.
//   declared-not-seen   A depends directly on B, and A's compiles reach nothing in B's interface. Linking may still
//                       need it; this pass sees includes only. Dependencies where either side compiles no repo file
//                       cannot be judged and are counted.
//   generated-by-several   one generated output is listed by two or more targets, and some two of them have no
//                       dependency path between them in either direction. CMake then emits the output's rule in
//                       each, and a parallel build can run it twice on one file (horde B501, found from Loupe's
//                       first crawl; ROADMAP Q-021). CMake's own docs warn against exactly this.
// Each finding states the weakest resolution among its evidence (critic, 2026-10-16): a `syntactic` include was
// matched by name only (e.g. a generated `config.h`), so the finding is a lead to check, not a fact.
// TypeScript is run by Node's built-in type stripping: only erasable syntax here.
import { sha256 } from '../tools/canon.mjs';

const by = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function conformance(graphText: string) {
  const G = JSON.parse(graphText);
  const cfgs: string[] = (G.crawler.configurations || [{ name: 'default' }]).map((c: any) => c.name).sort(by);
  const holds = (x: any, c: string) => !x.configs || x.configs.includes(c);
  const found = new Map<string, { kind: string; from: string; to: string; configs: Set<string>; evidence: Set<string> }>();
  const note = (kind: string, from: string, to: string, c: string, ev: string[], owners?: string[], rule?: string) => {
    const k = `${kind}\u0000${from}\u0000${to}`;
    const f: any = found.get(k) || { kind, from, to, configs: new Set(), evidence: new Set(), owners: new Set(), rules: new Set() };
    for (const o of owners || []) f.owners.add(o);
    if (rule) f.rules.add(rule);
    f.configs.add(c); for (const e of ev) f.evidence.add(e); found.set(k, f);
  };
  const COMPILED = /\.(c|cc|cpp|cxx|c\+\+|m|mm)$/i; // the build layer's COMPILED_EXT
  const dirOf = (id: string) => { const p = id.slice(id.indexOf(':') + 1); return p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '.'; };
  const notJudged: Record<string, { dependencies: number; unownedFiles: number }> = {};
  for (const c of cfgs) {
    const live = (G.edges as any[]).filter((e) => holds(e, c));
    const builtBy = new Map<string, Set<string>>();
    for (const e of live) if (e.kind === 'builds') { const s = builtBy.get(e.dst) || new Set(); s.add(e.src); builtBy.set(e.dst, s); }
    const direct = new Map<string, Set<string>>();
    for (const e of live) if (e.kind === 'depends') { const s = direct.get(e.src) || new Set(); s.add(e.dst); direct.set(e.src, s); }
    const reach = (a: string) => { const seen = new Set<string>(), work = [a]; while (work.length) for (const n of direct.get(work.pop()!) || []) if (!seen.has(n)) { seen.add(n); work.push(n); } return seen; };
    // ---- uses: what each target's compiles reach
    const incOut = new Map<string, any[]>();
    for (const e of live) if (e.kind === 'include') { const l = incOut.get(e.src) || []; l.push(e); incOut.set(e.src, l); }
    const listedBy = new Map<string, string[]>(); // target -> files it lists
    for (const [f, ts] of builtBy) for (const t of ts) { const l = listedBy.get(t) || []; l.push(f); listedBy.set(t, l); }
    const roots = (t: string) => (listedBy.get(t) || []).filter((f) => f.startsWith('file:') && COMPILED.test(f));
    const reached = new Map<string, Map<string, Set<string>>>(); // target -> file -> include edge ids that reached it
    for (const t of [...listedBy.keys()].sort(by)) {
      const got = new Map<string, Set<string>>(), work = roots(t);
      for (const r of work) got.set(r, new Set());
      while (work.length) for (const e of incOut.get(work.pop()!) || []) {
        if (!got.has(e.dst)) { got.set(e.dst, new Set()); work.push(e.dst); }
        got.get(e.dst)!.add(e.id);
      }
      reached.set(t, got);
    }
    // ---- owners: listed, else the one target sharing the directory
    const dirTargets = new Map<string, Set<string>>();
    for (const [f, ts] of builtBy) if (f.startsWith('file:')) for (const t of ts) { const d = dirOf(f), s2 = dirTargets.get(d) || new Set(); s2.add(t); dirTargets.set(d, s2); }
    const owner = (f: string): { ts: Set<string>; rule: string } | null => {
      if (builtBy.has(f)) return { ts: builtBy.get(f)!, rule: 'listed' };
      const d = f.startsWith('file:') ? dirTargets.get(dirOf(f)) : null;
      return d && d.size === 1 ? { ts: d, rule: 'directory' } : null;
    };
    const unowned = new Set<string>();
    for (const [t, got] of reached) {
      const R = reach(t), mine = new Set(roots(t));
      for (const [f, ids] of got) {
        if (mine.has(f) || !f.startsWith('file:') && !f.startsWith('miss:${build}')) continue; // own sources; externals are not targets'
        const o = owner(f);
        if (!o) { unowned.add(f); continue; }
        if (o.ts.has(t) || [...o.ts].some((u) => R.has(u))) continue; // its own, or declared through some owner
        for (const u of o.ts) note('used-not-declared', t, u, c, [...ids], undefined, o.rule);
      }
    }
    // ---- declared, not seen: A's compiles reach nothing of B's interface
    let undecided = 0;
    for (const [a, bs] of direct) for (const b of bs) {
      if (!roots(a).length || !roots(b).length) { undecided++; continue; }
      const ra = reached.get(a)!, iface = new Set([...(listedBy.get(b) || []), ...reached.get(b)!.keys()]);
      if (![...ra.keys()].some((f) => iface.has(f)))
        note('declared-not-seen', a, b, c, (live as any[]).filter((e) => e.kind === 'depends' && e.src === a && e.dst === b).map((e) => e.id));
    }
    notJudged[c] = { dependencies: undecided, unownedFiles: unowned.size };
    // A generated output (missing: generated, or made by a generates edge) with several owning targets, some two of
    // them unordered.
    const generated = new Set<string>();
    for (const n of G.nodes as any[]) if (n.kind === 'missing' && n.missing?.reason === 'generated') generated.add(n.id);
    for (const e of live) if (e.kind === 'generates') generated.add(e.dst);
    for (const [out, owners] of builtBy) {
      if (!generated.has(out) || owners.size < 2) continue;
      const os = [...owners].sort(by), r = new Map(os.map((o) => [o, reach(o)]));
      const unordered = os.some((a, i) => os.slice(i + 1).some((b) => !r.get(a)!.has(b) && !r.get(b)!.has(a)));
      if (unordered) note('generated-by-several', out, '', c, (live as any[]).filter((e) => e.kind === 'builds' && e.dst === out).map((e) => e.id), os);
    }
  }
  const rank: Record<string, number> = { syntactic: 0, search: 1, build: 2, 'compile-db': 3, exact: 4 };
  const byId = new Map((G.edges as any[]).map((e) => [e.id, e]));
  const weakest = (ids: Iterable<string>) => {
    let w: string | null = null;
    for (const id of ids) for (const x of byId.get(id)?.evidence || []) if (x.resolution && (w === null || rank[x.resolution] < rank[w])) w = x.resolution;
    return w;
  };
  const findings = [...found.values()].map((f) => {
    const out: any = { kind: f.kind, from: f.from, evidence: [...f.evidence].sort(by), weakestResolution: weakest(f.evidence) };
    if (f.to) out.to = f.to;
    if ((f as any).owners.size) out.owners = [...(f as any).owners].sort(by);
    if ((f as any).rules.size) out.tiedBy = [...(f as any).rules].sort(by);
    if (f.configs.size < cfgs.length) out.configs = [...f.configs].sort(by);
    return out;
  }).sort((a, b) => by(a.kind, b.kind) || by(a.from, b.from) || by(a.to || '', b.to || ''));
  return { schema: 'loupe.conformance/0.0-internal', graph: { hash: sha256(graphText) }, findings,
    notJudged: Object.fromEntries(cfgs.map((c) => [c, notJudged[c]])) };
}
