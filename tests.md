# Konomi Suno API — Test & API Documentation

## Quick Start

```bash
npm install
npm start                        # start server (port 3456)
SUNO_COOKIE="your_cookie" npm start  # start with auth
```

Then open http://localhost:3456 — the frontend is served from the same port.

## Authentication

Suno uses Clerk for auth. You need a cookie from your browser session.

### Getting your cookie
1. Open https://suno.com and log in
2. Open DevTools (F12) → Network tab
3. Reload the page
4. Click any request to suno.com
5. Copy the full `Cookie` header value

### Using the cookie

**Option A: Environment variable**
```bash
SUNO_COOKIE="__client=...; __cf_bm=...; ..." npm start
```

**Option B: Runtime via API**
```bash
curl -X POST http://localhost:3456/auth/cookie \
  -H 'Content-Type: application/json' \
  -d '{"cookie":"__client=...; __cf_bm=...; ..."}'
```

**Option C: Frontend**
Go to http://localhost:3456/#auth and paste the cookie.

### How auth works internally
1. Cookie → `GET clerk.suno.com/v1/client` → extracts `last_active_session_id`
2. Session ID → `POST clerk.suno.com/v1/client/sessions/{id}/tokens` → gets JWT
3. JWT used as `Authorization: Bearer` for all `studio-api.suno.ai` calls
4. Token auto-refreshes every 30 seconds

## API Endpoints

### System

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/health` | No | Health check: ok, version, auth status, tag count, uptime |
| GET | `/status` | No | Full system state: equipment, session, alarms, metrics |

### Auth

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/auth/cookie` | No | Set Suno cookie. Body: `{"cookie":"..."}` |
| GET | `/auth/status` | No | Auth status + session info |
| GET | `/credits` | Yes | Refresh and return credit balance |

### Suno Operations

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/library?page=0` | Yes | Paginated song library from Suno |
| GET | `/clip/:id` | Yes | Single clip/song by ID |
| POST | `/generate` | Yes | Generate song. Body: `{prompt, style?, title?, instrumental?}` |
| GET | `/poll?ids=a,b` | Yes | Poll clip status by IDs |
| POST | `/lyrics` | Yes | Generate lyrics. Body: `{"prompt":"..."}` |
| GET | `/lyrics/:id` | Yes | Get generated lyrics result |

### ISA-95 Tags

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/tags?prefix=Konomi/Equip` | No | List tag keys (optional prefix filter) |
| GET | `/tags/{path}` | No | Read single tag value |
| PUT | `/tags/{path}` | No | Write tag value. Body: `{"value":...}` |
| GET | `/udt/{path}` | No | Read UDT (nested object) |
| GET | `/dump` | No | Full tag store dump |

## Generate Modes

**Description mode** (Suno writes lyrics from your prompt):
```bash
curl -X POST http://localhost:3456/generate \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"A melancholy lo-fi track about rainy days"}'
```

**Custom mode** (you provide lyrics + style tags):
```bash
curl -X POST http://localhost:3456/generate \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"[Verse]\nWalking in the rain...","style":"lo-fi hip hop, acoustic","title":"Rainy Days"}'
```

**Instrumental**:
```bash
curl -X POST http://localhost:3456/generate \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"Ambient synth waves","instrumental":true}'
```

Response returns `clipIds` array. Poll with `GET /poll?ids=id1,id2`.

### Clip status lifecycle
`submitted` → `queued` → `streaming` → `complete`

Poll every 5s. When `complete`, `audio_url` is a CDN MP3 link.

## Suno API Internals (studio-api.suno.ai)

| Upstream Endpoint | Our Proxy | Purpose |
|-------------------|-----------|---------|
| `GET /api/billing/info/` | `GET /credits` | Credit balance |
| `POST /api/generate/v2/` | `POST /generate` | Song generation (2 clips per request, 10 credits) |
| `GET /api/feed/?page=N` | `GET /library?page=N` | Paginated library |
| `GET /api/feed/?ids=a,b` | `GET /poll?ids=a,b` | Poll clip status |
| `GET /api/clip/:id` | `GET /clip/:id` | Single clip |
| `POST /api/generate/lyrics/` | `POST /lyrics` | AI lyrics generation |
| `GET /api/generate/lyrics/:id` | `GET /lyrics/:id` | Get lyrics result |

Model: `chirp-v4` (default). Audio CDN: `https://cdn1.suno.ai/{id}.mp3`

## Server Test Results

Tested with server running (no Suno auth required for these):

```
GET  /health      → {"ok":true,"version":"1.0.0","authenticated":false,"tags":52}
GET  /auth/status → {"authenticated":false,"session":{"State":0,"Credits":0}}
POST /generate    → {"error":"Not authenticated. POST /auth/cookie first."} (401)
GET  /            → serves index.html (frontend SPA)
GET  /app/js/*.js → all 10 frontend modules served correctly
```

## Frontend Views

| Route | View | Data Source |
|-------|------|-------------|
| `#status` | System dashboard | `GET /status` + `GET /health` |
| `#auth` | Cookie auth + session info | `POST /auth/cookie` + `GET /auth/status` |
| `#generate` | Song creation + live polling | `POST /generate` + `GET /poll` |
| `#library` | Paginated song browser + playback | `GET /library` |
| `#jobs` | Recent songs table | `GET /library` |
| `#tags` | ISA-95 tag browser | `GET/PUT /tags/*` + `GET /udt/*` |

## Files

```
src/
├── tags.ts     — TagStore (ISA-95 tag hierarchy, EventEmitter)
├── suno.ts     — Suno HTTP client (Clerk auth, studio-api proxy)
├── index.ts    — Express server (all routes, frontend static serving)
└── browser.ts  — [legacy] Playwright browser automation

app/
├── styles.css  — all CSS
└── js/
    ├── api.js      — fetch client for all endpoints
    ├── router.js   — hash-based SPA router
    ├── nav.js      — navigation + connection indicator
    ├── toast.js    — notification helper
    ├── auth.js     — cookie auth view
    ├── status.js   — system dashboard view
    ├── generate.js — song creation view
    ├── library.js  — song library view
    ├── jobs.js     — recent songs table view
    └── tags.js     — tag browser view

test/
└── run.ts      — automated test suite (ISA-95 tag/UDT tests)
```

## TagStore Utilities

| Method | Purpose |
|--------|---------|
| `read(path)` | Read scalar tag value |
| `write(path, value)` | Write tag, emits `change` event |
| `readUDT(base)` | Read nested structure under base path |
| `writeUDT(base, obj)` | Flatten object into tag writes |
| `keys(prefix?)` | List tag paths |
| `size()` | Tag count |
| `dump()` | Full store as flat object |
| `clear()` | Wipe all tags |
