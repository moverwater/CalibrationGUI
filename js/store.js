// Application state shared by the UI modules: the document (S), export options, view state,
// undo/redo and persistence in the browser.
import { emptyState, newRoot, hasForeignColors, recolorAll } from './model.js';
import { DEFAULT_OPTS } from './export/index.js';

export const STORE_KEY = 'constraint-tree-builder-v1';

export const app = {
  S: emptyState(),          // the document (see model.js)
  opts: { ...DEFAULT_OPTS }, // export options
  T: null,                  // clade tree derived from S for the current render
  W: [],                    // calibration warnings for the current render
  selected: new Set(),      // selected taxon indices
  activeGroup: null,        // id of the highlighted group
  anchor: null,             // taxon index for shift-click ranges
  distOpen: null,           // clade id whose MRCA-prior distribution editor is open
  fmt: 'newick',            // export format shown
};

// Set by main.js: redraw everything (keepGroupList: leave the groups list in place, so editing a
// field in it does not lose focus), or just the parts that show the selection.
export const view = {
  render: (keepGroupList = false) => {},
  refreshSelection: () => {},
};

const undoStack = [], redoStack = [];
export const canUndo = () => undoStack.length > 0;
export const canRedo = () => redoStack.length > 0;

export function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ S: app.S, opts: app.opts })); } catch (e) { /* storage unavailable */ }
}
export function restore() {
  try {
    const d = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (d && Array.isArray(d.S?.taxa)) { app.S = d.S; Object.assign(app.opts, d.opts || {}); }
    if (!app.S.root) app.S.root = newRoot();
    if (hasForeignColors(app.S)) recolorAll(app.S);  // saved with an older palette
  } catch (e) { /* ignore */ }
}

// Applies an undoable change to the document, then saves and redraws.
export function commit(fn, keepGroupList = false) {
  undoStack.push(JSON.stringify(app.S));
  if (undoStack.length > 200) undoStack.shift();
  redoStack.length = 0;
  fn();
  save();
  view.render(keepGroupList);
}
function step(from, to) {
  if (!from.length) return;
  to.push(JSON.stringify(app.S));
  app.S = JSON.parse(from.pop());
  if (!app.S.root) app.S.root = newRoot();
  app.selected.clear(); app.activeGroup = null;
  save(); view.render();
}
export const undo = () => step(undoStack, redoStack);
export const redo = () => step(redoStack, undoStack);
