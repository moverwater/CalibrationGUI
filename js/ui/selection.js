// Taxon selection, shared by the taxa list, the tree and the groups list.
import { app, view } from '../store.js';
import { $ } from './dom.js';

export function setSelection(indices, additive) {
  if (!additive) app.selected.clear();
  indices.forEach(i => app.selected.add(i));
}

// Click on a taxon: toggles it, or with shift sets the range from the last clicked taxon in
// `orderList` (the order the taxa are shown in).
export function toggleTaxon(i, e, orderList) {
  const { selected } = app;
  if (e.shiftKey && app.anchor !== null) {
    const a = orderList.indexOf(app.anchor), b = orderList.indexOf(i);
    if (a >= 0 && b >= 0) {
      const [lo, hi] = a < b ? [a, b] : [b, a];
      const on = selected.has(app.anchor);
      for (let k = lo; k <= hi; k++) on ? selected.add(orderList[k]) : selected.delete(orderList[k]);
      view.refreshSelection();
      return;
    }
  }
  selected.has(i) ? selected.delete(i) : selected.add(i);
  app.anchor = i;
  view.refreshSelection();
}

// Click on a clade (tree node or list row): selects its taxa, or with shift/⌘/Ctrl adds them
// (removes them if they were all selected already), and highlights the clade.
export function clickClade(node, e) {
  const { selected } = app;
  const additive = e.shiftKey || e.metaKey || e.ctrlKey;
  const allSel = node.leaves.every(i => selected.has(i));
  if (additive && allSel) node.leaves.forEach(i => selected.delete(i));
  else setSelection(node.leaves, additive);
  app.activeGroup = node.group ? node.group.id : null;
  view.refreshSelection();
}

export function renderSelBar() {
  const n = app.selected.size;
  $('selCount').textContent = `${n} selected`;
  $('btnGroup').disabled = n < 2;
  $('btnClearSel').disabled = !n;
}
