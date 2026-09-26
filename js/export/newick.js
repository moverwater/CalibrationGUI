// Constraint tree exports: Newick and NEXUS.
import { isCalibrated, groupsInTreeOrder } from '../model.js';

export function qNewick(s) {
  return /^[^\s()\[\]':;,]+$/.test(s) ? s : "'" + s.replace(/'/g, "''") + "'";
}
function qNexus(s) {
  return /^[A-Za-z0-9_.\-]+$/.test(s) ? s : "'" + s.replace(/'/g, "''") + "'";
}
const annotation = c => isCalibrated(c) ? `[&lower=${c.lower},upper=${c.upper}]` : '';

// o.ungrouped: keep taxa outside every group; o.labels: name clades; o.ages: [&lower,upper] annotations;
// o.forest: CalibrationForestParser dialect (unquoted names, every clade named via [&name=...]).
export function toNewick(S, T, o) {
  const q = o.forest ? (s => s) : qNewick;
  const tail = c => {
    if (o.forest) {
      const kv = [`name=${c.name}`];
      if (isCalibrated(c)) kv.push(`lower=${c.lower}`, `upper=${c.upper}`);
      return `[&${kv.join(',')}]`;
    }
    return (o.labels ? qNewick(c.name) : '') + (o.ages ? annotation(c) : '');
  };
  const nw = node => {
    if (node.leaf !== undefined) return q(S.taxa[node.leaf]);
    return '(' + node.children.map(nw).join(',') + ')' + (node.group ? tail(node.group) : '');
  };
  const ungrouped = o.forest || o.ungrouped;
  const kids = ungrouped ? T.root.children : T.root.children.filter(c => c.leaf === undefined);
  if (!kids.length) return '';
  // The root is only annotated when it carries a calibration: a named root would otherwise be
  // read as a whole-tree clade.
  let rootTail = '';
  if (o.forest) rootTail = isCalibrated(S.root) ? tail(S.root) : '[&virtualRoot=true]';
  else if (o.ages && isCalibrated(S.root) && ungrouped) rootTail = (o.labels ? qNewick(S.root.name) : '') + annotation(S.root);
  if (kids.length === 1 && !ungrouped) return nw(kids[0]) + ';';
  return '(' + kids.map(nw).join(',') + ')' + rootTail + ';';
}

// A SETS block with one TAXSET per group, and the constraint tree in a TREES block.
export function toNexus(S, T, opts) {
  const gs = groupsInTreeOrder(T);
  const lines = ['#NEXUS', ''];
  if (gs.length) {
    lines.push('BEGIN SETS;');
    for (const node of gs) lines.push(`    TAXSET ${qNexus(node.group.name)} = ${node.leaves.map(i => qNexus(S.taxa[i])).join(' ')};`);
    lines.push('END;', '');
  }
  const nw = toNewick(S, T, opts);
  if (nw) lines.push('BEGIN TREES;', `    TREE constraint = ${nw}`, 'END;');
  return lines.join('\n');
}
