import express from 'express';
import cors from 'cors';
import { v4 as uuid } from 'uuid';
import { tags } from './tags.js';
import { SunoBrowser } from './browser.js';

const app = express();
const suno = new SunoBrowser();
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
tags.writeUDT('Konomi/Equip/SessionMgr', {
  ID: uuid(),
  Name: 'SessionMgr',
  State: 0,
  Mode: 1,
  Cmd: 0,
  Health: 1.0,
  Heartbeat: new Date(),
  FaultCode: 0,
  FaultMsg: '',
});
tags.writeUDT('Konomi/Equip/GenEngine', {
  ID: uuid(),
  Name: 'GenEngine',
  State: 0,
  Mode: 1,
  Cmd: 0,
  Health: 1.0,
  Heartbeat: new Date(),
  FaultCode: 0,
  FaultMsg: '',
});
tags.writeUDT('Konomi/Equip/AssetMgr', {
  ID: uuid(),
  Name: 'AssetMgr',
  State: 0,
  Mode: 1,
  Cmd: 0,
  Health: 1.0,
  Heartbeat: new Date(),
  FaultCode: 0,
  FaultMsg: '',
});

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

// Routes
app.get('/status', (_req, res) => {
  res.json({
    equip: tags.readUDT('Konomi/Equip'),
    session: tags.readUDT('Konomi/Session'),
    browser: tags.readUDT('Konomi/Browser'),
    alarms: tags.readUDT('Konomi/Alarms'),
    metrics: tags.readUDT('Konomi/Metrics'),
  });
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

app.post('/generate', async (req, res) => {
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
  suno.gen(id).catch(console.error);
  res.json({ jobId: id, status: 'queued' });
});

app.get('/job/:id', (req, res) => {
  const j = tags.readUDT<any>('Konomi/Jobs/Active/0');
  if (j.ID !== req.params.id) return res.status(404).json({ error: 'Not found' });
  res.json(j);
});

suno.init().then(() =>
  app.listen(3456, () => console.log('Konomi Suno API: http://localhost:3456'))
);
