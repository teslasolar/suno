import { chromium, BrowserContext, Page } from 'playwright';
import { tags } from './tags.js';

const B = 'Konomi';

/**
 * Browser profile resolution:
 *   1. CHROME_PROFILE env var  → use that exact path (your real browser profile)
 *   2. Cfg/Path/Session tag    → Playwright-managed persistent context (./session)
 *
 * To reuse your existing logged-in Chrome session:
 *   Linux:   CHROME_PROFILE=~/.config/google-chrome/Default
 *   macOS:   CHROME_PROFILE=~/Library/Application Support/Google/Chrome/Default
 *   Windows: CHROME_PROFILE=%LOCALAPPDATA%\Google\Chrome\User Data\Default
 *
 * Or point at a Chromium/Brave/Edge profile the same way.
 * The server will inherit all cookies, localStorage, and session data.
 */
export class SunoBrowser {
  private ctx: BrowserContext | null = null;
  private pg: Page | null = null;

  private get profilePath(): string {
    return process.env.CHROME_PROFILE
      || tags.read(`${B}/Cfg/Path/Session`) as string
      || './session';
  }

  async init() {
    tags.write(`${B}/Equip/SessionMgr/State`, 1);

    const headless = process.env.HEADLESS !== 'false';
    const profile = this.profilePath;
    console.log(`Browser profile: ${profile} (headless=${headless})`);

    // Channel lets Playwright use the system-installed Chrome
    // instead of downloading its own Chromium
    const channel = process.env.CHROME_PROFILE ? 'chrome' : undefined;

    this.ctx = await chromium.launchPersistentContext(profile, {
      headless,
      channel,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-first-run',
      ],
    });

    this.pg = this.ctx.pages()[0] || await this.ctx.newPage();
    tags.write(`${B}/Browser/Connected`, true);
    tags.write(`${B}/Browser/Headless`, headless);
    tags.write(`${B}/Equip/SessionMgr/State`, 2);
    await this.check();
  }

  async check() {
    await this.pg!.goto('https://suno.com');
    const url = this.pg!.url();
    const logged = !url.includes('login');
    tags.write(`${B}/Session/State`, logged ? 1 : 0);
    tags.write(`${B}/Equip/GenEngine/State`, logged ? 3 : 2);
    if (logged) {
      try {
        const sel = tags.read(`${B}/Cfg/Sel/Create/Credits`) as string;
        const c = parseInt(await this.pg!.textContent(sel) || '0');
        tags.write(`${B}/Session/Credits`, c);
        tags.write(`${B}/Alarms/LowCredits`, c < 10);
      } catch {
        // Credits element not found
      }
    }
    tags.write(`${B}/Browser/URL`, url);
    tags.write(
      `${B}/Browser/Page`,
      url.includes('login') ? 1 : url.includes('create') ? 2 : url.includes('library') ? 3 : 0
    );
  }

  async gen(jobId: string) {
    const J = `${B}/Jobs/Active/0`;
    const S = `${B}/Cfg/Sel`;
    tags.write(`${B}/Equip/GenEngine/State`, 4);
    tags.write(`${J}/State`, 1);
    try {
      await this.pg!.goto('https://suno.com/create');
      const prompt = tags.read(`${J}/Req/Prompt`) as string;
      const style = tags.read(`${J}/Req/Style`) as string;
      await this.pg!.fill(tags.read(`${S}/Create/Prompt`) as string, prompt);
      if (style) await this.pg!.fill(tags.read(`${S}/Create/Style`) as string, style);
      await this.pg!.click(tags.read(`${S}/Create/Create`) as string);
      const card = tags.read(`${S}/Job/Card`) as string;
      await this.pg!.waitForSelector(card, { timeout: 10000 });
      tags.write(`${J}/SunoID`, await this.pg!.getAttribute(card, 'data-song-id'));
      tags.write(`${J}/State`, 2);
      await this.poll(J, card);
    } catch (e: any) {
      tags.write(`${J}/State`, 4);
      tags.write(`${J}/Res/Error`, e.message);
      tags.write(`${B}/Alarms/GenFailed`, true);
    }
    tags.write(`${B}/Equip/GenEngine/State`, 3);
  }

  private async poll(J: string, card: string) {
    const timeout = tags.read(`${B}/Cfg/Timeout/Gen`) as number;
    const interval = tags.read(`${B}/Cfg/Timeout/Poll`) as number;
    const start = Date.now();
    while (Date.now() - start < timeout) {
      await new Promise(r => setTimeout(r, interval));
      const c = this.pg!.locator(card).first();
      const st = await c.getAttribute('data-status');
      tags.write(`${J}/Metrics/Polls`, ((tags.read(`${J}/Metrics/Polls`) as number) || 0) + 1);
      if (st === 'complete') {
        tags.write(`${J}/Res/Songs/0/AudioURL`, await c.locator('audio source').getAttribute('src'));
        tags.write(`${J}/Res/Songs/0/Title`, await c.locator('[class*="title"]').textContent());
        tags.write(`${J}/Res/DoneAt`, new Date());
        tags.write(`${J}/State`, 3);
        tags.write(`${B}/Metrics/JobsDone`, ((tags.read(`${B}/Metrics/JobsDone`) as number) || 0) + 1);
        return;
      }
      if (st === 'failed') throw new Error('Suno failed');
    }
    throw new Error('Timeout');
  }
}
