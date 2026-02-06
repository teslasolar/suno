import { mock } from './mock.js';

const BASE = 'http://localhost:3456';
let live = false;
let checked = false;

async function probe() {
  if (checked) return live;
  try {
    const r = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(1500) });
    live = r.ok;
  } catch { live = false; }
  checked = true;
  return live;
}

async function req(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${BASE}${path}`, opts);
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

export const api = {
  isLive: () => live,
  probe,
  status:    async () => (await probe()) ? req('GET', '/status')           : mock.status(),
  readTag:   async (p) => (await probe()) ? req('GET', `/tags/${p}`)       : mock.readTag(p),
  writeTag:  async (p, v) => (await probe()) ? req('PUT', `/tags/${p}`, { value: v }) : mock.writeTag(p, v),
  readUDT:   async (p) => (await probe()) ? req('GET', `/udt/${p}`)       : mock.readUDT(p),
  generate:  async (prompt, style, instrumental) =>
    (await probe()) ? req('POST', '/generate', { prompt, style, instrumental }) : mock.generate(prompt, style, instrumental),
  job:       async (id) => (await probe()) ? req('GET', `/job/${id}`)      : mock.job(id),
};
