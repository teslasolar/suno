import { api } from './api.js';
import { router } from './router.js';
import { toast } from './toast.js';

router.register('auth', async (el) => {
  el.innerHTML = `
    <h2>Session / Auth</h2>
    <div class="grid">
      <div class="card">
        <h3>Login to Suno</h3>
        <label>Email</label>
        <input id="auth-email" type="email" placeholder="you@email.com">
        <label>Password</label>
        <input id="auth-pass" type="password" placeholder="password">
        <button id="auth-login">Login</button>
      </div>
      <div class="card">
        <h3>Session Status</h3>
        <div id="auth-info" class="empty">Loading...</div>
        <button id="auth-refresh" class="secondary" style="margin-top:.75rem">Refresh Session</button>
      </div>
    </div>`;

  const load = async () => {
    try {
      const s = await api.readUDT('Konomi/Session');
      const states = ['None', 'Valid', 'Expired'];
      document.getElementById('auth-info').innerHTML = `
        <p>State: <span class="badge ${s.State===1?'ok':s.State===2?'err':'warn'}">${states[s.State]||'Unknown'}</span></p>
        <p style="margin-top:.5rem">Credits: <strong>${s.Credits??'—'}</strong></p>
        <p style="margin-top:.25rem;font-size:.7rem;color:var(--dm)">User: ${s.UserID||'—'}</p>`;
    } catch { document.getElementById('auth-info').textContent = 'API offline'; }
  };

  document.getElementById('auth-login').onclick = async () => {
    const email = document.getElementById('auth-email').value;
    const pass = document.getElementById('auth-pass').value;
    if (!email || !pass) return toast('Fill both fields', 'error');
    try {
      await api.writeTag('Konomi/Cmd/Login/Email', email);
      await api.writeTag('Konomi/Cmd/Login/Pass', pass);
      await api.writeTag('Konomi/Cmd/Login/Trigger', true);
      toast('Login triggered', 'success');
      setTimeout(load, 3000);
    } catch (e) { toast(e.message, 'error'); }
  };

  document.getElementById('auth-refresh').onclick = async () => {
    try {
      await api.writeTag('Konomi/Cmd/Refresh/Trigger', true);
      toast('Refresh triggered', 'success');
      setTimeout(load, 2000);
    } catch (e) { toast(e.message, 'error'); }
  };

  load();
});
