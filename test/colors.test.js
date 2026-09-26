// Group colours: from the palette, never the same as the enclosing group or the groups directly
// inside, and different from sibling groups whenever the palette allows.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { EXAMPLES } from '../js/examples.js';
import { parseInput } from '../js/parse.js';
import { PALETTE, emptyState, prepareDataset, applyDataset, addGroup, buildTree, hasForeignColors, recolorAll } from '../js/model.js';

const repo = p => fileURLToPath(new URL('../' + p, import.meta.url));

function checkColours(S) {
  const T = buildTree(S);
  const walk = node => {
    if (node.leaf !== undefined) return;
    if (node.group) {
      const c = node.group.color, name = node.group.name;
      assert.ok(PALETTE.includes(c), `${name} uses a palette colour`);
      if (node.parent.group) assert.notEqual(c, node.parent.group.color, `${name} differs from its enclosing group`);
      for (const k of node.children) if (k.group) assert.notEqual(c, k.group.color, `${name} differs from ${k.group.name}`);
      const siblings = node.parent.children.filter(n => n.group && n !== node);
      if (siblings.length + 2 <= PALETTE.length)  // room for siblings, the parent and itself
        for (const s of siblings) assert.notEqual(c, s.group.color, `${name} differs from sibling ${s.group.name}`);
    }
    node.children.forEach(walk);
  };
  walk(T.root);
}

for (const ex of EXAMPLES) {
  test(`colours by structure: ${ex.label}`, () => {
    const S = emptyState();
    applyDataset(S, prepareDataset(parseInput(readFileSync(repo(ex.file), 'utf8'))), ex.file);
    checkColours(S);
  });
}

test('a new group avoids its neighbours', () => {
  const S = emptyState();
  applyDataset(S, prepareDataset(parseInput('(A,B,C,D,E,F,G,H);')), 'x');
  const t = n => [...n].map(ch => S.taxa.indexOf(ch));
  addGroup(S, 'outer', t('ABCDEF'));
  addGroup(S, 'ab', t('AB'));
  addGroup(S, 'cd', t('CD'));
  addGroup(S, 'ef', t('EF'));
  addGroup(S, 'abcd', t('ABCD'));  // inserted between outer and ab/cd
  checkColours(S);
});

test('sessions saved with an older palette are recoloured', () => {
  const S = emptyState();
  applyDataset(S, prepareDataset(parseInput('((A,B)x,(C,D)y,E);')), 'x');
  S.groups.forEach(g => { g.color = '#e6194b'; });
  assert.ok(hasForeignColors(S));
  recolorAll(S);
  assert.ok(!hasForeignColors(S));
  checkColours(S);
});
