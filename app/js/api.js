const BASE = window.location.port === '3456'
  ? '' : 'http://localhost:3456';

async function req(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${BASE}${path}`, opts);
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

export const api = {
  status: () => req('GET', '/status'),
  readTag: (p) => req('GET', `/tags/${p}`),
  writeTag: (p, v) => req('PUT', `/tags/${p}`, { value: v }),
  readUDT: (p) => req('GET', `/udt/${p}`),
  generate: (prompt, style, instrumental) =>
    req('POST', '/generate', { prompt, style, instrumental }),
  job: (id) => req('GET', `/job/${id}`),
};
