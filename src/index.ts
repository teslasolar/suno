import express from 'express';
import cors from 'cors';
import { v4 as uuid } from 'uuid';
import { tags } from './tags.js';

const NO_BROWSER = process.argv.includes('--no-browser') || process.env.NO_BROWSER === '1';
const PORT = parseInt(process.env.PORT || '3456');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

// Init config
tags.writeUDT('Konomi/Cfg/Timeout', {
  Nav: 30000,
  Gen: 300000,
  Poll: 3000,
  Session: 86400000,
});
tags.writeUDT('Konomi/Cfg/Limit', {
  MaxConc: 2,
  MaxQueue: 50,
  MaxRetry: 3,
});
tags.writeUDT('Konomi/Cfg/Path', {
  Session: './session',
  Download: './downloads',
});
tags.writeUDT('Konomi/Cfg/Sel', {
  Create: {
    Prompt: "textarea[placeholder*='song']",
    Style: "input[placeholder*='style']",
    Create: "button:has-text('Create')",
    Credits: "[class*='credit'] span",
  },
  Job: {
    Card: '[data-song-id]',
  },
});

// Init metadata
tags.write('Konomi/_Meta/Version', '1.0.0');
tags.write('Konomi/_Meta/ISALevel', 2);
tags.write('Konomi/_Meta/StartedAt', new Date());

// Init equipment states
for (const name of ['SessionMgr', 'GenEngine', 'AssetMgr']) {
  tags.writeUDT(`Konomi/Equip/${name}`, {
    ID: uuid(),
    Name: name,
    State: 0,
    Mode: 1,
    Cmd: 0,
    Health: 1.0,
    Heartbeat: new Date(),
    FaultCode: 0,
    FaultMsg: '',
  });
}

// Init metrics
tags.write('Konomi/Metrics/Uptime', 0);
tags.write('Konomi/Metrics/JobsDone', 0);
tags.write('Konomi/Metrics/JobsFail', 0);
tags.write('Konomi/Metrics/AvgGenTime', 0);
tags.write('Konomi/Metrics/SuccessRate', 0);

// Init alarms
tags.write('Konomi/Alarms/SessionExp', false);
tags.write('Konomi/Alarms/LowCredits', false);
tags.write('Konomi/Alarms/GenFailed', false);
tags.write('Konomi/Alarms/SelBroken', false);
tags.write('Konomi/Alarms/RateLimited', false);

// Init job counters
tags.write('Konomi/Jobs/ActiveCt', 0);
tags.write('Konomi/Jobs/TotalProc', 0);

// Init session/browser defaults
tags.write('Konomi/Session/State', 0);
tags.write('Konomi/Session/Credits', 0);
tags.write('Konomi/Browser/Connected', false);
tags.write('Konomi/Browser/URL', '');
tags.write('Konomi/Browser/Page', 0);

// --- Routes ---

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    version: tags.read('Konomi/_Meta/Version'),
    browser: !NO_BROWSER,
    tags: tags.size(),
    uptime: process.uptime(),
  });
});

app.get('/status', (_req, res) => {
  res.json({
    equip: tags.readUDT('Konomi/Equip'),
    session: tags.readUDT('Konomi/Session'),
    browser: tags.readUDT('Konomi/Browser'),
    alarms: tags.readUDT('Konomi/Alarms'),
    metrics: tags.readUDT('Konomi/Metrics'),
  });
});

app.get('/tags', (_req, res) => {
  const prefix = (typeof _req.query.prefix === 'string') ? _req.query.prefix : undefined;
  res.json({ keys: tags.keys(prefix), count: tags.keys(prefix).length });
});

app.get('/tags/*', (req, res) => {
  res.json({ path: req.params[0], value: tags.read(req.params[0]) });
});

app.put('/tags/*', (req, res) => {
  tags.write(req.params[0], req.body.value);
  res.json({ ok: true });
});

app.get('/udt/*', (req, res) => {
  res.json(tags.readUDT(req.params[0]));
});

app.get('/dump', (_req, res) => {
  res.json(tags.dump());
});

app.post('/generate', async (req, res) => {
  if (!req.body.prompt) return res.status(400).json({ error: 'prompt required' });
  const id = uuid();
  tags.writeUDT('Konomi/Jobs/Active/0', {
    ID: id,
    State: 0,
    Req: {
      Prompt: req.body.prompt,
      Style: req.body.style || '',
      Instrumental: req.body.instrumental || false,
      ReqAt: new Date(),
    },
  });
  tags.write('Konomi/Jobs/ActiveCt', ((tags.read('Konomi/Jobs/ActiveCt') as number) || 0) + 1);
  if (!NO_BROWSER) {
    const { SunoBrowser } = await import('./browser.js');
    const suno = new SunoBrowser();
    suno.gen(id).catch(console.error);
  }
  res.json({ jobId: id, status: 'queued' });
});

app.get('/job/:id', (req, res) => {
  const j = tags.readUDT<any>('Konomi/Jobs/Active/0');
  if (j.ID !== req.params.id) return res.status(404).json({ error: 'Not found' });
  res.json(j);
});

// --- Start ---

async function start() {
  if (!NO_BROWSER) {
    try {
      const { SunoBrowser } = await import('./browser.js');
      const suno = new SunoBrowser();
      await suno.init();
      console.log('Browser initialized');
    } catch (e: any) {
      console.error('Browser init failed:', e.message);
      tags.write('Konomi/Equip/SessionMgr/FaultMsg', e.message);
      tags.write('Konomi/Equip/SessionMgr/State', 7);
    }
  } else {
    console.log('Running in no-browser mode');
    tags.write('Konomi/Equip/SessionMgr/State', 2);
    tags.write('Konomi/Equip/GenEngine/State', 2);
    tags.write('Konomi/Equip/AssetMgr/State', 2);
  }
  app.listen(PORT, () => console.log(`Konomi Suno API: http://localhost:${PORT}`));
}

start();

export { app, tags };
