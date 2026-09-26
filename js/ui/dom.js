// DOM helpers.
export const $ = id => document.getElementById(id);

let toastTimer;
export function toast(msg, err = false) {
  const t = $('toast');
  t.textContent = msg; t.className = 'show' + (err ? ' err' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.className = '', err ? 4000 : 2200);
}
