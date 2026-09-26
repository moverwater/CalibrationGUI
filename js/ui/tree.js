// The tree view: an SVG cladogram of the groups, with coloured bands for clades and their ages.
import { app, view } from '../store.js';
import { esc } from '../util.js';
import { hasAge, ageText, findNode } from '../model.js';
import { $ } from './dom.js';
import { setSelection, toggleTaxon } from './selection.js';

// Draws app.T, storing each node's position (x, y, yTop, yBot) on the node.
export function renderTree() {
  const { S, T, selected, activeGroup } = app;
  const svg = $('tree');
  if (!S.taxa.length) { svg.innerHTML = ''; svg.setAttribute('width', 0); svg.setAttribute('height', 0); return; }
  const { root } = T;
  const ROW = 20, PADT = 16;
  const maxName = Math.max(0, ...S.groups.map(g => Math.max(g.name.length, ageText(g).length * 0.95)));
  const COL = Math.min(120, Math.max(34, maxName * 6.6 + 18));
  const rootAge = ageText(S.root);
  const PADL = 22 + (rootAge ? Math.max(rootAge.length * 6.3, S.root.name.length * 6.6) + 8 : 0);
  const H = root.h;
  const leafX = PADL + H * COL;
  const maxTaxon = Math.max(...S.taxa.map(s => s.length));
  const W = leafX + 16 + maxTaxon * 7.2 + 20;
  let row = 0;
  const layout = node => {
    node.x = PADL + (H - node.h) * COL;
    if (node.leaf !== undefined) { node.y = PADT + row++ * ROW + ROW / 2; node.yTop = node.yBot = node.y; return; }
    node.children.forEach(layout);
    node.yTop = node.children[0].yTop;
    node.yBot = node.children[node.children.length - 1].yBot;
    node.y = (node.children[0].y + node.children[node.children.length - 1].y) / 2;
  };
  layout(root);
  const Ht = PADT * 2 + row * ROW;

  const bands = [], edges = [], nodes = [], leaves = [], labels = [];
  const walk = (node, parent) => {
    if (parent) edges.push(`M${parent.x},${node.y}H${node.x}`);
    if (node.leaf !== undefined) {
      const i = node.leaf, sel = selected.has(i);
      leaves.push(`<g class="leaf" data-i="${i}">` +
        (sel ? `<rect class="selbg" x="${node.x + 6}" y="${node.y - ROW / 2 + 1}" width="${S.taxa[i].length * 7.2 + 12}" height="${ROW - 2}" rx="4"/>` : '') +
        `<circle cx="${node.x}" cy="${node.y}" r="${sel ? 4 : 3}" fill="${sel ? 'var(--accent)' : 'var(--edge)'}"/>` +
        `<text x="${node.x + 12}" y="${node.y + 1}" fill="currentColor"${sel ? ' font-weight="600"' : ''}>${esc(S.taxa[i])}</text>` +
        `<rect x="${node.x - 6}" y="${node.y - ROW / 2}" width="${W - node.x}" height="${ROW}" fill="transparent"/></g>`);
      return;
    }
    if (node.children.length > 1) edges.push(`M${node.x},${node.children[0].y}V${node.children[node.children.length - 1].y}`);
    const g = node.group;
    if (g) {
      const inset = node.depth * 3;
      bands.push(`<rect x="${node.x - 8}" y="${node.yTop - ROW / 2 + 2}" width="${W - node.x + 8 - 6 - inset}" height="${node.yBot - node.yTop + ROW - 4}" rx="6" fill="${g.color}" fill-opacity="${g.id === activeGroup ? .2 : .08}" stroke="${g.color}" stroke-opacity="${g.id === activeGroup ? .9 : .45}"${g.id === activeGroup ? ' stroke-width="2"' : ''}/>`);
      const maxChars = Math.floor((COL - 16) / 6.6);
      const nm = g.name.length > maxChars ? g.name.slice(0, Math.max(1, maxChars - 1)) + '…' : g.name;
      labels.push(`<text class="glabel" x="${node.x - 11}" y="${node.y - 5}" text-anchor="end" fill="${g.color}">${esc(nm)}</text>`);
      if (hasAge(g)) labels.push(`<text class="gage" x="${node.x - 11}" y="${node.y + 4}" text-anchor="end">${esc(ageText(g))}</text>`);
    } else if (rootAge) {
      labels.push(`<text class="glabel" x="${node.x - 11}" y="${node.y - 5}" text-anchor="end" fill="currentColor">${esc(S.root.name)}</text>`);
      labels.push(`<text class="gage" x="${node.x - 11}" y="${node.y + 4}" text-anchor="end">${esc(rootAge)}</text>`);
    }
    node.children.forEach(c => walk(c, node));
    const all = node.leaves.every(i => selected.has(i));
    nodes.push(`<g class="inode" data-g="${g ? g.id : 'root'}"><title>${esc(g ? g.name : 'root')} (${node.leaves.length} taxa) — click to select</title>` +
      `<circle cx="${node.x}" cy="${node.y}" r="10" fill="transparent"/>` +
      `<circle cx="${node.x}" cy="${node.y}" r="4.5" fill="${all ? 'var(--accent)' : g ? g.color : 'var(--panel)'}" stroke="${g ? g.color : 'var(--edge)'}" stroke-width="1.5"/></g>`);
  };
  walk(root, null);
  // Stem to root
  edges.push(`M${rootAge ? 4 : PADL - 14},${root.y}H${root.x}`);

  svg.setAttribute('width', W);
  svg.setAttribute('height', Ht);
  svg.setAttribute('viewBox', `0 0 ${W} ${Ht}`);
  svg.style.color = 'var(--text)';
  svg.innerHTML = bands.join('') + `<path class="edge" d="${edges.join('')}"/>` + labels.join('') + leaves.join('') + nodes.join('');
}

export function initTree() {
  $('tree').addEventListener('mousedown', e => { if (e.shiftKey) e.preventDefault(); });
  $('tree').addEventListener('click', e => {
    const { T, selected } = app;
    const leaf = e.target.closest('.leaf');
    if (leaf) return toggleTaxon(+leaf.dataset.i, e, T.order);
    const inode = e.target.closest('.inode');
    if (inode) {
      const id = inode.dataset.g;
      const node = id === 'root' ? T.root : findNode(T, +id);
      const additive = e.shiftKey || e.metaKey || e.ctrlKey;
      const allSel = node.leaves.every(i => selected.has(i));
      if (additive && allSel) node.leaves.forEach(i => selected.delete(i));
      else setSelection(node.leaves, additive);
      app.activeGroup = node.group ? node.group.id : null;
      view.refreshSelection();
    }
  });
}
