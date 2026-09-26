// The export panel: tab groups, per-format options, the output text, copy and download.
import { app, save, STORE_KEY } from '../store.js';
import { esc, num } from '../util.js';
import { FORMATS } from '../export/index.js';
import { $, toast } from './dom.js';

// A tab per target, each with one or more formats. The last format used in each group is
// remembered, so switching groups returns to it.
const TAB_GROUPS = {
  tree: [['newick', 'Newick'], ['nexus', 'NEXUS']],
  beast: [['ccpp', 'CalibratedCPP'], ['cprior', 'CalibrationPrior'], ['mrca', 'MRCAPrior']],
  lphy: [['lphy', 'LPhy']],
};
const lastInGroup = { tree: 'newick', beast: 'ccpp', lphy: 'lphy' };
const groupOfFmt = f => Object.keys(TAB_GROUPS).find(g => TAB_GROUPS[g].some(([k]) => k === f));
const TAB_KEY = STORE_KEY + '-tab';

export function renderTabs() {
  const group = groupOfFmt(app.fmt);
  [...$('tabs').children].forEach(b => b.classList.toggle('on', b.dataset.group === group));
  const subs = TAB_GROUPS[group];
  $('subtabs').innerHTML = subs.length < 2 ? '' :
    subs.map(([k, l]) => `<button data-fmt="${k}"${k === app.fmt ? ' class="on"' : ''}>${l}</button>`).join('');
}
function setFmt(f) {
  app.fmt = f;
  lastInGroup[groupOfFmt(f)] = f;
  try { localStorage.setItem(TAB_KEY, f); } catch (e) { /* ignore */ }
  renderTabs();
  renderOutput();
}

// The options shown for the current format.
function optionsHtml() {
  const { opts, fmt } = app;
  const chk = (key, label, title = '') => `<label class="chk"${title ? ` title="${title}"` : ''}><input type="checkbox" data-opt="${key}"${opts[key] ? ' checked' : ''}>${label}</label>`;
  const sel = (key, options, title = '') => `<select data-opt="${key}"${title ? ` title="${title}"` : ''}>` +
    options.map(([v, l]) => `<option value="${v}"${String(opts[key]) === String(v) ? ' selected' : ''}>${l}</option>`).join('') + '</select>';
  const treeIdInput = `<label class="muted">tree <input type="text" data-opt="treeId" value="${esc(opts.treeId)}" spellcheck="false" style="width:110px"></label>`;
  const confInput = `<label class="muted" title="Probability mass inside each soft bound">confidence <input type="text" data-opt="conf" value="${opts.conf}" style="width:48px"></label>`;
  const formSel = sel('ccppForm', [['forest', 'Constraint tree'], ['sets', 'Taxon sets']], 'Shared by the CalibratedCPP and CalibrationPrior snippets');
  const idrefChk = key => chk(key, opts.ccppForm === 'forest' && key !== 'idrefMrca' ? 'idref calibrationForest' : 'idref taxon sets',
    'Refer to the taxon sets declared in another snippet instead of declaring them here');
  const declare = chk('declareTaxa', 'declare taxa', 'Declare each Taxon on first use instead of referring to existing ids');
  switch (fmt) {
    case 'ccpp': return formSel + idrefChk('idrefCcpp') + (opts.ccppForm === 'sets' && !opts.idrefCcpp ? declare : '');
    case 'cprior': return formSel + idrefChk('idrefCp') + treeIdInput +
      (opts.ccppForm === 'sets' ? confInput + (!opts.idrefCp ? declare : '') : '');
    case 'mrca': return idrefChk('idrefMrca') + treeIdInput + (!opts.idrefMrca ? declare : '');
    case 'lphy': return `<label class="muted" title="Alignment variable from the data{} block; the root calibration uses its getTaxaNames(). Leave empty to list the taxa explicitly.">data <input type="text" data-opt="lphyData" value="${esc(opts.lphyData)}" spellcheck="false" style="width:60px"></label>` +
      confInput;
    default: return chk('ungrouped', 'ungrouped taxa') + chk('labels', 'clade names') + chk('ages', 'ages [&lower,upper]');
  }
}

export function renderOutput() {
  const { S, T, opts, fmt } = app;
  $('exportOpts').innerHTML = optionsHtml();
  const out = S.taxa.length ? FORMATS[fmt].fn(S, T, opts) : '';
  $('output').value = out;
  $('output').classList.toggle('xml', !!FORMATS[fmt].xml);
  $('btnCopy').disabled = $('btnDownload').disabled = !out;
}

export function initExport() {
  try {
    const t = localStorage.getItem(TAB_KEY);
    if (t && groupOfFmt(t)) { app.fmt = t; lastInGroup[groupOfFmt(t)] = t; }
  } catch (e) { /* ignore */ }

  $('tabs').addEventListener('click', e => {
    const b = e.target.closest('button'); if (b) setFmt(lastInGroup[b.dataset.group]);
  });
  $('subtabs').addEventListener('click', e => {
    const b = e.target.closest('button'); if (b) setFmt(b.dataset.fmt);
  });
  $('exportOpts').addEventListener('change', e => {
    const k = e.target.dataset.opt;
    if (!k) return;
    if (e.target.type === 'checkbox') app.opts[k] = e.target.checked;
    else if (k === 'conf') {
      const v = num(e.target.value);
      if (v === null || v <= 0 || v >= 1) { toast('Confidence level must be between 0 and 1', true); e.target.value = app.opts.conf; return; }
      app.opts.conf = v;
    } else app.opts[k] = e.target.value;
    save();
    renderOutput();
  });
  $('btnCopy').onclick = async () => {
    const txt = $('output').value;
    try { await navigator.clipboard.writeText(txt); }
    catch (e) { $('output').select(); document.execCommand('copy'); }
    toast('Copied to clipboard');
  };
  $('btnDownload').onclick = () => {
    const base = (app.S.source || 'constraint').replace(/\.[^.]+$/, '');
    const { ext, type } = FORMATS[app.fmt];
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([$('output').value + '\n'], { type }));
    a.download = base + ext;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
}
