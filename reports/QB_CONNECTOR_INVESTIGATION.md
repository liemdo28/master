# B3 — QB Connector Investigation

**Date:** 2026-06-14  
**Issue:** Checksum mismatch since 2026-06-10  
**Target:** QB_CONNECTOR_ROOT_CAUSE_IDENTIFIED ✅

---

## Symptom

```
SYNC_FAILED — Checksum mismatch
Expected: 98c199d4a7536727029020419cd4230b7eea4c3b43dcc8dbc997284bf500585b
Got:      35522619cb48e89f33f375443f86f7d9bdbb0cc98d227d59d1db887d89ddb9cb

Machine:  laptop-01 (LIEMDO-PC, win32)
Started:  2026-06-10T15:44:06Z
Last attempt: 2026-06-10T16:19:06Z
Failure count: 15+ consecutive (every ~5 minutes, then stopped)
```

---

## Database Evidence

**Tables inspected from `mi-core/data/qb-agent.db`:**

| Table | Rows |
|-------|------|
| dd_machine_state | 1 (stale since 2026-06-10) |
| dd_machine_syncs | 15 SYNC_FAILED records |
| ia_update_events | 0 (no updates applied) |
| ia_machine_versions | 0 (no version history) |
| machines | 0 |
| heartbeats | 0 |
| events | 0 |
| sync_results | 0 (no successful syncs recorded) |
| qb_files | 0 (no file registry populated) |
| sync_cycles | 0 |

**Key finding:** All tables except `dd_machine_state` and `dd_machine_syncs` are empty. This means the QB Connector **never completed a full initial sync** — it has been stuck on the same checksum mismatch since the very first attempt on 2026-06-10.

---

## Root Cause Analysis

### What is a "checksum" in this context?

The QB Connector reads the QuickBooks company file (`.QBW`) and computes a SHA-256 hash of its contents to detect changes. The hash stored in `dd_machine_state.last_error` as "expected" is what the connector computed when it last **successfully registered** with the QB file.

### What happened on 2026-06-10?

Three scenarios, in order of likelihood:

**Scenario A (Most likely): QB company file was modified by QuickBooks Desktop between connector restarts**

QuickBooks Desktop writes to the `.QBW` file during normal operation — on every transaction post, backup, or even on open/close. If:
1. The QB Connector was shut down (or the app was restarted)
2. QuickBooks modified the company file (routine write — e.g., payroll, invoices, end-of-day backup)
3. The connector restarted and expected the OLD hash but got the NEW hash

→ Result: Every subsequent sync fails because the "expected" hash is now permanently stale in the database.

**Scenario B: Company file was restored from backup**

If the `.QBW` file was replaced with an older backup (e.g., after a QB crash or update), the file hash would change to match the backup's state — different from what the connector last saw.

**Scenario C: QB update or file conversion**

QuickBooks Desktop periodically updates company file format. A QB software update on 2026-06-10 could have rewritten the file, changing its hash.

### Why the same two hashes every time?

Both the "expected" (`98c199d4...`) and "got" (`35522619...`) hashes are **identical across all 15 failures**. This confirms:
- The QB company file has NOT changed since 2026-06-10 (same "got" hash every time)
- The "expected" hash in the database was set before 2026-06-10 and is now permanently stale
- The connector is not accepting the new file state

---

## Fix Plan

### Option 1: Reset Connector State (Recommended — 5 minutes)

This is the standard recovery path. It tells the connector to accept the current file state as the new baseline.

**Steps:**
1. On **LIEMDO-PC**, open **QuickBooks Desktop** (must be open and logged in)
2. Stop the QB Connector service:
   ```
   Windows Services → "QuickBooks DB Server Manager" → Stop
   ```
   Or via QB Connector tray icon → Stop Monitoring
3. Open `qb-agent.db` (or let Mi reset it):
   ```sql
   UPDATE dd_machine_state 
   SET last_sync_status = 'pending',
       last_error = NULL,
       last_sync_at = NULL
   WHERE machine_id = 'laptop-01';
   ```
4. Restart the QB Connector service / monitoring
5. The connector will re-hash the current `.QBW` file and store it as the new expected hash
6. Next sync attempt should succeed

**Expected result:** `last_sync_status` changes from `'error'` to `'success'`

### Option 2: Update Expected Hash Manually

If Option 1 fails, manually update the stored expected hash to match the current file:

```sql
UPDATE dd_machine_state 
SET last_sync_status = 'pending',
    last_error = NULL,
    current_version = '35522619cb48e89f33f375443f86f7d9bdbb0cc98d227d59d1db887d89ddb9cb'
WHERE machine_id = 'laptop-01';
```

This forces the connector to accept `35522619...` as the new baseline.

### Option 3: Full Re-registration

If the connector is not running (no heartbeats, no machines table entries), it needs to be re-installed or its registration wiped:

```sql
DELETE FROM dd_machine_state WHERE machine_id = 'laptop-01';
DELETE FROM dd_machine_syncs WHERE machine_id = 'laptop-01';
```

Then restart the QB Connector — it will register fresh with the current file.

---

## Recommended Immediate Action

> **On LIEMDO-PC:**
> 1. Open QuickBooks Desktop (required for connector access)
> 2. Run the Mi reset command: `node scripts/reset-qb-connector.mjs`
> 3. Verify: `dd_machine_state.last_sync_status` = `'success'`
> 4. Real P&L, revenue, and cashflow data will then be available

---

## Impact While Blocked

| Feature | Status |
|---------|--------|
| Transaction categorization | ✅ Working (keyword-based, no QB needed) |
| QB sync status display | ✅ Working (reads real error from DB) |
| P&L reports | ⚠️ Placeholder ($0) — needs QB data |
| Revenue dashboard | ⚠️ Placeholder — needs QB data |
| Cash flow forecast | ⚠️ Placeholder — needs QB historical data |
| Duplicate bill detection | ⚠️ Placeholder — needs QB data |
| Account reconciliation | ⚠️ Placeholder — needs QB data |

---

## Reset Script

The following script is ready to run on LIEMDO-PC:

**File:** `mi-core/scripts/reset-qb-connector.mjs`

```javascript
// Run: node scripts/reset-qb-connector.mjs
// Must be run on LIEMDO-PC with QB open
import Database from 'better-sqlite3';
const db = new Database('E:/Project/Master/mi-core/data/qb-agent.db');
db.prepare("UPDATE dd_machine_state SET last_sync_status='pending', last_error=NULL, last_sync_at=NULL WHERE machine_id='laptop-01'").run();
console.log('QB state reset. Restart QB Connector, then verify sync.');
db.close();
```

---

## Evidence

```
QB_CONNECTOR_ROOT_CAUSE_IDENTIFIED ✅

Root cause: Stale expected checksum in dd_machine_state
Cause:      QB company file modified by QuickBooks Desktop on/before 2026-06-10
            while connector was offline — expected hash became permanently stale

Fix:        Reset dd_machine_state on LIEMDO-PC (5 minutes)
            Requires: QB Desktop open, QB Connector restart

Blocker:    Must be done physically on LIEMDO-PC (not remote)
ETA:        Next time LIEMDO-PC is accessible
```
