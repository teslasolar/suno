import { api } from './api.js';
import { router } from './router.js';
import { toast } from './toast.js';

router.register('auth', async (el) => {
  el.innerHTML = `
    <h2>Session / Auth</h2>
    <div class="grid">
      <div class="card">
        <h3>Auto-Extract from Browser</h3>
        <p style="font-size:.75rem;color:var(--dm);margin-bottom:.75rem">
          Reads suno.com cookies directly from your Chrome/Brave/Edge cookie database.
          Make sure you're logged into suno.com in your browser first.
        </p>
        <div style="display:flex;gap:.5rem;flex-wrap:wrap">
          <button id="auth-extract">Auto-Extract</button>
          <button id="auth-extract-chrome" class="secondary">Chrome</button>
          <button id="auth-extract-brave" class="secondary">Brave</button>
          <button id="auth-extract-edge" class="secondary">Edge</button>
        </div>
        <p style="margin-top:.75rem;font-size:.7rem;color:var(--dm)">
          Or from terminal: <code>npm run cookie</code>
        </p>
      </div>
      <div class="card">
        <h3>Session Status</h3>
        <div id="auth-info" class="empty">Loading...</div>
        <button id="auth-credits" class="secondary" style="margin-top:.75rem">Refresh Credits</button>
      </div>
    </div>
    <div class="card" style="margin-top:1rem">
      <h3>Manual Cookie Paste</h3>
      <label>Cookie</label>
      <textarea id="auth-cookie" rows="3" placeholder="Paste cookie here (fallback if auto-extract doesn't work)"></textarea>
      <button id="auth-submit" class="secondary">Connect</button>
    </div>`;

  const load = async () => {
    try {
      const s = await api.authStatus();
      const info = document.getElementById('auth-info');
      if (s.authenticated) {
        info.innerHTML = `
          <p>Status: <span class="badge ok">Authenticated</span></p>
          <p style="margin-top:.5rem">Credits: <strong>${s.session?.Credits ?? '—'}</strong></p>`;
      } else {
        info.innerHTML = `<p>Status: <span class="badge warn">Not connected</span></p>
          <p style="margin-top:.5rem;font-size:.75rem;color:var(--dm)">Click Auto-Extract or paste a cookie.</p>`;
      }
    } catch { document.getElementById('auth-info').textContent = 'API offline'; }
  };

  async function extract(browser) {
    const btn = document.getElementById(browser ? `auth-extract-${browser}` : 'auth-extract');
    const orig = btn.textContent;
    btn.disabled = true; btn.textContent = 'Extracting...';
    try {
      const r = await api.authExtract(browser);
      toast(`Connected! Credits: ${r.credits}`, 'success');
      load();
    } catch (e) { toast(e.message, 'error'); }
    btn.disabled = false; btn.textContent = orig;
  }

  document.getElementById('auth-extract').onclick = () => extract(null);
  document.getElementById('auth-extract-chrome').onclick = () => extract('chrome');
  document.getElementById('auth-extract-brave').onclick = () => extract('brave');
  document.getElementById('auth-extract-edge').onclick = () => extract('edge');

  document.getElementById('auth-submit').onclick = async () => {
    const cookie = document.getElementById('auth-cookie').value.trim();
    if (!cookie) return toast('Paste your cookie', 'error');
    const btn = document.getElementById('auth-submit');
    btn.disabled = true; btn.textContent = 'Connecting...';
    try {
      const r = await api.authCookie(cookie);
      toast(`Connected! Credits: ${r.credits}`, 'success');
      load();
    } catch (e) { toast(e.message, 'error'); }
    btn.disabled = false; btn.textContent = 'Connect';
  };

  document.getElementById('auth-credits').onclick = async () => {
    try {
      const r = await api.credits();
      toast(`Credits: ${r.credits}`, 'success');
      load();
    } catch (e) { toast(e.message, 'error'); }
  };

  load();
});
