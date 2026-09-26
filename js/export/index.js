// The export formats, their default options and how each is downloaded.
import { toNewick, toNexus } from './newick.js';
import { toCalibratedCPP, toCalibrationPrior, toMrcaPrior } from './beast3.js';
import { toLPhy } from './lphy.js';

export const DEFAULT_OPTS = {
  ungrouped: true, labels: false, ages: true, treeId: '@tree',
  ccppForm: 'forest', conf: 0.9, declareTaxa: false, lphyData: 'D',
  idrefCcpp: false, idrefCp: true, idrefMrca: false,
};

// fn(S, T, opts) → text. `xml` output is shown without line wrapping.
export const FORMATS = {
  newick: { fn: toNewick, ext: '.constraint.nwk', type: 'text/plain' },
  nexus:  { fn: toNexus, ext: '.constraint.nex', type: 'text/plain' },
  ccpp:   { fn: toCalibratedCPP, ext: '.tree-prior-calibrations.xml', type: 'application/xml', xml: true },
  cprior: { fn: toCalibrationPrior, ext: '.calibration-prior.xml', type: 'application/xml', xml: true },
  mrca:   { fn: toMrcaPrior, ext: '.mrca-priors.xml', type: 'application/xml', xml: true },
  lphy:   { fn: toLPhy, ext: '.calibrations.lphy', type: 'text/plain', xml: true },
};
