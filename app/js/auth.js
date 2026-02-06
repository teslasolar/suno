import { api } from './api.js';
import { router } from './router.js';
import { toast } from './toast.js';

router.register('auth', async (el) => {
  el.innerHTML = `
    <h2>Session / Auth</h2>
    <div class="grid">
      <div class="card">
        <h3>Authenticate with Suno Cookie</h3>
        <label>Cookie</label>
        <textarea id="auth-cookie" rows="4" placeholder="Paste your suno.com cookie here...&#10;&#10;DevTools > Network > any request to suno.com > Headers > Cookie"></textarea>
        <button id="auth-submit">Connect</button>
        <p style="margin-top:.5rem;font-size:.7rem;color:var(--dm)">
          Open suno.com, DevTools (F12), Network tab, reload, click any request, copy the Cookie header value
        </p>
      </div>
      <div class="card">
        <h3>Session Status</h3>
        <div id="auth-info" class="empty">Loading...</div>
        <button id="auth-credits" class="secondary" style="margin-top:.75rem">Refresh Credits</button>
      </div>
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
          <p style="margin-top:.5rem;font-size:.75rem;color:var(--dm)">Paste your suno.com cookie to connect.</p>`;
      }
    } catch { document.getElementById('auth-info').textContent = 'API offline'; }
  };

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
