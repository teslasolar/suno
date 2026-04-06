# CLAUDE.md — Konomi Suno API

AI assistant instructions for this project.

## What This Project Does

`konomi-suno-api` is an Express HTTP server that proxies the Suno AI music generation API.
It authenticates via Suno's Clerk session, maintains a JWT refresh loop, and exposes a
REST API for generating songs, lyrics, and browsing your library.

A browser-based SPA is served from the same port (`localhost:3456`) with views for auth,
generation, library browsing, and an ISA-95 tag inspector.

## Tech Stack

- **Runtime**: Node.js, TypeScript (strict mode, ES2022, ESM)
- **Server**: Express 4 with CORS open to `*`
- **Auth**: Clerk session cookie → JWT, auto-refreshed every 30 seconds
- **State**: In-process ISA-95 tag store (`src/tags.ts`) — flat key-value with UDT (nested) support
- **Frontend**: Vanilla JS SPA in `app/js/`, hash-based routing, no framework
- **Execution**: `tsx` (no compile step required)

## Key Files

```
src/
  index.ts    — Express server: all routes, startup, Konomi tag initialisation
  suno.ts     — SunoClient: Clerk auth, JWT refresh, studio-api.suno.ai proxy methods
  tags.ts     — TagStore: ISA-95 tag hierarchy (read/write/UDT/events)
  cookie.ts   — Cookie extraction from local browser SQLite DBs (Chrome/Brave/Edge)
  browser.ts  — Legacy Playwright automation (superseded by cookie.ts)

app/
  styles.css
  js/         — SPA modules: api, router, nav, auth, status, generate, library, jobs, tags

test/
  run.ts      — Automated test suite (ISA-95 tag and UDT correctness)

tests.md      — Full API reference and test results (treat as the source of truth for endpoints)
```

## Konomi Ecosystem Integration

This project follows the **Konomi ISA-95 tagging convention**. All runtime state lives
under a hierarchical tag namespace rooted at `Konomi/`:

| Namespace | Purpose |
|-----------|---------|
| `Konomi/Equip/{name}` | Equipment UDTs (SessionMgr, GenEngine, AssetMgr) |
| `Konomi/Session/*` | Auth state, credits |
| `Konomi/Metrics/*` | JobsDone, JobsFail, AvgGenTime, SuccessRate |
| `Konomi/Alarms/*` | SessionExp, LowCredits, GenFailed, RateLimited |
| `Konomi/Jobs/*` | ActiveCt, TotalProc |
| `Konomi/Browser/*` | Connected flag |
| `Konomi/Cfg/*` | Timeouts and limits |
| `Konomi/_Meta/*` | Version, ISALevel, StartedAt |

Equipment state codes: `0=idle, 1=starting, 2=standby, 3=running, 4=busy, 7=fault`.

Tag endpoints (`/tags/*`, `/udt/*`, `/dump`) expose the full store over HTTP for
tooling and dashboards in the broader Konomi system.

## How to Run

```bash
npm install
npm start                              # server on port 3456, no auth
SUNO_COOKIE="..." npm start            # start pre-authenticated
```

Authenticate at runtime:
```bash
curl -X POST http://localhost:3456/auth/cookie \
  -H 'Content-Type: application/json' \
  -d '{"cookie":"<your Suno cookie>"}'
```

Or extract automatically from a local browser:
```bash
npm run cookie          # interactive browser selection
npm run cookie:chrome   # Chrome only
npm run cookie:brave    # Brave only
```

## How to Test

```bash
npm test    # runs test/run.ts with NO_BROWSER=1 (no Suno auth needed)
```

See `tests.md` for the full API reference and expected responses.

## Coding Conventions

- **TypeScript strict mode** throughout — no `any` unless bridging external API responses
- **ESM only** — `import/export`, `.js` extensions on relative imports (even for `.ts` sources)
- **No compile step** — `tsx` runs TypeScript directly; `tsc` is for type-checking only
- **Tag writes for all state changes** — never use module-level variables for observable state;
  write to `tags` so the `/status` and `/dump` endpoints stay accurate
- **Error handling pattern**: catch, write fault tags (`State=7`, `FaultMsg`), set alarm, rethrow
- **Routes stay in `index.ts`** — business logic belongs in `suno.ts` or `tags.ts`
- **No framework on the frontend** — keep `app/js/` modules small and dependency-free

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `3456` | HTTP server port |
| `SUNO_COOKIE` | `""` | Pre-load auth cookie on startup |
| `NO_BROWSER` | unset | Set to `1` to skip browser automation in tests |

## Suno API Notes

- Model: `chirp-v4`
- Generation costs 10 credits and returns 2 clips per request
- Clip lifecycle: `submitted` → `queued` → `streaming` → `complete`
- Poll `GET /poll?ids=id1,id2` every 5 seconds until `complete`
- Audio CDN: `https://cdn1.suno.ai/{id}.mp3`
- Auth expires; the 30-second refresh interval keeps the JWT live during a session
