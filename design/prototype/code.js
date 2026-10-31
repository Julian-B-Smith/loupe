// Seeing the code from the map (ROADMAP Q-037; Julian, poll 2026-10-30). Pure: no DOM, no fetch. Every map element
// that stands for code (a file, an edge's evidence, a section's folder) gets the same four actions, built here once so
// the right-click menu and the panel cannot disagree: Open on GitHub, Open in editor, Show in Finder, Show the code.
// An action that cannot run is still listed, disabled, with its reason (criterion 1): a hidden action reads as missing.
//
// Where the code is: GitHub at the crawled commit (graph.json `source`), or the target's checkout on this machine
// through the local helper (`npm run view`, tools/serve.mjs). The page never learns a disk path: the helper resolves
// repo + repo-relative path itself, so nothing machine-specific reaches the page, a URL or a commit.

// What the crawl says about where its code lives. `exact` is false when the crawl was not of a commit: a dirty tree
// (files differ from any commit) or the sample's placeholder "sample".
export function codeSource(graph) {
  const s = graph && graph.source;
  if (!s || !s.repo) return { repo: null, exact: false, why: 'the crawl names no repo' };
  if (!/^github\.com\/[^/]+\/[^/]+$/.test(s.repo)) return { repo: s.repo, exact: false, why: `${s.repo} is not on GitHub` };
  // The sample is hand-made data, not a crawl: its paths need not exist anywhere, so it opens nothing, even locally.
  if (!s.commit || s.commit === 'sample') return { repo: s.repo, exact: false, sample: true, why: 'sample data, not a crawl of a commit' };
  if (s.dirty) return { repo: s.repo, exact: false, why: 'crawled from uncommitted changes: no commit holds these files' };
  return { repo: s.repo, commit: s.commit, exact: true };
}

// Repo paths are joined segment by segment: a path with `#` or `?` (legal in a file name) must not end the URL early.
const enc = (p) => p.split('/').map(encodeURIComponent).join('/');

export function githubUrl(src, path, line, folder = false) {
  if (!src.exact) return null;
  const base = `https://${src.repo}/${folder ? 'tree' : 'blob'}/${src.commit}`;
  return path ? `${base}/${enc(path)}${line ? '#L' + line : ''}` : base;
}

export function rawUrl(src, path) {
  if (!src.exact) return null;
  const [, owner, name] = src.repo.split('/');
  return `https://raw.githubusercontent.com/${owner}/${name}/${src.commit}/${enc(path)}`;
}

// The place in the code an edge stands on: its first evidence that names a file. Site evidence carries a line (the
// #include, the call); config evidence names the build file only (its line lives in prose, `key`, and is not parsed).
export function edgeSite(edge) {
  const ev = ((edge && edge.evidence) || []).find((x) => x.path);
  return ev ? { path: ev.path, line: ev.line || null } : null;
}

// What a map element points at in the code, or why it points at nothing. Only `file` nodes are files in the repo:
// a missing node was named but never found, an external one is outside the repo, a target is a build name.
const NOT_A_FILE = { missing: 'named by the code but not found in the repo', external: 'outside the repo', target: 'a build target, not a file' };
export function codeTarget(data, sel) {
  if (!sel) return null;
  if (sel.type === 'node') {
    const n = data.nodes[sel.id];
    if (!n) return { why: 'not in this crawl' };
    if (n.kind !== 'file') return { why: NOT_A_FILE[n.kind] || `a ${n.kind}, not a file` };
    return { path: n.path, line: null, what: n.path };
  }
  if (sel.type === 'edge') {
    const site = edgeSite(data.edgeById[sel.id]);
    return site ? { ...site, what: site.line ? `${site.path}:${site.line}` : site.path } : { why: 'this edge records no place in the code' };
  }
  if (sel.type === 'element' && data.elements[sel.id] && data.elements[sel.id].primitive === 'section') {
    const dir = sectionFolder(data, sel.id);
    return dir != null ? { path: dir, folder: true, what: (dir || 'the repo root') + '/' } : { why: 'its files share no folder' };
  }
  return null;
}

// A section's folder: the longest directory every one of its files (through every subsection) sits in. Agent-drawn
// sections need not follow folders, so this is computed, never assumed; '' is the repo root.
export function sectionFolder(data, id) {
  const paths = data.descendants(id).flatMap((s) => data.elements[s].members).map((m) => data.nodes[m])
    .filter((n) => n && n.kind === 'file').map((n) => n.path.split('/').slice(0, -1));
  if (!paths.length) return null;
  let common = paths[0];
  for (const p of paths) { let i = 0; while (i < common.length && common[i] === p[i]) i++; common = common.slice(0, i); }
  return common.join('/');
}

// The four actions for one target. `env.helper` is the local helper's answer for this repo, { ok, why, actions }, or
// null when there is none (the hosted Testbench); `env.editor` is 'vscode' or 'cursor'.
export const EDITORS = { vscode: 'VS Code', cursor: 'Cursor' };
export function codeActions(src, target, env) {
  if (!target) return [];
  const no = (why) => ({ disabled: true, why });
  if (target.why) return [{ id: 'none', label: 'No code to open', ...no(target.why) }];
  if (src.sample) return [{ id: 'none', label: 'No code to open', ...no(src.why) }];
  const gh = githubUrl(src, target.path, target.line, target.folder);
  const local = env.helper && env.helper.ok;
  const noLocal = env.helper ? env.helper.why : 'needs Loupe running on this machine (npm run view)';
  // The helper reads files anywhere, but Finder and the editor links are macOS's `open` (`actions: false` elsewhere).
  const act = local && env.helper.actions !== false ? {} : no(local ? 'Finder and editor links need macOS' : noLocal);
  const acts = [
    { id: 'github', label: 'Open on GitHub', sub: gh ? `${target.what} at ${src.commit.slice(0, 7)}` : '', url: gh, ...(gh ? {} : no(src.why)) },
    { id: 'editor', label: `Open in ${EDITORS[env.editor] || EDITORS.vscode}`, sub: target.what, ...(target.folder ? no('a folder: open it in Finder') : act) },
    { id: 'reveal', label: 'Show in Finder', sub: target.what, ...act },
  ];
  // The pane reads through the helper locally, or from GitHub at the commit when hosted (Julian, poll 2026-10-30).
  if (!target.folder) acts.push({ id: 'pane', label: 'Show the code', sub: 'here, line-numbered', ...(local || gh ? {} : no(`${noLocal}; and ${src.why}`)) });
  return acts;
}

// The pane's marks: for one file, every line some edge's site evidence points at, with those edges. An edge with
// several sites marks each of them. Sorted by line, then edge id, so the marks are stable.
export function evidenceMarks(data, path) {
  const by = {};
  for (const e of data.edges) for (const ev of e.evidence || []) {
    if (ev.path !== path || !ev.line) continue;
    const l = (by[ev.line] = by[ev.line] || []);
    if (!l.includes(e.id)) l.push(e.id);
  }
  return Object.keys(by).map(Number).sort((a, b) => a - b).map((line) => ({ line, edges: by[line].sort() }));
}
