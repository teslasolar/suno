# Konomi Suno API — Test Documentation

## Running Tests

```bash
# Run full test suite (no browser needed)
npm test

# Start server in test mode (manual curl testing)
npm run test:server

# Start with your existing browser session
CHROME_PROFILE=~/.config/google-chrome/Default npm start

# Start headed for manual login
npm run dev
```

## Test Results — 32/32 PASS

```
════════════════════════════════════════════════════════════
  KONOMI SUNO API — TEST RESULTS
════════════════════════════════════════════════════════════
  PASS   81ms  GET /health — returns ok
  PASS    5ms  GET /status — full system state
  PASS    3ms  GET /status — equipment modules present
  PASS    3ms  GET /status — alarms all false at init
  PASS    3ms  GET /status — metrics initialized to zero
  PASS    3ms  GET /status — session defaults
  PASS    3ms  GET /status — browser defaults
  PASS    3ms  GET /tags/Konomi/_Meta/Version — read scalar
  PASS    6ms  GET /tags/Konomi/_Meta/ISALevel — read number
  PASS    3ms  GET /tags/nonexistent — returns null
  PASS   41ms  PUT /tags — write string
  PASS    6ms  PUT /tags — write number
  PASS    5ms  PUT /tags — write boolean
  PASS    9ms  PUT /tags — overwrite value
  PASS    3ms  GET /tags — list all keys
  PASS    3ms  GET /tags?prefix=Konomi/Equip — filtered keys
  PASS    4ms  GET /udt/Konomi/Cfg/Timeout — read config UDT
  PASS    2ms  GET /udt/Konomi/Cfg/Limit — read limits
  PASS    2ms  GET /udt/Konomi/Equip/GenEngine — equipment UDT
  PASS    1ms  GET /udt/Konomi/Cfg/Sel — selectors nested UDT
  PASS    3ms  GET /udt/nonexistent — returns empty object
  PASS    2ms  GET /dump — returns all tags
  PASS    4ms  POST /generate — success
  PASS    4ms  POST /generate — missing prompt returns 400
  PASS    5ms  POST /generate — with instrumental flag
  PASS    6ms  POST /generate — increments ActiveCt
  PASS    6ms  GET /job/:id — returns job
  PASS    2ms  GET /job/:id — 404 for unknown id
  PASS   10ms  write tags then readUDT — round-trip
  PASS    3ms  equipment states set to Idle in no-browser mode
  PASS    9ms  PUT alarm tag — updates status
  PASS    8ms  simulate login via tag writes
────────────────────────────────────────────────────────────
  32/32 passed, 0 failed
════════════════════════════════════════════════════════════
```

## Endpoints Tested

| # | Method | Endpoint | Tests | Notes |
|---|--------|----------|-------|-------|
| 1 | GET | `/health` | 1 | ok, version, browser mode, tag count, uptime |
| 2 | GET | `/status` | 6 | equip, session, browser, alarms, metrics |
| 3 | GET | `/tags` | 2 | list all keys, filter by prefix |
| 4 | GET | `/tags/{path}` | 3 | string, number, null for missing |
| 5 | PUT | `/tags/{path}` | 4 | string, number, boolean, overwrite |
| 6 | GET | `/udt/{path}` | 5 | timeout, limits, equip, selectors, empty |
| 7 | GET | `/dump` | 1 | full tag store dump |
| 8 | POST | `/generate` | 4 | success, 400 on missing prompt, instrumental flag, counter increment |
| 9 | GET | `/job/:id` | 2 | found, 404 |
| 10 | — | round-trips | 3 | tag→UDT, alarm update, session simulation |

## What's Tested

### TagStore (tags.ts)
- `read()` — scalar string, number, null for missing
- `write()` — string, number, boolean, overwrite
- `readUDT()` — flat, nested, empty base path
- `writeUDT()` — config, equipment, job structures
- `keys()` — all keys, prefix-filtered
- `size()` — returns count
- `dump()` — full store snapshot
- Change events fire (used internally by routes)

### API Server (index.ts)
- Health endpoint returns version, tag count, browser mode, uptime
- Status endpoint assembles all UDTs (equip, session, browser, alarms, metrics)
- Tag CRUD — read, write, list, filter
- UDT read — nested structures reconstructed correctly
- Generate — validates prompt, creates job in tag store, returns jobId
- Job lookup — by ID, 404 for unknown
- No-browser mode — equipment states set to Idle (2)

### ISA-95 Equipment Model
- All 3 equipment modules initialized (SessionMgr, GenEngine, AssetMgr)
- Each has: ID (UUID), Name, State, Mode, Cmd, Health, Heartbeat, FaultCode, FaultMsg
- States transition correctly in no-browser mode (0→2)
- Alarms all initialize to false
- Metrics all initialize to 0

### Browser Auth (browser.ts)
- **Not tested in CI** — requires Chromium binary
- Supports 3 modes:
  1. `CHROME_PROFILE` env var → reuse your existing logged-in Chrome
  2. `./session` directory → Playwright-managed persistent context
  3. `HEADLESS=false` (dev mode) → login manually in headed browser
- `channel: 'chrome'` used when CHROME_PROFILE set (uses system Chrome)
- `--disable-blink-features=AutomationControlled` to reduce bot detection

## Server Modes

| Mode | Command | Browser | Use Case |
|------|---------|---------|----------|
| Production | `npm start` | Headless, `./session` | Automated generation |
| Dev | `npm run dev` | Headed, `./session` | Manual login, debug |
| Profile | `CHROME_PROFILE=... npm start` | Headless, your profile | Reuse existing auth |
| Test server | `npm run test:server` | None | Manual API testing |
| Test suite | `npm test` | None | Automated 32-test suite |

## Reusing Your Browser Session

If you're already logged into Suno in Chrome, point at your profile:

```bash
# Linux
CHROME_PROFILE=~/.config/google-chrome/Default npm start

# macOS
CHROME_PROFILE="$HOME/Library/Application Support/Google/Chrome/Default" npm start

# Windows (PowerShell)
$env:CHROME_PROFILE="$env:LOCALAPPDATA\Google\Chrome\User Data\Default"
npm start

# Brave
CHROME_PROFILE=~/.config/BraveSoftware/Brave-Browser/Default npm start

# Edge
CHROME_PROFILE=~/.config/microsoft-edge/Default npm start
```

**Important**: Close Chrome first — Playwright needs exclusive access to the profile directory.
Alternatively, use a separate Chrome profile for Suno and keep your main browser open.

## Tools Added

| Tool | File | Purpose |
|------|------|---------|
| `tags.dump()` | tags.ts | Snapshot entire tag store as flat object |
| `tags.clear()` | tags.ts | Wipe all tags (for test isolation) |
| `tags.size()` | tags.ts | Count of tags in store |
| `tags.keys(prefix?)` | tags.ts | List tag paths, optionally filtered |
| `GET /health` | index.ts | Quick health check with version + stats |
| `GET /tags` | index.ts | List all tag keys with optional `?prefix=` filter |
| `GET /dump` | index.ts | Full tag store dump endpoint |
| `--no-browser` | index.ts | Start server without Playwright |
| `NO_BROWSER=1` | index.ts | Same as above, via env var |
| `CHROME_PROFILE` | browser.ts | Point at existing Chrome profile |
| `channel: 'chrome'` | browser.ts | Use system Chrome instead of bundled Chromium |

## Not Yet Implemented (Future)

These are stubbed in the tag structure but not wired to browser actions yet:

- `POST /login` — dedicated login endpoint (currently via tag writes to `Konomi/Cmd/Login/*`)
- `POST /cancel` — cancel active job
- `POST /refresh` — force session refresh
- Job queue management — multiple concurrent jobs, queue overflow
- Job history — moving completed jobs from Active to History
- Asset download — saving audio/images to `./downloads`
- Session expiry timer — auto-refresh before `Cfg/Timeout/Session`
- Metrics computation — `AvgGenTime`, `SuccessRate` calculated from history
- WebSocket/SSE — real-time tag change events to the SPA
