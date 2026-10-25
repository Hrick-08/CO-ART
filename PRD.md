# Product Requirements Document — CO-ART

**Status:** Product/technical specification reconstructed from prior project discussions  
**Last known target:** Next.js 16 PWA + FastAPI backend + LiterallyCanvas  
**Primary concept:** Real-time collaborative and competitive drawing/art application

---

## 1. Product Overview

The product is a multiplayer art application where users can enter rooms, collaborate/draw together on a shared canvas, and eventually compete through structured art challenges.

The core experience is:

1. A user creates or joins a room.
2. Another player joins using a short room code.
3. Players enter a shared real-time canvas.
4. Drawing actions are synchronized between connected clients.
5. Players can draw collaboratively or participate in competitive art challenges.
6. Artwork can be cleared, undone, exported as PNG, and synchronized between clients.
7. The longer-term product direction includes AI judging and community voting to score competitive artwork.
8. Social/community functionality can surround completed artwork and competitions.

The application is intended to work primarily as a **web/PWA application**, with an Android APK generated from the PWA using **Google Bubblewrap**.

---

# 2. Product Goals

## Primary goals

- Make real-time collaborative drawing simple to start.
- Allow users to create/join private rooms without complicated setup.
- Synchronize drawing strokes between multiple users with low latency.
- Provide a foundation for competitive multiplayer art.
- Eventually combine AI judging and human/community voting for artwork evaluation.
- Make the application installable as a PWA.
- Package the PWA as an Android APK.

## Secondary goals

- Provide basic social interaction around artwork.
- Keep the initial implementation technically simple enough to develop and deploy as a student/independent project.
- Use a lightweight backend and database rather than introducing unnecessary infrastructure.

## Non-goals for the initial implementation

The first implementation should not attempt to build a full professional digital-art suite.

Features such as advanced layers, professional brush engines, complex vector editing, sophisticated moderation infrastructure, and advanced AI generation are outside the original MVP scope.

---

# 3. Target Users

## Player

A user who wants to draw with or against another user.

Typical flow:

> Open app → authenticate → create/join room → draw → finish artwork → potentially compete/vote.

## Collaborator

A player primarily interested in creating artwork together with another person on a shared canvas.

## Competitor

A player participating in an art challenge where their artwork is evaluated against another player's artwork.

## Community member

A user who views completed artwork and participates in community voting.

---

# 4. Core Product Concepts

## 4.1 User

Authenticated application account.

Initial authentication system:

- Registration
- Login
- JWT authentication
- Password hashing using bcrypt

The JWT is stored client-side and used to authenticate API/WebSocket requests.

---

## 4.2 Room

A temporary multiplayer drawing space.

Each room has:

- A unique **6-character alphanumeric room code**
- A maximum of **2 players** in the current design
- A shared canvas
- WebSocket connection(s)
- Player presence/list
- Drawing state

Example:

```text
Room Code: A7K29P
Player 1: Alice
Player 2: Bob
```

A user can either:

- Create a room
- Join an existing room using its code

---

# 5. Multiplayer Model

## Current room capacity

**Maximum: 2 players**

This is intentionally constrained to keep synchronization and game logic manageable.

The room model can potentially be expanded later, but the current product specification assumes two-player rooms.

---

# 6. Collaborative Canvas

The central product experience is a shared drawing canvas.

Both connected players should see the same artwork.

When one player draws:

```text
Player A
   |
   | WebSocket
   v
Backend
   |
   | WebSocket
   v
Player B
```

The drawing should appear on the other player's canvas in real time.

---

# 7. Canvas Technology

The selected canvas library for the latest implementation is:

**LiterallyCanvas**

The application should use LiterallyCanvas for the drawing surface and serialize/synchronize drawing actions rather than relying on screenshots as the primary synchronization mechanism.

---

# 8. Drawing Synchronization

The system should synchronize **vector/stroke events** rather than repeatedly sending entire canvas images.

This reduces unnecessary bandwidth and makes real-time synchronization practical.

## Core event types

### `stroke_start`

Sent when a user begins a stroke.

Conceptually:

```json
{
  "type": "stroke_start",
  "stroke": {}
}
```

### `draw`

Sent while the stroke is being drawn.

```json
{
  "type": "draw",
  "points": []
}
```

### `stroke_end`

Sent when the stroke is completed.

```json
{
  "type": "stroke_end"
}
```

### `clear_canvas`

Requests that the shared canvas be cleared.

```json
{
  "type": "clear_canvas"
}
```

### `sync_request`

A newly connected client requests the current drawing state.

```json
{
  "type": "sync_request"
}
```

### `sync_response`

The server/peer provides the current canvas state.

```json
{
  "type": "sync_response",
  "strokes": []
}
```

The exact serialization format can follow LiterallyCanvas's representation as appropriate.

---

# 9. WebSocket API

The planned WebSocket endpoint is:

```text
/ws/{roomCode}?token=<jwt>
```

Example:

```text
/ws/A7K29P?token=<JWT>
```

The JWT authenticates the WebSocket connection.

The backend should:

1. Validate the JWT.
2. Identify the user.
3. Validate the room.
4. Check room capacity.
5. Add the user to the room.
6. Broadcast relevant events.
7. Remove the user when the connection closes.

---

# 10. Presence

The room should expose the current players.

Example:

```text
Players
────────────────
● Alice
● Bob
```

The player list should update when someone:

- joins
- disconnects

Presence was considered an optional/basic feature in the earlier implementation, but the final product direction includes a player list as part of the room UI.

---

# 11. Optional Chat

Basic room chat was considered during the earlier project iteration.

It is not part of the core drawing synchronization requirement.

If implemented, chat messages would be room-scoped and transmitted through the WebSocket connection.

Example:

```json
{
  "type": "chat",
  "message": "Nice!"
}
```

Chat should not be allowed to interfere with drawing synchronization.

---

# 12. Canvas Controls

The current MVP should provide basic controls.

## Clear

Clears the shared canvas.

The action must synchronize to the other connected player.

## Undo

Basic undo functionality is required/desired for the drawing experience.

The exact multiplayer semantics should be handled carefully so that one client's undo does not produce divergent canvas states.

## Export

Users should be able to export the artwork as a PNG.

Example:

```text
[ Clear ] [ Undo ] [ Export PNG ]
```

---

# 13. Authentication

## Registration

Users provide the required registration information and password.

Passwords must never be stored in plaintext.

Use:

```text
bcrypt
```

for password hashing.

## Login

Successful login returns a JWT.

The client stores the JWT locally.

## Client authentication state

The frontend uses the JWT for authenticated API requests and WebSocket connections.

---

# 14. Frontend

## Target framework

**Next.js 16**

Use the:

**App Router**

Architecture should remain compatible with a PWA deployment.

## Styling

**Tailwind CSS**

## Client state

**Zustand**

Use Zustand for client-side application state such as:

- authenticated user
- current room
- room code
- player list
- WebSocket connection state
- canvas/session state
- UI state

## HTTP client

**Axios**

Use Axios for REST/API requests.

## Local persistence

Use `localStorage` for the JWT/client authentication state.

---

# 15. Frontend Routes

The known target route structure is:

```text
/register
/login
/home
/room/[code]
```

## `/register`

Account creation.

Responsibilities:

- Registration form
- Validation
- API request
- Redirect to login/home after success

## `/login`

Authentication.

Responsibilities:

- Login form
- API request
- Store JWT
- Redirect to home

## `/home`

Main authenticated landing page.

Responsibilities:

- Create room
- Join room
- Enter room code
- Basic user/session information

Conceptually:

```text
Welcome

[ Create Room ]

Join a Room
[ A7K29P ] [ Join ]
```

## `/room/[code]`

Main multiplayer drawing experience.

Responsibilities:

- Connect WebSocket
- Display canvas
- Synchronize strokes
- Display players
- Provide drawing controls
- Handle connection state
- Handle room lifecycle

---

# 16. Backend

## Framework

**FastAPI**

FastAPI provides:

- REST API
- Authentication endpoints
- Room management
- WebSocket server
- Multiplayer event handling

---

# 17. Database

## Database

**SQLite**

The application is intentionally designed around SQLite for simplicity.

## ORM

**SQLAlchemy**

SQLAlchemy handles persistence and database models.

Likely core models include:

### User

```text
User
- id
- username/email
- password_hash
- created_at
```

### Room

```text
Room
- id
- code
- created_at
- status
```

Additional fields can be introduced as competitive/game functionality develops.

---

# 18. Backend Structure

The backend should be organized around clear separation of concerns.

Conceptually:

```text
backend/
├── app/
│   ├── main.py
│   ├── database.py
│   ├── models/
│   ├── schemas/
│   ├── routers/
│   ├── auth/
│   ├── websocket/
│   └── services/
└── tests/
```

Exact module naming can vary.

Important separation:

- authentication
- database models
- REST routes
- WebSocket management
- room management
- game/scoring logic

---

# 19. Room Lifecycle

## Create room

1. Authenticated user requests room creation.
2. Backend generates a unique 6-character alphanumeric code.
3. Room is created.
4. User becomes the first participant.
5. User is redirected to:

```text
/room/{code}
```

## Join room

1. User enters room code.
2. Backend validates the room.
3. Backend checks capacity.
4. User joins if fewer than two players are present.
5. User connects to the room WebSocket.

## Full room

If two players are already connected/assigned, additional users should be rejected.

Example:

```text
Room is full.
```

## Disconnect

When a player disconnects:

- Remove them from active presence.
- Notify the remaining player.
- Keep or close the room according to the room lifecycle policy.

---

# 20. WebSocket Architecture

The backend should maintain active connections by room.

Conceptually:

```python
rooms = {
    "A7K29P": {
        user_1: websocket_1,
        user_2: websocket_2
    }
}
```

A dedicated connection manager can handle:

- connect
- disconnect
- broadcast
- room membership
- targeted messages

Example conceptual API:

```text
connect(room_code, websocket)
disconnect(room_code, websocket)
broadcast(room_code, message)
send_personal(...)
```

---

# 21. Synchronization Requirements

The system must avoid clients getting permanently out of sync.

Important requirements:

- New clients receive existing drawing state.
- Drawing events preserve ordering.
- Clear events are propagated.
- Disconnects do not crash the room.
- Invalid WebSocket messages are rejected safely.
- A malformed client message must not terminate the entire room.

The synchronization protocol should prioritize a simple deterministic state model over excessive complexity.

---

# 22. PWA

The web application should be installable as a Progressive Web App.

Requirements include:

- Web App Manifest
- Service Worker
- Application icons
- Appropriate display mode
- HTTPS in production
- Installable mobile experience

The application should behave like an app when installed.

---

# 23. Android Packaging

The selected approach is:

**Google Bubblewrap**

The PWA is packaged into an Android application rather than creating a separate native Android frontend.

Expected workflow:

```bash
bubblewrap init
bubblewrap build
bubblewrap install
```

The Android application should effectively act as a packaged version of the production PWA.

---

# 24. Competitive Art Mode

The longer-term product direction expands the collaborative canvas into a competitive art game.

Instead of simply drawing together, two players can receive a challenge and produce competing artwork.

Example:

```text
Challenge:
"Draw a futuristic city"

Player A                 Player B
─────────                ─────────
[ Canvas ]               [ Canvas ]

       10:00 remaining
```

The competitive mode should ultimately support:

- challenge/prompt
- timer
- player submissions
- judging
- score
- winner/result
- community interaction

---

# 25. Scoring System

The planned scoring model uses a total of **100 points**.

```text
AI judging:        50 points
Community voting:  50 points
────────────────────────────
Total:            100 points
```

## AI score

AI evaluates the artwork for the competitive challenge.

Maximum:

```text
50 points
```

Possible judging dimensions could eventually include things such as:

- adherence to prompt
- creativity
- composition
- execution
- visual quality

The exact judging rubric was not finalized in the retained project information.

## Community score

The community votes between competing artworks.

Maximum:

```text
50 points
```

The community result is converted into the corresponding score.

## Tie

If the community poll ties:

```text
Player A: 25 community points
Player B: 25 community points
```

The AI score remains independently calculated.

Therefore:

```text
Final Score = AI Score + Community Score
```

---

# 26. Community Voting

Completed competitive artwork can be exposed to the community.

A poll can present:

```text
Which artwork is better?

[A] Artwork A

[B] Artwork B
```

Users vote for one.

The aggregate result determines the community component of the score.

The system should prevent a user from repeatedly voting on the same competition.

---

# 27. AI Judging

AI judging is part of the planned competitive product direction, but was explicitly deferred during an earlier implementation iteration.

Therefore, it should be treated as a **later-phase feature**, not a requirement for the basic collaborative drawing MVP.

Potential pipeline:

```text
Player submits artwork
        |
        v
Canvas exported/rendered
        |
        v
AI evaluation
        |
        v
AI score / 50
```

The exact AI provider/model and implementation were not fixed in the retained information.

---

# 28. Competitive Match Flow

A future competitive flow could be:

```text
Matchmaking
    |
    v
Two players matched
    |
    v
Challenge selected
    |
    v
Drawing phase
    |
    v
Timer expires / players submit
    |
    v
Artwork locked
    |
    +----------------+
    |                |
    v                v
AI judging       Community poll
    |                |
    |                |
    +-------+--------+
            |
            v
       Final score
            |
            v
          Winner
```

---

# 29. Matchmaking

The product direction includes **1v1 matchmaking**.

The broader competitive concept also considered **2v2**, but the retained implementation requirements currently define rooms as having a maximum of two players.

Therefore:

### Current implementation

```text
1 room = max 2 players
```

### Future expansion

```text
1v1 competitive matches
2v2 competitive matches
```

2v2 should not be treated as an implemented MVP requirement unless the architecture is intentionally expanded for it.

---

# 30. Social Layer

The product was envisioned as more than a drawing canvas.

Potential social/community layer:

- Completed artwork
- Competitive results
- Community voting
- Player profiles
- Artwork discovery
- Social interaction around drawings

The exact social feature set was not finalized.

The core MVP should therefore focus on the multiplayer drawing experience before building a full social network.

---

# 31. UI/UX Principles

The application should make the primary action obvious.

## Home

```text
┌───────────────────────────┐
│       CO-OP ART           │
│                           │
│     [ Create Room ]       │
│                           │
│  Join Room                │
│  [ ______ ] [ Join ]      │
│                           │
└───────────────────────────┘
```

## Room

```text
┌─────────────────────────────────────┐
│ Room: A7K29P                        │
├─────────────────────────────────────┤
│                                     │
│             CANVAS                  │
│                                     │
│                                     │
│                                     │
├─────────────────────────────────────┤
│ [Undo] [Clear] [Export PNG]         │
├─────────────────────────────────────┤
│ Players: Alice • Bob                │
│                                     │
│ Connection: ● Connected              │
└─────────────────────────────────────┘
```

The drawing area should dominate the screen.

---

# 32. Connection States

The room UI should communicate WebSocket status.

Possible states:

```text
Connecting...
Connected
Disconnected
Reconnecting...
Room full
Authentication failed
Room not found
```

A connection failure should not silently leave the user believing their strokes are being synchronized.

---

# 33. Error Handling

The application should handle:

- Invalid credentials
- Expired JWT
- Invalid room code
- Room not found
- Room full
- WebSocket disconnect
- WebSocket authentication failure
- Invalid drawing event
- Server errors
- Failed PNG export
- Duplicate room codes
- User disconnects

Errors should be surfaced through concise UI messages.

---

# 34. Security Requirements

## Passwords

Never store plaintext passwords.

Use bcrypt.

## JWT

JWTs must be validated server-side.

A WebSocket connection must not be accepted solely because a token exists; the token must be verified.

## Room authorization

Users should only be able to interact with rooms they have legitimately joined.

## Input validation

All REST and WebSocket input must be validated.

## WebSocket safety

Malformed messages must not be able to crash the WebSocket server or other users' sessions.

---

# 35. Data Flow

## Login

```text
Frontend
   |
   | POST /login
   v
FastAPI
   |
   | verify bcrypt hash
   v
JWT
   |
   v
Frontend localStorage
```

## Room creation

```text
Frontend
   |
   | POST /rooms
   v
FastAPI
   |
   v
SQLite
   |
   v
Room code
   |
   v
/room/{code}
```

## Drawing

```text
LiterallyCanvas
      |
      | stroke event
      v
Zustand / WebSocket client
      |
      | WebSocket
      v
FastAPI WebSocket
      |
      | broadcast
      v
Other player
      |
      v
LiterallyCanvas
```

---

# 36. Proposed API Surface

The known API requirements imply an API along these lines.

## Authentication

```text
POST /auth/register
POST /auth/login
```

## Room management

```text
POST /rooms
POST /rooms/{code}/join
GET  /rooms/{code}
```

## Multiplayer

```text
WS /ws/{roomCode}?token=<jwt>
```

Exact REST endpoint names can be adjusted during implementation.

---

# 37. Suggested WebSocket Message Contract

All WebSocket messages should contain a message type.

Example:

```json
{
  "type": "stroke_start",
  "data": {}
}
```

Possible message types:

```text
stroke_start
draw
stroke_end
clear_canvas
sync_request
sync_response
player_joined
player_left
chat
```

The protocol should be versionable if it becomes sufficiently complex.

---

# 38. Client State Model

A conceptual Zustand store:

```text
auth
├── user
├── token
└── authenticated

room
├── code
├── players
├── status
└── connectionStatus

canvas
├── strokes
├── isDrawing
└── history

ui
├── loading
├── error
└── notifications
```

---

# 39. MVP Scope

The first usable release should contain:

### Authentication

- [x] Registration
- [x] Login
- [x] JWT
- [x] bcrypt password hashing

### Rooms

- [x] Create room
- [x] 6-character room code
- [x] Join room
- [x] Maximum 2 players
- [x] Room route

### Canvas

- [x] LiterallyCanvas
- [x] Real-time stroke synchronization
- [x] Clear
- [x] Undo
- [x] PNG export
- [x] Initial canvas synchronization

### Multiplayer

- [x] FastAPI WebSocket
- [x] JWT-authenticated WebSocket
- [x] Player presence/list
- [x] Disconnect handling

### Frontend

- [x] Next.js 16 App Router
- [x] Tailwind
- [x] Zustand
- [x] Axios
- [x] localStorage JWT

### Deployment target

- [x] PWA
- [x] Bubblewrap Android packaging

---

# 40. Post-MVP Scope

The next product layer should introduce competitive mechanics:

- Matchmaking
- Drawing challenges
- Timers
- Submission locking
- Competitive results
- AI judging
- Community voting
- 100-point scoring
- Player rankings
- Match history

---

# 41. Future Social Features

Potential future features:

- Profiles
- Artwork galleries
- Follow/friend system
- Likes/reactions
- Comments
- Public competitions
- Leaderboards
- Match history
- Player statistics
- Featured artwork

These were part of the broader product direction rather than finalized MVP requirements.

---

# 42. Earlier Technical Iteration

An earlier version of the project used:

```text
React Native / Expo
FastAPI
SQLite
SQLAlchemy
JWT
bcrypt
FastAPI WebSockets
```

That version also used:

- 6-character alphanumeric room codes
- maximum 2 players
- vector stroke synchronization
- clear/sync functionality
- optional presence/chat

AI judging and scoring were explicitly deferred at that stage.

The project subsequently shifted toward the current web-first architecture:

```text
Next.js 16
Tailwind
LiterallyCanvas
FastAPI
SQLite
SQLAlchemy
JWT
bcrypt
Zustand
Axios
PWA
Bubblewrap
```

The earlier React Native/Expo architecture should therefore be considered **historical**, not the current target.

---

# 43. Current Technology Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 |
| Frontend architecture | App Router |
| Styling | Tailwind CSS |
| Canvas | LiterallyCanvas |
| State | Zustand |
| HTTP | Axios |
| Authentication | JWT |
| Password hashing | bcrypt |
| Backend | FastAPI |
| Database | SQLite |
| ORM | SQLAlchemy |
| Real-time | FastAPI WebSockets |
| Client persistence | localStorage |
| Web app | PWA |
| Android packaging | Google Bubblewrap |

---

# 44. Architecture Overview

```text
                         ┌──────────────────────┐
                         │      Next.js PWA     │
                         │                      │
                         │  Auth / Home / Room  │
                         │                      │
                         │     Zustand          │
                         │     Axios             │
                         │     LiterallyCanvas   │
                         └──────────┬───────────┘
                                    │
                         HTTPS / WebSocket
                                    │
                                    v
                         ┌──────────────────────┐
                         │       FastAPI        │
                         │                      │
                         │ REST API             │
                         │ JWT Auth              │
                         │ Room Management       │
                         │ WebSocket Manager     │
                         └──────────┬───────────┘
                                    │
                                    v
                         ┌──────────────────────┐
                         │       SQLite         │
                         │                      │
                         │ Users                │
                         │ Rooms                │
                         │ Future matches       │
                         │ Future submissions   │
                         └──────────────────────┘
```

---

# 45. Competitive Architecture — Future

```text
                 ┌───────────────┐
                 │  Matchmaking  │
                 └───────┬───────┘
                         │
                         v
                ┌─────────────────┐
                │  2 Players      │
                │  Matched        │
                └────────┬────────┘
                         │
                         v
                ┌─────────────────┐
                │ Art Challenge   │
                └────────┬────────┘
                         │
                         v
                ┌─────────────────┐
                │ Drawing Phase   │
                └────────┬────────┘
                         │
                         v
                ┌─────────────────┐
                │ Submission      │
                └───────┬─────────┘
                        / \
                       /   \
                      v     v
                ┌──────┐ ┌──────────────┐
                │ AI   │ │ Community    │
                │ /50  │ │ Voting /50   │
                └───┬──┘ └──────┬───────┘
                    │             │
                    └──────┬──────┘
                           v
                    ┌─────────────┐
                    │ Final Score │
                    │    /100     │
                    └──────┬──────┘
                           v
                       Winner
```

---

# 46. Success Criteria

## Technical MVP

The MVP is successful when:

1. A user can register.
2. A user can log in.
3. A user can create a room.
4. Another user can join using the six-character code.
5. Both users can connect through WebSockets.
6. Both users see the same drawing in real time.
7. Clearing the canvas synchronizes.
8. Basic undo works.
9. Artwork can be exported as PNG.
10. Player presence is visible.
11. Disconnects are handled gracefully.
12. The application can be installed as a PWA.
13. The PWA can be packaged as an Android APK through Bubblewrap.

## Product-level future success

The competitive version is successful when:

1. Players can be matched.
2. A challenge can be issued.
3. Players can draw within a defined time.
4. Submissions can be locked.
5. AI can evaluate artwork.
6. The community can vote.
7. Scores combine into a 100-point result.
8. Ties in community voting award 25 points to each player.
9. A winner can be determined and displayed.

---

# 47. Testing Checklist

## Authentication

- Register valid user
- Reject duplicate user
- Reject invalid credentials
- Verify password hashing
- Verify JWT generation
- Verify expired/invalid JWT rejection

## Rooms

- Create room
- Verify six-character code
- Join room
- Reject nonexistent room
- Reject third player
- Handle duplicate room code generation
- Handle disconnect

## WebSocket

- Authenticate connection
- Connect two users
- Broadcast drawing events
- Synchronize new client
- Clear canvas
- Handle malformed events
- Handle unexpected disconnect
- Remove player from presence list

## Canvas

- Draw
- Multiple strokes
- Undo
- Clear
- Export PNG
- Synchronize drawing accurately

## PWA

- Manifest valid
- Service worker valid
- App installable
- Icons present
- Production HTTPS
- PWA loads correctly

## Android

- Bubblewrap initialization
- Build APK
- Install APK
- Launch packaged PWA
- Verify authentication
- Verify WebSocket connection
- Verify canvas interaction

---

# 48. Product Risks

## Real-time synchronization

The largest early technical risk is maintaining consistent canvas state across clients.

The design should therefore favor event-based stroke synchronization and an explicit synchronization mechanism.

## Undo semantics

Undo becomes more complicated in a collaborative environment because each client can generate strokes.

The implementation should define whether undo means:

- undo the local user's most recent action, or
- undo the globally most recent action.

This should be resolved before treating collaborative undo as production-ready.

## WebSocket reliability

Mobile networks can disconnect frequently.

The room experience therefore needs connection-state handling and potentially reconnection logic.

## AI judging

AI judging introduces:

- model/API cost
- evaluation consistency
- prompt/rubric design
- latency
- potential gaming/manipulation

It should remain separate from the core drawing infrastructure.

## Community voting manipulation

Competitive voting eventually needs:

- one vote per eligible user
- abuse prevention
- duplicate-vote prevention
- potentially rate limiting

This is a future concern rather than an MVP blocker.

---

# 49. Open Product Decisions

These items were not fully finalized in the retained project information.

### Competitive mode

- Exact matchmaking algorithm
- Random vs skill-based matchmaking
- Match duration
- Challenge generation
- Rematch functionality

### AI judging

- AI provider/model
- Exact judging rubric
- Whether AI sees the prompt + final image only
- Whether AI scores each category separately
- Whether AI scores are normalized

### Community voting

- Who can vote
- Whether spectators can vote
- Vote duration
- Whether players can vote
- Anti-abuse system
- Whether vote counts are public during the poll

### Social layer

- Profiles
- Friends/following
- Likes
- Comments
- Public galleries
- Leaderboards

### Persistence

The initial collaborative room can remain lightweight, but the competitive product will eventually need persistent records for:

- matches
- submissions
- scores
- votes
- challenges
- player statistics

---

# 50. Recommended Development Phases Based on Prior Decisions

## Phase 1 — Foundation

```text
Next.js
FastAPI
SQLite
SQLAlchemy
JWT
bcrypt
```

Implement:

- registration
- login
- authentication
- basic home page

## Phase 2 — Rooms

Implement:

- room creation
- six-character codes
- joining
- room capacity
- `/room/[code]`

## Phase 3 — Real-time Canvas

Implement:

- LiterallyCanvas
- WebSocket connection
- stroke_start
- draw
- stroke_end
- synchronization
- clear
- presence

## Phase 4 — Canvas UX

Implement:

- undo
- PNG export
- connection states
- responsive UI
- PWA configuration

## Phase 5 — Android

Use:

```text
Google Bubblewrap
```

to package the PWA.

## Phase 6 — Competitive Art

Implement:

- matchmaking
- challenges
- timers
- submissions
- result screens

## Phase 7 — Judging

Implement:

- AI evaluation
- community voting
- 50/50 scoring
- tie handling

## Phase 8 — Social/Game Progression

Implement:

- profiles
- match history
- leaderboards
- artwork discovery
- social features

---

# 51. One-Sentence Product Definition

> A real-time multiplayer art platform where two people can share a canvas to create artwork together, with the product eventually evolving into a competitive drawing game powered by AI judging and community voting.

---

# 52. Current Source-of-Truth Summary

If this PRD conflicts with an earlier version of the project, the **latest known decisions** should take precedence:

```text
NEXT.JS 16 PWA
        +
LITERALLYCANVAS
        +
FASTAPI
        +
SQLITE / SQLALCHEMY
        +
JWT / BCRYPT
        +
WEBSOCKETS
        +
ZUSTAND / AXIOS
        +
BUBBLEWRAP
```

Core room model:

```text
6-character alphanumeric code
2-player maximum
real-time shared canvas
JWT-authenticated WebSocket
vector/stroke synchronization
```

Future competitive model:

```text
AI = 50 points
Community = 50 points
Total = 100 points

Community tie:
25 points each
```

The **collaborative drawing MVP is the foundation**; AI judging, community voting, matchmaking, and the broader social/competitive layer come afterward.