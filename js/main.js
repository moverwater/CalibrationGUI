// Entry point: wires the panels together and draws the app.
import { app, view, commit, undo, redo, restore, canUndo, canRedo } from './store.js';
import { emptyState, buildTree, calWarnings } from './model.js';
import { $, toast } from './ui/dom.js';
import { renderSelBar } from './ui/selection.js';
import { renderList, initTaxa } from './ui/taxa.js';
import { renderTree, initTree } from './ui/tree.js';
import { renderGroups, refreshGroupsInPlace, renderWarnings, initGroups } from './ui/groups.js';
import { renderTabs, renderOutput, initExport } from './ui/export.js';
import { initLayout } from './ui/layout.js';
import { initLoading } from './ui/loading.js';
import { initKeyboard } from './ui/keyboard.js';
import { initTheme } from './ui/theme.js';

view.render = (keepGroupList = false) => {
  const { S } = app;
  app.T = buildTree(S);
  app.W = calWarnings(S, app.T);
  $('empty').style.display = S.taxa.length ? 'none' : '';
  $('srcName').textContent = S.source || '';
  $('taxaCount').textContent = S.taxa.length || '';
  $('groupCount').textContent = S.groups.length || '';
  $('btnUndo').disabled = !canUndo();
  $('btnRedo').disabled = !canRedo();
  $('btnClearGroups').disabled = !S.groups.length;
  $('btnClearAll').disabled = !S.taxa.length;
  renderList();
  renderTree();
  if (keepGroupList) refreshGroupsInPlace(); else renderGroups();
  renderWarnings();
  renderOutput();
  renderSelBar();
};
view.refreshSelection = () => {
  renderList(); renderTree(); renderGroups(); renderSelBar();
};

$('btnUndo').onclick = undo;
$('btnRedo').onclick = redo;
$('btnClearGroups').onclick = () => { if (confirm('Remove all groups?')) commit(() => { app.S.groups = []; }); };
$('btnClearAll').onclick = () => {
  if (!confirm('Remove all taxa, groups and calibrations? (Undo restores them)')) return;
  commit(() => {
    app.S = emptyState();
    app.selected.clear(); app.activeGroup = null; app.anchor = null; app.distOpen = null;
  });
  toast('Cleared');
};

initTaxa();
initTree();
initGroups();
initExport();
initLayout();
initLoading();
initKeyboard();
initTheme();

restore();
renderTabs();
view.render();
document.documentElement.dataset.started = 'true';
