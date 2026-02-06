import { api } from './api.js';
import { router } from './router.js';

router.register('jobs', async (el) => {
  el.innerHTML = `
    <h2>Recent Songs</h2>
    <div id="jobs-list" class="empty">Loading...</div>
    <div style="margin-top:1rem">
      <button id="jobs-refresh" class="secondary">Refresh</button>
    </div>`;

  async function load() {
    try {
      const clips = await api.library(0);
      const target = document.getElementById('jobs-list');
      if (!clips.length) {
        target.innerHTML = '<div class="empty">No clips found</div>';
        return;
      }
      target.innerHTML = `<table><thead><tr>
        <th>Title</th><th>Status</th><th>Style</th><th>Created</th>
      </tr></thead><tbody>${clips.map(c => `<tr>
        <td style="color:var(--yw)">${c.title || '—'}</td>
        <td><span class="badge ${c.status==='complete'?'ok':c.status==='error'?'err':'info'}">${c.status}</span></td>
        <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dm)">${c.metadata?.tags || c.metadata?.gpt_description_prompt || '—'}</td>
        <td style="color:var(--dm)">${c.created_at ? new Date(c.created_at).toLocaleString() : '—'}</td>
      </tr>`).join('')}</tbody></table>`;
    } catch (e) {
      document.getElementById('jobs-list').innerHTML = `<div class="empty">${e.message}</div>`;
    }
  }

  document.getElementById('jobs-refresh').onclick = load;
  load();
});
