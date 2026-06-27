# DoorDash Operational Certification

Generated: 2026-06-27T04:15:00Z

Certification result: `BLOCKED`

## Real Evidence Collected

Evidence folder: `evidence/phase10-reality-closure/`

| Evidence | File |
| --- | --- |
| Health response | `doordash-health.json` |
| Redacted account list | `doordash-accounts-redacted.json` |
| Redacted metrics scrape | `doordash-metrics-redacted.json` |
| Redacted agent log | `doordash-agent-tail-redacted.log` |
| Health screenshot | `screenshot-doordash-health.png` |

## Read-Only Runtime

| Requirement | Result | Proof |
| --- | --- | --- |
| Can access agent | PASS | `GET /health` returned `status=ok` |
| Account registry visible | PASS | 4 configured accounts returned with email values redacted |
| Can see campaigns | FAIL | scrape did not reach portal/campaign views |
| Can collect evidence | PARTIAL | service collected health/log evidence, but browser scrape failed |
| Can create tasks | PARTIAL | Mi-Core runtime can create tasks; DoorDash-specific live task proof not complete |
| No spending/modifications | PASS | only health/account/metrics read endpoints were used |

## Blocker

Fresh scrape failed because the Playwright Chromium runtime expected by the installed package is missing. Two install attempts were made and timed out without completing. No production write or DoorDash mutation was attempted.

## Decision

DoorDash remains blocked until the browser runtime is repaired and a fresh read-only portal scrape proves account access, campaign visibility, and evidence capture.

Final status contribution: `MI_COMPANY_OS_PARTIAL`.
