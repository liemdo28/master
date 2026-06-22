# Phase 1.2.1 — YoLink Runtime Report

**Date:** 2025-06-04
**Status:** ⚠️ REQUIRES REAL DEVICE + CREDENTIALS

---

## What This Is

Real YoLink connection proof-of-concept: Discover YoLink Hub devices + read one temperature value from a sensor via the YoLink Cloud API.

This is a **live test** — not simulated. Requires physical YoLink Hub + at least one sensor connected.

---

## Prerequisites (CEO Action Required)

Before running this test, CEO must provide:

1. **YoLink Hub connected and online** (LED solid, not blinking)
2. **At least one temperature sensor paired** to the hub
3. **YoLink Developer Portal credentials** (UAC app):
   - `YOLINK_CLIENT_ID` — from https://www.yosmart.com/ → Developer Portal → UAC App
   - `YOLINK_CLIENT_SECRET` — same portal
4. **YoLink account** with devices registered to the same account as the UAC app

---

## Test Script

```bash
node scripts/test-yolink-connection.js
```

Expected output (with real credentials):
```
[YoLink Auth] Token obtained, expires in 7200s
[YoLink API] Home info: { ... }
[YoLink API] Devices found: 3
[YoLink API] Device yolink_abc123: Walk-in Cooler (THSensor) - Online - 38.5°F - Battery 100%
✅ YoLink connection proof-of-concept: PASS
```

Error output (missing credentials):
```
❌ YoLink not configured — set YOLINK_CLIENT_ID and YOLINK_CLIENT_SECRET in .env
```

Error output (hub offline):
```
❌ YoLink Hub offline or API unreachable. Check hub power and internet connection.
```

---

## Architecture Under Test

```
.env (YOLINK_CLIENT_ID + YOLINK_CLIENT_SECRET)
    ↓
yolink-auth.js → getToken() → POST https://api.yosmart.com/open/yolink/token
    ↓ OAuth2 client_credentials
yolink-client.js → getDeviceList() → POST https://api.yosmart.com/open/yolink/v2/api
    ↓ method: Home.getDeviceList
    ↓ Returns: [{ deviceId, type, name, modelName }]
yolink-client.js → getDeviceState(deviceId) → POST https://api.yosmart.com/open/yolink/v2/api
    ↓ method: THSensor.getState
    ↓ Returns: { online, state: { temperature, humidity, battery, reportAt } }
yolink-normalizer.js → celsiusToFahrenheit(5.6) → 42.1°F
yolink-reading-service.js → saveReading() → SQLite sensor_readings
```

---

## Configuration

```env
YOLINK_ENABLED=true
YOLINK_CLIENT_ID=your_client_id
YOLINK_CLIENT_SECRET=your_client_secret
YOLINK_POLL_INTERVAL_SECONDS=300    # 5 minutes
YOLINK_TIMEOUT_SECONDS=20
```

**Important:** `YOLINK_ENABLED` must be `true` to start the poller. Without it, the poller is disabled and the human workflow continues normally.

---

## Proof-of-Concept Test Steps

### Step 1: Test Connection (no sensor data stored)
```
POST /api/sensors/test
```
- Calls `yolink-auth.getToken()` → confirms OAuth2 works
- Calls `yolink-client.testConnection()` → `Home.getGeneralInfo()`
- Returns: `{ ok: true, home: {...} }` or `{ ok: false, error: "..." }`

### Step 2: Sync Devices
```
POST /api/sensors/sync
```
- Calls `yolink-device-sync.syncDevices()`
- Discovers all THSensor devices
- Stores in SQLite `sensors` table
- Returns: `{ synced: 2, devices: [...] }`

### Step 3: Force Poll (store first reading)
```
POST /api/sensors/force-poll
```
- Calls `yolink-poller.forcePoll()` → `readingService.pollAllSensors()`
- Fetches `THSensor.getState` for each device
- Saves to `sensor_readings` table
- Returns: `{ ok: true, result: { polled: 2, readings: [...] } }`

### Step 4: Read Latest
```
GET /api/sensors/readings?limit=10
```
- Returns last 10 readings from `sensor_readings` table

---

## Map Sensor to Store/Item

Before cross-validation works, sensors must be mapped:

```
POST /api/sensors/mapping
{
  "sensor_id": "yolink_abc123",
  "store_id": "stone_oak",
  "item_name": "Walk-in Cooler"
}
```

This creates a row in `sensor_item_mapping`:
```
sensor_id | store_id | item_name | active
yolink_abc123 | stone_oak | Walk-in Cooler | 1
```

Then `cross-validation-service.js` can find the sensor for any daily entry item.

---

## Cross-Validation Flow (After Mapping)

1. Employee submits Walk-in Cooler = 38°F via `/ldagent`
2. `cross-validation-service.compareHumanVsSensor()` looks up:
   - Latest reading for sensor mapped to "Walk-in Cooler" in "stone_oak"
   - Reading: 42°F, 3 minutes ago, online
3. Difference: |38 - 42| = 4°F > tolerance 2°F → MISMATCH
4. Bot replies:
   ```
   ⚠️ SENSOR MISMATCH

   Item: Walk-in Cooler
   You entered: 38°F
   Sensor shows: 42°F
   Difference: 4°F

   Reply:
   1 — Use my entered value
   2 — Use sensor value
   3 — Re-enter
   ```
5. Employee chooses → cross-validation result saved to `cross_validation_results`

---

## Test Results (Simulated)

Since real YoLink credentials are not yet configured, the system returns:

| Check | Result |
|---|---|
| `yolink-auth.isConfigured()` | `false` (no credentials) |
| `yolink-poller.getStatus().enabled` | `false` |
| `yolink-poller.getStatus().configured` | `false` |
| Dashboard sensor panel | "YoLink is not configured. Human workflow remains active." |
| Human workflow | ✅ Still works normally |
| WhatsApp bot | ✅ Not affected |

---

## Real Device Checklist

| Item | Status |
|---|---|
| YoLink Hub powered and connected to WiFi | ⬜ Pending |
| YoLink App showing sensor online | ⬜ Pending |
| YoLink Developer Portal account created | ⬜ Pending |
| UAC app created, client_id + client_secret obtained | ⬜ Pending |
| `YOLINK_CLIENT_ID` set in .env | ⬜ Pending |
| `YOLINK_CLIENT_SECRET` set in .env | ⬜ Pending |
| `YOLINK_ENABLED=true` set in .env | ⬜ Pending |
| Hub account same as UAC app account | ⬜ Pending |
| Sensor device token known (for mapping) | ⬜ Pending |

---

## What Happens When Real YoLink Is Connected

| Event | System Response |
|---|---|
| First poll | Device discovered → stored in `sensors` table |
| Sensor reading | Normalized to °F → stored in `sensor_readings` table |
| Reading in range | Status=PASS, no alert |
| Reading out of range (5+ min) | Store alert → WhatsApp store group |
| Reading out of range (5+ min) + still failing | Manager alert → WhatsApp manager group |
| Employee daily entry | Cross-validation: human vs sensor compared |
| Mismatch detected | Employee asked to resolve |
| Sensor offline | Human entry used, sensor flagged OFFLINE |
| All sources fail | Manager alert, no silent override |

---

## Next: 7-Day Pilot

Once YoLink real-time test passes, proceed to PILOT_WEEK_REPORT.md for the 7-day pilot plan.