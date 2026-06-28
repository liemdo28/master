# DEV2 Data Truth + Security Audit

Generated: 2026-06-15T10:54:11+07:00

Requested target: DEV2_OPERATIONS_CERTIFIED

Current verdict: DEV2_OPERATIONS_READY_WITH_OPEN_ITEMS

## Executive Decision

DEV2 is not certifying green yet.

Reason: the current runtime evidence still shows stale Gmail freshness, QuickBooks degraded freshness, Visibility degraded, Agent Engine unknown, and PM2 process ownership unavailable. Secret exposure remains certified clean.

## D1 — Runtime Secret Validation

Status: PASS

Evidence:

| Surface | Result |
| --- | --- |
| Executive Snapshot / operations package | PASS |
| Visibility | PASS |
| Gmail | PASS |
| Drive | PASS |
| Calendar | PASS |
| QB | PASS |
| Graph | PASS |
| Memory | PASS |

Secret scan result:

| Check | Result |
| --- | --- |
| API secrets exposed | 0 |
| OAuth access tokens exposed | 0 |
| OAuth refresh tokens exposed | 0 |
| Credentials/passwords exposed | 0 |

Reference: `SECRET_EXPOSURE_AUDIT.md`

Note: latest spot scan found zero secret-pattern matches in completed API responses. Some later API requests briefly returned `fetch failed`; this is tracked as reliability evidence, not secret exposure.

## D2 — Reliability Monitoring

Status: ACTIVE, NOT GREEN

Current evidence:

| Metric | Current |
| --- | --- |
| Burn-in score | 41 |
| Mi-Core status | up |
| Mi-Core uptime evidence | 86.67% |
| PM2 restarts | 0 recorded |
| PM2 ownership | unavailable from current runtime shell |
| Ollama health | reachable, model loaded |
| Ollama latency | 17 ms |
| Ollama timeout count | 0 in latest snapshot |
| Connector freshness | stale |
| Dashboard mismatch | none detected |

Open reliability conditions:

| Source | Condition | Severity |
| --- | --- | --- |
| Gmail | freshness stale, age 830 min over 120 min threshold | escalated |
| QuickBooks | freshness degraded | watch |
| Visibility | degraded | watch |
| Agent Engine | unknown | watch |
| PM2 | process list unavailable, PID ownership cannot be certified | warning |

References:

- `reports/DEV2_RUNTIME_RELIABILITY_SNAPSHOT.md`
- `reports/BURN_IN_WATCHDOG_FEED_REPORT.md`
- `reports/PM2_RESTART_MONITOR_REPORT.md`
- `reports/OLLAMA_HEALTH_MONITOR_REPORT.md`
- `reports/RUNTIME_ALERT_CLASSIFICATION_REPORT.md`

## D3 — Dev3 Support

Status: READY

Dev3 support package:

| Need | Source |
| --- | --- |
| Executive Snapshot | `reports/EXECUTIVE_RUNTIME_SNAPSHOT.md` and `/api/visibility/operations` |
| Intent Labels | Mi brain / chat routing labels from existing chat and pipeline layers |
| Source-of-Truth APIs | `/api/visibility/*`, `/api/graph/*`, `/api/memory/*`, `/api/qb-agent/*` |
| Freshness metadata | `/api/visibility/freshness` and `reports/DATA_FRESHNESS_GUARD.md` |
| Runtime reliability feed | `/api/visibility/runtime-reliability` |
| Incident registry | `/api/visibility/operations/incidents` and `reports/INCIDENT_REGISTRY.md` |

Dev3 note: use DEV2 evidence as before/after baseline for chat hardening tests. Do not treat current state as clean burn-in certification.

## D4 — Burn-In Metrics

Status: ACTIVE

Current burn-in metrics:

| Metric | Current |
| --- | --- |
| Uptime metrics | generated |
| Restart counts | generated |
| Connector health | generated |
| Freshness metadata | generated |
| Incident registry | active |
| Active incidents | 5 |
| Dashboard mismatch | none detected |

Open incidents:

| Type | Source | Summary |
| --- | --- | --- |
| runtime_failure | Agent Engine | Agent Engine unknown |
| sync_failure | Gmail | Gmail freshness stale |
| runtime_failure | Visibility | Visibility degraded |
| runtime_failure | QB Connector | QB Connector degraded |
| sync_failure | QuickBooks | QuickBooks freshness degraded |

Reference: `reports/INCIDENT_REGISTRY.md`

## Acceptance

| Requirement | Status |
| --- | --- |
| No fake green | PASS |
| No stale data | OPEN |
| No dashboard mismatch | PASS |
| Runtime secret validation | PASS |
| Reliability monitoring active | PASS |
| Dev3 evidence support ready | PASS |
| Burn-in metrics active | PASS |

## Final Target Status

DEV2_OPERATIONS_CERTIFIED is blocked.

Required before certification:

1. Refresh Gmail source and clear stale freshness.
2. Clear or explicitly classify QuickBooks degraded state.
3. Restore PM2 visibility so restart count and port PID ownership can be certified.
4. Resolve or close the open Agent Engine / Visibility / QB incidents with fresh evidence.

Until those are complete, the correct target state is:

DEV2_OPERATIONS_READY_WITH_OPEN_ITEMS
