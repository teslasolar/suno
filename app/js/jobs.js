import { api } from './api.js';
import { router } from './router.js';

const JSTATES = ['Queued','Submitted','Processing','Done','Failed'];
const jbadge = (s) => s===3?'ok':s===4?'err':'info';

router.register('jobs', async (el) => {
  el.innerHTML = `
    <h2>Jobs</h2>
    <div class="card"><h3>Active</h3><div id="jobs-active"></div></div>
    <div class="card"><h3>Queue</h3><div id="jobs-queue"></div></div>
    <div class="card"><h3>History</h3><div id="jobs-hist"></div></div>`;

  const render = (target, data) => {
    const entries = Object.entries(data || {}).filter(([,v]) => v?.ID);
    if (!entries.length) { target.innerHTML = '<div class="empty">Empty</div>'; return; }
    target.innerHTML = `<table><thead><tr>
      <th>ID</th><th>State</th><th>Prompt</th><th>Time</th>
    </tr></thead><tbody>${entries.map(([,j]) => `<tr>
      <td style="color:var(--yw)">${(j.ID||'').slice(0,8)}</td>
      <td><span class="badge ${jbadge(j.State)}">${JSTATES[j.State]??'?'}</span></td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${j.Req?.Prompt||'—'}</td>
      <td style="color:var(--dm)">${j.Req?.ReqAt?new Date(j.Req.ReqAt).toLocaleTimeString():'—'}</td>
    </tr>`).join('')}</tbody></table>`;
  };

  try {
    const [active, queue, hist] = await Promise.all([
      api.readUDT('Konomi/Jobs/Active'),
      api.readUDT('Konomi/Jobs/Queue'),
      api.readUDT('Konomi/Jobs/History'),
    ]);
    render(document.getElementById('jobs-active'), active);
    render(document.getElementById('jobs-queue'), queue);
    render(document.getElementById('jobs-hist'), hist);
  } catch (e) {
    el.innerHTML += `<div class="empty">Error: ${e.message}</div>`;
  }
});
