// Declared-versus-observed check for build targets (ROADMAP Q-016; Julian, 2026-10-16: Loupe can expose where a
// client's declared structure is not supported by the deterministic pass). A pure function of graph.json: no agent,
// no clock, nothing read but the graph.
//
// Declared: the build's target dependencies (`depends` edges), followed transitively, since a dependency's own
// dependencies are visible to its users. Observed: `include` edges from a file one target builds to a file another
// builds (`builds` edges; a generated header counts as built by the target that lists it). Worked per configuration
// (0026), because both sides can differ between configurations; a finding lists the configurations it holds in.
//
// Two kinds, neither a verdict:
//   used-not-declared   A's files include B's files, and A has no dependency path to B. The build may still work
//                       (include paths leak, or the order happens to be right), but the structure does not say so.
//   declared-not-seen   A depends directly on B, and no file of A includes a file of B. Linking may still need it;
//                       this pass sees includes only.
//   generated-by-several   one generated output is listed by two or more targets, and some two of them have no
//                       dependency path between them in either direction. CMake then emits the output's rule in
//                       each, and a parallel build can run it twice on one file (horde B501, found from Loupe's
//                       first crawl; ROADMAP Q-021). CMake's own docs warn against exactly this.
// Includes into files no target builds (most headers) cannot be attributed and are counted per configuration, not judged.
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
  const note = (kind: string, from: string, to: string, c: string, ev: string[], owners?: string[]) => {
    const k = `${kind}\u0000${from}\u0000${to}`;
    const f: any = found.get(k) || { kind, from, to, configs: new Set(), evidence: new Set(), owners: new Set() };
    for (const o of owners || []) f.owners.add(o);
    f.configs.add(c); for (const e of ev) f.evidence.add(e); found.set(k, f);
  };
  const unattributed: Record<string, number> = {};
  for (const c of cfgs) {
    const live = (G.edges as any[]).filter((e) => holds(e, c));
    const builtBy = new Map<string, Set<string>>();
    for (const e of live) if (e.kind === 'builds') { const s = builtBy.get(e.dst) || new Set(); s.add(e.src); builtBy.set(e.dst, s); }
    const direct = new Map<string, Set<string>>();
    for (const e of live) if (e.kind === 'depends') { const s = direct.get(e.src) || new Set(); s.add(e.dst); direct.set(e.src, s); }
    const reach = (a: string) => { const seen = new Set<string>(), work = [a]; while (work.length) for (const n of direct.get(work.pop()!) || []) if (!seen.has(n)) { seen.add(n); work.push(n); } return seen; };
    const uses = new Map<string, Set<string>>(); // "A\0B" -> include edge ids
    for (const e of live) if (e.kind === 'include') {
      const as = builtBy.get(e.src), bs = builtBy.get(e.dst);
      if (!as || !bs) { unattributed[c] = (unattributed[c] || 0) + 1; continue; }
      for (const a of as) for (const b of bs) {
        if (a === b || bs.has(a)) continue; // a file its own target builds too: not a cross-target use
        const k = a + '\u0000' + b, s = uses.get(k) || new Set(); s.add(e.id); uses.set(k, s);
      }
    }
    for (const [k, ids] of uses) { const [a, b] = k.split('\u0000'); if (!reach(a).has(b)) note('used-not-declared', a, b, c, [...ids]); }
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
    for (const [a, bs] of direct) for (const b of bs) if (!uses.has(a + '\u0000' + b)) note('declared-not-seen', a, b, c, (live as any[]).filter((e) => e.kind === 'depends' && e.src === a && e.dst === b).map((e) => e.id));
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
    if (f.configs.size < cfgs.length) out.configs = [...f.configs].sort(by);
    return out;
  }).sort((a, b) => by(a.kind, b.kind) || by(a.from, b.from) || by(a.to || '', b.to || ''));
  return { schema: 'loupe.conformance/0.0-internal', graph: { hash: sha256(graphText) }, findings,
    unattributedIncludes: Object.fromEntries(cfgs.map((c) => [c, unattributed[c] || 0])) };
}
