// MRCA-prior distributions. Each clade may carry c.dist = { type, offset, ...params }. Only the
// MRCAPrior export uses it; without one, a clade with ages gets Uniform(min, max). Offset types
// default their offset to the min age.
import { round } from './util.js';

export const DISTS = {
  uniform:     { label: 'Uniform', short: 'U', params: [] },
  lognormal:   { label: 'Log-normal', short: 'LN', params: [['M', 'M'], ['S', 'S']], offset: true },
  exponential: { label: 'Exponential', short: 'Exp', params: [['mean', 'mean']], offset: true },
  gamma:       { label: 'Gamma', short: 'Γ', params: [['alpha', 'shape'], ['theta', 'scale']], offset: true },
  normal:      { label: 'Normal', short: 'N', params: [['mean', 'mean'], ['sigma', 'σ']] },
};
export const distOf = c => c.dist || { type: 'uniform' };
export const offsetOf = c => distOf(c).offset ?? c.lower ?? 0;

// Starting parameters for a newly chosen type, scaled to the clade's age range when there is one.
export function defaultDist(type, c) {
  const lo = c.lower ?? 0, span = c.upper != null && c.upper > lo ? c.upper - lo : null;
  switch (type) {
    case 'lognormal': return { type, M: span ? round(Math.log(span) - 1.645) : 0, S: 1, real: false };
    case 'exponential': return { type, mean: span ? round(span / 3) : 1 };
    case 'gamma': return { type, alpha: 2, theta: span ? round(span / 5) : 1 };
    case 'normal': return { type, mean: span ? round(lo + span / 2) : lo || 1, sigma: span ? round(span / 4) : 1 };
    default: return { type: 'uniform' };
  }
}

export function lnGamma(z) {
  const g = [676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61503916999185,
             12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
  z -= 1;
  let x = 0.99999999999980993;
  g.forEach((gi, i) => x += gi / (z + i + 1));
  const t = z + g.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

// Density and a plotting range for the clade's distribution, or null if it is not well defined.
export function densityOf(c) {
  const d = distOf(c), off = offsetOf(c);
  const ok = v => typeof v === 'number' && v > 0;
  switch (d.type) {
    case 'uniform': {
      const lo = c.lower ?? 0, hi = c.upper;
      if (hi == null || hi <= lo) return null;
      return { pdf: x => x >= lo && x <= hi ? 1 / (hi - lo) : 0, from: lo, to: hi, pad: true };
    }
    case 'lognormal': {
      if (!ok(d.S) || (d.real && !ok(d.M)) || typeof d.M !== 'number') return null;
      const mu = d.real ? Math.log(d.M) - d.S * d.S / 2 : d.M;
      return { pdf: x => { const y = x - off; return y <= 0 ? 0 : Math.exp(-((Math.log(y) - mu) ** 2) / (2 * d.S * d.S)) / (y * d.S * Math.sqrt(2 * Math.PI)); },
               from: off, to: off + Math.exp(mu + 3.3 * d.S) };
    }
    case 'exponential':
      if (!ok(d.mean)) return null;
      return { pdf: x => { const y = x - off; return y < 0 ? 0 : Math.exp(-y / d.mean) / d.mean; }, from: off, to: off + 6 * d.mean };
    case 'gamma': {
      if (!ok(d.alpha) || !ok(d.theta)) return null;
      const lg = lnGamma(d.alpha);
      return { pdf: x => { const y = x - off; return y <= 0 ? 0 : Math.exp((d.alpha - 1) * Math.log(y) - y / d.theta - lg - d.alpha * Math.log(d.theta)); },
               from: off, to: off + d.theta * (d.alpha + 6 * Math.sqrt(d.alpha)) };
    }
    case 'normal':
      if (!ok(d.sigma) || typeof d.mean !== 'number') return null;
      return { pdf: x => Math.exp(-((x - d.mean) ** 2) / (2 * d.sigma ** 2)) / (d.sigma * Math.sqrt(2 * Math.PI)),
               from: d.mean - 4 * d.sigma, to: d.mean + 4 * d.sigma };
  }
  return null;
}

// SVG plot of the density with the clade's min/max ages marked, plus its median and 95% interval.
export function distPlot(c) {
  const dens = densityOf(c);
  if (!dens) return '<div class="sum">Set valid parameters to see the density.</div>';
  let a = Math.min(dens.from, c.lower ?? dens.from), b = Math.max(dens.to, c.upper ?? dens.to);
  const pad = (b - a) * (dens.pad ? 0.15 : 0.03);
  a = Math.max(0, a - pad); b += pad;
  const N = 400, xs = [], ys = [];
  for (let i = 0; i <= N; i++) { const x = a + (b - a) * i / N; xs.push(x); ys.push(dens.pdf(x)); }
  // Numerical CDF (trapezoid) for the summary
  const cdf = [0];
  for (let i = 1; i <= N; i++) cdf.push(cdf[i - 1] + (ys[i] + ys[i - 1]) / 2 * (xs[i] - xs[i - 1]));
  const total = cdf[N];
  const q = p => { const t = p * total; const i = cdf.findIndex(v => v >= t); return i <= 0 ? xs[0] : xs[i - 1] + (xs[i] - xs[i - 1]) * (t - cdf[i - 1]) / ((cdf[i] - cdf[i - 1]) || 1); };
  const W = 360, H = 70, top = Math.max(...ys.filter(Number.isFinite)) || 1;
  const X = x => (x - a) / (b - a) * W, Y = y => H - 4 - Math.min(y / top, 1) * (H - 10);
  const pts = xs.map((x, i) => `${X(x).toFixed(1)},${Y(ys[i]).toFixed(1)}`).join(' ');
  // The SVG stretches to the panel width, so strokes are non-scaling and the min/max labels are
  // HTML placed over it (SVG text would stretch with it). Labels near the right edge sit left of their line.
  const line = x => x == null ? '' :
    `<line x1="${X(x)}" x2="${X(x)}" y1="4" y2="${H - 4}" stroke="var(--danger)" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"/>`;
  const label = (x, lbl) => {
    if (x == null) return '';
    const pct = X(x) / W * 100;
    return `<span class="mark${pct > 70 ? ' end' : ''}" style="left:${pct.toFixed(2)}%">${lbl} ${x}</span>`;
  };
  // Probability mass between the clade's min and max ages
  const massIn = c.lower != null && c.upper != null
    ? (() => { const i0 = xs.findIndex(x => x >= c.lower), i1 = xs.findIndex(x => x >= c.upper); return i0 < 0 ? 0 : ((i1 < 0 ? total : cdf[i1]) - cdf[i0]) / total; })()
    : null;
  return `<div class="plotbox"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">` +
    `<polygon points="${X(a)},${H - 4} ${pts} ${X(b)},${H - 4}" fill="var(--accent)" fill-opacity=".15"/>` +
    `<polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="1.5" vector-effect="non-scaling-stroke"/>` +
    `<line x1="0" x2="${W}" y1="${H - 4}" y2="${H - 4}" stroke="var(--border)" vector-effect="non-scaling-stroke"/>` +
    line(c.lower) + line(c.upper) + `</svg>` + label(c.lower, 'min') + label(c.upper, 'max') + `</div>` +
    `<div class="sum">median ${round(q(0.5))} · 95% interval ${round(q(0.025))}–${round(q(0.975))}` +
    (massIn != null ? ` · ${(massIn * 100).toFixed(0)}% of mass between min and max` : '') + `</div>`;
}

// Reasons the clade's distribution cannot be written to BEAST, empty if it is valid.
export function distProblems(c) {
  const d = distOf(c), out = [];
  const pos = (k, lbl) => { if (!(typeof d[k] === 'number' && d[k] > 0)) out.push(`${DISTS[d.type].label} ${lbl} must be a positive number`); };
  if (d.type === 'lognormal') { pos('S', 'S'); if (d.real) pos('M', 'M (real space)'); else if (typeof d.M !== 'number') out.push('Log-normal M must be a number'); }
  if (d.type === 'exponential') pos('mean', 'mean');
  if (d.type === 'gamma') { pos('alpha', 'shape'); pos('theta', 'scale'); }
  if (d.type === 'normal') { pos('sigma', 'σ'); if (typeof d.mean !== 'number') out.push('Normal mean must be a number'); }
  if (DISTS[d.type].offset && offsetOf(c) < 0) out.push('offset must not be negative');
  return out;
}
