// Regression scenarios. golden.test.js replays each one through the modules and compares every
// export, warning and derived value with test/fixtures/golden.json, which was recorded from the
// single-file version of the app before it was split into modules.

// Inputs are either an example file (by name) or literal text.
export const SCENARIOS = [
  {
    name: 'primates-hand-made',
    input: { example: 'primates' },
    edits: [
      { create: { name: 'Hominidae', taxa: ['Homo_sapiens', 'Pan_troglodytes', 'Pan_paniscus', 'Gorilla_gorilla', 'Pongo_abelii', 'Pongo_pygmaeus'] } },
      { create: { name: 'HomoPan', taxa: ['Homo_sapiens', 'Pan_troglodytes', 'Pan_paniscus'] } },
      { create: { name: 'Pan', taxa: ['Pan_troglodytes', 'Pan_paniscus'] } },
      { create: { name: '', taxa: ['Macaca_mulatta', 'Macaca_fascicularis', 'Papio_anubis'] } },
      { create: { name: "Strep sirrhini's", taxa: ['Microcebus_murinus', 'Otolemur_garnettii'] } },
      { group: 'Hominidae', set: { lower: 13, upper: 18 } },
      { group: 'HomoPan', set: { lower: 6, upper: 10, dist: { type: 'lognormal', M: 0.5, S: 0.8, real: true, offset: null } } },
      { group: 'Pan', set: { lower: 1, upper: 2.5, dist: { type: 'gamma', alpha: 2, theta: 0.3 } } },
      { group: 'clade4', set: { lower: 5, dist: { type: 'exponential', mean: 1.5 } } },
      { group: "Strep sirrhini's", set: { dist: { type: 'lognormal', M: 1, S: 0.5, real: false, offset: 30 } } },
      { root: { lower: 55, upper: 90, dist: { type: 'normal', mean: 72.5, sigma: 8.75 } } },
    ],
  },
  { name: 'mammals', input: { example: 'mammals' }, edits: [] },
  {
    name: 'mammals-with-distributions',
    input: { example: 'mammals' },
    edits: [
      { group: 'HOMININI', set: { dist: { type: 'gamma', alpha: 3, theta: 0.5, offset: 6 } } },
      { group: 'BOVIDAE', set: { dist: { type: 'exponential', mean: 2 } } },
      { group: 'CARNIVORA', set: { dist: { type: 'normal', mean: 50, sigma: 5 } } },
      { group: 'MURINAE', set: { dist: { type: 'lognormal', M: -1, S: null, real: false } } },
      { root: { dist: { type: 'uniform' } } },
    ],
  },
  { name: 'metazoa', input: { example: 'metazoa' }, edits: [] },
  {
    name: 'warnings',
    input: { text: '(((A,B)[&name=X,lower=5,upper=2],(C,D)[&name=Y,lower=40])[&name=Z,lower=10,upper=20],(E,F)[&name=A],G)[&lower=1];' },
    edits: [{ group: 'X', set: { dist: { type: 'exponential', mean: -1 } } }],
  },
];

// Parser inputs: the resulting taxa, groups and root are compared.
export const PARSE_INPUTS = [
  ['fasta', '>seq one\nACGT\n>seq_two desc\nACGT\n>seq one\nAC'],
  ['nexus-taxlabels', "#NEXUS\nbegin taxa; dimensions ntax=3; taxlabels A 'B c' [comment] D; end;"],
  ['nexus-matrix', "#NEXUS\nbegin data; dimensions ntax=3 nchar=4; format datatype=dna interleave; matrix\n'taxon one' ACGT\nB ACGT\nC ACGT\n\n'taxon one' ACGT\nB ACGT\nC ACGT\n;\nend;"],
  ['nexus-trees', '#NEXUS\nbegin trees; tree t1 = [&R] ((A:1,B:1)AB[&lower=1,upper=2]:1,C:2);\nend;'],
  ['phylip', ' 3 10\nAlpha ACGTACGTAC\nBeta  ACGTACGTAC\nGam   ACGTACGTAC'],
  ['newick-quoted', "(('a b':1.5,'it''s'[x]:2)'my clade'[&lower=1.5,upper=3],c:3.0e0)[&virtualRoot=true];"],
  ['newick-partial-root', '((A,B)[&name=X,lower=1,upper=2],C)[&name=Top,lower=5,upper=9];'],
  ['list', 'one\n# comment\ntwo\n\nthree\ntwo'],
];

// Export option combinations, applied on top of the defaults.
export const DEFAULT_OPTS = {
  ungrouped: true, labels: false, ages: true, treeId: '@tree',
  ccppForm: 'forest', conf: 0.9, declareTaxa: false, lphyData: 'D',
  idrefCcpp: false, idrefCp: true, idrefMrca: false,
};
export function optionVariants() {
  const v = [];
  const bools = [false, true];
  for (const ungrouped of bools) for (const labels of bools) for (const ages of bools)
    v.push(['newick', { ungrouped, labels, ages }]);
  for (const labels of bools) v.push(['nexus', { labels }]);
  for (const ccppForm of ['forest', 'sets']) {
    for (const idrefCcpp of bools) for (const declareTaxa of bools) v.push(['ccpp', { ccppForm, idrefCcpp, declareTaxa }]);
    for (const idrefCp of bools) for (const conf of [0.9, 0.95]) for (const declareTaxa of bools)
      v.push(['cprior', { ccppForm, idrefCp, conf, declareTaxa, treeId: '@Tree.t:x' }]);
    for (const idrefMrca of bools) for (const declareTaxa of bools) v.push(['mrca', { ccppForm, idrefMrca, declareTaxa }]);
  }
  for (const lphyData of ['D', '']) for (const conf of [0.9, 0.97]) v.push(['lphy', { lphyData, conf }]);
  return v.map(([fmt, o]) => ({ key: fmt + ' ' + JSON.stringify(o), fmt, opts: { ...DEFAULT_OPTS, ...o } }));
}
