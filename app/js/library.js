import { api } from './api.js';
import { router } from './router.js';

router.register('library', async (el) => {
  el.innerHTML = `<h2>Song Library</h2><div id="lib-list" class="empty">Loading...</div>`;
  try {
    const hist = await api.readUDT('Konomi/Jobs/History');
    const songs = [];
    for (const [, job] of Object.entries(hist)) {
      if (job?.Res?.Songs) {
        for (const [, s] of Object.entries(job.Res.Songs)) {
          if (s?.Title || s?.AudioURL) songs.push({ ...s, prompt: job.Req?.Prompt });
        }
      }
    }
    if (!songs.length) {
      document.getElementById('lib-list').innerHTML =
        '<div class="empty">No songs yet. Generate some first.</div>';
      return;
    }
    document.getElementById('lib-list').innerHTML = songs.map(s => `
      <div class="card">
        <div class="song-card">
          ${s.ImageURL ? `<img src="${s.ImageURL}" alt="">` : '<img alt="">'}
          <div class="info">
            <div class="title">${s.Title || 'Untitled'}</div>
            <div class="meta">${s.Meta?.Key||''} ${s.Meta?.BPM?s.Meta.BPM+'bpm':''} ${s.Meta?.Mood||''}</div>
            <div class="meta">${s.prompt||''}</div>
            ${s.AudioURL ? `<audio controls src="${s.AudioURL}"></audio>` : ''}
          </div>
        </div>
        ${s.Lyrics ? `<details style="margin-top:.5rem;font-size:.75rem;color:var(--dm)">
          <summary>Lyrics</summary><pre style="white-space:pre-wrap;margin-top:.25rem">${s.Lyrics}</pre>
        </details>` : ''}
      </div>`).join('');
  } catch (e) {
    document.getElementById('lib-list').innerHTML = `<div class="empty">Error: ${e.message}</div>`;
  }
});
