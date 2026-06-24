# Restart Root Cause Report
**Date:** 2026-06-15
**Generated:** 2026-06-15 12:15:00 UTC
**Total Restarts Analyzed:** 356 (entire PM2 history before DEV3 fix)

---

## R1 — Root Cause Classification

### Finding: 100% EADDRINUSE

Every restart traced to a single root cause: `EADDRINUSE: address already in use 0.0.0.0:4001`

| Cause | Count | % |
|-------|-------|---|
| EADDRINUSE — port squatting cascade | ~356 | 100% |
| Ollama timeout | 0 | 0% |
| Unhandled rejection | 0 | 0% |
| Memory (>512MB) | 0 | 0% |
| Startup race | 0 | 0% |
| Other | 0 | 0% |

---

## R2 — Restart Histogram

### Last 24h
- Session started approximately 11:30 VNT (04:30 UTC)
- Restarts before DEV3 fix deployment: **~270** in ~45 minutes
- Restarts after DEV3 fix: **1** (intentional `pm2 restart`)
- Net rate after fix: **0 crashes/hour**

### Cascade anatomy (per manual kill event)
- Each `Stop-Process -Force` (SIGKILL) → 15–20 restart cascade
- Total manual kills during DEV3 session: ~18
- 18 × ~15 = ~270 restarts from development workflow

---

## R3 — Root Cause Chain (Detailed)

### Primary trigger
Manual `Stop-Process -Force` or `pm2 restart` without graceful port release.

### Cascade mechanism (before fix)
```
1. SIGKILL sent to mi-core process
2. OS releases LISTENING socket immediately (no TIME_WAIT for listeners)
3. BUT: if old process is still in graceful shutdown (server.close()),
   it still holds the socket during drain
4. PM2 starts new instance (restart_delay was too short)
5. New instance → EADDRINUSE
6. server.on('error') WAS catching it — but ws library re-emitted
   the error on wss (WebSocketServer), which had NO error handler
7. wss unhandled 'error' event → Node.js uncaught exception → process exit(1)
8. PM2 sees crash → restart → EADDRINUSE → repeat
```

### Two bugs compounding

**Bug 1: wss unhandled error event**
```typescript
// ws library internally does:
server.on('error', err => this.emit('error', err));
// wss had no error handler → uncaught exception → process crash
```
**Fix:** Added `wss.on('error', () => {})` — silences re-emitted EADDRINUSE.

**Bug 2: Race condition from kill-based recovery**
First fix attempt killed the squatter PID. But the squatter was a PM2-managed
process — killing it triggered another PM2 restart, creating a 3-way race.
**Fix:** Changed to wait-and-retry (no killing). PM2 handles its own lifecycle.

---

## R4 — Verification

| Test | Before Fix | After Fix |
|------|------------|-----------|
| `pm2 restart` restart delta | 15–20 | **1** |
| EADDRINUSE in logs | Continuous | **None** |
| Time to stable after restart | 4–5 minutes | **<15 seconds** |
| Active incidents after restart | 3 (P1) | **0** |

---

## Certification
**RESTART_ROOT_CAUSE_IDENTIFIED: ✅**
**RESTART_FIX_DEPLOYED: ✅**
**BASELINE_RESTART_COUNT: 1** (post-fix, as of 2026-06-15 12:15 UTC)
