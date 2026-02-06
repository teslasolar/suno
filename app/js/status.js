import { api } from './api.js';
import { router } from './router.js';

const STATES = ['Off','Starting','Idle','Ready','Running','—','—','Fault'];
const badge = (s) => s===3?'ok':s===4?'info':s===7?'err':'warn';

router.register('status', async (el) => {
  el.innerHTML = `<h2>System Status</h2><div id="st-content" class="empty">Loading...</div>`;
  try {
    const d = await api.status();
    const h = await api.health();
    document.getElementById('st-content').innerHTML = `
      <div class="grid">
        <div class="card stat"><div class="val">${h.authenticated ? 'Yes' : 'No'}</div><div class="lbl">Authenticated</div></div>
        <div class="card stat"><div class="val">${d.session?.Credits??'—'}</div><div class="lbl">Credits</div></div>
        <div class="card stat"><div class="val">${d.metrics?.JobsDone??0}</div><div class="lbl">Jobs Done</div></div>
        <div class="card stat"><div class="val">${d.metrics?.JobsFail??0}</div><div class="lbl">Failed</div></div>
      </div>
      <div class="grid">
        ${Object.entries(d.equip||{}).map(([k,v])=>`
          <div class="card">
            <h3>${k}</h3>
            <p>State: <span class="badge ${badge(v.State)}">${STATES[v.State]||'?'}</span></p>
            <p style="font-size:.75rem;color:var(--dm);margin-top:.25rem">Health: ${((v.Health||0)*100).toFixed(0)}%</p>
            ${v.FaultMsg?`<p style="color:var(--rd);font-size:.75rem;margin-top:.25rem">${v.FaultMsg}</p>`:''}
          </div>`).join('')}
      </div>
      <div class="card">
        <h3>Alarms</h3>
        ${Object.entries(d.alarms||{}).map(([k,v])=>
          `<span class="badge ${v?'err':'ok'}" style="margin:.2rem">${k}: ${v?'ACTIVE':'OK'}</span>`
        ).join(' ')}
      </div>`;
  } catch (e) {
    document.getElementById('st-content').innerHTML = `<div class="empty">API offline: ${e.message}</div>`;
  }
});
