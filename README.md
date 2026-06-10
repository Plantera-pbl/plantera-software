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

| Layer      | Technology                            |
| ---------- | ------------------------------------- |
| Framework  | Next.js 15 (App Router)               |
| Language   | TypeScript                            |
| Auth       | Clerk                                 |
| Database   | PostgreSQL via Supabase + Drizzle ORM |
| API        | tRPC                                  |
| Charts     | Recharts                              |
| Styling    | Tailwind CSS                          |
| Deployment | Vercel                                |

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
- `PATCH /api/v1/devices/{id}/config` — push updated automation config whenever the user saves plant settings or toggles the device on/off

---

## Notifications

Plantera does **not** scold you for things that the device already handles
automatically (watering, ventilation, grow-light). Instead, the notification
engine tells you **what the device just did and why**, so you always know the
state of the system without having to stare at the dashboard.

Notifications appear in three places:

1. **In-app bell icon** (top-right header) — red badge with unread count.
   Each entry shows the title, body, timestamp, a coloured severity bar
   (green = success, blue = info, amber = warning, red = critical) and a
   category tag (`watering`, `fan`, `light`, `temperature`, `reminder`).
2. **Browser push notification** — when the OS `Notification` permission is
   granted.
3. **Database** (table `plantera-software_notification`) — every event is
   persisted with `category`, `severity` and `plantId` so it can be queried
   later.

### Notification engine model

The engine compares the **previous** sensor snapshot for a plant against the
**current** one and only fires when a value **crosses** a configured
threshold. Each device has its own ON / OFF threshold pair, which mirrors a
classic hysteresis loop:

```
            soil moisture
   ──────────────────────────────
   100% ┤
        │      OFF threshold ──── stops a notification cycle
        │                              (e.g. "watering complete")
        │
        │      ON  threshold  ──── starts a notification cycle
        │                              (e.g. "watering started")
     0% ┤
```

Because the engine is state-aware, it will not spam: a "watering started"
event will only ever be followed by a "watering complete" event for the
same plant, never two starts in a row.

### Notification categories

| Icon | Category      | Fires when …                                                     | Severity  |
| ---- | ------------- | ---------------------------------------------------------------- | --------- |
| 💧   | `watering`    | Soil moisture drops **below `wateringOnPct`**                    | `info`    |
| ✅   | `watering`    | Soil moisture rises **back above `wateringOffPct`**              | `success` |
| 🌀   | `fan`         | Humidity climbs **above `fanOnPct`**                             | `info`    |
| ✅   | `fan`         | Humidity falls **back to / below `fanOffPct`**                   | `success` |
| 💡   | `light`       | Ambient light falls **below `lightOnPct`**                       | `info`    |
| ✅   | `light`       | Ambient light recovers **to / above `lightOffPct`**              | `success` |
| 🥶   | `temperature` | Temperature drops **below 10 °C** (device can't heat — advisory) | `warning` |
| 🔥   | `temperature` | Temperature rises **above 32 °C** (device can't cool — advisory) | `warning` |
| ✅   | `temperature` | Temperature returns to the comfort range                         | `success` |
| ⏰   | `reminder`    | A user-scheduled reminder's `dueAt` time passes                  | `info`    |

> **Removed from the old engine:** legacy alerts that told the user to
> _"water immediately"_, _"move closer to a window"_ or _"move to a brighter
> spot"_ — the device already takes care of those actions. The new engine
> instead reports what happened: e.g. _"💧 Living Room Monstera — watering
> started. Soil moisture 42 % → 28 % dropped below 35 % trigger. The device
> is delivering water (20 s burst)."_

### Per-plant device configuration

The notification thresholds are not hard-coded — every plant has its own
`device_config` row, editable from the **⚙ Plant settings** button in the
header. The configurable knobs are:

| Field                 | Default | Meaning                                                                       |
| --------------------- | ------- | ----------------------------------------------------------------------------- |
| `wateringOnPct`       | 35      | Soil % below which a watering cycle starts                                    |
| `wateringOffPct`      | 60      | Soil % at which a watering cycle is considered complete                       |
| `wateringDurationSec` | 20      | How long the pump runs each burst (informational)                             |
| `wateringCooldownMin` | 30      | Minimum minutes between two notifications of the **same** kind / same plant   |
| `fanOnPct`            | 75      | Humidity % above which the fan starts                                         |
| `fanOffPct`           | 60      | Humidity % at which the fan stops                                             |
| `lightOnPct`          | 30      | Light % below which the grow LED turns on                                     |
| `lightOffPct`         | 55      | Light % at which the grow LED turns off                                       |
| `quietHours`          | `[]`    | List of `{ start: "HH:mm", end: "HH:mm" }` windows that suppress _all_ alerts |
| `timezoneOffsetMin`   | 0       | Minutes from UTC used when evaluating `quietHours`                            |
| `deviceOn`            | `true`  | Master switch — when `false`, the engine emits nothing for that plant         |

The same numbers are also used by the **sensor charts**: the soil-moisture,
humidity and light panels draw two dashed reference lines (amber = ON,
green = OFF) and a light green band representing the comfort zone the
device is trying to maintain.

### Manual reminders

Open the **⏰ clock** button in the header to add ad-hoc reminders, e.g.
_"Add fertiliser in 30 days"_ or _"Repot in 90 days"_. Each reminder has:

- A `title` (shown in the notification),
- An optional `note` (the notification body),
- An optional `plantId` (so the notification is filed against a plant),
- A `dueAt` timestamp.

The client polls the reminder list every 30 s and, when a reminder's `dueAt`
is in the past and the reminder is not yet `done`, it fires a single
notification (cached in-session so it never repeats). Reminders can be
ticked off (`done = true`) or deleted from the same dialog.

### Quiet hours and the device master switch

When the current local time (UTC + `timezoneOffsetMin`) falls inside any of
the configured `quietHours` windows — or when `deviceOn = false` — the
engine still updates its internal state (so transitions are not lost) but
**does not emit a notification**. This is useful e.g. to silence everything
between 22:00 and 07:00.

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

| Variable                            | Description                             |
| ----------------------------------- | --------------------------------------- |
| `DATABASE_URL`                      | PostgreSQL connection string (Supabase) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key                   |
| `CLERK_SECRET_KEY`                  | Clerk secret key                        |
| `NEXT_PUBLIC_BROKER_URL`            | Deployed broker base URL (e.g. Railway) |

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

| Method   | Path                                   | Description                                |
| -------- | -------------------------------------- | ------------------------------------------ |
| `GET`    | `/api/v1/devices`                      | List all registered devices (includes `config`) |
| `POST`   | `/api/v1/devices`                      | Register a new device                      |
| `DELETE` | `/api/v1/devices/{id}`                 | Remove a device                            |
| `GET`    | `/api/v1/devices/{id}/config`          | Get device automation config               |
| `PATCH`  | `/api/v1/devices/{id}/config`          | Update device automation config            |
| `GET`    | `/api/v1/devices/{id}/readings`        | Reading history (`?limit=100&since=<iso>`) |
| `GET`    | `/api/v1/devices/{id}/readings/latest` | Most recent reading                        |
| `POST`   | `/api/v1/devices/{id}/push`            | Push a reading directly                    |
| `WS`     | `/api/v1/ws`                           | Live WebSocket feed                        |

### Message structure: software → broker (config sync)

Every time the user saves plant settings or toggles the device on/off, the
software sends a `PATCH /api/v1/devices/{id}/config` request with the
following JSON body.  The broker stores this in `Device.config` (SQLite JSON
column) and, when MQTT is enabled, immediately publishes it as a **retained**
message to `iot/devices/{id}/config` so the firmware receives it on its next
connect.

```jsonc
// PATCH /api/v1/devices/{id}/config
{
  "device_state":         1,           // 1 = enabled, 0 = disabled (master kill-switch)
  "watering_cooldown":    30,          // minutes — minimum gap between watering cycles
  "watering_duration":    20,          // seconds — how long the pump runs per burst
  "watering_moisture_on": 35.0,        // % — soil moisture below which watering starts
  "watering_moisture_off":60.0,        // % — soil moisture above which watering stops
  "fan_humidity_on":      75.0,        // % — ambient humidity above which the fan starts
  "fan_humidity_off":     60.0,        // % — ambient humidity below which the fan stops
  "light_intensity_on":   30.0,        // % — light level below which the grow LED turns on
  "light_intensity_off":  55.0,        // % — light level above which the grow LED turns off
  "non_working_windows":  ["22:00-06:00"] // list of "HH:MM-HH:MM" quiet windows (GMT+3)
}
```

#### Field mapping: software ↔ broker

The software stores config using camelCase names in PostgreSQL; the broker
uses snake_case names in its own SQLite database.  The conversion happens in
`sendDeviceConfig()` in `src/app/dashboard/_components/Dashboard.tsx`.

| Software field (`DeviceConfig`) | Broker field (`Device.config`) | Type / unit |
| ------------------------------- | ------------------------------ | ----------- |
| `deviceOn` (boolean)            | `device_state` (0 or 1)        | int |
| `wateringCooldownMin`           | `watering_cooldown`            | minutes (int) |
| `wateringDurationSec`           | `watering_duration`            | seconds (int) |
| `wateringOnPct`                 | `watering_moisture_on`         | % (float) |
| `wateringOffPct`                | `watering_moisture_off`        | % (float) |
| `fanOnPct`                      | `fan_humidity_on`              | % (float) |
| `fanOffPct`                     | `fan_humidity_off`             | % (float) |
| `lightOnPct`                    | `light_intensity_on`           | % (float) |
| `lightOffPct`                   | `light_intensity_off`          | % (float) |
| `quietHours: [{start, end}]`    | `non_working_windows: ["HH:MM-HH:MM"]` | string list |
| `timezoneOffsetMin`             | *(omitted — browser-only)*     | — |

> **Note:** `timezoneOffsetMin` is used only by the browser notification
> engine for evaluating quiet hours locally. It is not sent to the broker
> because the broker evaluates `non_working_windows` in GMT+3.

#### When is this message sent?

| User action | Triggered by |
| ----------- | ------------ |
| Save **⚙ Plant settings** dialog | `SettingsDialog.onSave` → `sendDeviceConfig()` |
| Toggle **Device enabled** switch in the header | `handleToggleDevice()` → `sendDeviceConfig()` |

### Message structure: broker → software (sensor readings)

The software receives sensor data from the broker via two REST endpoints:

**`GET /api/v1/devices/{id}/readings/latest`** — polled every 5 s

**`GET /api/v1/devices/{id}/readings?limit=48`** — loaded once on plant select

Both return `ReadingOut` objects:

```jsonc
{
  "id":               42,
  "device_id":        1,
  "timestamp":        "2026-06-10T14:32:00+00:00",   // ISO-8601 UTC
  "payload":          { "light": 2048, "soil-moisture": 1024, "temp": 23.5, "ambient-humidity": 61.2 },
  "light":            50.01,        // % (0–100), converted from raw ADC by broker
  "soil_moisture":    25.0,         // % (0–100), converted from raw ADC by broker
  "temp":             23.5,         // °C (-40–80), passed through as-is
  "ambient_humidity": 61.2          // % (0–100), passed through as-is
}
```

`payload` contains the raw values exactly as the microcontroller sent them.
The top-level `light` and `soil_moisture` fields are already converted from
12-bit ADC counts (0–4095) to percentages (0–100 %) by the broker:
`pct = round(raw / 4095 * 100, 2)`.  `temp` and `ambient_humidity` are
passed through unchanged.

### Message structure: software → broker (push reading, for testing)

**`POST /api/v1/devices/{id}/push`** — used by `serial_bridge.py` or manual
test scripts.  The body contains raw sensor values:

```jsonc
// POST /api/v1/devices/{id}/push
{
  "light":            2048,   // raw ADC 0–4095 (broker converts to %)
  "soil-moisture":    1024,   // raw ADC 0–4095 (broker converts to %)  ← note hyphen
  "temp":             23.5,   // °C, passed through as-is
  "ambient-humidity": 61.2    // %, passed through as-is               ← note hyphen
}
```

Note the **hyphenated keys** (`soil-moisture`, `ambient-humidity`).  The
broker stores them verbatim in `payload` and writes the converted values into
the dedicated `soil_moisture` / `ambient_humidity` columns.

### Message structure: broker → software (WebSocket live feed)

Connect to `WS /api/v1/ws` to receive new readings in real time.  Each
message is a JSON string:

```jsonc
{
  "device":    "esp32-livingroom",             // device name string
  "timestamp": "2026-06-10T14:32:00+00:00",   // ISO-8601 UTC
  "data": {
    "light":            50.01,   // % (already converted)
    "soil_moisture":    25.0,    // % (already converted)  ← note underscore
    "temp":             23.5,    // °C
    "ambient_humidity": 61.2     // %
  }
}
```

---

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

**Get the current config for device 1**

```powershell
Invoke-RestMethod "https://plantera-broker-production.up.railway.app/api/v1/devices/1/config"
```

**Update config for device 1** (replaces the full config object)

```powershell
Invoke-RestMethod -Method Patch `
  -Uri "https://plantera-broker-production.up.railway.app/api/v1/devices/1/config" `
  -ContentType "application/json" `
  -Body '{
    "device_state":          1,
    "watering_cooldown":     30,
    "watering_duration":     20,
    "watering_moisture_on":  35.0,
    "watering_moisture_off": 60.0,
    "fan_humidity_on":       75.0,
    "fan_humidity_off":      60.0,
    "light_intensity_on":    30.0,
    "light_intensity_off":   55.0,
    "non_working_windows":   ["22:00-06:00"]
  }'
```

**Open interactive API docs**

```
https://plantera-broker-production.up.railway.app/docs
```

---

## Testing the notification engine

You can drive the whole notification engine without any hardware by pushing
crafted readings to the broker's `POST /api/v1/devices/{id}/push` endpoint
from PowerShell. Pair these commands with the dashboard open in a browser
(the bell icon updates within ~5 s — the live-poll interval).

> The broker stores `light` and `soil-moisture` as raw ADC values (0–4095)
> and converts them to 0–100 % when reading. So to simulate **X %** of soil
> or light: `raw = round(X * 4095 / 100)`.
>
> Defaults assumed below: `wateringOnPct = 35`, `wateringOffPct = 60`,
> `fanOnPct = 75`, `fanOffPct = 60`, `lightOnPct = 30`, `lightOffPct = 55`,
> `wateringCooldownMin = 30`. Device ID `1` is used; replace as needed.

### Helper

```powershell
$broker = "https://plantera-broker-production.up.railway.app"
$dev    = 1

function Push-Reading($soilPct, $lightPct, $temp, $humidity) {
  $soilRaw  = [int]($soilPct  * 4095 / 100)
  $lightRaw = [int]($lightPct * 4095 / 100)
  $body = @{
    "light"            = $lightRaw
    "soil-moisture"    = $soilRaw
    "temp"             = $temp
    "ambient-humidity" = $humidity
  } | ConvertTo-Json
  Invoke-RestMethod -Method Post `
    -Uri "$broker/api/v1/devices/$dev/push" `
    -ContentType "application/json" -Body $body
  Start-Sleep -Seconds 6   # let the dashboard poll once
}
```

### Test 1 — watering cycle (start → complete)

```powershell
# Seed a "normal" reading first so the prev snapshot is established
Push-Reading 50 50 22 55
# Drop below wateringOnPct (35) → should fire "💧 watering started"
Push-Reading 28 50 22 55
# Climb above wateringOffPct (60) → should fire "✅ watering complete"
Push-Reading 65 50 22 55
```

**Expected:** two notifications appear in the bell. First is blue/info
("watering started", body mentions `50% → 28%` and the 20 s burst); second
is green/success ("watering complete", body mentions `28% → 65%`).

### Test 2 — fan cycle (humidity ON / OFF)

```powershell
Push-Reading 50 50 22 60   # baseline
Push-Reading 50 50 22 85   # > fanOnPct (75)  → "🌀 fan started"
Push-Reading 50 50 22 55   # <= fanOffPct (60) → "✅ fan stopped"
```

**Expected:** two notifications, category `fan`, info then success.

### Test 3 — grow-light cycle

```powershell
Push-Reading 50 60 22 55   # baseline
Push-Reading 50 18 22 55   # < lightOnPct (30) → "💡 grow light on"
Push-Reading 50 70 22 55   # >= lightOffPct (55) → "✅ grow light off"
```

**Expected:** two notifications, category `light`, info then success.

### Test 4 — temperature advisory (device cannot fix)

```powershell
Push-Reading 50 50 7 55    # < 10 °C   → "🥶 cold reading", severity warning
Push-Reading 50 50 22 55   # back to OK → "✅ temperature back to normal"
Push-Reading 50 50 35 55   # > 32 °C   → "🔥 hot reading", severity warning
```

**Expected:** three notifications, category `temperature`. The cold and
hot ones are amber (`warning`), the recovery one is green (`success`).

### Test 5 — cooldown is respected

```powershell
Push-Reading 50 50 22 55   # baseline
Push-Reading 28 50 22 55   # fires "watering started"
Push-Reading 65 50 22 55   # fires "watering complete"
Push-Reading 28 50 22 55   # within cooldown → NO new notification
Push-Reading 65 50 22 55   # within cooldown → NO new notification
```

**Expected:** only the first two events fire. The next two are suppressed
because the same event keys are still inside their `wateringCooldownMin`
window (default 30 min). Lower `wateringCooldownMin` to `0` in **⚙ Plant
settings** to bypass.

### Test 6 — quiet hours suppress everything

In **⚙ Plant settings** add a quiet window covering _right now_
(e.g. `00:00 → 23:59`) and save, then run:

```powershell
Push-Reading 50 50 22 55
Push-Reading 28 50 22 55   # would normally fire watering-start
Push-Reading 50 50 22 85   # would normally fire fan-start
```

**Expected:** **no** new notifications appear. The engine still updates its
internal transition state (so when quiet hours end, the next legitimate
crossing fires correctly), but emits nothing during the window.

### Test 7 — device master switch

In **⚙ Plant settings** turn **Device enabled** off, save, then run any of
the scenarios above.

**Expected:** zero notifications. Same as quiet hours, but global for that
plant regardless of the clock.

### Test 8 — manual reminders

1. Click the ⏰ button in the header.
2. Add a reminder with **In how many days = 0** (the form rounds up to a
   `dueAt` of now-ish; for instant testing you can edit the row in
   `plantera-software_reminder` and set `dueAt` to `now()`).
3. Within 30 s the bell shows a new `⏰ Reminder: <title>` notification
   (category `reminder`, severity `info`).
4. Click the green ✓ in the reminders dialog → the row is marked `done`
   and will not fire again.

**Expected:** one notification per reminder, exactly once per session.

### Verifying directly in the database

```sql
SELECT id, category, severity, title, body, "plantId", "createdAt"
FROM "plantera-software_notification"
ORDER BY "createdAt" DESC
LIMIT 20;
```

You should see the rows in the same order the bell shows them.

---

## Deployment

### Software (Vercel)

Push to `main` — Vercel deploys automatically. Add all environment variables under **Project → Settings → Environment Variables**.

### Broker (Railway)

The broker is deployed from the `plantera-broker` GitHub repo. Railway rebuilds on every push to `main`. Environment variables are managed in the Railway project dashboard.
