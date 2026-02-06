import { tags } from './tags.js';

const B = 'Konomi';
const CLERK_BASE = 'https://clerk.suno.com';
const API_BASE = 'https://studio-api.suno.ai';

let cookie = '';
let jwt = '';
let sessionId = '';

function headers(): Record<string, string> {
  return {
    Authorization: `Bearer ${jwt}`,
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    Referer: 'https://suno.com',
    Origin: 'https://suno.com',
  };
}

async function refreshToken(): Promise<boolean> {
  if (!cookie || !sessionId) return false;
  try {
    const r = await fetch(
      `${CLERK_BASE}/v1/client/sessions/${sessionId}/tokens?_clerk_js_version=5.15.0`,
      { method: 'POST', headers: { Cookie: cookie } }
    );
    if (!r.ok) return false;
    const setCookies = r.headers.getSetCookie?.() || [];
    if (setCookies.length) {
      cookie = mergeCookies(cookie, setCookies);
    }
    const data = await r.json();
    jwt = data.jwt;
    tags.write(`${B}/Session/State`, 1);
    return true;
  } catch (e: any) {
    tags.write(`${B}/Session/State`, 2);
    tags.write(`${B}/Equip/SessionMgr/FaultMsg`, e.message);
    return false;
  }
}

function mergeCookies(existing: string, setCookies: string[]): string {
  const jar = new Map<string, string>();
  for (const c of existing.split(';')) {
    const [k, ...v] = c.trim().split('=');
    if (k) jar.set(k, v.join('='));
  }
  for (const sc of setCookies) {
    const part = sc.split(';')[0];
    const [k, ...v] = part.trim().split('=');
    if (k) jar.set(k, v.join('='));
  }
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}

export class SunoClient {
  private refreshInterval: ReturnType<typeof setInterval> | null = null;

  async init(cookieStr: string) {
    cookie = cookieStr;
    tags.write(`${B}/Equip/SessionMgr/State`, 1);

    // Get session ID from Clerk
    const r = await fetch(
      `${CLERK_BASE}/v1/client?_clerk_js_version=5.15.0`,
      { headers: { Cookie: cookie } }
    );
    if (!r.ok) throw new Error(`Clerk client failed: ${r.status}`);
    const data = await r.json();
    sessionId = data.response?.last_active_session_id;
    if (!sessionId) throw new Error('No active session found in Clerk');

    // Initial token
    const ok = await refreshToken();
    if (!ok) throw new Error('Token refresh failed');

    // Keep-alive: refresh every 30s
    this.refreshInterval = setInterval(() => refreshToken(), 30000);

    tags.write(`${B}/Equip/SessionMgr/State`, 3);
    tags.write(`${B}/Browser/Connected`, true);
    await this.loadCredits();
  }

  async loadCredits() {
    try {
      const r = await fetch(`${API_BASE}/api/billing/info/`, { headers: headers() });
      if (!r.ok) return;
      const d = await r.json();
      tags.write(`${B}/Session/Credits`, d.total_credits_left ?? d.credits_left ?? 0);
      tags.write(`${B}/Alarms/LowCredits`, (d.total_credits_left ?? 0) < 10);
    } catch {}
  }

  async generate(prompt: string, style: string, title: string, instrumental: boolean) {
    await refreshToken();
    const isCustom = style || title;
    const body = isCustom
      ? { prompt, tags: style, title, mv: 'chirp-v4', make_instrumental: instrumental, generation_type: 'TEXT' }
      : { gpt_description_prompt: prompt, mv: 'chirp-v4', prompt: '', make_instrumental: instrumental, generation_type: 'TEXT' };

    const r = await fetch(`${API_BASE}/api/generate/v2/`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const err = await r.text();
      throw new Error(`Generate failed: ${r.status} ${err}`);
    }
    const data = await r.json();
    await this.loadCredits();
    return data;
  }

  async feed(ids?: string[], page?: number): Promise<any[]> {
    await refreshToken();
    let url = `${API_BASE}/api/feed/`;
    if (ids?.length) url += `?ids=${ids.join(',')}`;
    else if (page !== undefined) url += `?page=${page}`;

    const r = await fetch(url, { headers: headers() });
    if (!r.ok) throw new Error(`Feed failed: ${r.status}`);
    return r.json();
  }

  async clip(id: string): Promise<any> {
    await refreshToken();
    const r = await fetch(`${API_BASE}/api/clip/${id}`, { headers: headers() });
    if (!r.ok) throw new Error(`Clip failed: ${r.status}`);
    return r.json();
  }

  async generateLyrics(prompt: string): Promise<{ id: string }> {
    await refreshToken();
    const r = await fetch(`${API_BASE}/api/generate/lyrics/`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ prompt }),
    });
    if (!r.ok) throw new Error(`Lyrics gen failed: ${r.status}`);
    return r.json();
  }

  async getLyrics(id: string): Promise<any> {
    await refreshToken();
    const r = await fetch(`${API_BASE}/api/generate/lyrics/${id}`, { headers: headers() });
    if (!r.ok) throw new Error(`Lyrics fetch failed: ${r.status}`);
    return r.json();
  }

  isReady(): boolean {
    return !!jwt && !!sessionId;
  }

  destroy() {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
  }
}
