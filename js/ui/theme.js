// Light / Dark / System theme selector. "System" follows the operating system; a choice of Light
// or Dark is stored in the browser and set as <html data-theme>, which css/style.css keys on.
// index.html applies the stored choice before the page is drawn, so this key must match there.
import { STORE_KEY } from '../store.js';
import { $ } from './dom.js';

const THEME_KEY = STORE_KEY + '-theme';

function applyTheme(theme) {
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
}

export function initTheme() {
  const select = $('theme');
  select.value = document.documentElement.dataset.theme || 'system';
  select.addEventListener('change', () => {
    applyTheme(select.value);
    try {
      if (select.value === 'system') localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, select.value);
    } catch (e) { /* storage unavailable: the choice lasts until the page is closed */ }
  });
}
