# Template Cache Report

Date: 2026-06-05

## Cache Table

SQLite table:

`template_cache`

Stores:

- template_name
- template_version
- source
- item_count
- payload_json
- last_sync_at

## Fallback Rule

If Google Sheet is unavailable:

1. Use last real `template_cache` payload.
2. If no cache exists, do not run Daily Entry workflow.

User-facing no-cache reply:

`Template is not available. Please contact manager.`

## Runtime Result

Latest successful sync:

- item_count: 19
- version: `ca54a1553c17`
- source: `sheet`
- range: `Daily_Entry_Template!B11:D35`
