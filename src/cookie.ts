/**
 * Cookie Extractor — reads suno.com cookies from Chrome/Brave/Edge cookie DB.
 *
 * On Linux, Chrome encrypts cookies with AES-128-CBC using a key derived from
 * "peanuts" via PBKDF2. On macOS, the key comes from the Keychain. On Windows,
 * DPAPI is used. This script handles Linux and falls back to plaintext.
 *
 * Usage:
 *   npx tsx src/cookie.ts              # auto-detect browser
 *   npx tsx src/cookie.ts --chrome     # force Chrome
 *   npx tsx src/cookie.ts --brave      # force Brave
 *   npx tsx src/cookie.ts --edge       # force Edge
 *   npx tsx src/cookie.ts --chromium   # force Chromium
 *   npx tsx src/cookie.ts --print      # just print, don't start server
 */

import { readFileSync, existsSync, copyFileSync, unlinkSync } from 'fs';
import { homedir, platform } from 'os';
import { join } from 'path';
import { pbkdf2Sync, createDecipheriv } from 'crypto';
import initSqlJs from 'sql.js';

const DOMAIN = '.suno.com';

interface BrowserProfile {
  name: string;
  cookiePath: string;
}

function getBrowserProfiles(): BrowserProfile[] {
  const home = homedir();
  const os = platform();

  if (os === 'linux') {
    return [
      { name: 'Chrome', cookiePath: join(home, '.config/google-chrome/Default/Cookies') },
      { name: 'Brave', cookiePath: join(home, '.config/BraveSoftware/Brave-Browser/Default/Cookies') },
      { name: 'Edge', cookiePath: join(home, '.config/microsoft-edge/Default/Cookies') },
      { name: 'Chromium', cookiePath: join(home, '.config/chromium/Default/Cookies') },
    ];
  }
  if (os === 'darwin') {
    return [
      { name: 'Chrome', cookiePath: join(home, 'Library/Application Support/Google/Chrome/Default/Cookies') },
      { name: 'Brave', cookiePath: join(home, 'Library/Application Support/BraveSoftware/Brave-Browser/Default/Cookies') },
      { name: 'Edge', cookiePath: join(home, 'Library/Application Support/Microsoft Edge/Default/Cookies') },
      { name: 'Chromium', cookiePath: join(home, 'Library/Application Support/Chromium/Default/Cookies') },
    ];
  }
  if (os === 'win32') {
    const appData = process.env.LOCALAPPDATA || join(home, 'AppData/Local');
    return [
      { name: 'Chrome', cookiePath: join(appData, 'Google/Chrome/User Data/Default/Cookies') },
      { name: 'Brave', cookiePath: join(appData, 'BraveSoftware/Brave-Browser/User Data/Default/Cookies') },
      { name: 'Edge', cookiePath: join(appData, 'Microsoft/Edge/User Data/Default/Cookies') },
    ];
  }
  return [];
}

function decryptLinux(encrypted: Buffer): string {
  // Chrome on Linux: v10/v11 prefix + AES-128-CBC
  // Key: PBKDF2("peanuts", "saltysalt", 1, 16)
  if (encrypted.length < 4) return encrypted.toString();
  const prefix = encrypted.subarray(0, 3).toString();
  if (prefix !== 'v10' && prefix !== 'v11') return encrypted.toString();

  const key = pbkdf2Sync('peanuts', 'saltysalt', 1, 16, 'sha1');
  const iv = Buffer.alloc(16, ' '.charCodeAt(0));
  const data = encrypted.subarray(3);

  try {
    const decipher = createDecipheriv('aes-128-cbc', key, iv);
    decipher.setAutoPadding(true);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf-8');
  } catch {
    return '';
  }
}

function decryptValue(encrypted: Buffer): string {
  const os = platform();
  if (os === 'linux') return decryptLinux(encrypted);
  // macOS/Windows: would need keychain/DPAPI — fall back to plaintext
  if (encrypted.length > 3) {
    const prefix = encrypted.subarray(0, 3).toString();
    if (prefix === 'v10' || prefix === 'v11') {
      console.error('  Cookie is encrypted. On macOS, run: security find-generic-password -w -s "Chrome Safe Storage"');
      console.error('  Then set CHROME_KEY env var and re-run.');
      return '';
    }
  }
  return encrypted.toString();
}

async function extractCookies(browserName?: string): Promise<string> {
  const profiles = getBrowserProfiles();
  let targets = profiles.filter(p => existsSync(p.cookiePath));

  if (browserName) {
    targets = targets.filter(p => p.name.toLowerCase() === browserName.toLowerCase());
  }

  if (!targets.length) {
    const tried = browserName
      ? `No cookie DB found for ${browserName}`
      : 'No browser cookie DB found';
    console.error(tried);
    console.error('Looked in:');
    profiles.forEach(p => console.error(`  ${p.name}: ${p.cookiePath} ${existsSync(p.cookiePath) ? '(found)' : '(missing)'}`));
    process.exit(1);
  }

  const target = targets[0];
  console.log(`Reading cookies from ${target.name}: ${target.cookiePath}`);

  // Copy DB to avoid lock conflicts with running browser
  const tmp = target.cookiePath + '.konomi-tmp';
  copyFileSync(target.cookiePath, tmp);

  try {
    const SQL = await initSqlJs();
    const buf = readFileSync(tmp);
    const db = new SQL.Database(buf);

    // Chrome 96+ uses host_key, older uses host_key. encrypted_value is the cookie.
    const stmt = db.prepare(
      `SELECT name, encrypted_value, value FROM cookies
       WHERE host_key LIKE ?
       ORDER BY name`
    );
    stmt.bind(['%suno%']);

    const cookies: string[] = [];
    const seen = new Set<string>();

    while (stmt.step()) {
      const row = stmt.getAsObject() as { name: string; encrypted_value: Uint8Array; value: string };
      if (seen.has(row.name)) continue;
      seen.add(row.name);

      let val = '';
      if (row.encrypted_value && row.encrypted_value.length > 0) {
        val = decryptValue(Buffer.from(row.encrypted_value));
      }
      if (!val && row.value) {
        val = row.value;
      }
      if (val) {
        cookies.push(`${row.name}=${val}`);
      }
    }

    stmt.free();
    db.close();

    if (!cookies.length) {
      throw new Error('No suno.com cookies found. Are you logged into Suno in this browser?');
    }

    console.log(`Found ${cookies.length} suno.com cookies`);
    return cookies.join('; ');
  } finally {
    try { unlinkSync(tmp); } catch {}
  }
}

export { extractCookies };

// --- CLI entrypoint ---
const isCLI = process.argv[1]?.includes('cookie');
if (isCLI) {
  const args = process.argv.slice(2);
  const printOnly = args.includes('--print');
  const browserArg = ['chrome', 'brave', 'edge', 'chromium']
    .find(b => args.includes(`--${b}`));

  try {
    const cookie = await extractCookies(browserArg);

    if (printOnly) {
      console.log('\n--- Cookie ---');
      console.log(cookie);
      console.log('--- End ---\n');
      process.exit(0);
    }

    console.log('Starting server with extracted cookie...\n');
    process.env.SUNO_COOKIE = cookie;
    await import('./index.js');
  } catch (e: any) {
    console.error(e.message);
    process.exit(1);
  }
}
