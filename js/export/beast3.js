// BEAST 3 XML snippets: the CalibratedCPP tree prior's clades, the CalibrationPrior on their
// ages, and independent MRCAPriors.
//
// Every snippet declares a clade's TaxonSet under the clade name (and the constraint tree as
// "calibrationForest"), so any snippet can instead refer by idref to what another one declares.
import { xmlAttr } from '../util.js';
import { hasAge, isCalibrated, groupsInTreeOrder } from '../model.js';
import { DISTS, distOf, offsetOf, distProblems } from '../distributions.js';
import { toNewick } from './newick.js';

const REAL = 'beast.base.spec.inference.parameter.RealScalarParam';
const noCalibrations = '<!-- No clade has both a min and a max age, so there is no CalibrationPrior to add -->';
const idrefNote = ids => `<!-- Refers by idref to TaxonSets declared in another snippet: ${ids.join(', ')} -->`;
const forestIdrefNote = '<!-- Refers by idref to the calibrationForest declared in another snippet -->';

// Emits <taxon> elements, declaring each taxon on first use when opts.declareTaxa is set.
function taxonWriter(opts) {
  const declared = new Set();
  return (t, indent) => {
    if (opts.declareTaxa && !declared.has(t)) { declared.add(t); return `${indent}<taxon id="${xmlAttr(t)}" spec="Taxon"/>`; }
    return `${indent}<taxon idref="${xmlAttr(t)}"/>`;
  };
}

// Clades that CalibratedCPP conditions on: the root when calibrated, then every group (outer first).
function ccppClades(S, T) {
  const clades = [];
  if (isCalibrated(S.root)) clades.push({ c: S.root, leaves: T.root.leaves });
  groupsInTreeOrder(T).forEach(n => clades.push({ c: n.group, leaves: n.leaves }));
  return clades;
}

// Tree-prior side: the clades the calibrated CPP is conditioned on.
export function toCalibratedCPP(S, T, opts) {
  const clades = ccppClades(S, T);
  if (!clades.length) return '<!-- No groups or calibrations defined -->';
  const head = '<!-- Tree prior (e.g. calibratedcpp.CalibratedBirthDeathSkylineModel): add as child element(s) -->';
  if (opts.ccppForm === 'forest') {
    if (opts.idrefCcpp) return [head, forestIdrefNote, '<calibrationForest idref="calibrationForest"/>'].join('\n');
    return [head,
      `<calibrationForest id="calibrationForest" spec="calibration.CalibrationForestParser"`,
      `    newick="${xmlAttr(toNewick(S, T, { forest: true }))}"/>`,
    ].join('\n');
  }
  if (opts.idrefCcpp)
    return [head, idrefNote(clades.map(x => x.c.name)), ...clades.map(x => `<calibrations idref="${xmlAttr(x.c.name)}"/>`)].join('\n');
  const taxon = taxonWriter(opts);
  const out = [head];
  for (const { c, leaves } of clades) {
    out.push(`<calibrations id="${xmlAttr(c.name)}" spec="TaxonSet">`);
    leaves.forEach(i => out.push(taxon(S.taxa[i], '    ')));
    out.push('</calibrations>');
  }
  return out.join('\n');
}

// Age side: soft bounds on the calibrated clades, declaring their taxon sets (or forest) or
// referring by idref to the ones another snippet declares.
export function toCalibrationPrior(S, T, opts) {
  const clades = ccppClades(S, T).filter(x => isCalibrated(x.c));
  if (!clades.length) return noCalibrations;
  const tree = xmlAttr(opts.treeId), linked = opts.idrefCp;
  const out = ['<!-- Inside <distribution id="prior">: prior on the calibrated clade ages -->'];
  if (opts.ccppForm === 'forest') {
    if (linked) {
      out.push(forestIdrefNote, `<distribution id="calibrationPrior" spec="calibrationprior.CalibrationPrior" tree="${tree}" calibrationForest="@calibrationForest"/>`);
    } else {
      out.push(`<distribution id="calibrationPrior" spec="calibrationprior.CalibrationPrior" tree="${tree}">`,
        `    <calibrationForest id="calibrationForest" spec="calibration.CalibrationForestParser"`,
        `        newick="${xmlAttr(toNewick(S, T, { forest: true }))}"/>`,
        '</distribution>');
    }
    if (opts.conf !== 0.9) out.push('', `<!-- The constraint-tree form always uses confidenceLevel 0.9; switch to "Taxon sets" to use ${opts.conf} -->`);
    return out.join('\n');
  }
  const taxon = taxonWriter(opts);
  if (linked) out.push(idrefNote(clades.map(x => x.c.name)));
  out.push(`<distribution id="calibrationPrior" spec="calibrationprior.CalibrationPrior" tree="${tree}">`);
  let confDeclared = false;
  for (const { c, leaves } of clades) {
    const id = xmlAttr(c.name);
    let confAttr = '', confEl = null;
    if (opts.conf !== 0.9) {
      if (confDeclared) confAttr = ' confidenceLevel="@calibrationConfidence"';
      else { confDeclared = true; confEl = `        <confidenceLevel id="calibrationConfidence" spec="${REAL}" domain="UnitInterval" value="${opts.conf}"/>`; }
    }
    out.push(`    <calibration id="${id}.calibration" spec="calibrationprior.CalibrationCladePrior"${linked ? ` taxa="@${id}"` : ''}${confAttr}>`);
    if (!linked) {
      out.push(`        <taxa id="${id}" spec="TaxonSet">`);
      leaves.forEach(i => out.push(taxon(S.taxa[i], '            ')));
      out.push('        </taxa>');
    }
    out.push(`        <lowerAge id="${id}.lowerAge" spec="${REAL}" domain="NonNegativeReal" value="${c.lower}"/>`,
      `        <upperAge id="${id}.upperAge" spec="${REAL}" domain="NonNegativeReal" value="${c.upper}"/>`);
    if (confEl) out.push(confEl);
    out.push('    </calibration>');
  }
  out.push('</distribution>');
  return out.join('\n');
}

// <distr> element(s) for a clade's MRCA prior, or null (with a reason) when there is none to write.
function distrXml(c, id, indent) {
  const d = distOf(c);
  if (!c.dist && !hasAge(c)) return { xml: null };
  if (c.dist && distProblems(c).length) return { xml: null, skip: `${c.name}: ${distProblems(c)[0]}` };
  const off = offsetOf(c);
  if (d.type === 'uniform') {
    if (c.upper == null) return { xml: null, skip: `${c.name}: BEAST 3's Uniform needs a max age` };
    return { xml: `${indent}<distr id="${id}.Uniform" spec="beast.base.spec.inference.distribution.Uniform" lower="${c.lower ?? 0}" upper="${c.upper}"/>` };
  }
  const attrs = {
    lognormal: `M="${d.M}" S="${d.S}"${d.real ? ' meanInRealSpace="true"' : ''}`,
    exponential: `mean="${d.mean}"`,
    gamma: `alpha="${d.alpha}" theta="${d.theta}"`,
    normal: `mean="${d.mean}" sigma="${d.sigma}"`,
  }[d.type];
  const cls = { lognormal: 'LogNormal', exponential: 'Exponential', gamma: 'Gamma', normal: 'Normal' }[d.type];
  const inner = `spec="beast.base.spec.inference.distribution.${cls}" ${attrs}`;
  if (!DISTS[d.type].offset || off === 0) return { xml: `${indent}<distr id="${id}.${cls}" ${inner}/>` };
  return { xml: [`${indent}<distr id="${id}.distr" spec="beast.base.spec.inference.distribution.OffsetReal" offset="${off}">`,
                 `${indent}    <distribution id="${id}.${cls}" ${inner}/>`,
                 `${indent}</distr>`].join('\n') };
}

// One monophyletic MRCAPrior per clade, with the clade's age distribution when it has one.
export function toMrcaPrior(S, T, opts) {
  const gs = groupsInTreeOrder(T);
  const clades = gs.map(n => ({ c: n.group, leaves: n.leaves }));
  if (hasAge(S.root) || S.root.dist) clades.unshift({ c: S.root, leaves: T.root.leaves, root: true });
  if (!clades.length) return '<!-- No groups defined -->';
  const mrca = 'beast.base.spec.evolution.tree.MRCAPrior';
  const taxon = taxonWriter(opts);
  const out = ['<!-- Paste inside <distribution id="prior" ...> -->'];
  if (opts.idrefMrca) {
    out.push(idrefNote(clades.map(x => x.c.name)));
    // A CalibrationForestParser's clades are built in Java and have no XML ids to refer to.
    if (opts.ccppForm === 'forest') out.push('<!-- The constraint-tree form declares no TaxonSets; use the "Taxon sets" form in the snippet that declares them -->');
  }
  const skipped = [];
  // Inner groups first, so each taxon is declared in the smallest set and referenced elsewhere.
  for (const { c, leaves } of [...clades].sort((a, b) => a.leaves.length - b.leaves.length)) {
    const id = xmlAttr(c.name);
    const { xml, skip } = distrXml(c, id, '    ');
    if (skip) skipped.push(skip);
    const ref = opts.idrefMrca ? ` taxonset="@${id}"` : '';
    const open = `<distribution id="${id}.prior" spec="${mrca}" monophyletic="true" tree="${xmlAttr(opts.treeId)}"${ref}`;
    if (ref && !xml) { out.push(open + '/>'); continue; }
    out.push(open + '>');
    if (!ref) {
      out.push(`    <taxonset id="${id}" spec="TaxonSet">`);
      leaves.forEach(i => out.push(taxon(S.taxa[i], '        ')));
      out.push('    </taxonset>');
    }
    if (xml) out.push(xml);
    out.push('</distribution>');
  }
  if (skipped.length) out.push('', '<!-- Written without an age distribution (monophyly only):', ...skipped.map(s => '     ' + s), '-->');
  return out.join('\n');
}
