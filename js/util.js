// Small helpers shared by the model, parsers, exporters and UI.

export const num = v => { const x = parseFloat(v); return Number.isFinite(x) ? x : null; };
export const round = x => +x.toPrecision(4);

// Escapes text for HTML element content and attribute values.
export const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Escapes text for a double-quoted XML attribute.
export const xmlAttr = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Trims names and drops empty and repeated ones, keeping first-seen order.
export function dedupe(names) {
  const seen = new Set(), out = [];
  for (let n of names) {
    n = (n ?? '').trim();
    if (n && !seen.has(n)) { seen.add(n); out.push(n); }
  }
  return out;
}
