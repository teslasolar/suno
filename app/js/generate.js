import { api } from './api.js';
import { router } from './router.js';
import { toast } from './toast.js';

router.register('generate', async (el) => {
  el.innerHTML = `
    <h2>Create Song</h2>
    <div class="grid">
      <div class="card">
        <label>Prompt</label>
        <textarea id="gen-prompt" placeholder="Describe your song..."></textarea>
        <label>Style</label>
        <input id="gen-style" placeholder="e.g. lo-fi hip hop, ambient, punk rock">
        <div class="toggle">
          <input type="checkbox" id="gen-inst">
          <label for="gen-inst" style="margin:0;text-transform:none">Instrumental (no lyrics)</label>
        </div>
        <button id="gen-submit">Generate</button>
      </div>
      <div class="card">
        <h3>Active Job</h3>
        <div id="gen-status" class="empty">No active job</div>
      </div>
    </div>`;

  const JSTATES = ['Queued','Submitted','Processing','Done','Failed'];

  document.getElementById('gen-submit').onclick = async () => {
    const prompt = document.getElementById('gen-prompt').value;
    if (!prompt) return toast('Enter a prompt', 'error');
    const style = document.getElementById('gen-style').value;
    const inst = document.getElementById('gen-inst').checked;
    const btn = document.getElementById('gen-submit');
    btn.disabled = true; btn.textContent = 'Submitting...';
    try {
      const r = await api.generate(prompt, style, inst);
      toast('Job queued', 'success');
      pollJob(r.jobId);
    } catch (e) { toast(e.message, 'error'); }
    btn.disabled = false; btn.textContent = 'Generate';
  };

  async function pollJob(id) {
    const box = document.getElementById('gen-status');
    const iv = setInterval(async () => {
      try {
        const j = await api.job(id);
        const st = j.State ?? 0;
        box.innerHTML = `
          <p>Job: <code>${id.slice(0,8)}</code></p>
          <p>State: <span class="badge ${st===3?'ok':st===4?'err':'info'}">${JSTATES[st]}</span></p>
          <div class="progress"><div class="bar" style="width:${(j.Progress||0)*100}%"></div></div>
          ${st===3&&j.Res?.Songs?j.Res.Songs.filter(Boolean).map(s=>`
            <div class="song-card" style="margin-top:.75rem">
              <div class="info">
                <div class="title">${s.Title||'Untitled'}</div>
                ${s.AudioURL?`<audio controls src="${s.AudioURL}"></audio>`:''}
              </div>
            </div>`).join(''):''}
          ${st===4?`<p style="color:var(--rd);font-size:.8rem;margin-top:.5rem">${j.Res?.Error||'Unknown error'}</p>`:''}`;
        if (st >= 3) clearInterval(iv);
      } catch { clearInterval(iv); }
    }, 2000);
  }
});
