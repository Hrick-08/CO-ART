```
 ██████╗ ██████╗       █████╗ ██████╗ ████████╗
██╔════╝██╔═══██╗     ██╔══██╗██╔══██╗╚══██╔══╝
██║     ██║   ██║     ███████║██████╔╝   ██║
██║     ██║   ██║     ██╔══██║██╔══██╗   ██║
╚██████╗╚██████╔╝     ██║  ██║██║  ██║   ██║
 ╚═════╝ ╚═════╝      ╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝
 ```

### Real-time Collaborative Drawing Platform

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js&logoColor=white)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![NeonDB](https://img.shields.io/badge/NeonDB-Serverless-00A8E8?style=flat-square&logo=neon&logoColor=white)](https://neon.tech/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![WebSockets](https://img.shields.io/badge/WebSockets-Native-010101?style=flat-square&logo=websocket&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)
[![PWA](https://img.shields.io/badge/PWA-Ready-5A0FC8?style=flat-square&logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)
[![Bubblewrap](https://img.shields.io/badge/Bubblewrap-TWA-3DDC84?style=flat-square&logo=android&logoColor=white)](https://github.com/GoogleChromeLabs/bubblewrap)

> **CO-ART** is a real-time multiplayer art platform where two people can share a canvas to create artwork together. Built with Next.js 16, FastAPI, WebSockets, and LiterallyCanvas. Features JWT authentication, server-authoritative canvas state, and PWA/Android support.

---

## 🎯 Current MVP Features

### Authentication
- [x] User registration with username/password
- [x] User login with JWT tokens
- [x] JWT authentication (HS256, 24h expiry)
- [x] Bcrypt password hashing
- [x] Protected routes with AuthGuard
- [x] Token persistence in localStorage

### Rooms
- [x] Create room (generates 6-char code)
- [x] Join room by code
- [x] Maximum 2 players per room
- [x] Room info endpoint (GET /rooms/{code})
- [x] Idempotent join for creator/guest
- [x] "Room is full" error for 3rd player

### Real-time Canvas
- [x] LiterallyCanvas integration (vanilla API)
- [x] WebSocket connection with JWT auth
- [x] Stroke synchronization via completed shapes
- [x] Server-authoritative state (owner_id per shape)
- [x] Late-joiner sync (full history replay)
- [x] Fixed logical canvas size (1200×800) with CSS scaling

### Canvas Controls
- [x] Undo (removes requesting user's own last shape)
- [x] Clear canvas (synchronized to all)
- [x] Export PNG (with white background, 2x scale)
- [x] Toolbar disabled when disconnected

### Multiplayer Presence
- [x] Player list with online indicators
- [x] Join/leave broadcast
- [x] Connection status badge (connecting, connected, reconnecting, disconnected, full, auth_failed, not_found)
- [x] Auto-reconnect with exponential backoff

### PWA / Mobile
- [x] Web App Manifest (standalone display)
- [x] Service Worker (offline shell, no API/WS caching)
- [x] App icons (192, 512, maskable-512)
- [x] Installable on mobile
- [x] Android APK via Bubblewrap (after HTTPS deploy)

### Technical Foundation
- [x] Next.js 16 App Router + TypeScript + Tailwind
- [x] Zustand for client state
- [x] Axios with interceptors
- [x] FastAPI + SQLAlchemy 2.x (async) + PostgreSQL (NeonDB)
- [x] Single uvicorn worker (in-memory room state)
- [x] Comprehensive error handling (malformed WS messages never crash room)

---

## 🚧 Upcoming Scopes (Post-MVP)

### Phase 6 — Competitive Art Mode
- [ ] Matchmaking (1v1)
- [ ] Drawing challenges/prompts
- [ ] Timer for drawing phase
- [ ] Submission locking
- [ ] Result screens
- [ ] Rematch functionality

### Phase 7 — Judging & Scoring
- [ ] AI judging pipeline (50 points)
  - [ ] Adherence to prompt
  - [ ] Creativity
  - [ ] Composition
  - [ ] Execution
  - [ ] Visual quality
- [ ] Community voting (50 points)
  - [ ] One vote per eligible user
  - [ ] Tie handling (25 points each)
  - [ ] Anti-abuse/rate limiting
- [ ] 100-point combined scoring
- [ ] Winner determination & display

### Phase 8 — Social & Game Progression
- [ ] Player profiles
- [ ] Match history
- [ ] Leaderboards
- [ ] Artwork galleries
- [ ] Follow/friend system
- [ ] Likes/reactions/comments
- [ ] Public competitions
- [ ] Featured artwork

### Technical Improvements
- [ ] Live in-progress strokes (stroke_start/draw/stroke_end)
- [ ] Optional room chat
- [ ] Rate limiting on auth + WS messages
- [ ] Room expiry/cleanup job
- [ ] Persisting finished canvas snapshots
- [ ] Multi-worker support (Redis pub/sub for room state)

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────┐
│              Next.js PWA                     │
│  Auth / Home / Room / Canvas / Toolbar      │
│  Zustand • Axios • LiterallyCanvas           │
└─────────────────────┬───────────────────────┘
                      │ HTTPS / WSS
                      ▼
┌─────────────────────────────────────────────┐
│               FastAPI                        │
│  REST API • JWT Auth • Room Management      │
│  WebSocket Manager • RoomState (in-memory)  │
└─────────────────────┬───────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────┐
│            PostgreSQL (NeonDB)              │
│  Users • Rooms • (Future: Matches/Scores)   │
└─────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, App Router, TypeScript, Tailwind CSS |
| Canvas | LiterallyCanvas (vanilla `LC.init`) |
| State | Zustand |
| HTTP | Axios |
| Auth | JWT (PyJWT), bcrypt |
| Backend | FastAPI, SQLAlchemy 2.x (async), asyncpg |
| Database | PostgreSQL 16 (NeonDB serverless) |
| Realtime | FastAPI WebSockets |
| PWA | Manual manifest + Service Worker |
| Android | Google Bubblewrap |

---

## 🚀 Quick Start

### Prerequisites
- Python 3.12+
- Node.js 20+
- npm/pnpm
- PostgreSQL (or NeonDB account)

### Backend
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate  # Windows
# source .venv/bin/activate  # Linux/Mac
pip install -r requirements.txt
cp .env.example .env  # edit DATABASE_URL and SECRET_KEY
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
cp .env.local.example .env.local  # adjust API/WS URLs if needed
npm run dev
```

Open `http://localhost:3000` (or 3001) in two browser tabs.

### Test Users
1. Register/login as "alice" in first tab
2. Create room → copy 6-char code
3. Register/login as "bob" in second tab (incognito/another browser)
4. Join room with code
5. Draw together!

---

## 📁 Project Structure

```
coart/
├── PRD.md              # Product Requirements Document
├── mvp.md              # MVP Build Specification
├── README.md           # This file
├── backend/
│   ├── requirements.txt
│   ├── .env.example
│   ├── .env            # gitignored
│   └── app/
│       ├── main.py           # FastAPI app factory
│       ├── config.py         # Settings (pydantic-settings)
│       ├── database.py       # Async SQLAlchemy engine/session
│       ├── models.py         # User, Room models
│       ├── schemas.py        # Pydantic schemas
│       ├── security.py       # JWT, bcrypt, get_current_user
│       ├── routers/
│       │   ├── auth.py       # register, login, me
│       │   └── rooms.py      # create, get, join
│       ├── ws/
│       │   ├── manager.py    # ConnectionManager + RoomState
│       │   └── routes.py     # /ws/{code} handler
│       └── services/
│           └── room_codes.py # 6-char code generator
└── frontend/
    ├── .env.local.example
    ├── .env.local
    ├── public/
    │   ├── sw.js
    │   └── icons/
    └── app/
        ├── layout.tsx
        ├── manifest.ts
        ├── page.tsx              # redirect based on auth
        ├── login/page.tsx
        ├── register/page.tsx
        ├── home/page.tsx
        ├── room/[code]/page.tsx
        ├── components/
        │   ├── AuthGuard.tsx
        │   ├── CanvasBoard.tsx
        │   ├── Toolbar.tsx
        │   ├── PlayerList.tsx
        │   ├── ConnectionBadge.tsx
        │   └── RegisterSW.tsx
        ├── lib/
        │   ├── api.ts            # axios instance + interceptors
        │   └── ws.ts             # RoomSocket class
        └── store/
            ├── auth.ts
            ├── room.ts
            └── ui.ts
```

---

## 🧪 Testing Checklist

### Backend (pytest + FastAPI TestClient)
- [x] Register OK / duplicate 409 / password hashed
- [x] Login OK / bad password 401 / expired JWT rejected
- [x] Room create returns valid 6-char code
- [x] Join: second user OK, third user 409, creator re-join idempotent
- [x] WS: bad token 4401, unknown room 4404, non-member 4403, third connection 4409
- [x] WS: shape_add relayed to peer only; undo removes only sender's shape; clear reaches both; late joiner receives all shapes
- [x] WS: malformed JSON / unknown type / oversized payload → error, room still works

### Manual (two browsers + phone)
- [x] Draw simultaneously from both sides, then undo from each, then clear
- [x] Refresh one tab mid-drawing → state restored
- [x] Toggle network off/on → reconnect banner, state resyncs
- [x] Export PNG opens with white background and full drawing
- [ ] Install PWA on phone, then APK (requires HTTPS deploy)

---

## 📦 Android APK Build (Post-Deploy)

```bash
# After deploying to HTTPS (e.g., Vercel + Railway/Render)
npm i -g @bubblewrap/cli
bubblewrap init --manifest=https://your-domain/manifest.webmanifest
bubblewrap build
bubblewrap install
```

Requires:
- JDK 17 + Android SDK (Bubblewrap offers to install)
- Digital Asset Links (`/.well-known/assetlinks.json`) with SHA-256 of signing key
- WSS WebSocket URL in production

---

## 📄 License

MIT License — feel free to use for learning or as a starter for your own collaborative apps.