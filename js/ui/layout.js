// Resizable panels: the dividers either side of the tree and above the export area. Sizes are
// CSS variables on <main>, remembered in the browser; double-clicking a divider resets it.
import { STORE_KEY } from '../store.js';
import { $ } from './dom.js';

const SIZE_KEY = STORE_KEY + '-sizes';
const SIZE_LIMITS = { left: [160, 600], right: [300, 900], export: [120, 2000] };

export function initLayout() {
  const mainEl = document.querySelector('main');
  const applySizes = sizes => {
    for (const [k, v] of Object.entries(sizes)) mainEl.style.setProperty('--' + k, v + 'px');
  };
  const store = () => { try { localStorage.setItem(SIZE_KEY, JSON.stringify(sizes)); } catch (e) { /* ignore */ } };
  let sizes = {};
  try { sizes = JSON.parse(localStorage.getItem(SIZE_KEY) || '{}'); } catch (e) { /* ignore */ }
  applySizes(sizes);

  document.querySelectorAll('.gutter, .hgutter').forEach(g => {
    const key = g.dataset.size, col = g.classList.contains('gutter');
    g.addEventListener('pointerdown', e => {
      e.preventDefault();
      g.classList.add('drag');
      document.body.classList.add('resizing', col ? 'col' : 'row');
      const target = key === 'left' ? g.previousElementSibling : key === 'right' ? g.nextElementSibling : $('exportBox');
      const start = col ? e.clientX : e.clientY;
      const startSize = col ? target.getBoundingClientRect().width : target.getBoundingClientRect().height;
      // Dragging towards a panel shrinks it: the left panel grows rightwards, the others grow the other way.
      const sign = key === 'left' ? 1 : -1;
      const [lo, hi] = SIZE_LIMITS[key];
      const move = ev => {
        const maxH = key === 'export' ? target.parentElement.getBoundingClientRect().height - 150 : hi;
        const v = Math.round(Math.min(Math.min(hi, maxH), Math.max(lo, startSize + sign * ((col ? ev.clientX : ev.clientY) - start))));
        sizes[key] = v;
        applySizes({ [key]: v });
      };
      const up = () => {
        g.classList.remove('drag');
        document.body.classList.remove('resizing', 'col', 'row');
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
        store();
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    });
    g.addEventListener('dblclick', () => {
      delete sizes[key];
      mainEl.style.removeProperty('--' + key);
      store();
    });
  });
}
