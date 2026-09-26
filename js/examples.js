// Example datasets in examples/, offered in the Examples menu. The file name is also used as
// the loaded dataset's source name.
export const EXAMPLES = [
  { key: 'primates', label: 'Primates', desc: '18 taxa, no groups: start from scratch', file: 'examples/primates-example.fasta' },
  { key: 'mammals', label: 'Mammals', desc: '72 taxa, 18 calibrations (including the MAMMALIA root)', file: 'examples/mammals_18cal_constraint-tree.newick' },
  { key: 'metazoa', label: 'Metazoa', desc: '54 taxa, 20 calibrations', file: 'examples/metazoa_20cal_constraint-tree.newick' },
];
export const exampleSource = x => x.file.split('/').pop();
