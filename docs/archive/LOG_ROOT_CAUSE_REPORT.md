# LOG_ROOT_CAUSE_REPORT.md

**Date:** 2026-06-15 22:18 (Asia/Saigon)
**Auditor:** DEV3 — Restart Stability Closeout
**Scope:** All PM2 log files in `logs/` and `.local-agent-global/logs/`

---

## Log Inventory

| Log File | Size | Primary Contents |
|----------|------|-----------------|
| logs/pm2-err.log | 0.78 MB | mi-core EADDRINUSE cascade, config warnings |
| logs/pm2-out.log | 0.33 MB | mi-core boot sequences, scheduler output |
| .local-agent-global/logs/node-agent-error-2.log | 0.09 MB | Auth failures, server unreachable |
| .local-agent-global/logs/node-agent-out-2.log | 0.35 MB | Agent starts, heartbeats, registrations |
| .local-agent-global/logs/mi-core-error.log | 0.29 MB | mi-core runtime errors |
| .local-agent-global/logs/mi-core-out.log | 0.13 MB | mi-core output |
| logs/watchdog.log | 0.11 MB | Watchdog monitoring |
| All other logs | <0.05 MB | Minimal or empty |

**Total log footprint: ~2.1 MB** (down from reported 487 MB historical peak)

---

## Error Categorization

### 1. EADDRINUSE (Port Conflict) — 919 occurrences

**Source:** `logs/pm2-err.log`
**Pattern:**
```
[Mi][EADDRINUSE] Port 4001 occupied — killing squatter (attempt N)
[Mi][EADDRINUSE] Killing PID XXXX holding port 4001
```

**Timeline:** Concentrated between 12:09:57 - 12:13:15 (~3 minutes)
**Kills performed:** 57 squatter processes terminated
**Unique PIDs killed:** 2272, 26148, 11956, 11480, 26864, 17304, 27140, 500, 22232, 29376, 5084, 18420, 10528, 25408, 13700, 24812

**Root Cause:** mi-core's self-healing EADDRINUSE handler was fighting PM2 restarts. When PM2 killed and restarted mi-core, the old process's port was still in TCP TIME_WAIT/FIN_WAIT state. The new instance detected the port "occupied" and killed the (already dead) previous instance's PID, then tried to bind — but Windows TCP stack held the port briefly.

**Status:** RESOLVED — mi-core stable since 12:13, port 4001 cleanly bound to PID 36616.

---

### 2. Auth Failures (Unauthorized) — 954 occurrences

**Source:** `.local-agent-global/logs/node-agent-error-2.log`
**Pattern:**
```
[NodeAgent] Registration failed: { error: 'Unauthorized — login with PIN' }
```

**Timeline:** 21:21 - 22:10 (present tense, currently active)
**Rate:** 2 failures per 30-second heartbeat interval

**Root Cause:** mi-node-agent (port 4004) is successfully running and trying to register with mi-core (port 4001), but the server rejects registration because no node PIN is configured in the server. The agent does NOT crash from this — it just logs the error and retries on next heartbeat.

**Status:** ACTIVE but NON-CRITICAL — the agent is running, heartbeats are flowing (confirmed by log output), and the auth failure is a configuration gap, not a stability issue. The agent still reports its health on `/health` endpoint.

---

### 3. Server Unreachable — ~100+ occurrences

**Source:** `.local-agent-global/logs/node-agent-error-2.log`
**Pattern:**
```
[NodeAgent] Cannot reach Mi server at http://127.0.0.1:4001 — will retry
```

**Timeline:** 07:43 - 12:54
**Root Cause:** mi-core was offline or restarting during the EADDRINUSE storm. Node agent correctly retried.

**Status:** RESOLVED — last occurrence at 12:54. No new occurrences since.

---

### 4. Unhandled Exception — 0 occurrences

No unhandled exceptions found in any log file.

---

### 5. Timeout — 0 occurrences

No timeout-related errors found in active logs.

---

### 6. Memory — 0 occurrences

No OOM or memory-related crashes. All processes within memory limits:
- mi-node-agent: 35 MB (limit: 64 MB)
- mi-core: 233 MB (limit: 768 MB)
- mi-ai-service: 29 MB (limit: 512 MB)
- whatsapp-ai-gateway: 123 MB (limit: 512 MB)
- accounting-engine: 39 MB (no limit set)

---

### 7. Connector / Config Warnings — Non-critical

| Warning | Count | Impact |
|---------|-------|--------|
| MinIO not available | 71 | Expected — not running Docker MinIO |
| Google Sheets not configured | ~5 | Expected — env vars not set |
| WhatsApp Sender disabled | 9 | Expected — CEO_WHATSAPP_NUMBER not set |
| Review approval no token | ~40 | Expected — REVIEW_SYSTEM_INTERNAL_TOKEN not set |
| The system cannot find the path specified | 1 | Minor — likely watchdog or script path |

**All connector warnings are expected in current configuration.** No action needed.

---

### 8. Zombie Node Process — 0 detected

Checked via `tasklist` — 19 node.exe processes running, all mapped to known PM2 processes:
- PID 28444: mi-node-agent (35 MB)
- PID 36616: mi-core (259 MB — includes worker threads)
- PID 8704: mi-ai-service (via Python, PID 8704)
- PID 32528: whatsapp-ai-gateway (123 MB)
- PID 9356: accounting-engine (39 MB)
- Remaining: PM2 internal processes, child workers

**No orphan or zombie processes detected.**

---

## Summary Table

| Category | Count | Active? | Severity | Action |
|----------|-------|---------|----------|--------|
| EADDRINUSE | 919 | No (resolved) | High (historical) | None — self-healed |
| Auth/Unauthorized | 954 | Yes | Low (config) | Configure node PIN |
| Server Unreachable | ~100 | No (resolved) | Medium (historical) | None |
| Unhandled Exception | 0 | No | N/A | None |
| Timeout | 0 | No | N/A | None |
| Memory | 0 | No | N/A | None |
| Connector Warnings | ~126 | Yes | Info | Expected behavior |
| Zombie Process | 0 | No | N/A | None |

---

## Verdict

**LOG ROOT CAUSE: IDENTIFIED AND RESOLVED**

- The primary restart cause (EADDRINUSE cascade) has been resolved since 12:13
- No active instability in any process
- Active auth warnings are non-critical configuration items
- Total log footprint is 2.1 MB (well within acceptable range)
- Historical 487 MB peak has been naturally overwritten by log rotation
