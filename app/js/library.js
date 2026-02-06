import { api } from './api.js';
import { router } from './router.js';

router.register('library', async (el) => {
  let page = 0;
  el.innerHTML = `
    <h2>Song Library</h2>
    <div id="lib-list" class="empty">Loading...</div>
    <div style="display:flex;gap:.5rem;margin-top:1rem">
      <button id="lib-prev" class="secondary" disabled>Prev</button>
      <span id="lib-page" style="padding:.5rem;font-size:.8rem;color:var(--dm)">Page 1</span>
      <button id="lib-next" class="secondary">Next</button>
    </div>`;

  async function load() {
    const list = document.getElementById('lib-list');
    list.innerHTML = '<div class="empty">Loading...</div>';
    try {
      const clips = await api.library(page);
      if (!clips.length) {
        list.innerHTML = '<div class="empty">No songs yet. Generate some first.</div>';
        return;
      }
      list.innerHTML = clips.map(c => `
        <div class="card">
          <div class="song-card">
            ${c.image_url ? `<img src="${c.image_url}" alt="">` : '<img alt="">'}
            <div class="info">
              <div class="title">${c.title || 'Untitled'}</div>
              <div class="meta">
                ${c.metadata?.tags || ''} ${c.metadata?.duration ? Math.round(c.metadata.duration) + 's' : ''}
                <span class="badge ${c.status==='complete'?'ok':'info'}" style="margin-left:.5rem">${c.status}</span>
              </div>
              <div class="meta">${c.metadata?.gpt_description_prompt || ''}</div>
              ${c.audio_url ? `<audio controls src="${c.audio_url}"></audio>` : ''}
            </div>
          </div>
          ${c.metadata?.prompt ? `<details style="margin-top:.5rem;font-size:.75rem;color:var(--dm)">
            <summary>Lyrics</summary><pre style="white-space:pre-wrap;margin-top:.25rem">${c.metadata.prompt}</pre>
          </details>` : ''}
        </div>`).join('');
    } catch (e) {
      list.innerHTML = `<div class="empty">${e.message}</div>`;
    }
    document.getElementById('lib-page').textContent = `Page ${page + 1}`;
    document.getElementById('lib-prev').disabled = page === 0;
  }

  document.getElementById('lib-prev').onclick = () => { if (page > 0) { page--; load(); } };
  document.getElementById('lib-next').onclick = () => { page++; load(); };
  load();
});
