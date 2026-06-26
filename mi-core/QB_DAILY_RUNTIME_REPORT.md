# QB Daily Runtime Report
Generated: 2026-06-26T05:59:07.868Z
Status: needs_dev1_action
Certified: no
## Runtime Signal
- qb_open: true
- company_detected: true
- last_successful_sync: 2026-06-18T08:29:36.703Z
- transaction_count_today: 0
- checksum_expected: none
- checksum_actual: none
- checksum_mismatch: false
- detected_machine_id: none
- company_identity_matched: true
- company_machine_allowed: true
- company_id: raw-stockton
- company_name: Raw Japanese Bistro and Sushi Bar
- company_file: C:\QB Data\Raw Stockton\rawstockton.qbw
- allowed_machine_ids: qb-laptop-01, laptop-01, laptop1
- company_path_accepted: true
- path_match_required: false
## Errors
- none
## Duplicates
- duplicate_bills: 0
- duplicate_payments: 0
## Sync Gaps
- No QB heartbeat has been received
- Last successful QB sync is stale (11370 minutes old)
- No real QB activity log rows found
- Dev1 Laptop1 runtime result is NOT_STABLE
- Scheduled task ToastPOSManager-Background still needs PowerShell Run as Administrator to point at the corrected desktop-app path
- 12h sync runner hung for more than 3 minutes and was stopped by Dev1
- Transaction count is not verified from a fresh sync-result payload
- Checksum result was not found in a fresh sync-result payload
- Duplicate bills are not verified from a fresh sync-result payload
- Duplicate payments are not verified from a fresh sync-result payload
- Screenshot evidence has not been recaptured from the interactive desktop
## Dev1 Action
Required: Run PowerShell as Administrator on Laptop1 to update scheduled task ToastPOSManager-Background to the corrected desktop-app path, then trigger a clean sync-result after the 12h sync runner no longer hangs.
Handoff package: D:\Project\Master\.local-agent-global\visibility\quickbooks\dev1-handoff-package.json
Verdict: QB_RUNTIME_NEEDS_DEV1_ACTION