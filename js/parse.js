// Input parsers. parseInput detects the format and returns a dataset
// { taxa, groups: [{ name, taxa: names, lower, upper }], root, treeLeaves? } for model.prepareDataset.
import { num } from './util.js';
import { newRoot } from './model.js';

const tokenRe = /'((?:[^']|'')*)'|"([^"]*)"|([^\s;]+)/g;
function tokens(s) {
  const out = []; let m;
  tokenRe.lastIndex = 0;
  while ((m = tokenRe.exec(s))) out.push(m[1] !== undefined ? m[1].replace(/''/g, "'") : m[2] !== undefined ? m[2] : m[3]);
  return out;
}
const firstToken = line => { tokenRe.lastIndex = 0; const m = tokenRe.exec(line); return m ? (m[1] !== undefined ? m[1].replace(/''/g, "'") : m[2] ?? m[3]) : null; };

export function parseFasta(t) {
  return t.split(/\r?\n/).filter(l => l.startsWith('>')).map(l => l.slice(1).trim());
}
// Taxon names from a TAXLABELS or MATRIX block, or { newick } for a file with only a trees block.
export function parseNexus(t) {
  t = t.replace(/\[[^\]]*\]/g, '');
  let m = t.match(/\btaxlabels\b([\s\S]*?);/i);
  if (m) return tokens(m[1]);
  m = t.match(/\bmatrix\b([\s\S]*?);/i);
  if (m) return m[1].split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(firstToken);
  m = t.match(/\btree\s+[^=]+=\s*(?:\[[^\]]*\]\s*)?([\s\S]*?;)/i);
  if (m) return { newick: m[1] };
  return [];
}
export function parsePhylip(t) {
  const lines = t.split(/\r?\n/).filter(l => l.trim());
  const ntax = parseInt(lines[0].trim().split(/\s+/)[0], 10);
  return lines.slice(1, 1 + ntax).map(l => l.trim().split(/\s+/)[0]);
}

// BEAST XML: taxa from <sequence taxon="..."> (falling back to <taxon id="...">), plus the
// constraint tree of a calibration.CalibrationForestParser if there is one. Needs a DOMParser.
export function parseBeastXml(t) {
  const doc = new DOMParser().parseFromString(t, 'application/xml');
  const err = doc.getElementsByTagName('parsererror')[0];
  if (err) throw new Error('invalid XML: ' + (err.querySelector('div') || err).textContent.trim().split('\n')[0]);
  const all = [...doc.getElementsByTagName('*')];
  let taxa = all.filter(el => el.localName === 'sequence' && el.hasAttribute('taxon')).map(el => el.getAttribute('taxon'));
  if (!taxa.length) taxa = all.filter(el => el.localName === 'taxon' && el.hasAttribute('id')).map(el => el.getAttribute('id'));
  // newick is a String input: either an attribute or a child element (<newick>…</newick> or <input name="newick">…</input>)
  let forest = null;
  const fp = all.find(el => (el.getAttribute('spec') || '').endsWith('CalibrationForestParser'));
  if (fp) {
    if (fp.hasAttribute('newick')) forest = fp.getAttribute('newick');
    else {
      const child = [...fp.children].find(c => c.localName === 'newick' || (c.localName === 'input' && c.getAttribute('name') === 'newick'));
      if (child) forest = child.textContent;
    }
    if (forest !== null && !forest.trim()) forest = null;
  }
  return { taxa, forest };
}

// Newick with quoted labels, comments, branch lengths and [&key=value,...] annotations
// (name, lower/lowerAge, upper/upperAge, virtualRoot). Returns a { name, children[] } tree.
export function parseNewick(s) {
  s = s.trim();
  let i = 0;
  const skip = () => {
    while (i < s.length) {
      if (/\s/.test(s[i])) i++;
      else if (s[i] === '[') { const j = s.indexOf(']', i); i = j < 0 ? s.length : j + 1; }
      else break;
    }
  };
  const label = () => {
    skip();
    if (s[i] === "'") {
      let out = ''; i++;
      while (i < s.length) {
        if (s[i] === "'" && s[i + 1] === "'") { out += "'"; i += 2; }
        else if (s[i] === "'") { i++; break; }
        else out += s[i++];
      }
      return out;
    }
    let out = '';
    while (i < s.length && !/[(),:;\[\s]/.test(s[i])) out += s[i++];
    return out;
  };
  const annotate = (n, body) => {
    for (const kv of body.split(',')) {
      const eq = kv.indexOf('=');
      if (eq < 0) continue;
      const key = kv.slice(0, eq).trim().toLowerCase(), val = kv.slice(eq + 1).trim();
      if (key === 'name') n.annName = val;
      else if (key === 'lower' || key === 'lowerage') n.lower = num(val);
      else if (key === 'upper' || key === 'upperage') n.upper = num(val);
      else if (key === 'virtualroot') n.virtualRoot = val.toLowerCase() === 'true';
    }
  };
  const node = () => {
    skip();
    const n = { name: '', children: [], lower: null, upper: null };
    if (s[i] === '(') {
      i++;
      for (;;) {
        n.children.push(node());
        skip();
        if (s[i] === ',') { i++; continue; }
        if (s[i] === ')') { i++; break; }
        throw new Error('Unexpected "' + (s[i] ?? 'end of input') + '" at position ' + i);
      }
    }
    // Label, branch length and annotations, in any order
    let hasLabel = false;
    for (;;) {
      while (i < s.length && /\s/.test(s[i])) i++;
      if (s[i] === '[') {
        const j = s.indexOf(']', i);
        const body = s.slice(i + 1, j < 0 ? s.length : j);
        i = j < 0 ? s.length : j + 1;
        if (body.startsWith('&')) annotate(n, body.slice(1));
      } else if (s[i] === ':') {
        i++; while (i < s.length && /[\s0-9eE.+\-]/.test(s[i])) i++;
      } else if (!hasLabel && i < s.length && !/[(),;]/.test(s[i])) {
        n.name = label(); hasLabel = true;
      } else break;
    }
    if (n.annName) n.name = n.annName;
    return n;
  };
  const root = node();
  skip();
  if (s[i] !== ';' && i < s.length) throw new Error('Unexpected "' + s[i] + '" at position ' + i);
  return root;
}

// Leaves, internal clades and the root calibration of a parsed Newick tree.
export function newickToGroups(root) {
  const taxa = [], groups = [];
  const walk = n => {
    if (!n.children.length) { taxa.push(n.name); return [n.name]; }
    const leaves = n.children.flatMap(walk);
    if (n !== root && leaves.length > 1) groups.push({ name: n.name, taxa: leaves, lower: n.lower, upper: n.upper });
    return leaves;
  };
  walk(root);
  const rootCal = root.virtualRoot ? newRoot()
    : { name: root.name || 'root', lower: root.lower, upper: root.upper };
  return { taxa, groups, root: rootCal };
}

// Detects the format of `text` and parses it; null for empty input. Throws on malformed input.
export function parseInput(text) {
  const t = text.replace(/^﻿/, '').trim();
  if (!t) return null;
  let names, forest = null;
  if (t.startsWith('>')) names = parseFasta(t);
  else if (/^#nexus/i.test(t)) names = parseNexus(t);
  else if (/^\d+\s+\d+/.test(t)) names = parsePhylip(t);
  else if (t.startsWith('<')) ({ taxa: names, forest } = parseBeastXml(t));
  else if (t.startsWith('(')) names = { newick: t };
  else names = t.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));

  if (names && names.newick) return newickToGroups(parseNewick(names.newick));
  if (forest) {
    // A CalibratedCPP XML: its alignment taxa plus the taxa of its constraint tree
    const f = newickToGroups(parseNewick(forest));
    return { ...f, taxa: [...names, ...f.taxa], treeLeaves: f.taxa };
  }
  return { taxa: names, groups: [], root: newRoot() };
}
