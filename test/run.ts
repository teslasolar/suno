/**
 * Konomi Suno API — Test Runner
 * Boots server in no-browser mode, exercises every endpoint, reports results.
 * Usage: NO_BROWSER=1 npx tsx test/run.ts
 */

const PORT = 3457;
const BASE = `http://localhost:${PORT}`;

process.env.NO_BROWSER = '1';
process.env.PORT = String(PORT);

// import server (side-effect: starts listening)
await import('../src/index.js');

// wait for server ready
await new Promise(r => setTimeout(r, 500));

interface Result { name: string; pass: boolean; ms: number; detail: string }
const results: Result[] = [];

async function test(name: string, fn: () => Promise<void>) {
  const t0 = Date.now();
  try {
    await fn();
    results.push({ name, pass: true, ms: Date.now() - t0, detail: 'OK' });
  } catch (e: any) {
    results.push({ name, pass: false, ms: Date.now() - t0, detail: e.message });
  }
}

async function get(path: string) {
  const r = await fetch(`${BASE}${path}`);
  if (!r.ok) throw new Error(`GET ${path} → ${r.status}`);
  return r.json();
}

async function put(path: string, body: any) {
  const r = await fetch(`${BASE}${path}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`PUT ${path} → ${r.status}`);
  return r.json();
}

async function post(path: string, body: any) {
  const r = await fetch(`${BASE}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: r.status, data: await r.json() };
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`Assertion failed: ${msg}`);
}

// ─── Health ─────────────────────────────────────────────
await test('GET /health — returns ok', async () => {
  const d = await get('/health');
  assert(d.ok === true, 'ok should be true');
  assert(d.version === '1.0.0', `version=${d.version}`);
  assert(d.browser === false, 'browser should be false in test mode');
  assert(typeof d.tags === 'number' && d.tags > 0, `tags=${d.tags}`);
  assert(typeof d.uptime === 'number', `uptime=${d.uptime}`);
});

// ─── Status ─────────────────────────────────────────────
await test('GET /status — full system state', async () => {
  const d = await get('/status');
  assert(!!d.equip, 'missing equip');
  assert(!!d.session, 'missing session');
  assert(!!d.browser, 'missing browser');
  assert(!!d.alarms, 'missing alarms');
  assert(!!d.metrics, 'missing metrics');
});

await test('GET /status — equipment modules present', async () => {
  const d = await get('/status');
  for (const m of ['SessionMgr', 'GenEngine', 'AssetMgr']) {
    assert(!!d.equip[m], `missing equip.${m}`);
    assert(d.equip[m].Name === m, `equip.${m}.Name=${d.equip[m].Name}`);
    assert(typeof d.equip[m].Health === 'number', `equip.${m}.Health missing`);
  }
});

await test('GET /status — alarms all false at init', async () => {
  const d = await get('/status');
  for (const [k, v] of Object.entries(d.alarms)) {
    assert(v === false, `alarm ${k} should be false, got ${v}`);
  }
});

await test('GET /status — metrics initialized to zero', async () => {
  const d = await get('/status');
  assert(d.metrics.JobsDone === 0, `JobsDone=${d.metrics.JobsDone}`);
  assert(d.metrics.JobsFail === 0, `JobsFail=${d.metrics.JobsFail}`);
  assert(d.metrics.SuccessRate === 0, `SuccessRate=${d.metrics.SuccessRate}`);
});

await test('GET /status — session defaults', async () => {
  const d = await get('/status');
  assert(d.session.State === 0, `session.State=${d.session.State}`);
  assert(d.session.Credits === 0, `session.Credits=${d.session.Credits}`);
});

await test('GET /status — browser defaults', async () => {
  const d = await get('/status');
  assert(d.browser.Connected === false, `browser.Connected=${d.browser.Connected}`);
  assert(d.browser.Page === 0, `browser.Page=${d.browser.Page}`);
});

// ─── Tags — Read ────────────────────────────────────────
await test('GET /tags/Konomi/_Meta/Version — read scalar', async () => {
  const d = await get('/tags/Konomi/_Meta/Version');
  assert(d.path === 'Konomi/_Meta/Version', `path=${d.path}`);
  assert(d.value === '1.0.0', `value=${d.value}`);
});

await test('GET /tags/Konomi/_Meta/ISALevel — read number', async () => {
  const d = await get('/tags/Konomi/_Meta/ISALevel');
  assert(d.value === 2, `value=${d.value}`);
});

await test('GET /tags/nonexistent — returns null', async () => {
  const d = await get('/tags/does/not/exist');
  assert(d.value === null, `value=${d.value}`);
});

// ─── Tags — Write ───────────────────────────────────────
await test('PUT /tags — write string', async () => {
  const r = await put('/tags/test/mykey', { value: 'hello' });
  assert(r.ok === true, `ok=${r.ok}`);
  const d = await get('/tags/test/mykey');
  assert(d.value === 'hello', `value=${d.value}`);
});

await test('PUT /tags — write number', async () => {
  await put('/tags/test/num', { value: 42 });
  const d = await get('/tags/test/num');
  assert(d.value === 42, `value=${d.value}`);
});

await test('PUT /tags — write boolean', async () => {
  await put('/tags/test/flag', { value: true });
  const d = await get('/tags/test/flag');
  assert(d.value === true, `value=${d.value}`);
});

await test('PUT /tags — overwrite value', async () => {
  await put('/tags/test/mykey', { value: 'first' });
  await put('/tags/test/mykey', { value: 'second' });
  const d = await get('/tags/test/mykey');
  assert(d.value === 'second', `value=${d.value}`);
});

// ─── Tags — List keys ───────────────────────────────────
await test('GET /tags — list all keys', async () => {
  const d = await get('/tags');
  assert(Array.isArray(d.keys), 'keys should be array');
  assert(d.count > 0, `count=${d.count}`);
});

await test('GET /tags?prefix=Konomi/Equip — filtered keys', async () => {
  const d = await get('/tags?prefix=Konomi/Equip');
  assert(d.keys.length > 0, 'should have equip keys');
  for (const k of d.keys) {
    assert(k.startsWith('Konomi/Equip'), `key ${k} doesn't match prefix`);
  }
});

// ─── UDT — Read ─────────────────────────────────────────
await test('GET /udt/Konomi/Cfg/Timeout — read config UDT', async () => {
  const d = await get('/udt/Konomi/Cfg/Timeout');
  assert(d.Nav === 30000, `Nav=${d.Nav}`);
  assert(d.Gen === 300000, `Gen=${d.Gen}`);
  assert(d.Poll === 3000, `Poll=${d.Poll}`);
  assert(d.Session === 86400000, `Session=${d.Session}`);
});

await test('GET /udt/Konomi/Cfg/Limit — read limits', async () => {
  const d = await get('/udt/Konomi/Cfg/Limit');
  assert(d.MaxConc === 2, `MaxConc=${d.MaxConc}`);
  assert(d.MaxQueue === 50, `MaxQueue=${d.MaxQueue}`);
  assert(d.MaxRetry === 3, `MaxRetry=${d.MaxRetry}`);
});

await test('GET /udt/Konomi/Equip/GenEngine — equipment UDT', async () => {
  const d = await get('/udt/Konomi/Equip/GenEngine');
  assert(d.Name === 'GenEngine', `Name=${d.Name}`);
  assert(typeof d.ID === 'string' && d.ID.length > 0, 'missing ID');
  assert(d.Mode === 1, `Mode=${d.Mode}`);
  assert(d.Health === 1.0, `Health=${d.Health}`);
});

await test('GET /udt/Konomi/Cfg/Sel — selectors nested UDT', async () => {
  const d = await get('/udt/Konomi/Cfg/Sel');
  assert(!!d.Create, 'missing Create');
  assert(!!d.Job, 'missing Job');
  assert(d.Create.Prompt === "textarea[placeholder*='song']", `Prompt=${d.Create.Prompt}`);
  assert(d.Job.Card === '[data-song-id]', `Card=${d.Job.Card}`);
});

await test('GET /udt/nonexistent — returns empty object', async () => {
  const d = await get('/udt/does/not/exist');
  assert(JSON.stringify(d) === '{}', `got=${JSON.stringify(d)}`);
});

// ─── Dump ───────────────────────────────────────────────
await test('GET /dump — returns all tags', async () => {
  const d = await get('/dump');
  assert(typeof d === 'object', 'should be object');
  assert(Object.keys(d).length > 0, 'should have keys');
  assert('Konomi/_Meta/Version' in d, 'missing version key');
});

// ─── Generate ───────────────────────────────────────────
await test('POST /generate — success', async () => {
  const { status, data } = await post('/generate', {
    prompt: 'A chill lo-fi beat about rainy days',
    style: 'lo-fi hip hop',
  });
  assert(status === 200, `status=${status}`);
  assert(typeof data.jobId === 'string', `jobId=${data.jobId}`);
  assert(data.status === 'queued', `status=${data.status}`);
});

await test('POST /generate — missing prompt returns 400', async () => {
  const { status, data } = await post('/generate', { style: 'rock' });
  assert(status === 400, `status=${status}`);
  assert(data.error === 'prompt required', `error=${data.error}`);
});

await test('POST /generate — with instrumental flag', async () => {
  const { status, data } = await post('/generate', {
    prompt: 'Ambient synth waves',
    instrumental: true,
  });
  assert(status === 200, `status=${status}`);
  // verify tag was set
  const j = await get(`/job/${data.jobId}`);
  assert(j.Req.Instrumental === true, `Instrumental=${j.Req.Instrumental}`);
  assert(j.Req.Prompt === 'Ambient synth waves', `Prompt=${j.Req.Prompt}`);
});

await test('POST /generate — increments ActiveCt', async () => {
  const before = await get('/tags/Konomi/Jobs/ActiveCt');
  await post('/generate', { prompt: 'test increment' });
  const after = await get('/tags/Konomi/Jobs/ActiveCt');
  assert(after.value > before.value, `before=${before.value} after=${after.value}`);
});

// ─── Job ────────────────────────────────────────────────
await test('GET /job/:id — returns job', async () => {
  const { data: gen } = await post('/generate', { prompt: 'test job lookup' });
  const j = await get(`/job/${gen.jobId}`);
  assert(j.ID === gen.jobId, `ID mismatch`);
  assert(j.State === 0, `State=${j.State}`);
  assert(!!j.Req, 'missing Req');
});

await test('GET /job/:id — 404 for unknown id', async () => {
  const r = await fetch(`${BASE}/job/fake-id-12345`);
  assert(r.status === 404, `status=${r.status}`);
  const d = await r.json();
  assert(d.error === 'Not found', `error=${d.error}`);
});

// ─── Tag write + UDT round-trip ─────────────────────────
await test('write tags then readUDT — round-trip', async () => {
  await put('/tags/test/udt/a', { value: 1 });
  await put('/tags/test/udt/b', { value: 'two' });
  await put('/tags/test/udt/nested/c', { value: true });
  const d = await get('/udt/test/udt');
  assert(d.a === 1, `a=${d.a}`);
  assert(d.b === 'two', `b=${d.b}`);
  assert(d.nested?.c === true, `nested.c=${d.nested?.c}`);
});

// ─── Equipment state in no-browser mode ─────────────────
await test('equipment states set to Idle in no-browser mode', async () => {
  const d = await get('/status');
  assert(d.equip.SessionMgr.State === 2, `SessionMgr.State=${d.equip.SessionMgr.State}`);
  assert(d.equip.GenEngine.State === 2, `GenEngine.State=${d.equip.GenEngine.State}`);
  assert(d.equip.AssetMgr.State === 2, `AssetMgr.State=${d.equip.AssetMgr.State}`);
});

// ─── Tag write updates alarm ────────────────────────────
await test('PUT alarm tag — updates status', async () => {
  await put('/tags/Konomi/Alarms/LowCredits', { value: true });
  const d = await get('/status');
  assert(d.alarms.LowCredits === true, `LowCredits=${d.alarms.LowCredits}`);
  // reset
  await put('/tags/Konomi/Alarms/LowCredits', { value: false });
});

// ─── Session manipulation via tags ──────────────────────
await test('simulate login via tag writes', async () => {
  await put('/tags/Konomi/Session/State', { value: 1 });
  await put('/tags/Konomi/Session/Credits', { value: 500 });
  await put('/tags/Konomi/Session/UserID', { value: 'testuser@suno.com' });
  const s = await get('/udt/Konomi/Session');
  assert(s.State === 1, `State=${s.State}`);
  assert(s.Credits === 500, `Credits=${s.Credits}`);
  assert(s.UserID === 'testuser@suno.com', `UserID=${s.UserID}`);
});

// ─── Report ─────────────────────────────────────────────
console.log('\n' + '═'.repeat(60));
console.log('  KONOMI SUNO API — TEST RESULTS');
console.log('═'.repeat(60));

const pass = results.filter(r => r.pass).length;
const fail = results.filter(r => !r.pass).length;
const total = results.length;

for (const r of results) {
  const icon = r.pass ? '  PASS' : '  FAIL';
  const time = `${r.ms}ms`.padStart(5);
  console.log(`${icon}  ${time}  ${r.name}`);
  if (!r.pass) console.log(`               → ${r.detail}`);
}

console.log('─'.repeat(60));
console.log(`  ${pass}/${total} passed, ${fail} failed`);
console.log('═'.repeat(60));

process.exit(fail > 0 ? 1 : 0);
