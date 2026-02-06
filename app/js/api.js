const BASE = window.location.origin;

async function req(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${BASE}${path}`, opts);
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    throw new Error(d.error || `${r.status} ${r.statusText}`);
  }
  return r.json();
}

export const api = {
  health:     () => req('GET', '/health'),
  status:     () => req('GET', '/status'),
  authStatus: () => req('GET', '/auth/status'),
  authCookie: (cookie) => req('POST', '/auth/cookie', { cookie }),
  credits:    () => req('GET', '/credits'),
  library:    (page = 0) => req('GET', `/library?page=${page}`),
  clip:       (id) => req('GET', `/clip/${id}`),
  generate:   (prompt, style, title, instrumental) =>
    req('POST', '/generate', { prompt, style, title, instrumental }),
  poll:       (ids) => req('GET', `/poll?ids=${ids.join(',')}`),
  lyrics:     (prompt) => req('POST', '/lyrics', { prompt }),
  lyricsGet:  (id) => req('GET', `/lyrics/${id}`),
  readTag:    (p) => req('GET', `/tags/${p}`),
  writeTag:   (p, v) => req('PUT', `/tags/${p}`, { value: v }),
  readUDT:    (p) => req('GET', `/udt/${p}`),
};
