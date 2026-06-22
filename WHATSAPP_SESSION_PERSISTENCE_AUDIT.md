# WhatsApp Session Persistence Audit

**Date**: 2026-06-18  
**Status**: SESSION EXISTS — PROCESS MANAGEMENT MISSING

---

## Session Storage

| Property | Value |
|---|---|
| Session path | `E:\Project\Master\mi-core\services\whatsapp-ai-gateway\data\whatsapp\auth\session-bakudan-food-safety\` |
| Persistence mechanism | `whatsapp-web.js` `LocalAuth` strategy (Chrome profile on disk) |
| Client ID | `bakudan-food-safety` |
| Session root | `E:\Project\Master\mi-core\services\whatsapp-ai-gateway\data\whatsapp` |
| Cache dir | `E:\Project\Master\mi-core\services\whatsapp-ai-gateway\data\whatsapp\cache` |
| Meta file | `data/whatsapp/session.json` |
| Auth state file | `data/whatsapp/auth-state.json` |

---

## Session State (from session.json)

```json
{
  "client_id": "bakudan-food-safety",
  "state": "READY",
  "connection_status": "CONNECTED",
  "account_name": "Liem Do",
  "phone_number": "84584902302@c.us",
  "session_started_at": "2026-06-18T05:56:45.276Z",
  "last_connected_at": "2026-06-18T05:56:45.681Z",
  "last_saved_at": "2026-06-18T05:56:45.833Z"
}
```

**Interpretation**: Session was active at 12:56 VN time today. Gateway process has since terminated (PM2 shows 0 processes). Session data remains on disk.

---

## Auth State (from auth-state.json)

```json
{
  "client_id": "bakudan-food-safety",
  "has_local_auth": true,
  "saved_at": "2026-06-18T05:56:45.833Z",
  "session_dir": "E:\\Project\\Master\\mi-core\\services\\whatsapp-ai-gateway\\data\\whatsapp\\auth"
}
```

---

## Recovery Process

```javascript
// session-manager.js:129-151 — migrateLegacySessionIfNeeded()
// On init, checks for stored session in SESSION_DIR
// If found: reuses session → no QR scan needed
// If not found: checks legacy paths (.wwebjs_auth, data/session, LocalAuth)

// session-manager.js:113-116 — hasStoredSession()
function hasStoredSession() {
  const localAuthDir = path.join(SESSION_DIR, `session-${CLIENT_ID}`);
  return fs.existsSync(localAuthDir) || fs.existsSync(SESSION_META_FILE) || fs.existsSync(AUTH_STATE_FILE);
}
```

---

## Expiration Handling

| Scenario | Behavior | Source |
|---|---|---|
| Phone offline <14 days | Session remains valid, reconnects on restart | WhatsApp protocol |
| Phone offline >14 days | Session expires, QR scan required | WhatsApp protocol |
| Phone logged out | `auth_failure` event → state AUTH_FAILURE, QR required | `session-manager.js:322` |
| Browser crash | `disconnected` event → auto-reconnect if `AUTO_RECONNECT !== 'false'` | `session-manager.js:328-336` |
| WhatsApp Web conflict | `CONFLICT` state → heartbeat detects → scheduleReconnect | `session-manager.js:383` |

---

## Survival Test Results

| Test | Expected | Result |
|---|---|---|
| Session survives PM2 restart | ✅ Yes (LocalAuth persists to disk) | **THEORETICAL PASS** — no PM2 processes to test |
| Session survives gateway restart | ✅ Yes (session data on filesystem) | **THEORETICAL PASS** — session files exist |
| Session survives server restart | ✅ Yes (independent processes) | **THEORETICAL PASS** |
| Session survives PC reboot | ✅ Yes (files persist) BUT process must restart | **FAIL** — no autostart for gateway |

---

## Proof of Session Existence

```
Directory: E:\Project\Master\mi-core\services\whatsapp-ai-gateway\data\whatsapp\auth\session-bakudan-food-safety\
Last modified: 2026-06-18 02:15 PM (today)
```

The session directory exists and was written to today. The Chrome profile data (cookies, localStorage, WebSocket tokens) should allow reconnection without QR scan when the gateway process restarts.

---

## Conclusion

```
SESSION PERSISTENCE: IMPLEMENTED CORRECTLY IN CODE
OPERATIONAL STATUS: CANNOT BE TESTED — GATEWAY NOT RUNNING
```

The session persistence mechanism is sound:
- Files are stored on disk using `LocalAuth`
- `hasStoredSession()` correctly detects saved sessions
- Auto-migration from legacy paths is implemented
- Session metadata is tracked in `session.json`

The failure is NOT in session persistence — it is in **process management**. The gateway simply is not being started.
