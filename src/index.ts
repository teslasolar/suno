import express from 'express';
import cors from 'cors';
import path from 'path';
import { v4 as uuid } from 'uuid';
import { tags } from './tags.js';
import { SunoClient } from './suno.js';

const PORT = parseInt(process.env.PORT || '3456');
const COOKIE = process.env.SUNO_COOKIE || '';

const app = express();
const suno = new SunoClient();
app.use(cors({ origin: '*' }));
app.use(express.json());

// Serve frontend from repo root
app.use(express.static(path.resolve('.')));

// Init config
tags.writeUDT('Konomi/Cfg/Timeout', { Nav: 30000, Gen: 300000, Poll: 5000, Session: 86400000 });
tags.writeUDT('Konomi/Cfg/Limit', { MaxConc: 2, MaxQueue: 50, MaxRetry: 3 });

// Init metadata
tags.write('Konomi/_Meta/Version', '1.0.0');
tags.write('Konomi/_Meta/ISALevel', 2);
tags.write('Konomi/_Meta/StartedAt', new Date());

// Init equipment
for (const name of ['SessionMgr', 'GenEngine', 'AssetMgr']) {
  tags.writeUDT(`Konomi/Equip/${name}`, {
    ID: uuid(), Name: name, State: 0, Mode: 1, Cmd: 0,
    Health: 1.0, Heartbeat: new Date(), FaultCode: 0, FaultMsg: '',
  });
}

// Init metrics/alarms/counters/session
tags.write('Konomi/Metrics/Uptime', 0);
tags.write('Konomi/Metrics/JobsDone', 0);
tags.write('Konomi/Metrics/JobsFail', 0);
tags.write('Konomi/Metrics/AvgGenTime', 0);
tags.write('Konomi/Metrics/SuccessRate', 0);
for (const a of ['SessionExp', 'LowCredits', 'GenFailed', 'SelBroken', 'RateLimited']) {
  tags.write(`Konomi/Alarms/${a}`, false);
}
tags.write('Konomi/Jobs/ActiveCt', 0);
tags.write('Konomi/Jobs/TotalProc', 0);
tags.write('Konomi/Session/State', 0);
tags.write('Konomi/Session/Credits', 0);
tags.write('Konomi/Browser/Connected', false);

// --- Routes ---

app.get('/health', (_req, res) => {
  res.json({
    ok: true, version: tags.read('Konomi/_Meta/Version'),
    authenticated: suno.isReady(), tags: tags.size(), uptime: process.uptime(),
  });
});

app.get('/status', (_req, res) => {
  res.json({
    equip: tags.readUDT('Konomi/Equip'), session: tags.readUDT('Konomi/Session'),
    browser: tags.readUDT('Konomi/Browser'), alarms: tags.readUDT('Konomi/Alarms'),
    metrics: tags.readUDT('Konomi/Metrics'),
  });
});

// --- Auth ---
app.post('/auth/cookie', async (req, res) => {
  const { cookie } = req.body;
  if (!cookie) return res.status(400).json({ error: 'cookie required' });
  try {
    await suno.init(cookie);
    res.json({ ok: true, credits: tags.read('Konomi/Session/Credits') });
  } catch (e: any) { res.status(401).json({ error: e.message }); }
});

app.get('/auth/status', (_req, res) => {
  res.json({ authenticated: suno.isReady(), session: tags.readUDT('Konomi/Session') });
});

// Extract cookie from local browser DB and authenticate
app.post('/auth/extract', async (req, res) => {
  const browser = req.body.browser; // optional: "chrome", "brave", "edge", "chromium"
  try {
    const { extractCookies } = await import('./cookie.js');
    const cookie = await extractCookies(browser);
    await suno.init(cookie);
    res.json({ ok: true, credits: tags.read('Konomi/Session/Credits') });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// --- Suno proxy ---
app.get('/credits', async (_req, res) => {
  try { await suno.loadCredits(); res.json({ credits: tags.read('Konomi/Session/Credits') }); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/library', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 0;
    res.json(await suno.feed(undefined, page));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/clip/:id', async (req, res) => {
  try { res.json(await suno.clip(req.params.id)); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/generate', async (req, res) => {
  if (!suno.isReady()) return res.status(401).json({ error: 'Not authenticated. POST /auth/cookie first.' });
  if (!req.body.prompt) return res.status(400).json({ error: 'prompt required' });
  tags.write('Konomi/Equip/GenEngine/State', 4);
  try {
    const data = await suno.generate(req.body.prompt, req.body.style || '', req.body.title || '', req.body.instrumental || false);
    const clipIds = (data.clips || []).map((c: any) => c.id);
    tags.write('Konomi/Equip/GenEngine/State', 3);
    tags.write('Konomi/Metrics/JobsDone', ((tags.read('Konomi/Metrics/JobsDone') as number) || 0) + 1);
    res.json({ clipIds, status: 'submitted', clips: data.clips });
  } catch (e: any) {
    tags.write('Konomi/Equip/GenEngine/State', 7);
    tags.write('Konomi/Equip/GenEngine/FaultMsg', e.message);
    tags.write('Konomi/Alarms/GenFailed', true);
    tags.write('Konomi/Metrics/JobsFail', ((tags.read('Konomi/Metrics/JobsFail') as number) || 0) + 1);
    res.status(500).json({ error: e.message });
  }
});

app.get('/poll', async (req, res) => {
  const ids = (req.query.ids as string || '').split(',').filter(Boolean);
  if (!ids.length) return res.status(400).json({ error: 'ids query param required' });
  try { res.json(await suno.feed(ids)); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/lyrics', async (req, res) => {
  if (!req.body.prompt) return res.status(400).json({ error: 'prompt required' });
  try { res.json(await suno.generateLyrics(req.body.prompt)); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/lyrics/:id', async (req, res) => {
  try { res.json(await suno.getLyrics(req.params.id)); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

// --- Tag endpoints (ISA-95 tooling) ---
app.get('/tags', (_req, res) => {
  const prefix = (typeof _req.query.prefix === 'string') ? _req.query.prefix : undefined;
  res.json({ keys: tags.keys(prefix), count: tags.keys(prefix).length });
});
app.get('/tags/*', (req, res) => res.json({ path: req.params[0], value: tags.read(req.params[0]) }));
app.put('/tags/*', (req, res) => { tags.write(req.params[0], req.body.value); res.json({ ok: true }); });
app.get('/udt/*', (req, res) => res.json(tags.readUDT(req.params[0])));
app.get('/dump', (_req, res) => res.json(tags.dump()));

// --- Start ---
async function start() {
  if (COOKIE) {
    try {
      await suno.init(COOKIE);
      console.log('Authenticated via SUNO_COOKIE');
    } catch (e: any) {
      console.error('Auth failed:', e.message);
      tags.write('Konomi/Equip/SessionMgr/State', 7);
      tags.write('Konomi/Equip/SessionMgr/FaultMsg', e.message);
    }
  } else {
    console.log('No SUNO_COOKIE. POST /auth/cookie to authenticate or set SUNO_COOKIE env.');
    tags.write('Konomi/Equip/SessionMgr/State', 2);
  }
  app.listen(PORT, () => console.log(`Konomi Suno API: http://localhost:${PORT}`));
}

start();
export { app, tags };
