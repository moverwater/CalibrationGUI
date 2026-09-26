// Loading data: Open file, drag and drop, Paste, and the Examples menus.
import { app, commit } from '../store.js';
import { esc } from '../util.js';
import { hasAge, prepareDataset, applyDataset } from '../model.js';
import { parseInput } from '../parse.js';
import { EXAMPLES, exampleSource } from '../examples.js';
import { $, toast } from './dom.js';

// Parses `text` and replaces the current taxa, groups and calibrations with it (Undo restores them).
export function loadText(text, source) {
  let dataset;
  try { dataset = parseInput(text); }
  catch (e) { return toast('Could not parse ' + (source || 'input') + ': ' + e.message, true); }
  if (!dataset) return toast('Nothing to load', true);
  const prepared = prepareDataset(dataset);
  if (!prepared.names.length) return toast('No taxa found in ' + (source || 'input'), true);
  if ((app.S.groups.length || hasAge(app.S.root)) &&
      !confirm(`Load ${source || 'this input'}? It replaces the current taxa, groups and calibrations (Undo restores them).`)) return;
  commit(() => {
    applyDataset(app.S, prepared, source);
    app.selected.clear(); app.activeGroup = null; app.anchor = null; app.distOpen = null;
  });
  const { S } = app;
  const n = S.groups.length;
  const nc = S.groups.filter(hasAge).length + (hasAge(S.root) ? 1 : 0);
  toast(`Loaded ${prepared.names.length} taxa` + (n ? `, ${n} group${n === 1 ? '' : 's'}` : '') + (nc ? `, ${nc} calibration${nc === 1 ? '' : 's'}` : ''));
}

function readFile(f) {
  const r = new FileReader();
  r.onload = () => loadText(r.result, f.name);
  r.onerror = () => toast('Could not read ' + f.name, true);
  r.readAsText(f);
}

async function loadExample(x) {
  try {
    const res = await fetch(x.file);
    if (!res.ok) throw new Error(res.status + ' ' + res.statusText);
    loadText(await res.text(), exampleSource(x));
  } catch (e) {
    toast(`Could not load the ${x.label} example: ${e.message}`, true);
  }
}

const closeMenus = () => document.querySelectorAll('.exmenu .menu').forEach(m => m.hidden = true);

export function initLoading() {
  $('btnOpen').onclick = () => $('fileInput').click();
  $('fileInput').addEventListener('change', e => {
    const f = e.target.files[0]; if (f) readFile(f);
    e.target.value = '';
  });

  let dragDepth = 0;
  document.addEventListener('dragenter', e => { e.preventDefault(); dragDepth++; document.body.classList.add('drag'); });
  document.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; document.body.classList.remove('drag'); } });
  document.addEventListener('dragover', e => e.preventDefault());
  document.addEventListener('drop', e => {
    e.preventDefault(); dragDepth = 0; document.body.classList.remove('drag');
    const f = e.dataTransfer.files[0]; if (f) readFile(f);
  });

  $('btnPaste').onclick = () => { $('pasteText').value = ''; $('pasteDlg').showModal(); $('pasteText').focus(); };
  $('pasteDlg').addEventListener('close', () => {
    if ($('pasteDlg').returnValue === 'ok') loadText($('pasteText').value, 'pasted text');
  });

  document.querySelectorAll('.exmenu').forEach(m => {
    const btn = m.querySelector('button[data-menu]'), menu = m.querySelector('.menu');
    menu.innerHTML = EXAMPLES.map((x, i) => `<button data-ex="${i}">${esc(x.label)}<small>${esc(x.desc)}</small></button>`).join('');
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const open = menu.hidden;
      closeMenus();
      menu.hidden = !open;
    });
    menu.addEventListener('click', e => {
      const b = e.target.closest('button[data-ex]');
      if (!b) return;
      menu.hidden = true;
      loadExample(EXAMPLES[+b.dataset.ex]);
    });
  });
  document.addEventListener('click', e => { if (!e.target.closest('.exmenu')) closeMenus(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenus(); });
}
