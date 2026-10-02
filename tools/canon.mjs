// Canonical JSON and ids for Loupe. Deterministic: no clocks, no randomness, no locale.
import { createHash } from 'node:crypto';

const sortKeys = (v) => {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = sortKeys(v[k]);
    return out;
  }
  return v;
};

const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const evKey = (e) => `${e.type}|${e.path ?? ''}|${String(e.line ?? 0).padStart(9, '0')}|${e.col ?? 0}|${e.key ?? ''}|${e.trace ?? ''}|${e.author ?? ''}|${e.agent ?? ''}`;

// Canonical form of a graph: nodes and edges sorted by id, evidence sorted, keys sorted,
// 2-space indent, trailing newline. The graph hash is sha256 over exactly these bytes.
export function canonicalGraph(g) {
  const c = structuredClone(g);
  c.nodes.sort(byId);
  c.edges.sort(byId);
  for (const e of c.edges) e.evidence.sort((a, b) => (evKey(a) < evKey(b) ? -1 : evKey(a) > evKey(b) ? 1 : 0));
  return JSON.stringify(sortKeys(c), null, 2) + '\n';
}

// Overlay and view are canonical when keys are sorted and their arrays are in authored order.
export function canonicalDoc(d) {
  return JSON.stringify(sortKeys(d), null, 2) + '\n';
}

export const sha256 = (s) => 'sha256:' + createHash('sha256').update(s, 'utf8').digest('hex');
export const edgeId = (src, dst, kind) => 'e:' + createHash('sha256').update(`${src}|${dst}|${kind}`, 'utf8').digest('hex').slice(0, 16);
