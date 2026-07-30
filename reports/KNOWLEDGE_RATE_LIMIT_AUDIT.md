# KNOWLEDGE_RATE_LIMIT_AUDIT

Generated: 2026-06-12T19:10:00+07:00
Owner: Dev2
Scope: Knowledge Runtime Certification blocker

## Verdict

Root cause identified: global Express rate limiter was exhausted during certification testing.

This was not a Knowledge Search, Knowledge Graph, Project API, or Store API functional failure.

## R1 Findings

| Question | Finding |
|---|---|
| Which endpoint returns 429? | Multiple endpoints returned 429 after the shared bucket was exhausted: `/api/jarvis/graph/stats`, `/api/jarvis/graph/entities?type=project`, `/api/jarvis/graph/entities?type=store`, `/api/projects`, `/api/projects/health`, and later search/lookup calls. |
| What limit triggered? | Global Express middleware: `windowMs = 60,000 ms`, `max = 120` requests per IP. Response headers confirmed `ratelimit-limit: 120`. |
| Expected traffic? | Normal Executive Assistant traffic should be sequential and low volume: health/stats/search/lookup/entity calls, usually under 20 requests per minute per active conversation. |
| Burst traffic? | Prior certification test stacked API checks in the same 60-second window, then retried immediately. That exhausted the shared 120/minute bucket and made unrelated endpoints look unhealthy. |
| Misconfiguration? | No code-level misconfiguration found for a protected local/LAN API. Certification methodology was the immediate cause. Operational note: Dev3 should avoid unnecessary burst calls because all routes share the same limiter. |

## Code Evidence

Rate limiter definition:

`server/src/middleware/rate-limit.ts`

```ts
export const rateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
});
```

Global middleware placement:

`server/src/index.ts`

```ts
app.use(express.json({ limit: '10mb' }));
app.use(rateLimiter);
```

Because this is global, Knowledge, Graph, Entity, Project, Store, and Health requests all consume the same IP bucket.

## Reproduction Summary

Earlier certification sequence generated unexpected 429s because requests were made in rapid batches without waiting for the 60-second limiter window to reset.

Observed 429 examples:

| Endpoint | Result |
|---|---|
| `/api/jarvis/graph/stats` | 429 Too Many Requests |
| `/api/jarvis/graph/entities?type=project` | 429 Too Many Requests |
| `/api/jarvis/graph/entities?type=store` | 429 Too Many Requests |
| `/api/projects` | 429 Too Many Requests |
| `/api/projects/health` | 429 Too Many Requests |

## Clean-Window Retest

After waiting for a clean 60-second limiter window, API checks passed.

| API | Endpoint | Status | Latency |
|---|---|---:|---:|
| Knowledge Health | `/api/jarvis/health` | 200 | 37 ms |
| Knowledge Stats | `/api/jarvis/knowledge/stats` | 200 | 4 ms |
| Knowledge Search | `/api/jarvis/knowledge/search?q=Stone%20Oak&limit=3` | 200 | 66 ms |
| Knowledge Lookup | `/api/jarvis/graph/explore/Stone%20Oak` | 200 | 53 ms |
| Project Entities | `/api/jarvis/graph/entities?type=project` | 200 | 2 ms |
| Store Entities | `/api/jarvis/graph/entities?type=store` | 200 | 3 ms |
| Project API | `/api/projects` | 200 | 4,629 ms |
| Project Health | `/api/projects/health` | 200 | 3 ms |

## Conclusion

The prior blocker was caused by shared global rate-limit exhaustion, not Knowledge runtime failure.

Expected 429 behavior:

- More than 120 requests from the same IP in one 60-second window should return 429.

Unexpected 429 behavior:

- Knowledge/Graph/Project/Store endpoints returning 429 below that threshold.

Clean-window retest found no unexpected 429.
