// Keyboard shortcuts: undo/redo, G to group the selection, Delete to remove the selected clade,
// Escape to clear the selection. Ignored while typing in a field.
import { app, view, undo, redo } from '../store.js';
import { createGroup, deleteSelectedClade } from './groups.js';

export function initKeyboard() {
  document.addEventListener('keydown', e => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) && e.target.type !== 'checkbox';
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (mod && e.key.toLowerCase() === 'y' && !typing) { e.preventDefault(); redo(); return; }
    if (typing) { if (e.key === 'Escape') e.target.blur(); return; }
    if (e.key === 'Escape') { app.selected.clear(); app.activeGroup = null; view.refreshSelection(); }
    else if (e.key.toLowerCase() === 'g' && !mod) { e.preventDefault(); createGroup(); }
    else if ((e.key === 'Delete' || e.key === 'Backspace') && !mod) { e.preventDefault(); deleteSelectedClade(); }
  });
}
