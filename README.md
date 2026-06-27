<div align="center">

# 📍 LocationCircle

### *Stay close to those who matter.*

A **closed-group, real-time location-sharing Progressive Web App** for families and trusted circles — with invite-and-approve group joining, a Group-Head role model, full WCAG 2.1 AA accessibility (including text-to-speech), and an optional WhatsApp bot.

![Version](https://img.shields.io/badge/version-1.0.0-teal)
![Status](https://img.shields.io/badge/status-Live-success)
![License](https://img.shields.io/badge/license-MIT-blue)
![WCAG](https://img.shields.io/badge/accessibility-WCAG%202.1%20AA-green)
![Stack](https://img.shields.io/badge/stack-React%20%7C%20Node.js%20%7C%20PostgreSQL%20%7C%20Redis-navy)

**🔗 Live App:** https://locationcircle-rho.vercel.app  ·  **API:** https://locationcircle.onrender.com

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Live Deployment](#-live-deployment)
- [Key Features](#-key-features)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Database Schema](#-database-schema)
- [Project Structure](#-project-structure)
- [Getting Started (Local)](#-getting-started-local)
- [Environment Variables](#-environment-variables)
- [Deployment](#-deployment)
- [API Reference](#-api-reference)
- [WhatsApp Bot](#-whatsapp-bot)
- [Accessibility](#-accessibility)
- [User Roles & Permissions](#-user-roles--permissions)
- [License](#-license)

---

## 🌐 Overview

**LocationCircle** is an invite-only, privacy-first location-sharing web app for families, close friends, and small teams. Unlike public social apps, your real-time location is **only visible to members of a closed group you explicitly join** — never strangers, never public.

It's a **Progressive Web App (PWA)** that runs in any modern browser and installs to the home screen, with an optional **WhatsApp bot** for members who'd rather not open the app.

| Problem | LocationCircle's answer |
|---|---|
| Public location apps expose you to strangers | Invite-only closed groups with **Head approval** |
| Family on basic phones can't use apps | WhatsApp bot — no install needed |
| Most apps aren't accessible | WCAG 2.1 AA + built-in Text-to-Speech |
| No admin control in group location apps | **Group Head** role + Temporary Head delegation |
| Map SDKs need paid API keys | **Leaflet + OpenStreetMap** — free, no key |

---

## 🚀 Live Deployment

| Layer | Platform | URL |
|---|---|---|
| Web app (client) | **Vercel** | https://locationcircle-rho.vercel.app |
| API + WebSocket (server) | **Render** | https://locationcircle.onrender.com |
| PostgreSQL | **Neon** (Singapore) | — |
| Redis | **Upstash** (Singapore) | — |
| Auth + Storage | **Firebase** | — |

> The API runs on Render's free tier, which sleeps after ~15 min of inactivity — the first request after idle may take 30–60 s to wake.

---

## ✨ Key Features

### 🔐 Authentication & Onboarding
- **Google sign-in only** (Firebase Auth) — no passwords
- First-login wizard: profile **photo upload**, display name, phone number
- Initials-avatar fallback when no photo is set

### 👥 Group Management & Invites
- Create a group instantly — creator becomes **Group Head**
- **Shareable invite links** → recipients send a **join request** → Head **approves / denies**
- **Permanent Head transfer** to any member
- **Temporary Head** delegation with expiry + automatic reversion (cron-driven)
- Members can leave; Head can remove members
- Multi-group membership with a group switcher

### 📍 Real-Time Location
- Continuous GPS / network geolocation (foreground)
- Live, proximity-sorted member list (updates within seconds)
- Pause / resume your own sharing → shows *"Location paused"*
- Powered by **Socket.io** + **Redis** (5-minute TTL on positions)

### 🗺️ Dashboard & Map
- **Dashboard:** member list with locality, distance, car & transit ETA, and one-tap calling
- **Map (Leaflet + OpenStreetMap):** circular profile-photo markers, gold ring for the Head, a pulsing **"You"** marker, **satellite/street toggle**, tap-a-member to focus
- Group Head pinned at top with a gold highlight

### 📞 Direct Calling
- One-tap `tel:` intent → native dialer; accessible labels (*"Call Sara Mitchell"*)

### 🤖 WhatsApp Bot (optional)
- Natural-language: *"Where is Sara?"* → locality + distance + Google Maps link
- Commands: `LIST`, `HEAD`, `PAUSE`, `RESUME`
- Locations fetched live — never stored in chat history

### ♿ Accessibility (WCAG 2.1 AA)
- Built-in **Text-to-Speech** (Web Speech API) reads the member list aloud
- Adjustable font size, 3px focus ring, full keyboard navigation + skip link
- `aria-live` regions for location updates (incl. a hidden map position summary)
- Color-blind-safe: the Head row uses position + icon + border + colour

### ⚙️ Account & Privacy
- Edit name, phone, photo; link WhatsApp number; notification preferences
- **Delete account & all data** (GDPR erasure) with "type DELETE" confirmation

---

## 🛠️ Tech Stack

### Frontend
| Tech | Purpose |
|---|---|
| React 18 + TypeScript | UI framework |
| Vite | Build tool & dev server |
| Tailwind CSS | Styling |
| React Router v6 | Routing |
| Zustand | State management |
| Socket.io-client | Real-time location events |
| **Leaflet + OpenStreetMap / CARTO** | Interactive map (no API key) |
| Web Speech API | Built-in TTS (Read Aloud) |
| vite-plugin-pwa | PWA / offline shell |

### Backend
| Tech | Purpose |
|---|---|
| Node.js + Express | REST API |
| Socket.io | Real-time WebSocket server |
| Firebase Admin SDK | Google ID-token verification |
| JWT | Session tokens |
| node-cron | Temp-Head expiry, token & GDPR cleanup |
| Zod | Request validation |

### Data & Hosting
| Tech | Purpose |
|---|---|
| PostgreSQL (**Neon**) | Primary database |
| Redis (**Upstash**) | Real-time position cache |
| Firebase (Auth + Storage) | Google sign-in + avatar uploads |
| **Render** (API) · **Vercel** (client) | Hosting |
| Docker Compose | Local Postgres + Redis |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  CLIENT (Browser / PWA) — Vercel             │
│     React + TS + Vite + Tailwind · Zustand · React Router    │
│     Socket.io-client · Leaflet/OSM map · Web Speech API      │
└───────────────┬─────────────────────────┬───────────────────┘
                │ HTTPS REST              │ WebSocket
                ▼                         ▼
┌─────────────────────────────────────────────────────────────┐
│                 API SERVER (Node.js) — Render                │
│             Express + Socket.io + JWT + Zod                  │
│   /auth  /users  /groups  /locations  /webhook(WhatsApp)     │
│              node-cron (temp-head / cleanup)                 │
└────────┬────────────────┬───────────────┬───────────────────┘
         │                │               │
         ▼                ▼               ▼
┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐
│  PostgreSQL  │  │    Redis     │  │   External Services    │
│   (Neon)     │  │  (Upstash)   │  │  Firebase Auth/Storage │
│ users·groups │  │ live         │  │  Google Maps (optional)│
│ members·loc  │  │ positions    │  │  WhatsApp Cloud API    │
│ join_requests│  │ (5-min TTL)  │  │  (optional)            │
└──────────────┘  └──────────────┘  └────────────────────────┘
```

---

## 🗄️ Database Schema

Tables (see [server/src/db/schema.sql](server/src/db/schema.sql) for full DDL):

- **users** — profile, phone, whatsapp, font size, sharing flag, notification prefs
- **groups** — name, head_id, invite token + expiry
- **group_members** — membership + role (`head` / `temp_head` / `member`)
- **join_requests** — pending invite requests awaiting Head approval
- **temp_head** — temporary-head grants with expiry
- **locations** — persisted positions (Redis holds the live copy)
- **notifications** — notification records

---

## 📁 Project Structure

```
LocationCircle/
├── client/                 # React + Vite PWA  → deployed on Vercel
│   ├── src/
│   │   ├── components/      # MemberCard, MapPin, TTSButton, RoleTag
│   │   ├── hooks/           # useLocation, useSocket, useTTS
│   │   ├── pages/           # Login, Onboarding, Dashboard, MapView, Settings, GroupManage
│   │   ├── store/           # Zustand stores (auth, group, location)
│   │   └── lib/             # api (axios), firebase
│   └── vercel.json          # SPA fallback for deep links / invite links
├── server/                  # Node + Express API → deployed on Render
│   ├── src/
│   │   ├── routes/          # auth, users, groups, locations, webhook
│   │   ├── middleware/      # authMiddleware, roleGuard, validate (zod)
│   │   ├── services/        # socket, redis, maps, whatsapp, cron, firebase
│   │   └── db/              # pool + schema.sql + migrate
│   └── Dockerfile
├── docker-compose.yml       # local Postgres + Redis
├── requirements.txt
└── README.md
```

---

## 🚀 Getting Started (Local)

### Prerequisites
- Node.js **v20+** and npm
- Docker Desktop (for local Postgres + Redis) **or** Neon + Upstash accounts
- A Firebase project (Google sign-in enabled + Cloud Storage)

### 1. Install
```bash
git clone https://github.com/Dany-John-C/LocationCircle.git
cd LocationCircle
cd client && npm install
cd ../server && npm install
```

### 2. Configure env
Create a `.env` (root or `server/`) and a `client/.env` using the values in
[Environment Variables](#-environment-variables) below.

### 3. Start data services (local Docker)
```bash
docker compose up -d          # Postgres on :5433, Redis on :6379
npm --prefix server run migrate   # apply schema
```
> Or point `DATABASE_URL` / `REDIS_URL` at Neon / Upstash instead.

### 4. Run
```bash
# Terminal 1 — API
cd server && npm run dev      # http://localhost:3001

# Terminal 2 — Web app
cd client && npm run dev      # http://localhost:5173
```

---

## 🔑 Environment Variables

Use the templates below to create your `.env` files.

**Server**
```env
NODE_ENV=development
JWT_SECRET=...                # node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_EXPIRES_IN=30d
DATABASE_URL=postgresql://...           # local Docker or Neon (SSL auto-enabled for cloud)
REDIS_URL=redis://localhost:6379        # local Docker or Upstash rediss://
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
# FIREBASE_SERVICE_ACCOUNT=../service-account.json   # local-only alternative to the 3 vars above
CLIENT_URL=http://localhost:5173
# Optional: GOOGLE_MAPS_API_KEY, WHATSAPP_PHONE_NUMBER_ID/ACCESS_TOKEN/VERIFY_TOKEN
```

**Client** (Vite, prefixed `VITE_`)
```env
VITE_API_URL=http://localhost:3001
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

> 🔒 Never commit real `.env` files — they're git-ignored. The Firebase **web** config is safe to expose; the Firebase **service-account private key** and `JWT_SECRET` are secrets.

---

## ☁️ Deployment

The live app uses an all-free-tier stack:

1. **PostgreSQL → Neon** — create a project, run `schema.sql` in the SQL editor, copy the connection string.
2. **Redis → Upstash** — create a Redis DB, copy the `rediss://` URL.
3. **Server → Render** — New Web Service from this repo, **Root Directory `server`** (or its Dockerfile), set all server env vars (`NODE_ENV=production`, `DATABASE_URL`, `REDIS_URL`, JWT + Firebase, `CLIENT_URL`). SSL to the cloud DB is auto-enabled.
4. **Client → Vercel** — import the repo, **Root Directory `client`**, set `VITE_*` env vars (with `VITE_API_URL` = the Render URL). `vercel.json` provides SPA fallback so invite links work.
5. **Wire up** — set `CLIENT_URL` on Render to the Vercel URL (CORS + sockets), and add the Vercel domain to **Firebase → Authentication → Authorized domains**.

Pushing to `main` auto-deploys both Render and Vercel.

---

## 📡 API Reference

### Auth & Users
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/google` | Verify Firebase ID token → app JWT |
| `GET` | `/api/users/me` | Current user |
| `PUT` | `/api/users/me` | Update profile / prefs |
| `GET` | `/api/users/me/groups` | My groups |
| `GET` | `/api/users/me/requests` | My pending join requests |
| `DELETE` | `/api/users/me` | Delete account + all data (GDPR) |

### Groups
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/groups` | Create group (caller = Head) |
| `GET` | `/api/groups/:id` | Group details + members |
| `POST` | `/api/groups/:id/invite` | Generate reusable invite link (Head) |
| `POST` | `/api/groups/join/:token` | Request to join via invite |
| `GET` | `/api/groups/:id/requests` | Pending join requests (Head) |
| `POST` | `/api/groups/:id/requests/:uid/approve` | Approve request (Head) |
| `POST` | `/api/groups/:id/requests/:uid/deny` | Deny request (Head) |
| `PUT` | `/api/groups/:id/head` | Transfer permanent Head |
| `POST` / `DELETE` | `/api/groups/:id/temp-head` | Assign / revoke Temp Head |
| `DELETE` | `/api/groups/:id/members/:uid` | Remove member (Head) |
| `POST` | `/api/groups/:id/leave` | Leave group |

### Locations
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/locations/:groupId` | All member positions |
| `POST` | `/api/locations/:groupId/eta` | Distance + car/transit ETA |
| `PUT` | `/api/locations/me` | Update own position |
| `PUT` | `/api/locations/me/pause` | Pause / resume sharing |

### WhatsApp
| Method | Endpoint | Description |
|---|---|---|
| `GET` / `POST` | `/api/webhook/whatsapp` | Meta webhook verify / messages |

### Socket.io events
`room:join` · `location:update` → `location:broadcast` · `head:changed` · `member:sharing-changed`

---

## 🤖 WhatsApp Bot

Link your WhatsApp number in **Settings**, then message the bot:

| Input | Reply |
|---|---|
| `LIST` | All members + localities |
| `HEAD` | Current Group Head's location |
| `PAUSE` / `RESUME` | Toggle your own sharing |
| *"Where is [Name]?"* | That member's locality, distance, ETA + Google Maps link |

> Requires a Meta WhatsApp Business app + a public webhook URL (the Render URL). Optional — the app is fully functional without it.

---

## ♿ Accessibility

Built **accessibility-first**, targeting **WCAG 2.1 AA**: full ARIA roles/labels, keyboard navigation + skip link, Read-Aloud TTS on the member list, adjustable font size, 3px focus ring, `aria-live` updates, and a color-independent Head indicator (position + icon + border + colour).

```bash
# Optional automated audit
npx axe-cli https://locationcircle-rho.vercel.app
```

---

## 👥 User Roles & Permissions

| Permission | Member | Temp Head | Group Head |
|---|:---:|:---:|:---:|
| View members & map | ✅ | ✅ | ✅ |
| Share / pause own location | ✅ | ✅ | ✅ |
| Call members · WhatsApp bot | ✅ | ✅ | ✅ |
| Shown as Head (gold) | ❌ | ✅ (temp) | ✅ |
| Invite / approve members | ❌ | ❌ | ✅ |
| Remove members | ❌ | ❌ | ✅ |
| Assign / revoke Temp Head | ❌ | ❌ | ✅ |
| Transfer permanent Head | ❌ | ❌ | ✅ |

---

## 📄 License

MIT — see [LICENSE](LICENSE).

<div align="center">

Built as part of an internship project · LocationCircle © 2026

</div>
