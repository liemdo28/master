# QB Runtime Monitoring Ready

Generated: 2026-06-14
Owner: Dev2 - Mi-Core visibility and certification

## Status

QB_RUNTIME_MONITORING_READY

Current live validation result: needs_dev1_action
Latest Laptop1 target result: LAPTOP1_QB_RUNTIME_STABLE is NOT STABLE / BLOCKED as of 2026-06-14 09:02 PDT.

## Implemented

- QB runtime snapshot tracks qb_open, company_detected, last_successful_sync, transaction count, checksum, duplicate bills, duplicate payments, and sync gaps.
- Dashboard payload exposes normalized states: healthy, degraded, failed, needs_dev1_action.
- Failed/non-healthy QB runtime automatically writes a Dev1 handoff package.
- Daily runtime report is generated at QB_DAILY_RUNTIME_REPORT.md.
- QuickBooks visibility cache writes data.json, summary.json, last_sync.json, and errors.json so connector health cannot show false green from a stale cache-only file.
- Dev1 Laptop1 runtime evidence is ingested from `.local-agent-global/visibility/quickbooks/dev1-runtime-evidence.json` as a hard certification blocker.

## Current Laptop1 Blocking Evidence

- QB Desktop and QB Web Connector are running on Laptop1.
- Live QB agent is running, but its status is QB_BLOCKED.
- Configured QB file target is missing: `D:\QB\StoneOak.qbw`.
- Active/current QB evidence points to `C:\QB Data\Raw Stockton\rawstockton.qbw` / Raw Japanese Bistro and Sushi Bar.
- Mi-Core heartbeat POSTs to `http://100.118.102.113:4001/api/qb-agent/heartbeat` are timing out.
- Scheduler has `outbox_pending: 1268`.
- Latest QB activity log is WARNING, not clean success.
- Transaction count, checksum, duplicate bills, and duplicate payments are not verified from a valid sync log.
- Screenshot capture failed; blank screenshot is not valid evidence.

## Dev1 Handoff Package Fields

- failure_type
- expected_checksum
- actual_checksum
- last_successful_sync
- company_detected
- qb_open
- required_dev1_action
- screenshots_or_log_paths
- gaps
- errors

## Acceptance Result

- Laptop1 healthy path: dashboard_status is healthy only when QB is open, company is detected, checksum is clean, a successful sync exists, heartbeat is fresh, no duplicates are detected, and no sync gaps exist.
- Laptop1 failure path: dashboard_status becomes needs_dev1_action or failed, and a Dev1 package is generated.
- No false green: cache errors are written whenever QB is not certified.
- No stale red: old historical errors do not block healthy if the current runtime signals are clean.

## Required Dev1 Clearance

Dev1 must fix Laptop1 QB agent config to the correct company file/store mapping, replace the stale scheduled task path, restore Mi-Core connectivity, rerun daily sync from the corrected agent, capture transaction count/checksum, verify duplicates, and capture real QB Desktop/Web Connector screenshots from the interactive desktop.
