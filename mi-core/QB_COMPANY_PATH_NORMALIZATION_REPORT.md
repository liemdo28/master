# QB Company Path Normalization Report

Generated: 2026-06-14
Target: QB_COMPANY_IDENTITY_CERTIFIED

## Verdict

QB_COMPANY_IDENTITY_CERTIFIED

Raw Stockton is no longer treated as a company mismatch solely because the file is located at:

`C:\QB Data\Raw Stockton\rawstockton.qbw`

## Phase 1 Review

Company detection previously mixed path expectations with company identity evidence. The Dev1 handoff said the configured target was `D:\QB\StoneOak.qbw`, while the active QB evidence showed `C:\QB Data\Raw Stockton\rawstockton.qbw` and company name `Raw Japanese Bistro and Sushi Bar`.

Determination:

- The Raw Stockton finding is not a real company mismatch when validating Raw Stockton.
- It was a path/config expectation mismatch caused by stale StoneOak assumptions.
- The remaining runtime blockers are real but separate: Mi-Core heartbeat timeout, pending outbox, stale runtime sync state, warning-level activity log, unverified transaction count/checksum/duplicates, and invalid screenshot evidence.

## Phase 2 Normalized Company Detection

Certification now resolves company identity using:

- company id
- company name
- aliases
- QB company metadata
- approved production file paths as supporting metadata

Path match is not required unless the registry entry explicitly sets `path_match_required: true`.

Current resolved identity:

- company_id: `raw-stockton`
- company_name: `Raw Japanese Bistro and Sushi Bar`
- detected_file: `C:\QB Data\Raw Stockton\rawstockton.qbw`
- identity_matched: `true`
- path_accepted: `true`
- path_match_required: `false`

## Phase 3 Allowed Paths Registry

Added approved production registry:

`E:\Project\Master\mi-core\.local-agent-global\visibility\quickbooks\company-registry.json`

Added machine ownership topology:

- Laptop1: `raw-stockton` only. Observed heartbeat id: `qb-laptop-01`.
- Laptop2: `b1-jht-venture`, `b2-stone-oak`, `b3-bandera`, `copper`, `ift`.

Approved Raw Stockton path:

`C:\QB Data\Raw Stockton\rawstockton.qbw`

The connector must not fail solely because the QB company file is outside a legacy folder such as `D:\QB`.

The connector must fail if a company identity is detected on the wrong assigned machine.

## Phase 4 Certification Rerun

Rerun result:

- correct company loaded: `true`
- path accepted: `true`
- machine ownership accepted: `true` for `qb-laptop-01`
- mismatch removed if company is correct: `true`
- dashboard_status: `needs_dev1_action`
- certified runtime: `false`

The dashboard remains red for non-path reasons:

- Mi-Core heartbeat POST timeout to `http://100.118.102.113:4001/api/qb-agent/heartbeat`
- `outbox_pending: 1268`
- runtime sync state is stale: `2026-06-09T09:32:16Z`
- latest activity result is WARNING, not clean success
- transaction count/checksum/duplicates are not verified from a valid sync log
- screenshot evidence is invalid

## Acceptance

Certification is now based on the correct company identity, not a specific folder path.

Company identity target is met: QB_COMPANY_IDENTITY_CERTIFIED.

Full runtime target remains blocked until Dev1 clears the reporting and sync verification gaps.
