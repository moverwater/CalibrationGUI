// The document model: taxa, nested groups (clades) and their calibrations, with no DOM access.
//
// State S = { taxa: string[], groups: Group[], root: Clade, nextId, source }
//   Group = { id, name, taxa: sorted taxon indices, color, lower, upper, dist? }
//   Clade (the root) = { name, lower, upper, dist? }
// Groups must form a nested (laminar) family: any two are disjoint or one contains the other.
import { dedupe } from './util.js';
import { distOf, distProblems } from './distributions.js';

export const PALETTE = ['#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#1fb5c9', '#f032e6',
                        '#9a6324', '#469990', '#808000', '#6f5bd1', '#e6a800', '#d2691e', '#2e8b57'];

export const newRoot = () => ({ name: 'root', lower: null, upper: null });
export const emptyState = () => ({ taxa: [], groups: [], root: newRoot(), nextId: 1, source: '' });

export const hasAge = c => c.lower != null || c.upper != null;
export const isCalibrated = c => c.lower != null && c.upper != null;
export const ageText = c => hasAge(c) ? `${c.lower ?? '?'}–${c.upper ?? '?'}` : '';

// The root clade for id 'root', otherwise the group with that id.
export const cladeById = (S, id) => id === 'root' ? S.root : S.groups.find(g => g.id === +id);

export function uniqueName(base, used) {
  if (!used.has(base)) return base;
  for (let k = 2; ; k++) if (!used.has(base + '_' + k)) return base + '_' + k;
}
export function nextColor(S) {
  const counts = new Map(PALETTE.map(c => [c, 0]));
  S.groups.forEach(g => g.color && counts.set(g.color, (counts.get(g.color) || 0) + 1));
  let best = PALETTE[0];
  for (const c of PALETTE) if (counts.get(c) < counts.get(best)) best = c;
  return best;
}

// A group that `taxaIdx` would duplicate or partially overlap, or null.
export function findConflict(S, taxaIdx, ignoreId) {
  const s = new Set(taxaIdx);
  for (const g of S.groups) {
    if (g.id === ignoreId) continue;
    let inter = 0;
    for (const i of g.taxa) if (s.has(i)) inter++;
    if (inter === g.taxa.length && inter === s.size) return { g, kind: 'duplicate' };
    if (inter > 0 && inter < g.taxa.length && inter < s.size) return { g, kind: 'overlap', inter };
  }
  return null;
}
// Why the sorted taxon indices `t` cannot become a group, or null if they can.
export function validateSelection(S, t, ignoreId) {
  if (t.length < 2) return 'Select at least 2 taxa';
  if (t.length === S.taxa.length) return 'A group of all taxa is just the root — select a subset';
  const c = findConflict(S, t, ignoreId);
  if (c?.kind === 'duplicate') return `Group "${c.g.name}" already contains exactly these taxa`;
  if (c) return `Selection partially overlaps "${c.g.name}" (${c.inter} of its ${c.g.taxa.length} taxa) — groups must be nested or disjoint`;
  return null;
}

// Adds a group of the (unsorted) taxon indices; unnamed groups are called clade<id>.
export function addGroup(S, name, taxa) {
  const id = S.nextId++;
  const t = [...taxa].sort((a, b) => a - b);
  S.groups.push({ id, name: name || uniqueName('clade' + id, new Set(S.groups.map(g => g.name))), taxa: t, color: nextColor(S) });
  return id;
}

// A parsed input ({ taxa, groups, root, treeLeaves? }) normalised for loading.
// treeLeaves: the taxa covered by the file's constraint tree, when that is fewer than all taxa;
// its root is then an ordinary clade rather than the root.
export function prepareDataset({ taxa, groups, root, treeLeaves }) {
  const names = dedupe(taxa);
  const gs = groups.map(g => ({ name: g.name, taxa: g.taxa, lower: g.lower, upper: g.upper }));
  const leaves = dedupe(treeLeaves || names);
  const partial = leaves.length < names.length;
  if (partial && (hasAge(root) || root.name !== 'root')) gs.push({ name: root.name === 'root' ? '' : root.name, taxa: leaves, lower: root.lower, upper: root.upper });
  return { names, groups: gs, root: partial ? newRoot() : root };
}
// Replaces the taxa, groups and root of S with a prepared dataset.
export function applyDataset(S, { names, groups, root }, source) {
  applyTaxaAndGroups(S, names, groups, source);
  S.root = root;
}

// Replaces the taxa and groups; groups are given by taxon name. Repeated and trivial groups
// (fewer than two taxa, or all of them) are dropped.
export function applyTaxaAndGroups(S, names, namedGroups, source) {
  const idx = new Map(names.map((n, i) => [n, i]));
  const seen = new Set(), out = [];
  const usedNames = new Set();
  S.taxa = names;
  S.source = source || '';
  S.groups = [];
  for (const g of namedGroups) {
    const t = [...new Set(g.taxa.map(n => idx.get(n)).filter(i => i !== undefined))].sort((a, b) => a - b);
    if (t.length < 2 || t.length === names.length) continue;
    const key = t.join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    let name = g.name && !usedNames.has(g.name) ? g.name : '';
    const id = S.nextId++;
    if (!name) name = uniqueName('clade' + id, usedNames);
    usedNames.add(name);
    out.push({ id, name, taxa: t, color: g.color || null, lower: g.lower ?? null, upper: g.upper ?? null, dist: g.dist });
  }
  S.groups = out;
  S.groups.forEach(g => { if (!g.color) g.color = nextColor(S); });
}

// The clade tree implied by the groups:
//   root: { group: null, children, depth, h, min, leaves }
//   internal node: { group, children, ... }, leaf: { leaf: taxon index, groups: enclosing groups }
//   order: taxon indices in tree order; leafNodes: leaf node per taxon index.
export function buildTree(S) {
  const n = S.taxa.length;
  const root = { group: null, children: [], depth: 0 };
  const owner = new Array(n).fill(root);
  // Largest first: the parent of each group is the current smallest owner of any of its taxa.
  const gs = [...S.groups].sort((a, b) => b.taxa.length - a.taxa.length);
  for (const g of gs) {
    const node = { group: g, children: [] };
    owner[g.taxa[0]].children.push(node);
    for (const i of g.taxa) owner[i] = node;
  }
  for (let i = 0; i < n; i++) owner[i].children.push({ leaf: i });

  const order = [];
  const finish = (node, depth, ancestors) => {
    node.depth = depth;
    if (node.leaf !== undefined) { node.min = node.leaf; node.h = 0; node.groups = ancestors; return; }
    const anc = node.group ? [...ancestors, node.group] : ancestors;
    node.children.forEach(c => finish(c, depth + 1, anc));
    node.children.sort((a, b) => a.min - b.min);
    node.min = node.children.length ? node.children[0].min : 0;
    node.h = 1 + Math.max(0, ...node.children.map(c => c.h));
  };
  finish(root, 0, []);
  const leafNodes = new Array(n);
  const collect = node => {
    if (node.leaf !== undefined) { order.push(node.leaf); leafNodes[node.leaf] = node; node.leaves = [node.leaf]; return; }
    node.children.forEach(collect);
    node.leaves = node.children.flatMap(c => c.leaves);
  };
  collect(root);
  return { root, order, leafNodes };
}

// Group nodes of the tree, outermost first.
export function groupsInTreeOrder(T) {
  const out = [];
  const walk = node => { if (node.group) out.push(node); (node.children || []).forEach(walk); };
  walk(T.root);
  return out;
}
export function findNode(T, id) {
  let found = null;
  const walk = n => { if (n.group?.id === id) found = n; else (n.children || []).forEach(walk); };
  walk(T.root);
  return found;
}

// Problems that would make BEAST / CalibratedCPP reject the calibrations, as { id, msg } with
// id the clade id ('root' for the root, null for problems not tied to a clade).
export function calWarnings(S, T) {
  const out = [];
  const add = (id, msg) => out.push({ id, msg });
  const taxonNames = new Set(S.taxa);
  const check = (c, id, label, ancestorCal) => {
    // A min-only clade is fine for an offset MRCA prior; CalibratedCPP and LPhy just skip it.
    if (hasAge(c) && !isCalibrated(c) && distOf(c).type === 'uniform') add(id, `${label}: needs both a min and a max age`);
    if (c.dist) distProblems(c).forEach(p => add(id, `${label}: MRCA prior ${p}`));
    if (isCalibrated(c) && c.lower > c.upper) add(id, `${label}: min age ${c.lower} is greater than max age ${c.upper}`);
    if (c.lower != null && ancestorCal && ancestorCal.c.upper != null && c.lower > ancestorCal.c.upper)
      add(id, `${label}: min age ${c.lower} is older than the max age ${ancestorCal.c.upper} of enclosing clade "${ancestorCal.c.name}"`);
    if (/[\[\](),:;=&'"]/.test(c.name)) add(id, `${label}: name contains characters that break the constraint-tree format`);
    if (taxonNames.has(c.name)) add(id, `${label}: name clashes with a taxon id`);
  };
  check(S.root, 'root', 'root', null);
  const walk = (node, anc) => {
    if (node.leaf !== undefined) return;
    if (node.group) check(node.group, node.group.id, `"${node.group.name}"`, anc);
    const next = node.group && hasAge(node.group) ? { c: node.group } : anc;
    node.children.forEach(c => walk(c, next));
  };
  walk(T.root, hasAge(S.root) ? { c: S.root } : null);
  const bad = S.taxa.filter(t => /[\[\](),:;'"]/.test(t));
  if (bad.length) add(null, `${bad.length} taxon name${bad.length > 1 ? 's contain' : ' contains'} ()[],:; or quotes — CalibrationForestParser cannot read these (e.g. "${bad[0]}")`);
  return out;
}
