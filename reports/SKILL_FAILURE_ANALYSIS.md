# Skill Failure Analysis
**Module:** DEV3 Phase 12.4  
**Date:** 2026-06-13  
**Status:** PRODUCTION_READY  
**File:** `mi-core/server/src/gstack/skills/skill-failure-analysis.ts`

---

## Objective

Classify and store failure patterns per skill: error fingerprint, frequency, first/last occurrence, and remediation advice. Provides actionable diagnostics for debugging skill degradation.

---

## Failure Pattern Schema

```typescript
interface FailurePattern {
  pattern_key: string;    // normalized error fingerprint
  error_sample: string;   // raw error text (≤150 chars)
  frequency: number;
  first_seen: string;
  last_seen: string;
  remediation: string;    // actionable advice
}

interface SkillFailureReport {
  skill_id: string;
  total_failures: number;
  total_executions: number;
  failure_rate: number;
  patterns: FailurePattern[];
  mtbf_executions?: number;   // mean executions between failures
  updated_at: string;
}
```

---

## Remediation Library

| Error Pattern | Remediation |
|--------------|-------------|
| ETIMEDOUT / timeout | Increase timeout; check network to target |
| ECONNREFUSED | Service not running — check pm2 status |
| ENOENT / no such file | Verify path configuration |
| EPERM / permission denied | Check file/process ownership |
| Out of memory / heap | Investigate memory leak; increase heap limit |
| JSON parse error | Validate upstream API contract |
| 401 / unauthorized | Rotate credentials or verify token scope |
| 500 / internal server error | Check upstream logs; retry with backoff |
| 404 / not found | Verify endpoint URL and resource existence |

---

## Pattern Normalization

Raw error strings are normalized before fingerprinting:
- Hex IDs stripped → `<hex>`
- Timestamps stripped → `<ts>`
- Port numbers stripped → `:<port>`
- Lowercased, whitespace collapsed

This groups "ECONNREFUSED to port 4001" and "ECONNREFUSED to port 4002" under the same pattern.

---

## Acceptance Test Results

| Skill | Failures | Failure Rate | Unique Patterns | MTBF |
|-------|---------|-------------|----------------|------|
| health | 1 | 1.6% | 1 | 62 execs |
| source_scan | 4 | 6.5% | 2 | 15 execs |
| pm2_status | **0** | 0.0% | 0 | — |
| regression_suite | 7 | 11.5% | 2 | 9 execs |
| dashboard_audit | 3 | 5.0% | 2 | 20 execs |

### Failure Pattern Detail

**health** — 1 pattern:
- `ECONNREFUSED: connection refused to port 4001` (freq: 1) → _Target service not running — check pm2 status_

**source_scan** — 2 patterns:
- `permission denied: /project/.git` (freq: 3) → _Check file/process ownership_
- `ENOENT: no such file or directory` (freq: 1) → _Verify path configuration_

**regression_suite** — 2 patterns:
- `R03: expected "em biết" in reply but got empty` (freq: 4) → _Review logs; check environment variables_
- `ETIMEDOUT: jarvis query timed out` (freq: 3) → _Increase timeout; check network connectivity_

**dashboard_audit** — 2 patterns:
- `ECONNREFUSED: dashboard API unreachable` (freq: 2) → _Target service not running — check pm2 status_
- `HTTP 401: unauthorized` (freq: 1) → _Authentication failure — rotate API credentials_

---

## Storage

```
.local-agent-global/skills/failure-analysis.json
```

Re-analyzed on every `analyzeSkillFailures()` call, which triggers on each `recordExecution()` with `success=false`.
