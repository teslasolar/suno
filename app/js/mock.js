// Mock API — runs entirely in the browser against store.js
import { store } from './store.js';
import { uid } from './seed.js';

let jobCounter = 0;

export const mock = {
  status: async () => ({
    equip: store.readUDT('Konomi/Equip'),
    session: store.readUDT('Konomi/Session'),
    browser: store.readUDT('Konomi/Browser'),
    alarms: store.readUDT('Konomi/Alarms'),
    metrics: store.readUDT('Konomi/Metrics'),
  }),

  readTag: async (p) => ({ path: p, value: store.read(p) }),

  writeTag: async (p, v) => { store.write(p, v); return { ok: true }; },

  readUDT: async (p) => store.readUDT(p),

  generate: async (prompt, style, instrumental) => {
    const id = uid();
    store.writeUDT('Konomi/Jobs/Active/0', {
      ID: id, State: 0,
      Req: { Prompt: prompt, Style: style || '', Instrumental: instrumental || false,
        ReqAt: new Date().toISOString() },
    });
    // simulate async processing
    setTimeout(() => { store.write('Konomi/Jobs/Active/0/State', 1); }, 500);
    setTimeout(() => { store.write('Konomi/Jobs/Active/0/State', 2); store.write('Konomi/Jobs/Active/0/Progress', 0.5); }, 1500);
    setTimeout(() => {
      store.write('Konomi/Jobs/Active/0/State', 3);
      store.write('Konomi/Jobs/Active/0/Progress', 1.0);
      store.writeUDT('Konomi/Jobs/Active/0/Res', {
        Songs: { 0: { ID: `song_${id.slice(0,8)}`, Title: prompt.slice(0,40), AudioURL: '', ImageURL: '',
          Duration: 180000, Lyrics: '', Meta: { BPM: 120, Key: 'Am', Mood: style || 'Chill' } } },
        CreditsUsed: 10, DoneAt: new Date().toISOString(), Error: ''
      });
      // copy to history
      const hi = jobCounter++;
      const job = store.readUDT('Konomi/Jobs/Active/0');
      store.writeUDT(`Konomi/Jobs/History/${hi + 4}`, job);
      store.write('Konomi/Metrics/JobsDone', (store.read('Konomi/Metrics/JobsDone') || 0) + 1);
    }, 4000);
    return { jobId: id, status: 'queued' };
  },

  job: async (id) => {
    const j = store.readUDT('Konomi/Jobs/Active/0');
    if (j.ID !== id) throw new Error('Not found');
    return j;
  },
};
