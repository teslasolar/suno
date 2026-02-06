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
  `<span class="dot off" id="conn-dot" title="API offline"></span>`;

async function poll() {
  const dot = document.getElementById('conn-dot');
  try {
    await api.status();
    dot.className = 'dot on';
    dot.title = 'API online';
  } catch {
    dot.className = 'dot off';
    dot.title = 'API offline';
  }
}
poll();
setInterval(poll, 5000);
