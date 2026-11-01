// What the panels say about a declaration graph (schema 0.4, ROADMAP Q-015). Pure: strings in, strings out, no DOM, so
// tools/render.test.mjs can run the very code the viewer's panels run (the inline script in index.html cannot be imported).
// A declared node is a block or slot the target repo states; it has no path, so every name comes from declared.id.

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const isDeclaration = data => !!(data.graph && data.graph.declaration);
// One name for any node: a file's path, a declared block's id, else the id itself.
export const nodeName = (n, fallback = '') => (n ? n.path ?? (n.declared && n.declared.id) ?? n.id : fallback);
// Where an edge comes from, in the words the provenance already uses; "crawled" is only true of a crawler's edge.
export const edgeOrigin = e => (e.origin === 'overlay' ? 'overlay' : e.provenance === 'declared' ? 'declared' : 'crawled');
export const nounOf = n => (n && n.kind === 'slot' ? 'slot' : n && n.kind === 'block' ? 'block' : 'file');

// Stage 1 of a declaration graph: what was read, from where, and the declaration's own counts. (A crawl states its crawler.)
export function declarationStageHtml(data) {
  const g = data.graph, d = g.declaration, src = g.source || {};
  const kinds = {}; data.edges.forEach(e => { kinds[e.kind] = (kinds[e.kind] || 0) + 1; });
  const provs = {}; data.edges.forEach(e => { provs[e.provenance] = (provs[e.provenance] || 0) + 1; });
  const counts = Object.entries(d.counts || {}).map(([k, v]) => `${esc(k)} ${typeof v === 'object' && v ? Object.entries(v).map(([a, b]) => `${esc(a)} ${b}`).join(', ') : esc(v)}`).join('; ');
  return `<p>The structure the target repo declares about itself, restated by an adapter with no interpretation. This is the reference the Signal path view is checked against.</p>
      <dl class="kv"><dt>Format</dt><dd>${esc(d.format)}</dd><dt>Declaration</dt><dd>${esc(d.path)} · blob ${esc(String(d.blob).slice(0, 7))}</dd><dt>Spec</dt><dd>${esc(d.spec && d.spec.path)} · blob ${esc(String((d.spec && d.spec.blob) || '').slice(0, 7))}</dd><dt>Commit</dt><dd>${esc(String(src.commit || '').slice(0, 7))}</dd><dt>Declared counts</dt><dd>${counts}</dd><dt>Nodes</dt><dd>${data.nodeIds.length}</dd></dl>
      <table class="t"><thead><tr><th>Kind</th><th>Declared edges</th></tr></thead><tbody>${Object.entries(kinds).map(([k, n]) => `<tr><td>${esc(k)}</td><td>${n}</td></tr>`).join('')}</tbody></table>
      <table class="t"><thead><tr><th>Provenance</th><th>Edges</th></tr></thead><tbody>${Object.entries(provs).map(([k, n]) => `<tr><td>${esc(k)}</td><td>${n}</td></tr>`).join('')}</tbody></table>`;
}

// Stage 2's lead sentence: who made the view's elements.
export function viewSentence(data) {
  const n = data.order.length;
  return isDeclaration(data)
    ? `<p>Dialect ${esc(data.view.dialect.name)}. The adapter restated the declaration as ${n} elements: one section for each declared parent. Nothing was composed; every section can be checked against the declaration.</p>`
    : `<p>Dialect ${esc(data.view.dialect.name)}. The structure agent composed this view from ${n} elements. Each one makes a claim the audit can test.</p>`;
}

// The declaration's own words about a block or slot (M5): label, scope, multiplicity, cites.
export function declaredNodeHtml(n) {
  const d = n && n.declared; if (!d) return '';
  return `<dl class="kv"><dt>Declared</dt><dd>${esc(d.label)}</dd><dt>Scope</dt><dd>${esc(d.scope)}</dd>${d.multiplicity ? `<dt>Multiplicity</dt><dd>${esc(d.multiplicity)}</dd>` : ''}<dt>Cites</dt><dd>${esc((d.cites || []).join(', '))}</dd></dl>`;
}
// ... and about an edge: label and cites (its declared id is in the evidence card, evidenceNote below).
export function declaredEdgeHtml(e) {
  const d = e && e.declared; if (!d) return '';
  return `<dl class="kv">${d.label ? `<dt>Declared</dt><dd>${esc(d.label)}</dd>` : ''}<dt>Cites</dt><dd>${esc((d.cites || []).join(', '))}</dd></dl>`;
}
export const evidenceNote = x => (x.type === 'declaration' ? `declared id ${x.id}` : '');
