import { api } from './api.js';
import { router } from './router.js';
import { toast } from './toast.js';

const CLIP_STATES = { submitted:'info', queued:'info', streaming:'ok', complete:'ok', error:'err' };

router.register('generate', async (el) => {
  el.innerHTML = `
    <h2>Create Song</h2>
    <div class="grid">
      <div class="card">
        <label>Prompt / Description</label>
        <textarea id="gen-prompt" placeholder="Describe your song..."></textarea>
        <label>Style Tags <span style="font-size:.65rem;color:var(--dm)">(optional, enables custom mode)</span></label>
        <input id="gen-style" placeholder="e.g. lo-fi hip hop, ambient, punk rock">
        <label>Title <span style="font-size:.65rem;color:var(--dm)">(optional)</span></label>
        <input id="gen-title" placeholder="Song title">
        <div class="toggle">
          <input type="checkbox" id="gen-inst">
          <label for="gen-inst" style="margin:0;text-transform:none">Instrumental (no lyrics)</label>
        </div>
        <button id="gen-submit">Generate</button>
      </div>
      <div class="card">
        <h3>Result</h3>
        <div id="gen-status" class="empty">Submit a prompt to generate</div>
      </div>
    </div>`;

  document.getElementById('gen-submit').onclick = async () => {
    const prompt = document.getElementById('gen-prompt').value;
    if (!prompt) return toast('Enter a prompt', 'error');
    const style = document.getElementById('gen-style').value;
    const title = document.getElementById('gen-title').value;
    const inst = document.getElementById('gen-inst').checked;
    const btn = document.getElementById('gen-submit');
    btn.disabled = true; btn.textContent = 'Generating...';
    try {
      const r = await api.generate(prompt, style, title, inst);
      toast('Generation started', 'success');
      pollClips(r.clipIds);
    } catch (e) { toast(e.message, 'error'); }
    btn.disabled = false; btn.textContent = 'Generate';
  };

  function renderClips(clips) {
    document.getElementById('gen-status').innerHTML = clips.map(c => `
      <div class="card" style="margin-bottom:.5rem">
        <div class="song-card">
          ${c.image_url ? `<img src="${c.image_url}" alt="">` : ''}
          <div class="info">
            <div class="title">${c.title || 'Generating...'}</div>
            <div class="meta">
              <span class="badge ${CLIP_STATES[c.status]||'info'}">${c.status}</span>
              ${c.metadata?.tags ? `<span style="margin-left:.5rem">${c.metadata.tags}</span>` : ''}
            </div>
            ${c.audio_url && c.status === 'complete' ? `<audio controls src="${c.audio_url}"></audio>` : ''}
          </div>
        </div>
      </div>`).join('');
  }

  function pollClips(ids) {
    const iv = setInterval(async () => {
      try {
        const clips = await api.poll(ids);
        renderClips(Array.isArray(clips) ? clips : [clips]);
        if (clips.every(c => c.status === 'complete' || c.status === 'error')) clearInterval(iv);
      } catch { clearInterval(iv); }
    }, 5000);
  }
});
