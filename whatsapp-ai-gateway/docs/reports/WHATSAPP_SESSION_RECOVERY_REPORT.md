# WhatsApp Session Recovery Report

**Generated:** 2026-06-12  
**Module:** `src/whatsapp/session-manager.js`

---

## 1. Session Persistence Architecture

| Layer | Implementation | Survival |
|---|---|---|
| Auth tokens | WhatsApp Web.js `LocalAuth` | Persisted to `PROGRAMDATA/BakudanFoodSafety/whatsapp/auth/` |
| Session metadata | `session.json` in session root | Written on every `ready` and `authenticated` event |
| Auth state flag | `auth-state.json` | Written alongside session.json |
| Legacy migration | Auto-migrates `.wwebjs_auth`, `./data/session`, `./LocalAuth` | Runs once on first boot if new path is empty |

**Session root path** (env-configurable):
```
WHATSAPP_SESSION_ROOT (default: PROGRAMDATA/BakudanFoodSafety/whatsapp)
```

Storing in `PROGRAMDATA` ensures session survives:
- App updates (project directory changes)
- `npm install` / dependency upgrades
- Git checkouts / pulls

---

## 2. Auto-Reconnect with Exponential Backoff

**Before hardening:** Fixed 15s reconnect delay.

**After hardening:** Exponential backoff sequence:

| Attempt | Delay |
|---|---|
| 1 | 15s |
| 2 | 30s |
| 3 | 60s |
| 4+ | 120s (capped) |

Reset to attempt 1 on every successful `ready` event.

**Telegram alert:** Sent every 3 reconnect attempts (configurable via `MAX_RECONNECT_ALERTS`).

**Disable:** `AUTO_RECONNECT=false` in `.env`.

---

## 3. Heartbeat Watchdog

Added: `startHeartbeat()` — starts on `ready`, stops on `destroyClient()`.

**Interval:** 60s (configurable: `WHATSAPP_HEARTBEAT_MS`)

**Probe:** `client.getState()` — native WhatsApp Web.js state query.

**Recovery triggers on:**
- `null` state (process died silently)
- `CONFLICT` (another session took over)
- `UNPAIRED` (device unlinked)

On trigger: calls `scheduleReconnect()` with exponential backoff.

---

## 4. Restart / Windows Reboot Recovery

On server start, `init()` calls `createClient()` which:
1. Creates dirs if missing
2. Calls `migrateLegacySessionIfNeeded()` — moves session to standard path
3. Initializes `Client` with `LocalAuth` pointing at `SESSION_DIR`

`LocalAuth` reads the persisted auth tokens → no QR scan needed after restart, if auth files are intact.

**Verified scenarios:**
- App restart (`pm2 restart`) → session restores, no QR
- Windows reboot → session restores from PROGRAMDATA (no QR)
- App update → session path unchanged (in PROGRAMDATA), no QR
- QR required only if auth files deleted (`POST /api/whatsapp/reset-session`)

---

## 5. New API Endpoint

```
GET /api/whatsapp/session
```

Returns extended session status:
```json
{
  "ok": true,
  "session": {
    "state": "READY",
    "connection_status": "CONNECTED",
    "heartbeat_active": true,
    "reconnect_count": 0,
    "next_reconnect_delay_ms": 15000,
    "heartbeat_interval_ms": 60000,
    "auto_reconnect": true,
    "account_name": "...",
    "phone_number": "...",
    "session_age_seconds": 3600,
    "has_stored_session": true,
    "session_root": "C:\\ProgramData\\BakudanFoodSafety\\whatsapp"
  }
}
```

---

## 6. Verdict

**HARDENED.** Session survives app restart, Windows reboot, and app update. Heartbeat watchdog catches silent crashes. Exponential backoff prevents reconnect storms.
