// Seed demo data into the in-browser tag store
import { store } from './store.js';

function uid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// Config
store.writeUDT('Konomi/Cfg/Timeout', { Nav:30000, Gen:300000, Poll:3000, Session:86400000 });
store.writeUDT('Konomi/Cfg/Limit', { MaxConc:2, MaxQueue:50, MaxRetry:3 });
store.writeUDT('Konomi/Cfg/Path', { Session:'./session', Download:'./downloads' });
store.writeUDT('Konomi/Cfg/Sel', {
  Create:{ Prompt:"textarea[placeholder*='song']", Style:"input[placeholder*='style']",
    Create:"button:has-text('Create')", Credits:"[class*='credit'] span" },
  Job:{ Card:'[data-song-id]' }
});

// Meta
store.write('Konomi/_Meta/Version', '1.0.0');
store.write('Konomi/_Meta/ISALevel', 2);
store.write('Konomi/_Meta/StartedAt', new Date().toISOString());

// Equipment
for (const name of ['SessionMgr','GenEngine','AssetMgr']) {
  store.writeUDT(`Konomi/Equip/${name}`, {
    ID:uid(), Name:name, State:3, Mode:1, Cmd:0,
    Health:1.0, Heartbeat:new Date().toISOString(), FaultCode:0, FaultMsg:''
  });
}

// Metrics
store.write('Konomi/Metrics/Uptime', 86400);
store.write('Konomi/Metrics/JobsDone', 47);
store.write('Konomi/Metrics/JobsFail', 3);
store.write('Konomi/Metrics/AvgGenTime', 42000);
store.write('Konomi/Metrics/SuccessRate', 94);

// Alarms
store.write('Konomi/Alarms/SessionExp', false);
store.write('Konomi/Alarms/LowCredits', false);
store.write('Konomi/Alarms/GenFailed', false);
store.write('Konomi/Alarms/SelBroken', false);
store.write('Konomi/Alarms/RateLimited', false);

// Session (demo: logged in)
store.write('Konomi/Session/State', 1);
store.write('Konomi/Session/Credits', 487);
store.write('Konomi/Session/UserID', 'demo@konomi.ai');

// Browser
store.write('Konomi/Browser/Connected', true);
store.write('Konomi/Browser/URL', 'https://suno.com/create');
store.write('Konomi/Browser/Page', 2);
store.write('Konomi/Browser/Headless', true);

// Jobs
store.write('Konomi/Jobs/ActiveCt', 0);
store.write('Konomi/Jobs/TotalProc', 50);

// History — demo songs
const songs = [
  { title:'Midnight Rain', prompt:'A melancholic lo-fi track about rain', style:'lo-fi hip hop', bpm:85, key:'Dm', mood:'Melancholic' },
  { title:'Solar Flare', prompt:'Energetic synth-wave anthem', style:'synthwave', bpm:128, key:'Am', mood:'Energetic' },
  { title:'Quiet Garden', prompt:'Peaceful ambient nature sounds', style:'ambient', bpm:70, key:'C', mood:'Peaceful' },
  { title:'Neon Streets', prompt:'Cyberpunk city night drive', style:'cyberpunk electro', bpm:140, key:'Em', mood:'Intense' },
];

songs.forEach((s, i) => {
  const id = uid();
  store.writeUDT(`Konomi/Jobs/History/${i}`, {
    ID:id, SunoID:`suno_${id.slice(0,8)}`, State:3,
    Req:{ Prompt:s.prompt, Style:s.style, Instrumental:false, ReqAt:new Date(Date.now()-86400000*(i+1)).toISOString() },
    Res:{ Songs:{ 0:{ ID:`song_${id.slice(0,8)}`, Title:s.title,
      AudioURL:'', ImageURL:'', Duration:180000,
      Lyrics: i===0 ? 'Drops on glass, memories pass\nFading slow in purple haze\nMidnight rain, sweet refrain\nLost in loops of quieter days' : '',
      Meta:{ BPM:s.bpm, Key:s.key, Mood:s.mood }
    }}, CreditsUsed:10, DoneAt:new Date(Date.now()-86400000*i).toISOString(), Error:'' },
    Metrics:{ QueueTime:2000, ProcTime:38000, Retries:0, Polls:12 }, Progress:1.0
  });
});

export { uid };
