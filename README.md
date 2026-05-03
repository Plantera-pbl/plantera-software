# Plantera

A plant monitoring web app. Each plant is paired with a physical sensor device (Arduino / ESP32) that reports light, soil moisture, temperature and ambient humidity. The dashboard displays live readings and historical charts for every plant in your collection.

---

## Features

- **Live sensor dashboard** — readings update every 5 seconds from the broker (or simulated when offline)
- **Historical charts** — filterable by time window: last 1 h, 6 h, 12 h, or 24 h
- **Plant management** — add, edit, and delete plants; each linked to a physical device via its numeric Device ID
- **Care guidance** — contextual tips based on current sensor values
- **Notifications** — in-app notification bell in the header plus browser push notifications when sensor thresholds are exceeded

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Auth | Clerk |
| Database | PostgreSQL via Supabase + Drizzle ORM |
| API | tRPC |
| Charts | Recharts |
| Styling | Tailwind CSS |
| Deployment | Vercel |

---

## Architecture overview

```
Physical sensor (Arduino / ESP32)
        │  MQTT / HTTP push
        ▼
  plantera-broker  ──────────────────────────────────────────────────┐
  (FastAPI, Python)                                                   │
  Deployed on Railway                                                 │
  • Receives sensor readings                                          │
  • Stores them in PostgreSQL                                         │
  • Exposes REST API + WebSocket                                      │
        │  REST polling every 5 s                                     │
        ▼                                                             │
  plantera-software (this repo)                                       │
  Deployed on Vercel                                                  │
  • Dashboard fetches latest readings per plant                       │
  • Appends new points to the live chart                              │
  • Falls back to simulated data when broker is unreachable           │
```

### How a plant connects to the broker

Each plant in the database has a **Device ID** field (`topic` column). This is the numeric ID that the broker assigned when the physical device was registered. The dashboard uses this ID to call:

- `GET /api/v1/devices/{id}/readings` — load chart history on plant select
- `GET /api/v1/devices/{id}/readings/latest` — poll every 5 s for live data

---

## Notifications

Plantera checks sensor readings on every live poll (every 5 seconds) and fires alerts when values cross defined thresholds. Each alert has a **30-minute cooldown per plant** so you are not flooded with repeated messages.

Alerts appear in two places:
1. **In-app bell icon** in the top-right header — shows a red badge with the unread count; clicking it opens a dropdown panel listing all past notifications for the current session.
2. **Browser push notification** — shown by the OS if the user has granted the `Notification` permission.

### Notification types

| Icon | Key | Trigger condition | Severity |
|------|-----|-------------------|----------|
| 💧 | `soil-critical` | Soil moisture **< 15 %** | Critical — water immediately |
| 💧 | `soil-low` | Soil moisture **< 35 %** | Warning — water in the next 1–2 days |
| 🌊 | `soil-high` | Soil moisture **> 78 %** | Warning — plant may be overwatered |
| ☀️ | `light-critical` | Light level **< 10 %** | Critical — plant is in the dark |
| ☀️ | `light-low` | Light level **< 30 %** | Info — light is low, move closer to a window |
| 🥶 | `temp-low` | Temperature **< 10 °C** | Warning — too cold, risk of cold shock |
| 🔥 | `temp-high` | Temperature **> 32 °C** | Warning — too hot, risk of heat stress |

> **Note:** humidity alerts are shown as care guidance cards on the dashboard but do not currently trigger push/bell notifications.

---

## Local development

### Prerequisites
- Node.js 20+
- A Supabase PostgreSQL database
- A Clerk application
- The broker running locally or the deployed Railway URL

### Setup

```bash
npm install
cp .env.example .env.local
# fill in .env.local (see Environment variables below)
npm run db:push   # push schema to the database
npm run dev       # http://localhost:3000
```

### Environment variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Supabase) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `CLERK_SECRET_KEY` | Clerk secret key |
| `NEXT_PUBLIC_BROKER_URL` | Deployed broker base URL (e.g. Railway) |

### Useful scripts

```bash
npm run dev          # start dev server with Turbopack
npm run build        # production build
npm run db:push      # push schema changes to DB (no migration file)
npm run db:generate  # generate Drizzle migration files
npm run db:migrate   # run pending migrations
npm run db:studio    # open Drizzle Studio (visual DB browser)
npm run check        # lint + typecheck
```

---

## Broker

The broker lives at [github.com/Plantera-pbl/plantera-broker](https://github.com/Plantera-pbl/plantera-broker). It is a standalone Python (FastAPI) service deployed on Railway.

### What it does

- **Receives** sensor data from microcontrollers via MQTT (HiveMQ cloud) or HTTP push
- **Converts** raw ADC values (0–4095) to percentages (0–100 %) for light and soil moisture
- **Stores** every reading in PostgreSQL (one row per snapshot)
- **Streams** new readings in real time over WebSocket to any connected client
- **Exposes** a REST API for reading history and device management

### Broker REST API

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/devices` | List all registered devices |
| `POST` | `/api/v1/devices` | Register a new device |
| `DELETE` | `/api/v1/devices/{id}` | Remove a device |
| `GET` | `/api/v1/devices/{id}/readings` | Reading history (`?limit=100&since=<iso>`) |
| `GET` | `/api/v1/devices/{id}/readings/latest` | Most recent reading |
| `POST` | `/api/v1/devices/{id}/push` | Push a reading directly |
| `WS` | `/api/v1/ws` | Live WebSocket feed |

### Broker cheatsheet (PowerShell)

**List all devices**
```powershell
Invoke-RestMethod "https://plantera-broker-production.up.railway.app/api/v1/devices"
```

**Register a new device** (returns an `id` — save it as the plant's Device ID)
```powershell
Invoke-RestMethod -Method Post `
  -Uri "https://plantera-broker-production.up.railway.app/api/v1/devices" `
  -ContentType "application/json" `
  -Body '{"name":"my-plant","url":"","poll_interval":5}'
```

**Get last 100 readings for device 1**
```powershell
Invoke-RestMethod "https://plantera-broker-production.up.railway.app/api/v1/devices/1/readings"
```

**Get the latest reading for device 1**
```powershell
Invoke-RestMethod "https://plantera-broker-production.up.railway.app/api/v1/devices/1/readings/latest"
```

**Push a manual reading to device 1** (useful for testing without hardware)
```powershell
Invoke-RestMethod -Method Post `
  -Uri "https://plantera-broker-production.up.railway.app/api/v1/devices/1/push" `
  -ContentType "application/json" `
  -Body '{"light":2048,"soil-moisture":1024,"temp":23.5,"ambient-humidity":61.2}'
```

**Delete device 1**
```powershell
Invoke-RestMethod -Method Delete `
  "https://plantera-broker-production.up.railway.app/api/v1/devices/1"
```

**Open interactive API docs**
```
https://plantera-broker-production.up.railway.app/docs
```

---

## Deployment

### Software (Vercel)
Push to `main` — Vercel deploys automatically. Add all environment variables under **Project → Settings → Environment Variables**.

### Broker (Railway)
The broker is deployed from the `plantera-broker` GitHub repo. Railway rebuilds on every push to `main`. Environment variables are managed in the Railway project dashboard.
