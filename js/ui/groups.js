// The groups panel: one row per clade (the root first) with its name, ages and MRCA-prior
// distribution editor, plus the group actions (create, redefine, delete, rename, set ages).
import { app, view, commit } from '../store.js';
import { esc, num } from '../util.js';
import { hasAge, cladeById, validateSelection, addGroup, findNode } from '../model.js';
import { DISTS, distOf, offsetOf, defaultDist, distPlot } from '../distributions.js';
import { $, toast } from './dom.js';
import { setSelection } from './selection.js';

const clade = id => cladeById(app.S, id);

// ---------------------------------------------------------------- rendering
function distEditor(c, id) {
  const d = distOf(c), spec = DISTS[d.type];
  const field = (key, label) => `<label>${label} <input type="text" data-d="${key}" value="${d[key] ?? ''}" inputmode="decimal" spellcheck="false"></label>`;
  let html = `<div class="distEd" data-g="${id}"><select data-d="type">` +
    Object.entries(DISTS).map(([k, v]) => `<option value="${k}"${k === d.type ? ' selected' : ''}>${v.label}</option>`).join('') + `</select>`;
  if (d.type === 'uniform') html += `<span class="note" style="flex-basis:auto">bounds are the clade's min and max ages</span>`;
  spec.params.forEach(([k, lbl]) => html += field(k, lbl));
  if (d.type === 'lognormal') html += `<label class="chk"><input type="checkbox" data-d="real"${d.real ? ' checked' : ''}>M in real space</label>`;
  if (spec.offset) html += `<label title="Leave empty to use the min age">offset <input type="text" data-d="offset" value="${d.offset ?? ''}" placeholder="${c.lower ?? 0}" inputmode="decimal" spellcheck="false"></label>`;
  html += `<div class="plot">${distPlot(c)}</div>`;
  if (c.dist) html += `<button class="icon" data-act="resetDist" style="margin-left:auto" title="Back to the default Uniform(min, max)">reset</button>`;
  return html + `</div>`;
}

export function renderGroups() {
  const { S, T, activeGroup, distOpen } = app;
  if (!S.taxa.length) { $('groupList').innerHTML = ''; return; }
  const ageInputs = c =>
    `<input type="text" class="age" data-k="lower" value="${c.lower ?? ''}" placeholder="min" inputmode="decimal" spellcheck="false">` +
    `<span class="dash">–</span>` +
    `<input type="text" class="age" data-k="upper" value="${c.upper ?? ''}" placeholder="max" inputmode="decimal" spellcheck="false">`;
  const distBtn = (c, id) => {
    const d = distOf(c), shown = c.dist || hasAge(c);
    return `<button class="icon dist${c.dist ? ' set' : ''}${distOpen === id ? ' open' : ''}" data-act="dist" tabindex="-1" ` +
      `title="MRCA prior distribution: ${DISTS[d.type].label}${DISTS[d.type].offset ? ', offset ' + offsetOf(c) : ''}">${shown ? DISTS[d.type].short : 'ƒ'}</button>`;
  };
  const rows = [
    `<div class="grp root" data-g="root" title="Calibrate the root (all taxa)">` +
    `<span class="swatch rootsw"></span>` +
    `<input type="text" class="nm" value="${esc(S.root.name)}" spellcheck="false" title="Rename">` +
    `<span class="n">${S.taxa.length}</span>${ageInputs(S.root)}<span class="btns">${distBtn(S.root, 'root')}</span></div>`,
  ];
  if (distOpen === 'root') rows.push(distEditor(S.root, 'root'));
  const walk = (node, depth) => {
    if (node.leaf !== undefined) return;
    if (node.group) {
      const g = node.group;
      rows.push(`<div class="grp${g.id === activeGroup ? ' active' : ''}" data-g="${g.id}" style="padding-left:${12 + (depth - 1) * 14}px">` +
        `<span class="swatch" style="background:${g.color}"></span>` +
        `<input type="text" class="nm" value="${esc(g.name)}" spellcheck="false" title="Rename">` +
        `<span class="n">${g.taxa.length}</span>${ageInputs(g)}<span class="btns">${distBtn(g, g.id)}` +
        `<button class="icon" data-act="redefine" tabindex="-1" title="Replace this group's taxa with the current selection">⟲</button>` +
        `<button class="icon" data-act="delete" tabindex="-1" title="Delete group">✕</button></span></div>`);
      if (distOpen === g.id) rows.push(distEditor(g, g.id));
    }
    node.children.forEach(c => walk(c, depth + 1));
  };
  walk(T.root, 0);
  if (!S.groups.length) rows.push('<div class="pad muted">No groups yet. Select taxa and press <b>Create group</b>.</div>');
  $('groupList').innerHTML = rows.join('');
  markGroupWarnings();
}

// Updates in place after an edit made inside the groups list (see store.view.render).
export function refreshGroupsInPlace() {
  markGroupWarnings();
  refreshDistPlot();
  refreshDistButtons();
}
function refreshDistPlot() {
  if (app.distOpen == null) return;
  const ed = document.querySelector(`#groupList .distEd[data-g="${app.distOpen}"] .plot`);
  const c = clade(app.distOpen);
  if (ed && c) ed.innerHTML = distPlot(c);
}
function refreshDistButtons() {
  document.querySelectorAll('#groupList .grp button.dist').forEach(b => {
    const c = clade(b.closest('.grp').dataset.g), d = distOf(c);
    b.textContent = c.dist || hasAge(c) ? DISTS[d.type].short : 'ƒ';
    b.title = `MRCA prior distribution: ${DISTS[d.type].label}${DISTS[d.type].offset ? ', offset ' + offsetOf(c) : ''}`;
  });
  // The offset placeholder follows the min age
  document.querySelectorAll('#groupList .distEd input[data-d="offset"]').forEach(inp => {
    inp.placeholder = clade(inp.closest('.distEd').dataset.g).lower ?? 0;
  });
}
function markGroupWarnings() {
  const bad = new Map();
  app.W.forEach(w => w.id != null && bad.set(String(w.id), (bad.has(String(w.id)) ? bad.get(String(w.id)) + '\n' : '') + w.msg));
  document.querySelectorAll('#groupList .grp').forEach(row => {
    const m = bad.get(row.dataset.g);
    row.classList.toggle('warn', !!m);
    row.title = m || '';
  });
}
export function renderWarnings() {
  const el = $('warnings');
  el.innerHTML = app.W.map(w => `<div>⚠ ${esc(w.msg)}</div>`).join('');
  el.classList.toggle('show', app.W.length > 0);
}

// ---------------------------------------------------------------- actions
export function createGroup() {
  const { S } = app;
  const t = [...app.selected].sort((a, b) => a - b);
  const err = validateSelection(S, t);
  if (err) return toast(err, true);
  const name = $('groupName').value.trim();
  if (name && (S.groups.some(g => g.name === name) || S.root.name === name)) return toast(`A group named "${name}" already exists`, true);
  let id;
  commit(() => {
    id = addGroup(app.S, name, t);
    app.selected.clear();
  });
  app.activeGroup = id;
  $('groupName').value = '';
  renderGroups();
}
function redefineGroup(id) {
  const g = app.S.groups.find(g => g.id === id);
  const t = [...app.selected].sort((a, b) => a - b);
  const err = validateSelection(app.S, t, id);
  if (err) return toast(err, true);
  commit(() => { g.taxa = t; });
  toast(`"${g.name}" now has ${t.length} taxa`);
}
function deleteGroup(id) {
  commit(() => { app.S.groups = app.S.groups.filter(g => g.id !== id); });
  if (app.activeGroup === id) app.activeGroup = null;
  if (app.distOpen === id) app.distOpen = null;
}
// Delete key: removes the clade whose taxa are exactly the current selection (the highlighted
// clade first), so a stale highlight never deletes something the user is no longer looking at.
export function deleteSelectedClade() {
  const { selected } = app;
  const matches = g => g.taxa.length === selected.size && g.taxa.every(i => selected.has(i));
  const g = app.S.groups.find(g => g.id === app.activeGroup && matches(g)) || app.S.groups.find(matches);
  if (!g) return toast('Select a clade to delete: click its node in the tree or its row in the groups list', true);
  deleteGroup(g.id);
  selected.clear();
  view.refreshSelection();
  toast(`Deleted "${g.name}" (Undo restores it)`);
}
function renameGroup(id, name, input) {
  const { S } = app;
  const g = clade(id);
  name = name.trim();
  if (!name || name === g.name) { input.value = g.name; return; }
  if (S.groups.some(o => o.name === name) || S.root.name === name) { input.value = g.name; return toast(`A clade named "${name}" already exists`, true); }
  commit(() => { g.name = name; }, true);
}
function setAge(id, key, value, input) {
  const g = clade(id);
  const v = value.trim() === '' ? null : num(value);
  if (value.trim() !== '' && (v === null || v < 0)) {
    input.value = g[key] ?? '';
    return toast('Ages must be non-negative numbers', true);
  }
  if (v === g[key]) { input.value = v ?? ''; return; }
  commit(() => { g[key] = v; }, true);
  input.value = v ?? '';
}
function setDist(id, key, target) {
  const c = clade(id);
  if (key === 'type') {
    commit(() => { c.dist = target.value === 'uniform' ? undefined : defaultDist(target.value, c); });
    return;
  }
  const d = { ...distOf(c) };
  if (key === 'real') d.real = target.checked;
  else {
    const raw = target.value.trim();
    const v = raw === '' ? null : num(raw);
    if (raw !== '' && v === null) { target.value = d[key] ?? ''; return toast('Enter a number', true); }
    if (key === 'offset') d.offset = v; else d[key] = v;
  }
  commit(() => { c.dist = d; }, true);
}

// ---------------------------------------------------------------- events
export function initGroups() {
  $('groupList').addEventListener('click', e => {
    const act = e.target.closest('button')?.dataset.act;
    if (act === 'resetDist') {
      const id = e.target.closest('.distEd').dataset.g;
      return commit(() => { clade(id).dist = undefined; });
    }
    const row = e.target.closest('.grp');
    if (!row || e.target.tagName === 'INPUT') return;
    if (act === 'dist') {
      const id = row.dataset.g === 'root' ? 'root' : +row.dataset.g;
      app.distOpen = app.distOpen === id ? null : id;
      return renderGroups();
    }
    if (row.dataset.g === 'root') {
      setSelection(app.T.root.leaves, false);
      app.activeGroup = null;
      return view.refreshSelection();
    }
    const id = +row.dataset.g;
    if (act === 'delete') return deleteGroup(id);
    if (act === 'redefine') return redefineGroup(id);
    const node = findNode(app.T, id);
    setSelection(node.leaves, e.shiftKey || e.metaKey || e.ctrlKey);
    app.activeGroup = id;
    view.refreshSelection();
    // Scroll the clade into view
    const wrap = $('treeWrap');
    const top = node.yTop - 40;
    if (top < wrap.scrollTop || node.yBot > wrap.scrollTop + wrap.clientHeight) wrap.scrollTo({ top, behavior: 'smooth' });
  });
  $('groupList').addEventListener('change', e => {
    const ed = e.target.closest('.distEd');
    if (ed && e.target.dataset.d) return setDist(ed.dataset.g, e.target.dataset.d, e.target);
    if (e.target.tagName !== 'INPUT') return;
    const id = e.target.closest('.grp').dataset.g;
    if (e.target.classList.contains('age')) setAge(id, e.target.dataset.k, e.target.value, e.target);
    else renameGroup(id, e.target.value, e.target);
  });
  $('groupList').addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' && e.key === 'Enter') e.target.blur();
  });

  // Selection bar above the tree
  $('btnGroup').onclick = createGroup;
  $('groupName').addEventListener('keydown', e => { if (e.key === 'Enter') createGroup(); });
  $('btnClearSel').onclick = () => { app.selected.clear(); app.activeGroup = null; view.refreshSelection(); };
}
