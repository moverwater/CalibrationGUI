// The list view: the calibrations as an indented outline, each clade followed by its taxa and the
// clades inside it, in tree order. Clades can be collapsed; clicking works as in the tree view.
import { app } from '../store.js';
import { esc } from '../util.js';
import { hasAge, ageText, findNode } from '../model.js';
import { $ } from './dom.js';
import { toggleTaxon, clickClade } from './selection.js';

const collapsed = new Set();   // ids ('root' or group id, as strings) of collapsed clades

export function renderOutline() {
  const { S, T, selected, activeGroup } = app;
  const el = $('outline');
  if (!S.taxa.length) { el.innerHTML = ''; return; }
  const rows = [];
  const taxonRow = (i, depth) => rows.push(
    `<div class="orow taxon${selected.has(i) ? ' sel' : ''}" data-i="${i}" style="--d:${depth}"><span class="bullet"></span><span>${esc(S.taxa[i])}</span></div>`);
  const cladeRow = (node, depth) => {
    const g = node.group, c = g || S.root, id = g ? String(g.id) : 'root';
    const nSel = node.leaves.filter(i => selected.has(i)).length;
    const open = !collapsed.has(id);
    rows.push(`<div class="orow clade${g && g.id === activeGroup ? ' active' : ''}${nSel === node.leaves.length ? ' allsel' : ''}" data-g="${id}" style="--d:${depth}" title="Click to select this clade's taxa">` +
      `<button class="twisty" data-act="toggle" tabindex="-1" aria-label="${open ? 'Collapse' : 'Expand'} ${esc(c.name)}">${open ? '▾' : '▸'}</button>` +
      `<span class="swatch${g ? '' : ' rootsw'}"${g ? ` style="background:${g.color}"` : ''}></span>` +
      `<span class="oname">${esc(c.name)}</span>` +
      (hasAge(c) ? `<span class="oage">${esc(ageText(c))}</span>` : '') +
      `<span class="ocount">${node.leaves.length} taxa${nSel && nSel < node.leaves.length ? ` · ${nSel} selected` : ''}</span></div>`);
    if (open) node.children.forEach(k => k.leaf !== undefined ? taxonRow(k.leaf, depth + 1) : cladeRow(k, depth + 1));
  };
  cladeRow(T.root, 0);
  el.innerHTML = rows.join('');
}

// Expands the clade's ancestors and scrolls its row into view.
export function revealInOutline(node) {
  let changed = false;
  for (let n = node.parent; n; n = n.parent) {
    const id = n.group ? String(n.group.id) : 'root';
    if (collapsed.delete(id)) changed = true;
  }
  if (changed) renderOutline();
  const row = $('outline').querySelector(`.orow.clade[data-g="${node.group ? node.group.id : 'root'}"]`);
  row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

export function initOutline() {
  $('outline').addEventListener('mousedown', e => { if (e.shiftKey) e.preventDefault(); });
  $('outline').addEventListener('click', e => {
    const { T } = app;
    const row = e.target.closest('.orow');
    if (!row) return;
    if (row.classList.contains('taxon')) return toggleTaxon(+row.dataset.i, e, T.order);
    const id = row.dataset.g;
    if (e.target.closest('[data-act="toggle"]')) {
      collapsed.has(id) ? collapsed.delete(id) : collapsed.add(id);
      return renderOutline();
    }
    clickClade(id === 'root' ? T.root : findNode(T, +id), e);
  });
}
