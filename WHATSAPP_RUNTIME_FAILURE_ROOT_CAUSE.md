# WhatsApp Runtime Failure — Root Cause Analysis

**Date**: 2026-06-18  
**Status**: ROOT CAUSE IDENTIFIED  
**Severity**: P0 — Production Down

---

## Observed Failure

```
User sends:  "Mi ơi, service nào đang down?"
Response:    "Mi-Core is temporarily unavailable"
```

---

## Root Cause Summary

| # | Root Cause | Confidence |
|---|---|---|
| 1 | **WhatsApp AI Gateway process NOT running** — PM2 has zero app processes active | CONFIRMED |
| 2 | **start.bat does NOT start WhatsApp Gateway** — only starts mi-core, ai-service, agent-engine | CONFIRMED |
| 3 | **No scheduled task for WhatsApp Gateway** — `schtasks` query returns empty for both "Mi Ultimate" and "WhatsApp AI Gateway" | CONFIRMED |
| 4 | **Mi-Ultimate.vbs autostart only launches start.bat** — which does not include gateway | CONFIRMED |
| 5 | **Gateway → Mi-Core timeout (15s)** when Mi-Core is slow/down produces fallback error | CONFIRMED (code) |
| 6 | **Chat queue timeout (90s)** or **Ollama timeout** causes graceful error reply | CONFIRMED (code) |

---

## Failure Chain

```
CEO sends WhatsApp message
        │
        ▼
WhatsApp AI Gateway (port 3211) — PROCESS NOT RUNNING
        │ IF running:
        ▼
Gateway receives message → routes to Mi-Core (POST http://localhost:4001/api/whatsapp/mi)
        │
        ▼ (TIMEOUT_MS = 15,000ms)
If Mi-Core unreachable → forwarder returns { ok: false, reply: null }
        │
        ▼
message-listener.js → sendMiForwardResult() → failure reply SUPPRESSED (since reply is null for mi-core)
        │
        ▼
No response delivered to CEO — OR —
Previous version (before outbound send guard) delivered "Mi-Core is temporarily unavailable"
```

---

## Evidence: Current PM2 State

```
$ pm2 list
┌────┬──────────────────┬─────────────┬─────────┬─────────┐
│ id │ name             │ status      │ pid     │ uptime  │
└────┴──────────────────┴─────────────┴─────────┴─────────┘
(EMPTY — no app processes)
```

Only `pm2-logrotate` module is online.

---

## Evidence: Autostart Configuration

**Windows Startup folder** (`Mi-Ultimate.vbs`):
```vbs
shell.Run "cmd /c ""E:\Project\Master\mi-core\start.bat""", 0, False
```

**start.bat launches**:
1. Docker big data infra (PostgreSQL/MinIO/Qdrant) — optional
2. Python AI Service (port 4002)
3. Agent Engine Bridge (port 4003)
4. Mi Server (port 4001)

**MISSING**: WhatsApp AI Gateway (port 3211) is NOT started by start.bat

---

## Evidence: "temporarily unavailable" Text Origin

The exact phrase `"Mi-Core is temporarily unavailable"` is **NOT** present in any current source file. However, it IS listed in **BLOCKED_USER_FACING_PATTERNS** in:
- `session-manager.js:36` — outbound send guard
- `reply-service.js:9` — reply send guard

This means:
1. The text existed in a **previous version** of `agent-mi-forwarder.js` `safeErrorReply()` function
2. The current version replaced it with Vietnamese graceful degradation messages
3. The blocking patterns were added as a safety net to prevent any residual occurrence

---

## Evidence: Gateway Process State

**Session file** (`data/whatsapp/session.json`):
```json
{
  "state": "READY",
  "connection_status": "CONNECTED",
  "account_name": "Liem Do",
  "phone_number": "84584902302@c.us",
  "session_started_at": "2026-06-18T05:56:45.276Z",
  "last_connected_at": "2026-06-18T05:56:45.681Z"
}
```

Session was last active at 05:56 UTC (12:56 VN time) — then gateway process terminated.

---

## Failure Scenarios That Produce "temporarily unavailable"

| Scenario | Pipeline Stage | Error Type |
|---|---|---|
| Gateway not running | No process | Message never received |
| Mi-Core not running | Gateway → Mi-Core HTTP | `ECONNREFUSED` → timeout |
| Mi-Core overloaded | chat-queue.ts | `ChatQueueFullError` or `ChatTimeoutError` |
| Ollama down/slow | pipeline execution | Timeout after 90s |
| Gateway Chrome crash | Puppeteer process | Session lost, messages not received |
| Network interruption | WhatsApp WebSocket | Disconnect event → reconnect loop |

---

## Fix Required

1. **Add WhatsApp AI Gateway to start.bat** — or use PM2 ecosystem
2. **Configure PM2 startup persistence** (`pm2 save && pm2 startup`)
3. **Set `WHATSAPP_HEADLESS=true`** in gateway environment
4. **Start PM2 ecosystem with all processes** including gateway
5. **Verify scheduled task or startup folder entry includes gateway**
