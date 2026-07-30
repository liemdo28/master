# WhatsApp Admin UI Report

**Generated:** 2026-06-12  
**Module:** `src/dashboard/admin-ui.js`, `src/dashboard/transport-panels.js`

---

## 1. Transport Panels Added

New file: [`src/dashboard/transport-panels.js`](../../src/dashboard/transport-panels.js)

Five new panels injected at the top of the dashboard (above existing WhatsApp diagnostics):

| Panel | ID | Description |
|---|---|---|
| WhatsApp Session | `#transport-session` | Heartbeat status, reconnect count, backoff state, session age, controls |
| Clients & API Keys | `#transport-clients` | All clients, status, key prefix, commands, env key, last used, rotate/revoke |
| Routing Status | `#transport-routing` | /agent→agent-coding, /mi→mi-core, food-safety→internal, isolation checks |
| Routing Traffic | `#transport-traffic` | Last 20 routed messages, status, latency, approval status |
| API Key Audit Log | `#transport-audit` | Last 20 audit events, client, action, result |

---

## 2. Session Panel Features

- **Connection status** badge (CONNECTED / DISCONNECTED / AUTH_REQUIRED)
- **Heartbeat** badge (ACTIVE / INACTIVE) with interval
- **Auto-reconnect** toggle status (ON/OFF), backoff sequence shown
- **Reconnect attempt count** with next delay
- **Session age** in human format (1h 23m)
- **Account name** and phone number
- **Session root path** and stored session status
- **Controls:** Connect, Reconnect, Restart, Reset Session (with confirm dialog)

---

## 3. Clients Panel Features

Table columns: Client ID, Status, Key Prefix, Allowed Commands, Env Key configured, Last Used

Actions per row:
- **Rotate** — calls `POST /api/clients/:id/rotate`, displays new raw key in alert (shown once)
- **Revoke** — calls `POST /api/clients/:id/revoke` with confirm dialog

Create new client form (inline, hidden by default):
- Fields: client_id, allowed_commands, description
- Calls `POST /api/clients`, displays generated raw key inline

---

## 4. Routing Status Panel Features

- Per-client card: /agent → Agent-Coding, /mi → Mi-Core, food-safety → internal
- Endpoint reachability status per client
- Env key configured badge
- Collapsible validation check table (from `/api/router/validate`)
- **Run Validation** button — triggers live check and shows PASS/FAIL inline

---

## 5. Traffic Panel Features

- Last 20 routed messages from `routed_messages` table
- Columns: Time, Status (OK/FAIL), Command, Target, Source chat, Approval status, Latency (ms)
- Link to full JSON: `/api/audit/messages`

---

## 6. Audit Log Panel Features

- Last 20 API key events from `api_key_audit` table
- Columns: Time, Result (OK/FAIL), Client ID, Action (CREATED/ROTATED/REVOKED/VALIDATED/FAILED), Detail
- Links to `/api/audit/api-keys` and `/api/audit/logs`

---

## 7. API Surface

All panels are backed by existing API endpoints — no new endpoints needed for UI:

| Panel | Endpoint |
|---|---|
| Session | `GET /api/whatsapp/session` (new) |
| Clients | `GET /api/clients` |
| Rotate key | `POST /api/clients/:id/rotate` |
| Revoke key | `POST /api/clients/:id/revoke` |
| Create client | `POST /api/clients` |
| Routing status | `GET /api/router/status` |
| Routing validation | `GET /api/router/validate` (new) |
| Traffic | `GET /api/audit/messages` |
| Audit log | `GET /api/audit/api-keys` |

---

## 8. Verdict

**COMPLETE.** Admin UI now covers all six required areas: Clients, API Keys, Routing Status, Session Status, Traffic, Audit Logs.
