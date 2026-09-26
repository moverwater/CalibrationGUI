// The taxa panel: filterable, sortable list of taxa with the groups each belongs to.
import { app, view } from '../store.js';
import { esc } from '../util.js';
import { $ } from './dom.js';
import { toggleTaxon } from './selection.js';

// Taxon indices shown in the list, in display order.
export function visibleTaxa() {
  const { S, T } = app;
  const f = $('filter').value;
  let test = () => true;
  if (f) {
    if ($('useRegex').checked) {
      try { const re = new RegExp(f, 'i'); test = s => re.test(s); $('filter').style.outlineColor = ''; }
      catch (e) { $('filter').style.outlineColor = 'var(--danger)'; test = () => false; }
    } else { const lf = f.toLowerCase(); test = s => s.toLowerCase().includes(lf); }
  }
  const ungroupedOnly = $('ungroupedOnly').checked;
  let idx;
  const sort = $('sortBy').value;
  if (sort === 'tree') idx = T.order;
  else if (sort === 'alpha') idx = S.taxa.map((_, i) => i).sort((a, b) => S.taxa[a].localeCompare(S.taxa[b], undefined, { numeric: true }));
  else idx = S.taxa.map((_, i) => i);
  return idx.filter(i => test(S.taxa[i]) && (!ungroupedOnly || !T.leafNodes[i].groups.length));
}

export function renderList() {
  const { S, T, selected } = app;
  const vis = visibleTaxa();
  $('taxonList').innerHTML = vis.map(i => {
    const groups = T.leafNodes[i].groups;
    const dots = groups.map(g => `<span class="dot" style="background:${g.color}" title="${esc(g.name)}"></span>`).join('');
    // The innermost group's name, so group membership does not rely on colour alone
    const inner = groups.length ? `<span class="gname" title="${esc(groups.map(g => g.name).join(' › '))}">${esc(groups[groups.length - 1].name)}</span>` : '';
    return `<div class="taxon${selected.has(i) ? ' sel' : ''}" data-i="${i}"><input type="checkbox" tabindex="-1"${selected.has(i) ? ' checked' : ''}><span class="nm" title="${esc(S.taxa[i])}">${esc(S.taxa[i])}</span>${inner}<span class="dots">${dots}</span></div>`;
  }).join('') || (S.taxa.length ? '<div class="pad muted">No taxa match the filter</div>' : '');
}

export function initTaxa() {
  $('taxonList').addEventListener('click', e => {
    const row = e.target.closest('.taxon');
    if (!row) return;
    e.preventDefault();
    toggleTaxon(+row.dataset.i, e, visibleTaxa());
  });
  $('taxonList').addEventListener('mousedown', e => { if (e.shiftKey) e.preventDefault(); });
  ['filter', 'useRegex', 'ungroupedOnly', 'sortBy'].forEach(id => $(id).addEventListener(id === 'filter' ? 'input' : 'change', renderList));
  $('btnSelShown').onclick = () => { visibleTaxa().forEach(i => app.selected.add(i)); view.refreshSelection(); };
  $('btnInvert').onclick = () => {
    const { selected } = app;
    visibleTaxa().forEach(i => selected.has(i) ? selected.delete(i) : selected.add(i));
    view.refreshSelection();
  };
}
