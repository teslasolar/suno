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
  await api.probe();
  if (api.isLive()) {
    dot.className = 'dot on';
    dot.title = 'API live on localhost:3456';
    badge.textContent = 'LIVE';
    badge.className = 'mode-badge live';
  } else {
    dot.className = 'dot on demo';
    dot.title = 'Running in demo mode (in-browser)';
    badge.textContent = 'DEMO';
    badge.className = 'mode-badge demo';
  }
}
poll();
setInterval(poll, 10000);
