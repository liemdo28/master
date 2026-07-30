# SOURCE_AUDIT_RUNTIME_HEALTH.md
> Mi Company OS — Runtime Health Audit
> Date: 2026-06-18
> Timestamp: 2026-06-18T04:37:00Z

---

## PM2 Process List

```
┌────┬──────────────────────┬──────────┬─────────┬────────┬───────────┐
│ id │ name                 │ pid      │ uptime  │ ↺      │ status    │
├────┼──────────────────────┼──────────┼─────────┼────────┼───────────┤
│ 3  │ mi-accounting        │ N/A      │ 9m      │ 3      │ online    │
│ 1  │ mi-core              │ 18620    │ 9m      │ 22     │ online    │
│ 4  │ whatsapp-ai-gateway  │ 14236    │ 9m      │ 3      │ online    │
│ 0  │ pm2-logrotate        │ 28972    │ —       │ 0      │ online    │
└────┴──────────────────────┴──────────┴─────────┴────────┴───────────┘
```

**Not in PM2:** mi-ceo-observer, mi-ai-service, mi-node-agent (these are defined in ecosystem.config.js but not currently running)

---

## Port Verification

| Port | Owner PID | PM2 PID | Match |
|------|-----------|---------|-------|
| 4001 | 18620 | 18620 | ✅ MATCH |
| 3211 | 14236 | 14236 | ✅ MATCH |
| 8844 | N/A | N/A (mi-accounting shows online but no PID) | ⚠️ |

**No zombie processes detected** — EADDRINUSE retry loop fixed (max 3 attempts → exit).

---

## Health Endpoint Results

### Port 4001 — Mi-Core Server
```
GET http://localhost:4001/api/health
{
  "server": "ok",
  "python_ai_service": "down",
  "ollama": "ok",
  "timestamp": "2026-06-18T04:37:46.719Z"
}
```
**Verdict: ✅ HEALTHY** (python_ai_service down is known — mi-ai-service not in PM2)

### Port 3211 — WhatsApp AI Gateway
```
GET http://localhost:3211/health
{
  "ok": true,
  "runtime": {
    "pid": 14236,
    "uptime_seconds": 579,
    "whatsapp_ready": true,
    "whatsapp_status": "ready",
    "google_sheets_ready": true,
    "ocr_ready": true
  },
  "whatsapp": "ready"
}
```
**Verdict: ✅ HEALTHY**

---

## Self-Healing Monitor
```
GET http://localhost:4001/api/company-os/monitor
{
  "status": "DEGRADED",
  "healthy": 5,
  "down": 6,
  "total": 11
}
```

| Service | Healthy | Restart Count |
|---------|---------|---------------|
| Mi Core Server | ✅ | 0 |
| WhatsApp Gateway | ✅ | 0 |
| Accounting Engine (PM2) | ✅ | 0 |
| CEO Observer | ❌ | 1 |
| Mi Core HTTP | ❌ | 0 |
| Accounting HTTP | ❌ | 0 |
| Ollama AI | ✅ | 0 |
| Food Safety Gateway | ❌ | 1 |
| QB Ops Agent | ❌ | 1 |
| Evidence DB | ✅ | 0 |
| Knowledge DB | ❌ | 0 |

**Overall: DEGRADED** — Core services (mi-core, whatsapp, ollama) all healthy. Supporting services (food-safety, qb-ops, ceo-observer) down.

---

## PM2 Log Summary

**mi-core:**
- Boot sequence complete: all phases initialized (briefing, graph, memory, health, twin)
- BigData Foundation initialized
- [P0-SCRUB] active — redacting secrets from LLM context
- [O4-LATENCY] RED on some AI inference calls (>15s threshold)

**whatsapp-ai-gateway:**
- WhatsApp: ready ✅
- SQLite WARN on startup: ALTER TABLE idempotent migrations (non-blocking)
- Template sync WARN: Google Sheets range parse error (non-blocking)

---

## Restart Count Analysis

| Service | Restart Count | Root Cause |
|---------|--------------|-----------|
| mi-core | 22 | EADDRINUSE zombie loop (fixed in this session) |
| whatsapp-ai-gateway | 3 | Normal PM2 restarts |
| mi-accounting | 3 | Port 8844 binding issue |

**Restart count 22 for mi-core** is elevated due to the zombie process bug that was fixed during Phase 14 testing. The bug (infinite EADDRINUSE retry) has been patched — future restarts should be clean.

---

## Zombie/EADDRINUSE Status

**Status: ✅ CLEAN** — No zombie processes. Port 4001 PID matches PM2 PID exactly.

The EADDRINUSE infinite retry loop was the root cause of zombie accumulation during the Phase 14 testing session. Fix applied: `startHttpServer()` now exits after 3 failed bind attempts instead of retrying infinitely.
