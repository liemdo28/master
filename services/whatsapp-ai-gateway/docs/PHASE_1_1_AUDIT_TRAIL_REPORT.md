# Phase 1.1 — Audit Trail Hardening Report

**Project:** WhatsApp AI Gateway
**Date:** 2026-06-04
**Status:** IMPLEMENTED

---

## What Was Built

Two SQLite tables track every confirmed workflow for compliance and debugging.

### Table 1: `workflow_audit_logs`

Created automatically on first boot. No manual migration needed.

```sql
CREATE TABLE IF NOT EXISTS workflow_audit_logs (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id             TEXT,
  workflow_type           TEXT NOT NULL,
  store_id               TEXT,
  store_name             TEXT,
  group_chat_id          TEXT,
  group_name             TEXT,
  employee_id            TEXT,
  employee_name          TEXT,
  employee_language      TEXT DEFAULT 'en',
  original_inputs_json   TEXT,
  edits_json             TEXT,
  final_payload_json     TEXT,
  validation_result_json TEXT,
  sheet_write_status     TEXT DEFAULT 'PENDING',
  manager_alert_status   TEXT DEFAULT 'NOT_SENT',
  created_at             TEXT DEFAULT (datetime('now')),
  confirmed_at           TEXT
)
```

Indexes: `idx_audit_store`, `idx_audit_confirmed`

### Table 2: `workflow_edit_history`

Records every EDIT command before CONFIRM is processed.

```sql
CREATE TABLE IF NOT EXISTS workflow_edit_history (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  audit_log_id    INTEGER NOT NULL,
  item_name       TEXT NOT NULL,
  old_value       TEXT,
  new_value       TEXT,
  edited_by       TEXT,
  edited_at       TEXT DEFAULT (datetime('now'))
)
```

Index: `idx_edit_audit`

---

## Integration Points

### When Created

`auditTrail.createAuditLog(...)` is called when user types CONFIRM.
Captures: original_inputs, edits, final_payload, validation_result at the moment of confirmation.

### When Updated

After CONFIRM, `auditTrail.markConfirmed(auditLogId, { sheetWriteStatus, managerAlertStatus })`
updates: sheet_write_status and manager_alert_status fields.

### When Edited

`auditTrail.recordEdit(...)` is called in broth-command.js when user types EDIT.
Captures: item_name, old_value, new_value, edited_by, edited_at.

---

## Answering CEO Questions

| Question | How Answered |
|----------|---------------|
| Who submitted? | `employee_name` + `employee_id` in `workflow_audit_logs` |
| Which store? | `store_name` + `store_id` |
| When? | `confirmed_at` timestamp |
| What did they enter first? | `original_inputs_json` (first values captured at session start) |
| What did they edit? | `workflow_edit_history` table (linked by `audit_log_id`) |
| What was finally confirmed? | `final_payload_json` (captured at CONFIRM) |
| Did sheet write succeed? | `sheet_write_status` |
| Did manager alert fire? | `manager_alert_status` |

---

## API Access

```
GET /api/audit/logs?store_id=<store>&limit=20
GET /api/audit/logs/:id         ← includes edits
GET /api/audit/stats
GET /api/audit/today            ← today's submissions per store
```

---

## Test Verification

Run:
```bash
node tests/phase1-tests.js
```

Expected: All audit trail tests pass.

---

## Sign-off

| Role | Name | Date |
|------|------|------|
| Tech | | 2026-06-04 |