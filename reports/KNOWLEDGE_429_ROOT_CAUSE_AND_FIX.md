# KNOWLEDGE_429_ROOT_CAUSE_AND_FIX

Generated: 2026-06-13T00:08:00+07:00
Owner: Dev2
Status: FIX_APPLIED_AND_6H_CERTIFIED

## Executive Summary

The Phase 4 429 failures were caused by the global Express rate limiter, not a Knowledge Search, Graph, upstream provider, WhatsApp, or route-specific limiter.

The intended internal monitor bypass existed in source, but it did not work at runtime because the middleware captured `MI_CORE_API_KEY` before `dotenv.config()` loaded `server/.env`. As a result, the runtime monitor did not authenticate as trusted internal traffic and was counted in the shared IP bucket with other local traffic.

## Required Findings

| Required Item | Finding |
|---|---|
| Which route returned 429? | `/api/jarvis/health` and `/api/jarvis/knowledge/search?q=Mi-Core&limit=3` in Phase 4 raw logs. Server-side 429 audit proof captured `/api/jarvis/health`. |
| Limiter type | Global Express limiter from `server/src/middleware/rate-limit.ts`. |
| Route-specific limiter? | No evidence for Jarvis Knowledge routes. |
| Upstream provider limiter? | No. Responses came directly from local Express with `Too many requests`. |
| Internal API limiter? | No separate internal Knowledge limiter found. |
| External dependency limiter? | No. The failure occurred before route handler dependency work. |
| Client/IP key | `127.0.0.1`, shared local bucket. |
| Configured bucket | 120 requests / 60 seconds / IP. |
| Retry-After captured | Yes, server audit captured `retry_after: 60` for proof requests. |

## Evidence From Failed Phase 4

Raw log:

`reports/evidence/knowledge-final-audit/phase4_runtime_raw.jsonl`

Affected samples:

| Sample | Timestamp | Health | Search | Result |
|---:|---|---:|---:|---|
| 170 | 2026-06-12T16:06:12 local run window | 429 | 429 | FAIL |
| 177 | 2026-06-12T16:13:19 local run window | 429 | 429 | FAIL |
| 178 | 2026-06-12T16:14:20 local run window | 429 | 429 | FAIL |

## Server-Side 429 Audit

New audit log:

`reports/evidence/knowledge-rate-limit/runtime-429-audit.jsonl`

Example captured event:

```json
{
  "limiter": "global-express-rate-limit",
  "route": "/api/jarvis/health",
  "method": "GET",
  "ip": "127.0.0.1",
  "client_key": "127.0.0.1",
  "caller_identity": "external-rate-limit-proof",
  "has_internal_key": false,
  "retry_after": "60",
  "bucket": {
    "limit": 120,
    "used": 125,
    "remaining": 0
  }
}
```

Captured fields:

- request timestamp
- route/path/method
- IP/client key
- caller identity
- whether internal key was present
- retry-after
- bucket limit/used/remaining/reset time
- selected request headers

## Root Cause Detail

Source had an internal bypass:

```ts
const INTERNAL_KEY = process.env.MI_CORE_API_KEY || 'mi-core-secret-2026';
```

But `server/src/index.ts` imports middleware before calling `dotenv.config()`.

Runtime order:

1. `index.ts` imports `rateLimiter`.
2. `rate-limit.ts` evaluates `process.env.MI_CORE_API_KEY`.
3. `MI_CORE_API_KEY` is still undefined.
4. Middleware stores fallback key `mi-core-secret-2026`.
5. Later `dotenv.config()` loads the real key.
6. Runtime monitor sends the real key.
7. Middleware compares real key to stale fallback key.
8. Internal monitor is not skipped and consumes the global IP bucket.

This explains why the monitor could hit 429 after hours when other local traffic shared the same `127.0.0.1` bucket.

## Runtime-Safe Fix Applied

Fix: trusted internal API key bypass with request-time key lookup.

File:

`server/src/middleware/rate-limit.ts`

Change:

```ts
function internalKey(): string {
  return process.env.MI_CORE_API_KEY || 'mi-core-secret-2026';
}
```

The middleware now reads `MI_CORE_API_KEY` at request time, after dotenv has loaded.

Scope remains narrow:

- bypass only applies when `x-api-key` matches the internal key
- bypass only applies to `/api/jarvis/*` and `/api/mi/*`
- public routes remain rate-limited
- unauthenticated traffic remains rate-limited

## Monitor Fix Applied

File:

`scripts/knowledge-final-audit.js`

Phase 4 monitor now sends:

- `x-api-key: <MI_CORE_API_KEY from server/.env>`
- `x-caller-id: knowledge-runtime-monitor`

The raw log records:

- `internal_auth`
- `caller_identity`
- retry-after
- rate-limit headers when present
- PM2 memory/CPU

## Post-Fix Proof

Internal trusted proof:

| Test | Result |
|---|---:|
| Requests | 130 |
| Status 200 | 130 |
| Status 429 | 0 |
| Rate-limit headers | absent |
| Average latency | 132 ms |
| P95 latency | 161 ms |

External unauthenticated proof:

| Test | Result |
|---|---:|
| Requests | 125 |
| Status 200 | 120 |
| Status 429 | 5 |
| Retry-After | 60 |
| Server audit log | written |

This proves:

- the global limiter still protects normal traffic
- internal Knowledge runtime monitor no longer consumes the global bucket
- 429 events now produce root-cause evidence

## Certification Status

Final status after rerun:

`KNOWLEDGE_CERTIFIED`

Completed certification evidence:

- full 6-hour Phase 4 run completed
- 0 unexpected 429
- 0 API failures
- no crash
- no memory leak observed during bounded 6-hour run
- stable latency
- clean raw evidence logs
