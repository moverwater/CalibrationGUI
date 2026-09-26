// Replays test/scenarios.js through the modules and compares every export, warning, tree order
// and density plot with test/fixtures/golden.json.gz, recorded from the single-file app.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

import { SCENARIOS, PARSE_INPUTS, optionVariants } from './scenarios.js';
import { EXAMPLES, exampleSource } from '../js/examples.js';
import { parseInput } from '../js/parse.js';
import { emptyState, prepareDataset, applyDataset, addGroup, buildTree, calWarnings, groupsInTreeOrder } from '../js/model.js';
import { distPlot } from '../js/distributions.js';
import { FORMATS } from '../js/export/index.js';

const repo = p => fileURLToPath(new URL('../' + p, import.meta.url));
const golden = JSON.parse(gunzipSync(readFileSync(repo('test/fixtures/golden.json.gz'))).toString());

const clone = x => x === undefined ? null : JSON.parse(JSON.stringify(x));
const summary = S => ({
  source: S.source, nextId: S.nextId, taxa: S.taxa.slice(),
  groups: S.groups.map(g => ({ id: g.id, name: g.name, taxa: g.taxa.map(i => S.taxa[i]), lower: g.lower ?? null, upper: g.upper ?? null, dist: clone(g.dist) })),
  root: clone(S.root),
});
function load(text, source) {
  const S = emptyState();
  applyDataset(S, prepareDataset(parseInput(text)), source);
  return S;
}

for (const sc of SCENARIOS) {
  test(`scenario ${sc.name}`, async t => {
    const ex = EXAMPLES.find(x => x.key === sc.input.example);
    const S = ex ? load(readFileSync(repo(ex.file), 'utf8'), exampleSource(ex)) : load(sc.input.text, 'scenario.newick');
    for (const e of sc.edits) {
      if (e.create) addGroup(S, e.create.name, e.create.taxa.map(n => S.taxa.indexOf(n)));
      else if (e.group) Object.assign(S.groups.find(g => g.name === e.group), clone(e.set));
      else if (e.root) Object.assign(S.root, clone(e.root));
    }
    const T = buildTree(S);
    const want = golden.scenarios[sc.name];
    assert.deepEqual(summary(S), want.state, 'state');
    assert.deepEqual(T.order.map(i => S.taxa[i]), want.order, 'tree order');
    assert.deepEqual(groupsInTreeOrder(T).map(n => n.group.name), want.groupsInTreeOrder, 'groups in tree order');
    assert.deepEqual(calWarnings(S, T), want.warnings, 'warnings');
    for (const c of [S.root, ...S.groups]) assert.equal(distPlot(c), want.plots[c.name], `plot of ${c.name}`);
    for (const v of optionVariants()) {
      await t.test(v.key, () => assert.equal(FORMATS[v.fmt].fn(S, T, v.opts), want.outputs[v.key]));
    }
  });
}

for (const [name, text] of PARSE_INPUTS) {
  test(`parse ${name}`, () => {
    assert.deepEqual(summary(load(text, 'input-' + name)), golden.parse[name]);
  });
}
