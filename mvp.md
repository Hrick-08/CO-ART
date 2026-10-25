# CO-ART — MVP Build Spec

> Build instructions for the collaborative-drawing MVP. Source of truth for product intent is `PRD.md`; this file is the **execution plan**. Where they differ, this file wins for the MVP and the reason is noted.
>
> **Before writing any frontend code:** read `frontend/AGENTS.md` and the Next.js docs it points to. Next.js 16 has breaking changes vs. older versions; don't rely on memory for APIs.

---

## 0. MVP definition

Two logged-in users can create/join a room by 6-char code, draw on a shared canvas that stays in sync in real time, undo, clear, export PNG, see who is in the room and the connection state. The app is installable as a PWA and packagable as an APK with Bubblewrap.

**Out of scope (do not build):** matchmaking, challenges, timers, AI judging, community voting, scoring, profiles, galleries, 2v2, chat, layers, custom brushes. Do not add scaffolding "for later" beyond what is listed here.

---

## 1. Locked stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 16, App Router, TypeScript, Tailwind |
| Canvas | LiterallyCanvas (vanilla `LC.init`, see risk R1) |
| State / HTTP | Zustand, Axios |
| Backend | FastAPI, SQLAlchemy 2.x, SQLite |
| Auth | JWT (PyJWT), bcrypt (use the `bcrypt` package directly, not passlib) |
| Realtime | FastAPI WebSockets |
| PWA / Android | manual manifest + service worker, Bubblewrap |

---

## 2. Risks to resolve first

**R1 — LiterallyCanvas vs React 19 / Next 16 (do this first, time-box 1-2 hrs).**
LiterallyCanvas is an old library with React 0.14/15-era peer deps, so its React component will likely not work under React 19. Plan:
1. Install `literallycanvas` and try the **vanilla** API: `LC.init(domElement, options)`, loaded only on the client via a `"use client"` component + `next/dynamic` with `ssr: false` (it touches `window`/`document` on import).
2. It may need `React`/`ReactDOM` on `window` or its CSS (`literallycanvas.css`) imported manually. Try that.
3. **If it can't be made to render a working draw tool in the spike, stop and fall back** to a small custom `<canvas>` component that emits the exact same shape-level messages defined in §5. The protocol is deliberately canvas-agnostic so the backend is unaffected. Tell the user before switching.

**R2 — Undo in a shared canvas.** MVP rule: **undo removes the requesting user's own most recent shape** (not the globally latest). Server tracks `owner` per shape. This avoids divergence and is deterministic.

**R3 — In-memory room state.** Live canvas state lives in server memory, so run **one uvicorn worker** and note that a server restart wipes live canvases (rooms/users persist in SQLite). That's acceptable for the MVP.

---

## 3. Target structure

```
coart/
├── PRD.md
├── mvp.md
├── backend/
│   ├── requirements.txt
│   ├── .env.example
│   ├── coart.db                  (gitignored)
│   └── app/
│       ├── main.py               (app factory, CORS, routers, create tables)
│       ├── config.py             (env: SECRET_KEY, ALGORITHM, TOKEN_TTL, CORS origins)
│       ├── database.py           (engine, SessionLocal, Base, get_db)
│       ├── models.py             (User, Room)
│       ├── schemas.py            (pydantic in/out)
│       ├── security.py           (hash/verify, create/decode JWT, get_current_user)
│       ├── routers/
│       │   ├── auth.py           (register, login, me)
│       │   └── rooms.py          (create, get, join)
│       ├── ws/
│       │   ├── manager.py        (ConnectionManager + in-memory RoomState)
│       │   └── routes.py         (/ws/{code})
│       └── services/
│           └── room_codes.py     (generate unique 6-char code)
└── frontend/
    ├── .env.local.example        (NEXT_PUBLIC_API_URL, NEXT_PUBLIC_WS_URL)
    ├── public/
    │   ├── sw.js
    │   └── icons/                (192, 512, maskable-512)
    └── app/
        ├── layout.tsx
        ├── manifest.ts
        ├── page.tsx              (redirect: token ? /home : /login)
        ├── login/page.tsx
        ├── register/page.tsx
        ├── home/page.tsx
        ├── room/[code]/page.tsx
        ├── components/
        │   ├── AuthGuard.tsx
        │   ├── CanvasBoard.tsx   (LC wrapper, client-only)
        │   ├── Toolbar.tsx       (Undo / Clear / Export PNG)
        │   ├── PlayerList.tsx
        │   ├── ConnectionBadge.tsx
        │   └── RegisterSW.tsx
        ├── lib/
        │   ├── api.ts            (axios instance + interceptors)
        │   └── ws.ts             (RoomSocket class: connect, send, reconnect)
        └── store/
            ├── auth.ts
            ├── room.ts
            └── ui.ts
```

Existing `backend/main.py` moves to `backend/app/main.py`. Delete the old one once moved.

---

## 4. Backend spec

### 4.1 Models
```
User: id, username (unique, 3-20, [a-zA-Z0-9_]), password_hash, created_at
Room: id, code (unique, 6 chars), creator_id -> User, guest_id -> User (nullable),
      status ("open" | "closed"), created_at
```
Use username + password only (no email) for the MVP.

### 4.2 REST
| Method | Path | Behaviour |
|---|---|---|
| POST | `/auth/register` | validate, bcrypt hash, 201. 409 on duplicate username |
| POST | `/auth/login` | returns `{access_token, token_type, user}`. 401 on bad creds |
| GET | `/auth/me` | current user from Bearer token |
| POST | `/rooms` | auth. creates room with unique code, creator = current user |
| GET | `/rooms/{code}` | auth. room info + member usernames. 404 if none |
| POST | `/rooms/{code}/join` | auth. if user is creator/guest → ok (idempotent). elif guest_id empty → set guest. else 409 `Room is full` |

- Codes: 6 chars from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no 0/O/1/I). On unique-constraint collision, regenerate (max 10 tries).
- Normalise incoming codes with `.strip().upper()`.
- JWT: HS256, 24h expiry, `sub` = user id. `SECRET_KEY` from env, never hardcoded.
- CORS: allow the frontend origin(s) from env.

### 4.3 WebSocket `/ws/{code}?token=<jwt>`
Handshake order — on failure `close` with the code listed, **before** adding to room:
1. Decode/verify token → else close `4401` (auth failed)
2. Room exists → else `4404`
3. User is creator or guest of the room → else `4403`
4. User not already connected with a *live* socket in this room; if so, replace the old socket (handles refresh/reconnect) → close the old one with `4000`
5. Active connection count < 2 after replacement → else `4409` (room full)

After accept:
- Send `welcome` to the new client: `{you: {id, username}, players: [...]}`
- Send `sync_response` with the server's current shape list to the new client
- Broadcast `player_joined` to the others

On message: parse JSON in try/except, validate with pydantic (`type` required, size cap ~256 KB), ignore/`error`-reply invalid messages. **A malformed message must never close or crash the room.**

On disconnect: remove from manager, broadcast `player_left`. Keep room state in memory until both players have left for 10 minutes, then free it.

### 4.4 RoomState (in memory)
```python
class RoomState:
    shapes: list[dict]        # [{id, owner_id, data}]  ordered
    connections: dict[int, WebSocket]   # user_id -> ws
```
The **server is authoritative**. A new client gets state from the server, not from its peer.

---

## 5. WebSocket protocol (MVP)

PRD §8 describes `stroke_start / draw / stroke_end`. For the MVP we sync **completed shapes** (equivalent to `stroke_end`) because LC emits a serialisable shape on completion; live in-progress strokes are a polish item (§9). All messages: `{ "type": string, ...fields }`.

**Client → server**
```json
{"type": "shape_add",    "shape": { "id": "uuid", "data": { /* LC.shapeToJSON(shape) */ } }}
{"type": "undo"}
{"type": "clear_canvas"}
{"type": "sync_request"}
```
**Server → clients**
```json
{"type": "welcome",       "you": {"id":1,"username":"alice"}, "players": [{"id":1,"username":"alice"}]}
{"type": "sync_response", "shapes": [ {"id":"..","data":{..}} ]}
{"type": "shape_add",     "shape": {"id":"..","data":{..}}, "by": 1}      // to the OTHER client only
{"type": "shape_remove",  "id": "..", "by": 1}                            // to everyone incl. sender (sender may ignore if already applied)
{"type": "clear_canvas",  "by": 1}                                        // to everyone
{"type": "player_joined", "player": {...}, "players": [...]}
{"type": "player_left",   "player": {...}, "players": [...]}
{"type": "error",         "message": "..."}
```
Server behaviour:
- `shape_add`: assign `owner_id` from the socket's user (never trust client), append, relay to the other player. Reject duplicate `id`.
- `undo`: find the **last shape with `owner_id == this user`**, remove it, broadcast `shape_remove`. No-op if none.
- `clear_canvas`: empty the list, broadcast.
- `sync_request`: reply with `sync_response` to requester only.

Ordering: one asyncio task per socket plus the shared list is enough; mutate the list synchronously inside the handler (no `await` between check and mutate).

---

## 6. Frontend spec

### 6.1 State (Zustand)
- `auth`: `user, token, hydrated`; `login/logout/hydrate`. Persist token in `localStorage` under `coart_token`. Read it only inside `useEffect`/`hydrate` (SSR has no localStorage) and gate UI on `hydrated` to avoid hydration mismatch.
- `room`: `code, players, connectionStatus` (`connecting | connected | disconnected | reconnecting | full | auth_failed | not_found`).
- `ui`: `error, loading`.

### 6.2 API layer
`lib/api.ts`: axios instance with `baseURL = NEXT_PUBLIC_API_URL`, request interceptor adds `Authorization: Bearer`, response interceptor on 401 → logout + redirect `/login`.

### 6.3 Pages
- `/login`, `/register`: simple forms, inline error messages, redirect to `/home` on success (register → auto-login or redirect to `/login`, pick one and keep it consistent).
- `/home` (guarded): "Create Room" → `POST /rooms` → `router.push('/room/CODE')`. Join input (uppercased, maxLength 6) → `POST /rooms/{code}/join` → push. Show API errors (not found / full).
- `/room/[code]` (guarded): see §6.4. Remember `params` is async in recent Next versions — check the docs per `AGENTS.md`.
- Visual direction: dark, minimal, canvas dominates the screen; mobile-first (this ships as an app). Toolbar and player list sit below/around the canvas as in PRD §31.

### 6.4 Room page behaviour
1. On mount: `GET /rooms/{code}` (404 → "Room not found"), `POST /rooms/{code}/join`, then open `RoomSocket`.
2. `RoomSocket` (`lib/ws.ts`): wraps `WebSocket`, URL `${NEXT_PUBLIC_WS_URL}/ws/${code}?token=${token}`; typed `send()` that **refuses to send when not open** and surfaces the state; auto-reconnect with backoff (1s, 2s, 4s, max 10s) **except** on close codes 4401/4403/4404/4409.
3. Status mapping: 4401→`auth_failed`, 4404→`not_found`, 4409→`full`. Show a visible banner whenever status ≠ `connected`; disable toolbar while disconnected so users never draw into the void.
4. On `sync_response`: clear local canvas without emitting, rebuild from shapes. On every (re)connect the server sends this automatically.
5. **Echo loop guard:** when applying remote events to LC, set a ref flag `applyingRemote = true` so the LC `shapeSave` listener does not re-send. Always reset the flag in `finally`.
6. Local draw: LC `shapeSave` → generate `id` (`crypto.randomUUID()`), keep `id → shape` map locally, send `shape_add`.
7. Remote `shape_add`: `LC.JSONToShape(data)` → `lc.saveShape(shape, /*triggerShapeSaveEvent*/ false)`; map `id`.
8. `shape_remove`: find local shape by id and remove it from `lc.shapes`, then `lc.repaintLayer('main')`. If LC has no clean removal API, rebuild from the tracked ordered `[{id,data}]` list with `loadSnapshot`-style replay. **Keep our own ordered list as the source for rebuilds** rather than depending on LC internals.
9. Undo button → send `undo` only (don't call `lc.undo()` locally; wait for `shape_remove`). Clear → send `clear_canvas`, then apply on receipt.
10. Export PNG: `lc.getImage({ rect: ..., scale: 2 })` → `toDataURL('image/png')` → anchor download `coart-{code}.png`. Wrap in try/catch with a UI error (PRD §33). Fill a white background so the PNG isn't transparent.
11. Cleanup on unmount: close socket, destroy LC (`lc.teardown?.()`), remove listeners.
12. Canvas sizing: fill container, handle resize and orientation change. Drawing coordinates are in canvas space; if the two clients have different canvas sizes, shapes may appear offset. **MVP rule: use a fixed logical canvas (e.g. 1200×800) and scale it with CSS** so both users share one coordinate space.

---

## 7. PWA + Android

**PWA**
- `app/manifest.ts` (name "CO-ART", `display: "standalone"`, `start_url: "/home"`, theme/background colors, icons 192/512 + maskable).
- `public/sw.js`: minimal — cache the app shell/static assets; **never cache `/ws`, API calls or auth responses**. Network-first for navigation, offline fallback page.
- `RegisterSW.tsx` registers it in production only.
- Don't add a PWA plugin; Turbopack + plugins is a source of pain. Manual is ~40 lines.
- Verify with Lighthouse "installable" check on an HTTPS deploy.

**Android (Bubblewrap)** — after production HTTPS deploy:
```bash
npm i -g @bubblewrap/cli
bubblewrap init --manifest=https://<your-domain>/manifest.webmanifest
bubblewrap build
bubblewrap install
```
Needs JDK 17 + Android SDK (Bubblewrap offers to install them). Set up Digital Asset Links (`/.well-known/assetlinks.json`) with the signing key's SHA-256 so the TWA hides the browser bar. The WS URL must be `wss://`.

---

## 8. Build order (check off as you go)

### Phase 0 — Spike (R1)
- [ ] Next page with LC rendering and drawing client-side. Decide LC vs custom canvas.

### Phase 1 — Foundation
- [ ] Backend restructure into `app/`, `requirements.txt` (fastapi, uvicorn[standard], sqlalchemy, PyJWT, bcrypt, pydantic-settings, python-multipart not needed)
- [ ] Models, register, login, `/auth/me`; bcrypt + JWT
- [ ] Frontend: Tailwind check, zustand + axios installed, auth store, api.ts, `/login`, `/register`, `AuthGuard`, `/home` shell
- **Done when:** register → login → land on `/home`; refresh keeps you logged in; bad token bounces to `/login`.

### Phase 2 — Rooms
- [ ] Room model, code generator, `POST /rooms`, `GET /rooms/{code}`, `POST /rooms/{code}/join`
- [ ] Home: create + join flows, error messages
- [ ] `/room/[code]` shell showing code and member names
- **Done when:** user A creates, user B joins by code, user C gets "Room is full".

### Phase 3 — Realtime canvas
- [ ] ConnectionManager, RoomState, `/ws/{code}` handshake with close codes
- [ ] `welcome`, `sync_response`, `player_joined/left`
- [ ] `RoomSocket` with reconnect; ConnectionBadge; PlayerList
- [ ] CanvasBoard with echo-loop guard; `shape_add` both directions; late-joiner sync
- **Done when:** two browsers see each other's strokes; a third tab joining later sees the full drawing; killing the server shows "Reconnecting…" and recovers.

### Phase 4 — Canvas UX
- [ ] Undo (own last shape), Clear, Export PNG
- [ ] Toolbar disabled when disconnected; error toasts/banners
- [ ] Fixed logical canvas size + responsive scaling; touch drawing works on mobile
- **Done when:** the PRD §46 technical success criteria 1-11 pass.

### Phase 5 — PWA + Android
- [ ] Manifest, icons, `sw.js`, registration
- [ ] Deploy (frontend on Vercel or similar; backend on a host with persistent disk and WebSocket support, single worker, HTTPS/WSS)
- [ ] Bubblewrap build, install, verify login + WS + drawing inside the APK
- **Done when:** PRD §46 criteria 12-13 pass.

---

## 9. Post-MVP polish (only after Phase 5)
- Live in-progress strokes (`stroke_start` / `draw` / `stroke_end`) for lower perceived latency
- Optional room chat
- Rate limiting on auth + WS messages
- Rooms: expiry/cleanup job
- Persisting finished canvas snapshots

---

## 10. Test checklist (minimum)

**Backend (pytest + FastAPI TestClient, incl. `websocket_connect`)**
- register ok / duplicate 409 / password stored hashed
- login ok / bad password 401 / expired + garbage JWT rejected
- room create returns 6-char code from the allowed alphabet
- join: second user ok, third user 409, creator re-join idempotent
- WS: bad token 4401, unknown room 4404, non-member 4403, third connection 4409
- WS: `shape_add` relayed to peer only; `undo` removes only the sender's shape; `clear_canvas` reaches both; late joiner receives all shapes
- WS: malformed JSON / unknown type / oversized payload → `error`, room still works

**Manual (two browsers + one phone)**
- draw simultaneously from both sides, then undo from each, then clear
- refresh one tab mid-drawing → state restored
- toggle network off/on → reconnect banner, state resyncs
- export PNG opens with white background and full drawing
- install PWA on phone, then APK

---

## 11. Config / env

`backend/.env.example`
```
SECRET_KEY=change-me-long-random
ACCESS_TOKEN_EXPIRE_MINUTES=1440
DATABASE_URL=sqlite:///./coart.db
CORS_ORIGINS=http://localhost:3000
```
`frontend/.env.local.example`
```
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```
SQLite + FastAPI: use `connect_args={"check_same_thread": False}`.

Run locally:
```bash
# backend
cd backend && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# frontend
cd frontend && npm run dev
```

---

## 12. Rules for the coding agent
- Work phase by phase; stop and verify each "Done when" before moving on.
- Don't add features outside §0. If something in the PRD seems missing here, it's intentionally post-MVP.
- Never trust client-supplied identity on the WebSocket; derive the user from the verified JWT.
- Never let one bad message take down a room.
- Commit after each phase with a clear message.
