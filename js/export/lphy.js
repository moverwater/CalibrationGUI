// LinguaPhylo snippet: one calibration(taxa, upper, lower) per clade, jointly handled by
// ConditionedMRCAPrior.
import { isCalibrated, groupsInTreeOrder } from '../model.js';

export function toLPhy(S, T, opts) {
  const used = new Set(['D', 'L', 'n', 'taxa', 'tree', 'calibrations', opts.lphyData]);
  const ident = base => {
    let s = base.replace(/[^A-Za-z0-9_]/g, '_');
    if (!/^[A-Za-z_]/.test(s)) s = '_' + s;
    let out = s;
    for (let k = 2; used.has(out); k++) out = s + '_' + k;
    used.add(out);
    return out;
  };
  const str = t => '"' + t.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
  const array = (name, leaves) => {
    const lines = [];
    let line = '';
    for (const i of leaves) {
      const s = str(S.taxa[i]);
      if (line && line.length + s.length > 96) { lines.push(line); line = ''; }
      line += (line ? ', ' : '') + s;
    }
    lines.push(line);
    return `${name} = [` + lines.join(',\n' + ' '.repeat(name.length + 4)) + '];';
  };

  const clades = [];
  if (isCalibrated(S.root)) clades.push({ c: S.root, leaves: T.root.leaves, root: true });
  groupsInTreeOrder(T).forEach(n => clades.push({ c: n.group, leaves: n.leaves }));
  const cal = clades.filter(x => isCalibrated(x.c));
  const skipped = clades.filter(x => !isCalibrated(x.c)).map(x => x.c.name);
  if (!cal.length) return '// No clade has both a min and a max age, so there are no LPhy calibrations to write.';

  const out = ['// Calibrations from Constraint Tree Builder: paste into the model{} block', ''];
  const dataVar = opts.lphyData.trim();
  for (const x of cal) {
    x.taxaVar = x.root && dataVar ? `${dataVar}.getTaxaNames()` : null;
    if (!x.taxaVar) { x.taxaVar = ident(x.c.name); out.push(array(x.taxaVar, x.leaves)); }
  }
  out.push('');
  for (const x of cal) {
    x.calVar = ident('c' + x.c.name.charAt(0).toUpperCase() + x.c.name.slice(1));
    out.push(`${x.calVar} = calibration(taxa=${x.taxaVar}, upper=${x.c.upper}, lower=${x.c.lower});`);
  }
  const p = opts.conf !== 0.9 ? `, p=${opts.conf}` : '';
  out.push(`calibrations ~ ConditionedMRCAPrior(calibrations=[${cal.map(x => x.calVar).join(', ')}]${p});`);
  if (skipped.length) out.push('', `// Not included (calibration() needs both a min and a max age): ${skipped.join(', ')}`);
  out.push('', '// Tree prior, e.g.:',
    `// tree ~ CalibratedCPP(calibrations=calibrations, diversification=diversification, turnover=turnover, rho=rho, n=n);`);
  return out.join('\n');
}
