// Layer-E (measured, non-blocking; ROADMAP Q-015 criterion 4): how close did the parked agent-inferred engine2 map
// (Q-014, branch q014/engine2-inferred-map) get to HORDE's declaration? Never in ./verify, never drawn as structure.
//   node tools/engine-structure-agreement.mjs [--ref origin/q014/engine2-inferred-map]
//
// The two maps share no nodes: the inferred one is files, the declared one is concepts, and nothing may link a block to
// a file (Julian, 2026-10-31), so a by-name mapping would itself be inference. What they share is the spec: both cite
// its requirement ids. So this measures citation overlap, a weak upper bound: citing one requirement does not make two
// edges the same edge. The inferred map also read an older spec (its own commit against the declaration's), and an id
// may have moved between them. Deterministic: the same two inputs print the same bytes.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i < 0 ? d : process.argv[i + 1]; };
const ref = arg('--ref', 'origin/q014/engine2-inferred-map');
const overlay = JSON.parse(execFileSync('git', ['show', `${ref}:design/prototype/snapshots/engine2-spec/overlay.json`], { encoding: 'utf8', maxBuffer: 1 << 26 }));
const graph = JSON.parse(readFileSync('design/prototype/snapshots/engine2-structure/graph.json', 'utf8'));

// The rationale is prose: requirement ids (VO-1, RC-6.5, C.14) and sections (§4.2). No \b before §: it is not a word char.
const ID = /\b(?:[A-Z]{2}-\d+(?:\.\d+)?|C\.\d+)\b|§\d+(?:\.\d+)*/g;
const idsIn = (text) => new Set(text.match(ID) || []);
const inferred = overlay.edges.map((e) => idsIn(e.evidence.map((x) => x.rationale || '').join(' ')));
const declared = graph.edges.map((e) => new Set(e.declared.cites));
const union = (sets) => new Set(sets.flatMap((s) => [...s]));
const I = union(inferred), D = union(declared), hits = (s, other) => [...s].some((x) => other.has(x));
const sorted = (s) => [...s].sort();

console.log(JSON.stringify({
  measured: 'citation overlap, not edge identity (Layer-E: non-blocking)',
  inputs: { inferred: ref, declaredCommit: graph.source.commit },
  inferredEdges: inferred.length,
  inferredEdgesWithACite: inferred.filter((s) => s.size).length,
  inferredEdgesCitingADeclaredId: inferred.filter((s) => hits(s, D)).length,
  declaredEdges: declared.length,
  declaredEdgesCitingAnInferredId: declared.filter((s) => hits(s, I)).length,
  idsInBoth: sorted(new Set([...I].filter((x) => D.has(x)))).length,
  idsOnlyInferred: sorted(new Set([...I].filter((x) => !D.has(x)))),
  idsOnlyDeclared: sorted(new Set([...D].filter((x) => !I.has(x)))),
}, null, 2));
