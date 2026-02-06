import { api } from './api.js';
import { router } from './router.js';
import { toast } from './toast.js';

router.register('tags', async (el) => {
  el.innerHTML = `
    <h2>Tag Browser</h2>
    <div class="card">
      <div class="row">
        <div><label>Tag Path</label><input id="tag-path" placeholder="Konomi/Equip/GenEngine/State"></div>
        <div><label>Value</label><input id="tag-val" placeholder="value"></div>
      </div>
      <button id="tag-read" class="secondary">Read</button>
      <button id="tag-write">Write</button>
      <button id="tag-udt" class="secondary">Read UDT</button>
    </div>
    <div class="card"><h3>Result</h3><pre id="tag-result" style="font-size:.8rem;color:var(--gn);white-space:pre-wrap;max-height:400px;overflow:auto">—</pre></div>`;

  const path = () => document.getElementById('tag-path').value;
  const out = document.getElementById('tag-result');

  document.getElementById('tag-read').onclick = async () => {
    if (!path()) return toast('Enter a path', 'error');
    try {
      const r = await api.readTag(path());
      out.textContent = JSON.stringify(r, null, 2);
    } catch (e) { out.textContent = e.message; }
  };

  document.getElementById('tag-write').onclick = async () => {
    if (!path()) return toast('Enter a path', 'error');
    const v = document.getElementById('tag-val').value;
    let parsed;
    try { parsed = JSON.parse(v); } catch { parsed = v; }
    try {
      await api.writeTag(path(), parsed);
      toast('Written', 'success');
      out.textContent = `${path()} = ${JSON.stringify(parsed)}`;
    } catch (e) { toast(e.message, 'error'); }
  };

  document.getElementById('tag-udt').onclick = async () => {
    if (!path()) return toast('Enter a path', 'error');
    try {
      const r = await api.readUDT(path());
      out.textContent = JSON.stringify(r, null, 2);
    } catch (e) { out.textContent = e.message; }
  };
});
