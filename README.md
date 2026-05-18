<div align="center">

# 📍 LocationCircle

### *Stay close to those who matter.*

A **closed-group, real-time location sharing Progressive Web App** for families and trusted circles — with a built-in WhatsApp bot and full WCAG 2.1 AA accessibility.

![Version](https://img.shields.io/badge/version-1.0.0--MVP-teal)
![Status](https://img.shields.io/badge/status-In%20Development-orange)
![License](https://img.shields.io/badge/license-MIT-blue)
![WCAG](https://img.shields.io/badge/accessibility-WCAG%202.1%20AA-green)
![Stack](https://img.shields.io/badge/stack-React%20%7C%20Node.js%20%7C%20PostgreSQL-navy)

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Database Schema](#-database-schema)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [API Reference](#-api-reference)
- [Accessibility](#-accessibility)
- [WhatsApp Bot Commands](#-whatsapp-bot-commands)
- [User Roles & Permissions](#-user-roles--permissions)
- [Sprint Roadmap](#-sprint-roadmap)
- [Team](#-team)
- [License](#-license)

---

## 🌐 Overview

**LocationCircle** is an invite-only, privacy-first location sharing web application designed for families, close-knit friend groups, and small teams. Unlike public social platforms, LocationCircle ensures your real-time location is **only visible to members of your closed group** — never strangers, never publicly.

The app is built as a **Progressive Web App (PWA)** accessible on any modern browser, with a companion **WhatsApp chatbot** for members who prefer not to install additional apps.

### Why LocationCircle?

| Problem | Solution |
|---|---|
| Public location apps expose you to strangers | Invite-only closed groups |
| Family members on basic phones can't use apps | WhatsApp bot — no install needed |
| Existing apps aren't accessible | WCAG 2.1 AA + built-in TTS |
| No admin control in group location apps | Group Head role with delegation |

---

## ✨ Key Features

### 🔐 Authentication & Onboarding
- **Google OAuth 2.0** single sign-on — no passwords
- 3-step onboarding wizard: display name → profile photo → WhatsApp link (optional)
- Automatic initials avatar fallback if photo is skipped

### 👥 Group Management
- Create a group instantly — creator becomes **Group Head** automatically
- Invite members via shareable links (7-day / single-use expiry)
- **Temporary Head** delegation with date/time expiry and auto-reversion
- Permanent Head transfer to any group member
- Member removal with confirmation

### 📍 Real-Time Location
- Continuous GPS / network-based geolocation (foreground)
- Live proximity-sorted member list — updated every 5 seconds
- Pause / Resume your own location sharing
- Graceful fallback to last-known position when offline
- Powered by **Socket.io** + **Redis** pub/sub

### 🗺️ Dashboard & Map
- **Dashboard:** Scrollable member list with locality, distance (km), car ETA, transit ETA, and one-tap calling
- **Map View:** Full-screen Google Maps with custom pins — gold crown for Group Head, teal "ME" pulse for you
- Group Head row always pinned at top with gold highlight

### 📞 Direct Calling
- One-tap `tel:` intent — opens native phone dialer immediately
- Accessible labels: *"Call Sara Mitchell"* (never just "Call")

### 🤖 WhatsApp Bot
- Query member locations via natural language: *"Where is Sara right now?"*
- Structured commands: `LIST`, `HEAD`, `PAUSE`, `RESUME`
- Live data fetch — locations **never stored** in chat history
- Verified WhatsApp Business API bot (green badge)

### ♿ Accessibility (WCAG 2.1 AA)
- Built-in **Text-to-Speech** (Web Speech API) — reads the full member list aloud
- `A+` / `A-` font scaling controls
- 3px orange focus ring on all interactive elements
- Full keyboard navigation with Skip Link
- `aria-live` regions for real-time location updates
- Color-blind safe design — Group Head uses 4 independent visual cues

---

## 🛠️ Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| React 18 + TypeScript | UI framework |
| Vite | Build tool & dev server |
| Tailwind CSS | Utility-first styling |
| React Router v6 | Client-side routing |
| Zustand | Lightweight state management |
| Socket.io-client | Real-time location events |
| Google Maps JS SDK | Interactive map & custom pins |
| Web Speech API | Built-in TTS (Read Aloud) |

### Backend
| Technology | Purpose |
|---|---|
| Node.js + Express | REST API server |
| Socket.io | Real-time WebSocket server |
| Firebase Auth | Google OAuth 2.0 token verification |
| JWT | Session management |
| node-cron | Temporary Head auto-expiry scheduler |

### Data Layer
| Technology | Purpose |
|---|---|
| PostgreSQL (Supabase) | Primary relational database |
| Redis (Upstash) | Real-time location cache + pub/sub |
| Google Distance Matrix API | ETA calculation (car + transit) |
| Google Geocoding API | Reverse geocoding (locality names) |

### Integrations
| Technology | Purpose |
|---|---|
| WhatsApp Business API | Bot notifications & commands |
| Firebase Auth | Google sign-in provider |

### Deployment
| Layer | Platform |
|---|---|
| Frontend | Vercel |
| Backend | Render |
| Database | Supabase (PostgreSQL) |
| Redis | Upstash |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT (Browser / PWA)                   │
│         React + TypeScript + Vite + Tailwind CSS            │
│    Zustand State │ React Router │ Socket.io-client          │
│    Google Maps JS SDK │ Web Speech API (TTS)                │
└───────────────┬─────────────────────────┬───────────────────┘
                │ HTTPS REST              │ WebSocket
                ▼                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   API SERVER (Node.js)                      │
│              Express + Socket.io + JWT Auth                 │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────┐  │
│   │  /auth   │ │ /groups  │ │/locations│ │  /webhook   │  │
│   │ Firebase │ │  CRUD    │ │ GPS data │ │  WhatsApp   │  │
│   └──────────┘ └──────────┘ └──────────┘ └─────────────┘  │
│              node-cron (Temp Head expiry scheduler)         │
└────────┬────────────────┬───────────────┬───────────────────┘
         │                │               │
         ▼                ▼               ▼
┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐
│  PostgreSQL  │  │    Redis     │  │   External Services    │
│  (Supabase)  │  │  (Upstash)   │  │ ┌──────────────────┐  │
│              │  │              │  │ │ Google Maps SDK  │  │
│  users       │  │ location     │  │ │ Distance Matrix  │  │
│  groups      │  │ cache        │  │ │ Geocoding API    │  │
│  members     │  │ pub/sub      │  │ └──────────────────┘  │
│  temp_head   │  │ sessions     │  │ ┌──────────────────┐  │
│  locations   │  │              │  │ │  WhatsApp Biz    │  │
│  notifs      │  └──────────────┘  │ │  API (Meta)      │  │
└──────────────┘                    │ └──────────────────┘  │
                                    └────────────────────────┘
```

---

## 🗄️ Database Schema

```sql
-- Users
CREATE TABLE users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) NOT NULL,
    email       VARCHAR(255) UNIQUE NOT NULL,
    phone       VARCHAR(20),
    avatar_url  TEXT,
    whatsapp    VARCHAR(20),
    created_at  TIMESTAMP DEFAULT NOW()
);

-- Groups
CREATE TABLE groups (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(100) NOT NULL,
    head_id       UUID REFERENCES users(id),
    invite_token  VARCHAR(64) UNIQUE,
    token_expiry  TIMESTAMP,
    created_at    TIMESTAMP DEFAULT NOW()
);

-- Group Members
CREATE TABLE group_members (
    user_id   UUID REFERENCES users(id) ON DELETE CASCADE,
    group_id  UUID REFERENCES groups(id) ON DELETE CASCADE,
    role      VARCHAR(20) CHECK (role IN ('head','temp_head','member')) DEFAULT 'member',
    joined_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, group_id)
);

-- Real-Time Locations
CREATE TABLE locations (
    user_id        UUID REFERENCES users(id) ON DELETE CASCADE PRIMARY KEY,
    lat            DECIMAL(10, 8) NOT NULL,
    lng            DECIMAL(11, 8) NOT NULL,
    locality       VARCHAR(100),
    sharing_paused BOOLEAN DEFAULT FALSE,
    updated_at     TIMESTAMP DEFAULT NOW()
);

-- Temporary Head Assignments
CREATE TABLE temp_head (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id    UUID REFERENCES groups(id) ON DELETE CASCADE,
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    granted_by  UUID REFERENCES users(id),
    expiry      TIMESTAMP NOT NULL,
    active      BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMP DEFAULT NOW()
);

-- Notifications
CREATE TABLE notifications (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type           VARCHAR(50) NOT NULL,
    target_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    message        TEXT NOT NULL,
    channel        VARCHAR(20) CHECK (channel IN ('push','whatsapp','email')),
    sent_at        TIMESTAMP DEFAULT NOW()
);
```

---

## 📁 Project Structure

```
locationcircle/
├── client/                      # React + Vite frontend
│   ├── public/
│   │   └── manifest.json        # PWA manifest
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   │   ├── MemberCard.tsx   # Member list row
│   │   │   ├── MapPin.tsx       # Custom Google Maps marker
│   │   │   ├── TTSButton.tsx    # Read Aloud control
│   │   │   └── RoleTag.tsx      # Head / Temp Head badge
│   │   ├── hooks/
│   │   │   ├── useLocation.ts   # Geolocation API wrapper
│   │   │   ├── useSocket.ts     # Socket.io connection
│   │   │   └── useTTS.ts        # Web Speech API hook
│   │   ├── pages/
│   │   │   ├── Login.tsx        # Google OAuth screen
│   │   │   ├── Onboarding.tsx   # 3-step profile wizard
│   │   │   ├── Dashboard.tsx    # Member list (main screen)
│   │   │   ├── MapView.tsx      # Full-screen map
│   │   │   ├── Settings.tsx     # Profile + admin controls
│   │   │   └── GroupManage.tsx  # Head-only admin panel
│   │   ├── store/
│   │   │   ├── authStore.ts     # Zustand: user session
│   │   │   ├── groupStore.ts    # Zustand: group data
│   │   │   └── locationStore.ts # Zustand: member positions
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   ├── tailwind.config.ts
│   └── vite.config.ts
│
├── server/                      # Node.js + Express backend
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.ts          # POST /auth/google
│   │   │   ├── users.ts         # GET|PUT /users/me
│   │   │   ├── groups.ts        # CRUD /groups
│   │   │   ├── locations.ts     # GET|PUT /locations
│   │   │   └── webhook.ts       # POST /webhook/whatsapp
│   │   ├── middleware/
│   │   │   ├── authMiddleware.ts
│   │   │   └── roleGuard.ts
│   │   ├── services/
│   │   │   ├── socketService.ts # Socket.io server
│   │   │   ├── redisService.ts  # Redis pub/sub
│   │   │   ├── mapsService.ts   # Google Maps APIs
│   │   │   ├── whatsappService.ts
│   │   │   └── cronService.ts   # Temp Head expiry scheduler
│   │   ├── db/
│   │   │   ├── index.ts         # PostgreSQL connection pool
│   │   │   └── schema.sql       # Full DDL
│   │   └── index.ts             # Express app entry point
│   └── package.json
│
├── docs/
│   ├── BRD_LocationCircle_App.pdf
│   ├── UI_Mockups_LocationCircle.pdf
│   ├── SRS.md
│   ├── diagrams/                # UML + DFD + ER diagrams
│   └── test-cases.md
│
├── .env.example
├── docker-compose.yml
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js v20+
- PostgreSQL 15+ (or Supabase account)
- Redis (or Upstash account)
- Google Cloud Console project (Maps API + OAuth)
- Firebase project (Auth)

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/locationcircle.git
cd locationcircle
```

### 2. Install Dependencies

```bash
# Frontend
cd client && npm install

# Backend
cd ../server && npm install
```

### 3. Configure Environment Variables

```bash
cp .env.example .env
# Fill in all values (see Environment Variables section below)
```

### 4. Set Up the Database

```bash
cd server
psql -U postgres -d locationcircle -f src/db/schema.sql
```

### 5. Start Development Servers

```bash
# Terminal 1 — Backend
cd server && npm run dev       # Runs on http://localhost:4000

# Terminal 2 — Frontend
cd client && npm run dev       # Runs on http://localhost:5173
```

---

## 🔑 Environment Variables

Create a `.env` file in both `client/` and `server/` using the template below:

### `server/.env`
```env
# Server
PORT=4000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/locationcircle

# Redis
REDIS_URL=redis://localhost:6379

# Firebase Admin SDK
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-client-email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Google Maps
GOOGLE_MAPS_API_KEY=your-google-maps-key

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=30d

# WhatsApp Business API
WHATSAPP_API_TOKEN=your-meta-api-token
WHATSAPP_PHONE_NUMBER_ID=your-number-id
WHATSAPP_VERIFY_TOKEN=your-webhook-verify-token
```

### `client/.env`
```env
VITE_API_URL=http://localhost:4000
VITE_SOCKET_URL=http://localhost:4000
VITE_GOOGLE_MAPS_KEY=your-google-maps-key
VITE_FIREBASE_API_KEY=your-firebase-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
```

---

## 📡 API Reference

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/auth/google` | Verify Google token, return JWT |
| `GET` | `/users/me` | Get current user profile |
| `PUT` | `/users/me` | Update name, avatar, phone |

### Groups
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/groups` | Create group (caller becomes Head) |
| `GET` | `/groups/:id` | Get group details + members |
| `POST` | `/groups/:id/invite` | Generate invite link |
| `POST` | `/groups/join/:token` | Join via invite token |
| `PUT` | `/groups/:id/head` | Transfer or delegate Head role |
| `DELETE` | `/groups/:id/members/:uid` | Remove a member (Head only) |

### Locations
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/locations/:groupId` | Get all member positions (polling fallback) |
| `PUT` | `/locations/me` | Update own position |
| `PUT` | `/locations/me/pause` | Toggle location sharing pause |

### WhatsApp
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/webhook/whatsapp` | Webhook verification (Meta) |
| `POST` | `/webhook/whatsapp` | Incoming message handler |

### Socket.io Events
| Event | Direction | Payload |
|---|---|---|
| `location:update` | Client → Server | `{ lat, lng, groupId }` |
| `location:broadcast` | Server → Clients | `{ userId, lat, lng, locality }` |
| `head:changed` | Server → Clients | `{ newHeadId, groupId }` |
| `member:joined` | Server → Clients | `{ userId, groupId }` |

---

## ♿ Accessibility

LocationCircle is built **accessibility-first**, targeting **WCAG 2.1 Level AA** compliance throughout.

| Feature | Implementation |
|---|---|
| Screen reader support | Full ARIA roles, labels, live regions |
| Keyboard navigation | Complete tab order, skip link, focus management |
| Read Aloud (TTS) | Web Speech API — reads member list aloud |
| Font scaling | `A+` / `A-` controls — reflows at 200% without scroll |
| Focus indicator | 3px orange `:focus-visible` ring |
| Color independence | Head row: position + border + icon + color (4 cues) |
| Contrast ratio | Minimum 4.5:1 (text), 3:1 (large text) |
| Touch targets | ≥ 44×44px on all interactive elements |
| Dynamic updates | `aria-live="polite"` for location, `assertive` for Head changes |

### Automated Testing
```bash
# Run axe-core accessibility audit
npx axe-cli http://localhost:5173 --exit
```

---

## 🤖 WhatsApp Bot Commands

Once you've linked your WhatsApp number in **Settings → WhatsApp**, you can message the **LocationCircle Bot**:

| Input | Response |
|---|---|
| `LIST` | All group members sorted by proximity |
| `HEAD` | Current Group Head's location + ETA |
| `PAUSE` | Pause your location sharing |
| `RESUME` | Resume your location sharing |
| *"Where is [Name]?"* | Member's locality, distance, car ETA, Google Maps link |

> ⚠️ **Privacy:** Live location data is fetched in real-time and **never stored** in WhatsApp message history.

---

## 👥 User Roles & Permissions

| Permission | Member | Temp Head | Group Head |
|---|---|---|---|
| View member list & map | ✅ | ✅ | ✅ |
| Share own location | ✅ | ✅ | ✅ |
| Pause own location | ✅ | ✅ | ✅ |
| Call members (tel: intent) | ✅ | ✅ | ✅ |
| Use WhatsApp bot | ✅ | ✅ | ✅ |
| Shown with crown/gold badge | ❌ | ✅ (temporary) | ✅ |
| Invite new members | ❌ | ❌ | ✅ |
| Remove members | ❌ | ❌ | ✅ |
| Assign Temporary Head | ❌ | ❌ | ✅ |
| Transfer permanent Head role | ❌ | ❌ | ✅ |

---

## 🗓️ Sprint Roadmap

| Sprint | Dates | Status | Focus |
|---|---|---|---|
| **Sprint 1** | Jun 1–4 | 🔄 In Progress | Project Initiation + BRD Review |
| **Sprint 2** | Jun 5–15 | ⏳ Planned | SRS + UML Diagrams + DB Design |
| **Sprint 3** | Jun 16–22 | ⏳ Planned | Auth + Group Management |
| **Sprint 4** | Jun 23–Jul 7 | ⏳ Planned | Real-Time Location + Socket.io |
| **Sprint 5** | Jul 8–15 | ⏳ Planned | Dashboard + Google Maps + ETA |
| **Sprint 6** | Jul 16–20 | ⏳ Planned | Accessibility (WCAG) + WhatsApp Bot |
| **Sprint 7** | Jul 21–25 | ⏳ Planned | Testing + Bug Fixing |
| **Sprint 8** | Jul 26–28 | ⏳ Planned | Deployment + Documentation |

---

## 📦 Final Deliverables

- [ ] SRS Document
- [ ] UML Diagrams (Use Case, Class, Sequence, Activity, State, Component, Deployment)
- [ ] DFD Level 0 & Level 1
- [ ] ER Diagram
- [ ] Architecture Diagram
- [ ] ProjectLibre Plan (`.pod`)
- [ ] Test Cases Document
- [ ] Risk Analysis
- [ ] Source Code (GitHub)
- [ ] Deployed Application (Vercel + Render)
- [ ] Final Project Report
- [ ] Presentation (PPT)
- [ ] Demo Video

---

## 👨‍💻 Team

| Role | Responsibility |
|---|---|
| Project Lead | Planning, integration, deployment |
| Frontend Developer | React UI, accessibility, maps |
| Backend Developer | APIs, authentication, WebSockets |
| Database Engineer | PostgreSQL, schema, optimization |
| QA Tester | Testing, accessibility audit |

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

Built with ❤️ as part of an internship project · LocationCircle © 2026

</div>
