import { api } from './api.js';

const links = [
  ['status', 'Status'],
  ['auth', 'Auth'],
  ['generate', 'Create'],
  ['library', 'Library'],
  ['jobs', 'Jobs'],
  ['tags', 'Tags'],
];

const el = document.getElementById('nav');
el.innerHTML = `<span class="logo">KONOMI</span>` +
  links.map(([r, l]) =>
    `<a data-route="${r}" href="#${r}">${l}</a>`
  ).join('') +
  `<span class="mode-badge" id="mode-badge">...</span>` +
  `<span class="dot off" id="conn-dot"></span>`;

async function poll() {
  const dot = document.getElementById('conn-dot');
  const badge = document.getElementById('mode-badge');
  try {
    const h = await api.health();
    dot.className = 'dot on';
    if (h.authenticated) {
      badge.textContent = 'LIVE';
      badge.className = 'mode-badge live';
      dot.title = 'Connected + Authenticated';
    } else {
      badge.textContent = 'NO AUTH';
      badge.className = 'mode-badge demo';
      dot.title = 'Connected but not authenticated';
    }
  } catch {
    dot.className = 'dot off';
    dot.title = 'API offline';
    badge.textContent = 'OFFLINE';
    badge.className = 'mode-badge';
  }
}
poll();
setInterval(poll, 10000);
