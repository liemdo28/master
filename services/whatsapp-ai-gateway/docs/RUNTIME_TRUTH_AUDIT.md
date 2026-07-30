# Runtime Truth Audit

Date: 2026-06-05

## Runtime Endpoints

- `GET /api/health`
- `GET /api/runtime-truth`

`/api/runtime-truth` returns:

- build_id
- git_commit
- build_time
- project_path
- node_pid
- port
- whatsapp_status
- template_item_count
- template_source
- template_version
- language_engine_status
- google_sheet_template_url
- google_sheet_log_url
- admin_control_ready

## Live Runtime

- Port: `3210`
- WhatsApp status: `ready`
- Template count: `19`
- Template source: `sheet` after sync, `sqlite` on warm restart before sync
- Template version: `ca54a1553c17`

## WhatsApp Proof

`/version` now returns:

- Build ID
- Commit
- Template Count
- Template Version
- Template Source
- Language Engine
- Source path via runtime build info

CEO can compare `/api/runtime-truth.build_id` with WhatsApp `/version`.
