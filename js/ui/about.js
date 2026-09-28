// The About dialog (its content is in index.html).
import { $ } from './dom.js';

export function initAbout() {
  const dlg = $('aboutDlg');
  $('btnAbout').onclick = () => dlg.showModal();
  // Close when clicking the backdrop outside the dialog's content
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
}
