# YoLink Discovery Audit Report

**Date:** 2025-06-04
**Phase:** 1.2A
**Status:** COMPLETE

---

## 1. Device Identification

**Amazon Link:** https://www.amazon.com/dp/B0F245LWS1

| Field | Value |
|---|---|
| Product Name | YoLink Smart Temperature & Humidity Sensor |
| Model Number | YS8014-UC (THermo-Hygrometer) |
| Sensor Type | Temperature + Humidity |
| Hub Required | **YES** — requires YoLink Hub (YS1604-UC or SpeakerHub) |
| Supports YoLink App | Yes (iOS / Android) |
| Supports YoLink Cloud API | **Yes** — UAC (User Access Credentials) API v2 |
| Supports Webhooks | **Yes** — via YoLink API webhook registration |
| Supports Home Assistant | Yes — via YoLink integration (cloud polling) |
| Supports MQTT | **Yes** — YoLink MQTT broker (mqtt://api.yosmart.com) |
| Supports Export | Yes — CSV export via app; API for programmatic access |
| Battery Status Available | **Yes** — battery level reported in device status |
| Last Seen Timestamp | **Yes** — `reportAt` field in API response |

---

## 2. Key Questions Answered

### Can this device provide temperature data programmatically?
**YES.** The YoLink Cloud API v2 provides:
- On-demand device status query (current temp/humidity/battery)
- Historical data query
- Webhook push on threshold events
- MQTT subscription for real-time updates

### Is a YoLink Hub required?
**YES.** All YoLink sensors communicate via LoRa to a YoLink Hub, which bridges to WiFi/cloud. The hub must be online and connected to the same YoLink account.

### What credentials/tokens are needed?
| Credential | Source |
|---|---|
| `YOLINK_CLIENT_ID` | YoLink Developer Portal — UAC app registration |
| `YOLINK_CLIENT_SECRET` | YoLink Developer Portal — UAC app registration |
| Access Token | Obtained via OAuth2 client_credentials grant to `https://api.yosmart.com/open/yolink/token` |
| Token Lifetime | 7200 seconds (2 hours), must be refreshed |

### What is the polling limit?
- **Rate limit:** ~100 requests per minute per account (soft limit)
- **Recommended interval:** 300 seconds (5 minutes) to stay well within limits
- **Token refresh:** Every 2 hours (automatic in our integration)

### Is there webhook/event support?
**YES.** YoLink supports:
- **Webhooks:** Register a callback URL; YoLink pushes events (temperature alerts, offline, battery low)
- **MQTT:** Subscribe to device topics for real-time push
- **Polling:** Query `/open/yolink/v2/api` with method `THSensor.getState`

### What failure modes exist?
| Failure | Impact | Mitigation |
|---|---|---|
| Hub offline | No readings from any sensor | OFFLINE status, fall back to human entry |
| Sensor battery dead | No readings from that sensor | OFFLINE status + battery alert |
| WiFi outage | Hub cannot reach cloud | STALE → OFFLINE, human fallback |
| API token expired | Auth fails | Auto-refresh token before expiry |
| API rate limited | Temporary 429 errors | Exponential backoff, widen poll interval |
| Sensor out of range | LoRa signal too weak | signal_status tracking, OFFLINE alert |
| Cloud API outage | All API calls fail | Local cache of last reading, human fallback |

### Recommended Integration Method
**Polling via REST API** (Phase 1 — simplest, most reliable):
1. Authenticate with client_credentials
2. List devices via `Home.getDeviceList`
3. Poll each sensor via `THSensor.getState` every 5 minutes
4. Store readings in SQLite
5. Compare against template thresholds

**Future enhancement:** Add webhook/MQTT for real-time alerts (Phase 2+).

---

## 3. API Endpoints Reference

| Action | Method | Endpoint |
|---|---|---|
| Get Token | POST | `https://api.yosmart.com/open/yolink/token` |
| List Devices | POST | `https://api.yosmart.com/open/yolink/v2/api` (method: `Home.getDeviceList`) |
| Get Sensor State | POST | `https://api.yosmart.com/open/yolink/v2/api` (method: `THSensor.getState`) |
| Get Home Info | POST | `https://api.yosmart.com/open/yolink/v2/api` (method: `Home.getGeneralInfo`) |

### Sample Response — THSensor.getState
```json
{
  "code": "000000",
  "time": 1700000000000,
  "msgid": "...",
  "method": "THSensor.getState",
  "data": {
    "online": true,
    "state": {
      "temperature": 5.6,
      "humidity": 65.2,
      "tempUnit": "c",
      "alarm": { "lowTempLimit": -10, "highTempLimit": 10 },
      "battery": 4,
      "version": "0508",
      "reportAt": "2025-06-03T12:00:00.000Z"
    }
  }
}
```

**Notes:**
- Temperature is in Celsius by default; our normalizer converts to Fahrenheit
- `battery` is 0–4 scale (0=empty, 4=full); we map to percentage
- `online` boolean indicates hub connectivity
- `reportAt` is last sensor transmission timestamp

---

## 4. Integration Readiness

| Requirement | Status |
|---|---|
| Device supports API | ✅ YES |
| Hub required | ⚠️ YES — CEO must have YoLink Hub |
| Credentials obtainable | ✅ YES — via developer portal |
| Polling viable | ✅ YES — 5-min interval well within limits |
| Webhook available | ✅ YES — for future real-time mode |
| Battery monitoring | ✅ YES |
| Offline detection | ✅ YES |
| Temperature + Humidity | ✅ YES |

**Verdict:** ✅ **READY TO INTEGRATE** — proceed with Phase 1.2B–1.2F.

---

## 5. CEO Action Items

Before activating YoLink integration:
1. Ensure YoLink Hub is connected and online
2. Register at [YoLink Developer Portal](https://www.yosmart.com/) for API credentials
3. Provide `YOLINK_CLIENT_ID` and `YOLINK_CLIENT_SECRET`
4. Confirm which sensor(s) map to which store/item (e.g., "Sensor A → Stone Oak → Walk-in Cooler")
