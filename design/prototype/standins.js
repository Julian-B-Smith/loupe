// Stand-ins for logic infrastructure owns. Each is replaced by the real implementation on handover.

// conserve(): port of the v1 viewer's check. Every node is placed (drawn, collapsed or ghosted),
// every edge is drawn, in a bus, folded into a count, or inside a collapsed container.
export function conserve(data, state, map) {
  const edges = { total: data.edges.length, drawn: 0, bus: 0, folded: 0, collapsed: 0 };
  const unaccounted = [];
  data.edges.forEach(e => {
    const m = map.edges[e.id];
    if (m && edges[m.via] != null && m.via !== 'total') edges[m.via]++; else unaccounted.push(e.id);
  });
  const nodes = { total: data.nodeIds.length, placed: 0 };
  // A node counts only if it is drawn, or stands in something that is (a section, fold row, port, elsewhere chip).
  // An entry with no proxy is a node the renderer lost: count it as unaccounted (review v4, B1).
  // Once settled (not mid-transition), the proxy must also be something the frame actually drew (map.drawn).
  const shown = p => !map.drawn || !map.settled || map.drawn.has(p);
  data.nodeIds.forEach(id => { const m = map.nodes[id]; if (m && (m.state === 'drawn' || m.state === 'ghost' || (m.proxy && shown(m.proxy)))) nodes.placed++; else unaccounted.push(id); });
  const accounted = edges.drawn + edges.bus + edges.folded + edges.collapsed;
  // With a lens on, the edges this frame routed inside, across and outside the lens box must equal the lens's own
  // partition. Without this the meter's lens line would only restate lens.js (critic, 2026-10-08).
  if (map.lens && map.lensCheck && map.settled) {
    const k = map.lensCheck, l = map.lens;
    if (k.in !== l.insideEdges || k.cross !== l.crossing || k.out !== l.outsideEdges) unaccounted.push(`lens partition: drawn ${k.in}/${k.cross}/${k.out}, lens ${l.insideEdges}/${l.crossing}/${l.outsideEdges}`);
  }
  const status = unaccounted.length || accounted !== edges.total ? 'broken' : data.stale ? 'stale' : 'balanced';
  return { status, nodes, edges, accounted, unaccounted };
}

// Band rule finding: an edge from a lower level into a higher one is counterflow.
// Matching exemptions (view.exemptions) set its status. Infrastructure's audit replaces this.
export function counterflow(data) {
  const band = (data.byPrimitive.band || []).map(id => data.elements[id])[0];
  if (!band) return [];
  const levelOfSec = {};
  band.levels.forEach((l, i) => l.members.forEach(m => data.descendants(m).forEach(d => { levelOfSec[d] = i; })));
  const lv = id => levelOfSec[data.home[id]];
  const bySrc = {};
  data.edges.forEach(e => {
    const a = lv(e.src), b = lv(e.dst);
    if (a != null && b != null && a > b) (bySrc[e.src] = bySrc[e.src] || []).push(e);
  });
  return Object.entries(bySrc).map(([src, es]) => {
    const ex = (data.view.exemptions || []).find(x => x.rule === 'band.downward' && x.pattern.src === src &&
      es.every(e => (!x.pattern.kind || x.pattern.kind === e.kind) && (!x.pattern.dstIn || data.descendants(x.pattern.dstIn).includes(data.home[e.dst]))));
    return { node: src, edges: es.map(e => e.id), status: ex ? ex.status : 'flagged', exemption: ex ? ex.id : null, band: band.id };
  });
}

// Twins conformity: for each twin and port, ok if a static edge matches, warn if only
// overlay edges do, bad if none. Infrastructure's audit replaces this.
export function conformity(data, twinsId) {
  const t = data.elements[twinsId];
  const out = {};
  t.members.forEach(sec => {
    const files = new Set(data.descendants(sec).flatMap(s => data.elements[s].members));
    out[sec] = t.interface.map(p => {
      const es = data.edges.filter(e => (p.direction === 'in' ? e.src === p.peer && files.has(e.dst) : e.dst === p.peer && files.has(e.src)) &&
        (p.role ? e.role === p.role : !p.kind || e.kind === p.kind));
      return !es.length ? 'bad' : es.some(e => e.provenance === 'static') ? 'ok' : 'warn';
    });
  });
  return out;
}
