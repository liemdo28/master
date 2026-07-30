# QB_HEARTBEAT_RECOVERY_REPORT

**Generated:** 2026-06-15T17:32:00+07:00
**Scope:** Heartbeat blockage diagnosis and recovery plan
**Result:** SERVER-SIDE RECOVERY COMPLETE — remote agent recovery requires Dev1 action

---

## Executive Summary

The QB heartbeat pipeline is architecturally sound. Mi-Core's `/api/qb-agent/heartbeat` endpoint receives, validates, persists, and forwards heartbeats to Google Sheets correctly. The heartbeat blockage is caused by the **remote Laptop1 agent stopping**, not by any server-side failure. Recovery requires physical access to Laptop1.

---

## Heartbeat Architecture

```
Laptop1 (Stockton_Laptop, 100.118.102.113)
  └─ MiCore-QB-Heartbeat-Bridge (Windows Scheduled Task, every 1 min)
       └─ send-qb-heartbeat.ps1
            ├─ Checks for QBW.EXE process
            ├─ Builds JSON body (machine_id, store_code, status, qb_open, qb_company)
            └─ POST http://100.118.102.113:4001/api/qb-agent/heartbeat
                 │
Mi-Core Server (this host, 0.0.0.0:4001)
  └─ qb-agent.ts → POST /heartbeat
       ├─ INSERT INTO heartbeats (machine_id, status, qb_open, ...)
       ├─ UPDATE machines SET status='online', last_heartbeat=?, last_seen_at=?
       └─ sheetSync.onHeartbeat() → Google Sheets (fire-and-forget)
```

---

## Current Heartbeat State

| Field | Value |
|---|---|
| Machine ID | `qb-laptop-01` |
| Machine Name | QB Laptop 1 |
| Hostname | Stockton_Laptop |
| Store Code | `raw-stockton` |
| Store Name | Raw Japanese Bistro and Sushi Bar |
| Status (DB) | `online` |
| Total Heartbeats Received | 859 |
| Last Heartbeat | `2026-06-15T05:48:29Z` |
| Minutes Since Last HB | **282 minutes (4.7 hours)** |
| QB Desktop Status | `qb_open=0` (not running) |
| Bridge IP | `100.118.102.113` (Tailscale) |
| Bridge Reachability | **UNREACHABLE** |

---

## Heartbeat Timeline Analysis

### Phase 1: Initial Registration (2026-06-14)
```
15:10:55Z — First heartbeat, qb_open=1, QB_READY
```
Initial setup. QB Desktop was open during DEV1_LAPTOP1_QB_FINALIZE.ps1 execution.

### Phase 2: Overnight Gap (745 minutes)
```
15:10:55Z → 03:35:56Z = 745 minutes (12.4 hours)
```
Laptop went to sleep/shutdown overnight. This is normal behavior — the bridge cannot run when the laptop is off.

### Phase 3: Bridge Resumed (2026-06-15 03:35-04:04)
```
03:35:56Z — Bridge resumes
03:44:14Z — 8-minute gap (possible task hiccup)
03:47:06Z — Heartbeats resume steadily (~1/minute)
03:58:29Z — BACKGROUND_AGENT_STARTED event received
04:04:13Z — Last BACKGROUND_AGENT_HEARTBEAT event received
```
The background agent on Laptop1 was actively running and reporting.

### Phase 4: Active Heartbeats (04:04-05:48)
```
05:39:08Z — QB_READY (qb_open=1) ← QB Desktop was running
05:39:14Z — ok (qb_open=0)
05:40:08Z — QB_READY (qb_open=1)
05:40:16Z — ok (qb_open=0)
... (alternating pattern — QB Desktop opening/closing or detection flapping)
05:48:09Z — QB_READY (qb_open=1) ← Last heartbeat with QB open
05:48:29Z — ok (qb_open=0) ← FINAL heartbeat
```

**Pattern observed:** QB Desktop was alternating between open/closed states every ~1 minute. This suggests either:
- The user was opening/closing QB repeatedly
- The QBW.EXE process detection was flapping (QB starting then crashing)
- Or the laptop was about to go to sleep and processes were shutting down

### Phase 5: Dead Zone (05:48 → present)
```
05:48:29Z → 10:31Z = 282 minutes (4.7 hours) — NO HEARTBEATS
```
The heartbeat bridge stopped completely. Laptop1 is unreachable via Tailscale.

---

## "Outbox Pending 1268" Investigation

The task brief references "outbox pending 1268". Investigation findings:

1. **Server-side has no outbox queue.** The `qbAgentSheetSyncService.ts` uses fire-and-forget async writes to Google Sheets. There is no pending queue, no retry buffer, no backpressure mechanism.

2. **Database contains 859 heartbeats + 11 events + 2 sync results + 26 doordash syncs** — total ~898 records. Not 1268.

3. **The "1268 pending" likely refers to the Laptop1-side `reporting_outbox`** in `background_agent.py`:
   ```powershell
   # From DEV1_LAPTOP1_QB_FINALIZE.ps1, Section 3:
   & $Python -c "from services.reporting_outbox import get_outbox; print(get_outbox().flush())"
   ```
   This is a Python-side queue that batches report files before uploading. Since the laptop is offline, any outbox items there cannot be flushed.

4. **Resolution:** The outbox can only be flushed when Laptop1 is online and connected to Mi-Core. Run the flush command from `DEV1_LAPTOP1_QB_FINALIZE.ps1` after confirming connectivity.

---

## Recovery Checklist

### Server-Side (DONE — verified operational)
- [x] Mi-Core PM2 process running (id=9, port 4001)
- [x] QB Agent route mounted at `/api/qb-agent/*`
- [x] SQLite database healthy (qb-agent.db, 248KB)
- [x] Heartbeat endpoint accepts and processes POST requests
- [x] Machine registration working (qb-laptop-01 registered)
- [x] Google Sheets sync service wired (fire-and-forget)
- [x] Auth middleware operational (requireAuth + requireAgentAuth)
- [x] No error reports in database
- [x] No pending commands

### Remote Laptop1 (PENDING — requires Dev1 physical access)
- [ ] Wake/power on Laptop1 (Stockton_Laptop)
- [ ] Verify Tailscale is running (`tailscale status`)
- [ ] Confirm Mi-Core reachable from Laptop1 (`curl http://100.118.102.113:4001/api/qb-agent/ping`)
- [ ] Verify Heartbeat Bridge scheduled task exists (`Get-ScheduledTask -TaskName "MiCore-QB-Heartbeat-Bridge"`)
- [ ] Reinstall bridge if missing: `DEV1_LAPTOP1_QB_HEARTBEAT_BRIDGE.ps1 -Install`
- [ ] Open QuickBooks Desktop (`C:\QB Data\Raw Stockton\rawstockton.qbw`)
- [ ] Wait 1-2 minutes for bridge to detect QBW.EXE and send heartbeat
- [ ] Flush reporting outbox: `DEV1_LAPTOP1_QB_FINALIZE.ps1`
- [ ] Trigger fresh sync cycle from background agent
- [ ] Verify on Mi-Core: `last_heartbeat < 30 min ago` and `qb_open=1`

### Post-Recovery Verification (from Mi-Core host)
```bash
# 1. Check heartbeat freshness
node -e "const Database = require('better-sqlite3'); const db = new Database('data/qb-agent.db'); const hb = db.prepare('SELECT * FROM heartbeats ORDER BY id DESC LIMIT 1').get(); console.log('Last HB:', hb.received_at, 'qb_open:', hb.qb_open);"

# 2. Check machine status
node -e "const Database = require('better-sqlite3'); const db = new Database('data/qb-agent.db'); const m = db.prepare('SELECT * FROM machines WHERE machine_id = ?').get('qb-laptop-01'); console.log('Status:', m.status, 'Last seen:', m.last_seen_at);"

# 3. Full QB status
node -e "const Database = require('better-sqlite3'); const db = new Database('data/qb-agent.db'); console.log('Machines:', db.prepare('SELECT COUNT(*) as c FROM machines').get().c); console.log('Online:', db.prepare(\"SELECT COUNT(*) as c FROM machines WHERE status='online'\").get().c); console.log('Pending cmds:', db.prepare(\"SELECT COUNT(*) as c FROM commands WHERE status='pending'\").get().c); console.log('Errors:', db.prepare('SELECT COUNT(*) as c FROM error_reports').get().c); console.log('HB total:', db.prepare('SELECT COUNT(*) as c FROM heartbeats').get().c);"
```

---

## Acceptance Gate — Current vs Post-Recovery

| Criterion | Current | Post-Recovery Target |
|---|---|---|
| QB status | `online` (stale) | `healthy` |
| heartbeat active | ❌ stopped 4.7h ago | ✅ <2 min ago |
| outbox pending | 0 (server) / unknown (laptop) | 0 both |
| last sync < 30 min | ❌ 26 hours | ✅ <30 min |
| action_required | ❌ true | ✅ false |

---

## Architectural Notes

### Why there is no server-side outbox queue
The QB Agent was designed with fire-and-forget for Google Sheets writes to avoid blocking the agent's report cycle. This is intentional — a Sheets API failure must not prevent the QB agent from completing its work. However, this means there is **no server-side mechanism to replay missed writes** if the laptop was offline and had queued reports.

### Heartbeat data is not deduplicated
Each heartbeat creates a new row in the `heartbeats` table. Over 24 hours at 1/minute = ~1440 rows. The 859 total rows represent ~14 hours of active bridge time. This is normal and the table can be periodically vacuumed if needed.

### QB Desktop open/close flapping
The alternating `qb_open=1/0` pattern in the last hour of activity suggests QB Desktop was not stably open. This could indicate:
- User manually closing/reopening QB
- QB crash-and-restart behavior
- Windows sleep/wake cycles affecting the QBW.EXE process

This should be investigated on Laptop1 to ensure QB Desktop runs stably for reliable sync cycles.

---

## Conclusion

The QB heartbeat pipeline is **functionally healthy on the server side**. The heartbeat blockage and outbox pending issues are both caused by **Laptop1 being offline/unreachable**. Once Laptop1 is powered on, connected to Tailscale, and the Heartbeat Bridge scheduled task is running with QB Desktop open, the system will self-heal to QB_RUNTIME_HEALTHY.

No code changes or server restarts are required.
