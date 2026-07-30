# DAY1_DISCREPANCY_AUDIT

**Date:** 2026-06-15T21:47:00+07:00
**Auditor:** DEV4
**Trigger:** P0 finding — burn-in monitor reported approvals.db MISSING, reminder-store MISSING, workflows-dir MISSING
**Method:** Path verification across both `.local-agent-global` directories
**Verdict:** P0_REJECTED ✅ (false positive — wrong path in monitor)

---

## EXECUTIVE SUMMARY

The P0 finding was a **false positive**. The burn-in monitor's `GLOBAL_DIR` variable pointed at `E:/Project/Master/.local-agent-global/` (an old/stale location) instead of the actual runtime path `E:/Project/Master/mi-core/.local-agent-global/`. When checked at the correct path, ALL stores exist and are healthy.

**P0_REJECTED** — No data loss occurred.

---

## 1. APPROVALS.DB

| Field | Expected Path | Actual Path | Status |
|-------|---------------|-------------|--------|
| DB file | `E:/Project/Master/.local-agent-global/approval-store/approvals.db` | `E:/Project/Master/mi-core/.local-agent-global/approval-store/approvals.db` | ✅ EXISTS (wrong path checked) |
| WAL file | (same dir) approvals.db-wal | `E:/Project/Master/mi-core/.local-agent-global/approval-store/approvals.db-wal` | ✅ EXISTS |
| SHM file | (same dir) approvals.db-shm | `E:/Project/Master/mi-core/.local-agent-global/approval-store/approvals.db-shm` | ✅ EXISTS |

### Evidence

```
approval-store/approvals.db:    4,096 bytes   (mtime: 2026-06-15T06:36:25.404Z)
approval-store/approvals.db-wal: 3,254,832 bytes (mtime: 2026-06-15T09:05:36Z)
approval-store/approvals.db-shm: 32,768 bytes   (mtime: 2026-06-15T09:05:31Z)
```

**Assessment:** 3.2MB WAL file indicates active write operations. DB is live and operational. The approval gate CAN persist approvals across restarts.

**Status: HEALTHY** ✅

---

## 2. REMINDERS.DB

| Field | Expected Path | Actual Path | Status |
|-------|---------------|-------------|--------|
| Directory | `E:/Project/Master/.local-agent-global/reminder-store/` | `E:/Project/Master/mi-core/.local-agent-global/reminder-store/` | ✅ EXISTS |
| DB file | (same dir) reminders.db | `E:/Project/Master/mi-core/.local-agent-global/reminder-store/reminders.db` | ✅ EXISTS |

### Evidence

```
reminder-store/           DIR (3 items)
reminder-store/reminders.db: 4,096 bytes (mtime: 2026-06-15T06:36:26.544Z)
```

**Assessment:** Reminder store exists with 3 files. DB is present.

**Status: HEALTHY** ✅

---

## 3. WORKFLOW DIRECTORY

| Field | Expected Path | Actual Path | Status |
|-------|---------------|-------------|--------|
| Root workflows dir | `E:/Project/Master/.local-agent-global/workflows/` | `E:/Project/Master/mi-core/.local-agent-global/workflows/` | ✅ EXISTS |
| Multi-intent subdir | (same) workflows/multi-intent/ | `E:/Project/Master/mi-core/.local-agent-global/workflows/multi-intent/` | ✅ EXISTS |

### Evidence

```
workflows/                DIR (5,094 items)
workflows/multi-intent/   DIR (219 items)
```

### Sample Files

```
WF-VN-0.json  (3,063 bytes, 2026-06-15T09:26:40.972Z)
WF-VN-1.json  (3,040 bytes, 2026-06-15T09:26:42.731Z)
WF-VN-2.json  (3,031 bytes, 2026-06-15T09:26:44.855Z)
WF-VN-3.json  (3,118 bytes, 2026-06-15T09:26:46.862Z)
WF-VN-4.json  (1,902 bytes, 2026-06-15T09:26:47.926Z)
```

**Assessment:** 5,094 workflow files present. 219 multi-intent workflows. Most recent created within the last hour of operation.

**Status: HEALTHY** ✅

---

## 4. EXECUTION LEDGER

| Field | Expected Path | Actual Path | Status |
|-------|---------------|-------------|--------|
| Directory | `E:/Project/Master/.local-agent-global/execution-ledger/` | `E:/Project/Master/mi-core/.local-agent-global/execution-ledger/` | ✅ EXISTS |
| Ledger file | (same dir) ledger.jsonl | `E:/Project/Master/mi-core/.local-agent-global/execution-ledger/ledger.jsonl` | ✅ EXISTS |

### Evidence

```
execution-ledger/                  DIR (1 item)
execution-ledger/ledger.jsonl: 204,677 bytes (mtime: 2026-06-15T08:59:15.698Z)
Total entries: 533
PASS: 336 | FAIL: 48 | PENDING: 183
```

**Assessment:** 533 ledger entries with 63% PASS rate. Last entry ~5h ago. Active and comprehensive.

**Status: HEALTHY** ✅

---

## 5. BOTH-PATH COMPARISON

### Master Path (WRONG — stale artifact)

```
E:/Project/Master/.local-agent-global/
├── action-audit/        (0 items — EMPTY)
├── communication/       (0 items — EMPTY)
├── connectors/          (2 items)
├── conversations.db     (159,744 bytes — stale copy)
├── coo-v4/              (12 items)
├── data-analyst/        (4 items)
├── evidence/            (0 items — EMPTY)
├── execution-ledger/    (1 item — 6 stale entries)
├── executive-memory-v2/ (7 items)
├── knowledge-db/        (7 items)
├── memory/              (0 items — EMPTY)
├── mi-core/             (5 items)
├── operations/          (4 items)
├── remote-access/       (4 items)
├── visibility/          (18 items)
├── voice/               (1 item)
└── work-orders/         (1 item)
```

**Key indicators this is WRONG:**
- Many directories are EMPTY (0 items)
- Only 6 stale ledger entries (first entries from Jun 13)
- NO approval-store directory at all
- NO reminder-store directory at all
- NO workflows directory at all
- conversations.db exists (stale copy) but no WAL/SHM files

### Mi-Core Path (CORRECT — runtime data)

```
E:/Project/Master/mi-core/.local-agent-global/
├── approval-store/      (3 items — approvals.db + WAL + SHM)
├── approvals/           (73 items)
├── burn-in/             (2 items)
├── company-memory/      (7 items)
├── data-analyst/        (2 items)
├── decisions.json
├── employees.json
├── evidence/            (81 items)
├── execution-ledger/    (1 item — 533 entries)
├── execution-queue/     (2,388 items)
├── executive-briefing/  (1 item)
├── executive-memory-v2/ (7 items)
├── graph/               (4 items)
├── idempotency/         (1 item)
├── incidents.json
├── knowledge-db/        (5 items)
├── knowledge-universe/  (1 item)
├── lessons.json
├── logs/                (10 items)
├── operational-memory/  (3 items)
├── operations/          (4 items)
├── processes.json
├── projects.json
├── reference-brain/     (1 item)
├── reminder-store/      (3 items)
├── seo-drafts/          (559 items)
├── skills/              (6 items)
├── vendors.json
├── visibility/          (7 items)
├── work-orders/         (116 items)
└── workflows/           (5,094 items)
```

**Key indicators this is CORRECT:**
- approval-store present with active WAL (3MB)
- reminder-store present
- workflows with 5,094 files
- execution-queue with 2,388 items
- seo-drafts with 559 items
- work-orders with 116 items
- evidence with 81 items
- PM2 ecosystem config uses `cwd: __dirname` (mi-core dir)

---

## ROOT CAUSE

The `.env.example` declares:
```
GLOBAL_DIR=E:/Project/Master/.local-agent-global
```

But the PM2 ecosystem config uses:
```javascript
{
  name: 'mi-core',
  script: 'server/dist/index.js',
  cwd: __dirname,  // resolves to E:/Project/Master/mi-core
}
```

The PM2 `error_file` and `out_file` paths are:
```javascript
error_file: '.local-agent-global/logs/mi-core-error.log',
out_file:   '.local-agent-global/logs/mi-core-out.log',
```

These are relative to `cwd` = `E:/Project/Master/mi-core/`, confirming the server uses `E:/Project/Master/mi-core/.local-agent-global/` at runtime. The `.env.example` GLOBAL_DIR is stale documentation from an earlier deployment phase.

---

## FINAL VERDICT

| Store | P0 Finding | Actual Status | P0 |
|-------|-----------|---------------|-----|
| approvals.db | MISSING | EXISTS (4KB + 3MB WAL) | **REJECTED** |
| reminder-store | MISSING | EXISTS (3 items) | **REJECTED** |
| workflows-dir | MISSING | EXISTS (5,094 items) | **REJECTED** |
| execution-ledger | Only 6 entries | 533 entries (63% PASS) | **REJECTED** |

**P0_REJECTED** — All four stores are present and operational at the correct path. The burn-in monitor's GLOBAL_DIR has been corrected from `E:/Project/Master/.local-agent-global/` to `E:/Project/Master/mi-core/.local-agent-global/`.

**Action Required:** Update `.env.example` to reflect the actual runtime path to prevent future confusion.

---

*Audit completed by DEV4 — 2026-06-15 21:47 ICT*
