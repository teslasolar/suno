const routes = {};
let current = null;

function navigate(hash) {
  const route = hash.replace('#', '') || 'status';
  if (routes[route]) {
    current = route;
    document.getElementById('app').innerHTML = '';
    routes[route](document.getElementById('app'));
    document.querySelectorAll('nav a[data-route]').forEach(a =>
      a.classList.toggle('active', a.dataset.route === route)
    );
  }
}

export const router = {
  register(name, fn) { routes[name] = fn; },
  init() {
    window.addEventListener('hashchange', () => navigate(location.hash));
    navigate(location.hash);
  },
  current() { return current; },
};
