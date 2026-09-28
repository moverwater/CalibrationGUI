// The Tree / List switch for the centre panel. Only the visible view is drawn; the choice is
// remembered in the browser.
import { app, STORE_KEY } from '../store.js';
import { findNode } from '../model.js';
import { $ } from './dom.js';
import { renderTree, revealInTree } from './tree.js';
import { renderOutline, revealInOutline } from './outline.js';

const VIEW_KEY = STORE_KEY + '-view';
let current = 'tree';

export function renderCenter() {
  const list = current === 'list';
  $('tree').style.display = list ? 'none' : '';
  $('outline').hidden = !list;
  document.querySelectorAll('#viewSwitch button').forEach(b => {
    b.classList.toggle('on', b.dataset.view === current);
    b.setAttribute('aria-pressed', b.dataset.view === current);
  });
  list ? renderOutline() : renderTree();
}

// Brings the clade with this id ('root' or a group id) into view in the current view.
export function revealClade(id) {
  const node = id === 'root' ? app.T.root : findNode(app.T, +id);
  if (!node) return;
  current === 'list' ? revealInOutline(node) : revealInTree(node);
}

export function initViews() {
  try { if (localStorage.getItem(VIEW_KEY) === 'list') current = 'list'; } catch (e) { /* ignore */ }
  $('viewSwitch').addEventListener('click', e => {
    const b = e.target.closest('button[data-view]');
    if (!b || b.dataset.view === current) return;
    current = b.dataset.view;
    try { localStorage.setItem(VIEW_KEY, current); } catch (err) { /* ignore */ }
    $('treeWrap').scrollTo({ top: 0, left: 0 });
    renderCenter();
  });
}
