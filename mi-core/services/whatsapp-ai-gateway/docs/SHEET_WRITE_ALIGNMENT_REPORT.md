# Sheet Write Alignment Report

Date: 2026-06-05

## Fix

Daily Entry confirmation now builds one row per template item instead of one summary row with payload JSON.

Columns:

- timestamp
- store
- employee
- item
- category
- value
- target_min
- target_max
- status
- source
- notes

## Runtime Behavior

If template has 19 items, `appendBrothLog()` writes or queues 19 rows.

If Google Sheets is disabled or unavailable, the same 19 rows are queued safely in the sheet-write queue.
