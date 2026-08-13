# Phase 7B — Health/Dependency Component Audit

Date: 2026-08-13

Discovery-only audit of every existing health/status/self-heal/probe
implementation, gathered via direct source inspection, before designing the
canonical Phase 7B health contract.

## Component map

| Component | Path | Classification | Notes |
|---|---|---|---|
| `GET /api/health` | `server/src/routes/health.ts` | **MISLEADING** | Public, unauthenticated, **no timeout** on its two `fetch()` calls (ai-service, Ollama) — a hung dependency hangs this handler forever. Shallow: `server`/`python_ai_service`/`ollama` only, no DB, no authority, no knowledge. Bypasses the global rate limiter (mounted before it). Its name implies comprehensiveness it doesn't have. |
| `company-os/self-healing-monitor.ts` | `startSelfHealingMonitor` | **CANONICAL (with existing restart authority)** | Monitors 10 services (PM2 + HTTP probes, 5s timeout each). On PM2-type failure, calls `pm2 restart` — **already has narrow, pre-existing restart authority**, gated by a max-2-per-process in-memory counter. This authority predates Phase 7B and is left untouched (per directive: existing narrow safe recovery behavior may remain). Source of "CEO ALERT: X DOWN" log lines. |
| `operations/self-healing.ts` | `startSelfHealingScheduler` | **OVERLAPPING (dead-ish)** | A *second*, differently-scoped "SelfHeal": 5 min interval, 5 detectors (restart storm, stale connectors, stuck queue/workflows/approvals), **never restarts anything** — only logs incidents and resets in-memory metrics. Overlaps in name/intent with the monitor above but shares no code. |
| Rate-limiter false positive | `middleware/rate-limit.ts` + `self-healing-monitor.ts:73` | **CONFIRMED BUG** | The `evidence-db` probe hits `/api/company-os/health`, which is **not** in `isInternalJarvisCall`'s bypass allowlist (only `/api/jarvis*` and `/api/mi*` prefixes are exempted from the global rate limiter). The probe's own traffic competes with regular API traffic on the same IP-keyed bucket — a request burst can starve the probe into a false 429-driven "DOWN" reading. Root cause confirmed, not just theorized. |
| Ollama health | 5 independent sites: `providers/provider-router.ts` (circuit breaker), `model-router/ollama-router.ts`, `coding/llm/ollama-client.ts`, `executive-intelligence/model-router.ts`, `models/model-health.ts` | **LEGACY (fragmented)** | Five uncoordinated re-implementations of "ping `/api/tags`", no shared truth, no `lastCheckedAt` tracked anywhere except a trip counter (circuit breaker) and a health-status string (`MODEL_REGISTRY`, never scheduled). |
| Python AI service health | `routes/health.ts` only | **DEAD (ping-only)** | Confirmed (again, independently) that nothing else in `server/src` calls ai-service for real generation — every generation call goes Node→Ollama directly. Health-checking a service that's otherwise unused. |
| Google connector health | `visibility/connectors/google/google-auth.ts` `getAuthStatus()` → `GET /api/auth/google/status` | **CANONICAL (reusable)** | Already returns `{configured, has_tokens, status: 'connected'\|'needs_authorization'\|'not_configured'}` via a real, mounted, public route. A second, richer implementation (`intelligence/google-read-client.ts`'s `inspectToken()`/`ConnectorStatus` — distinguishes `TOKEN_EXPIRED`/`INSUFFICIENT_SCOPE`) exists but is **not wired to any route** — legacy/unexposed duplicate. |
| node-agent health | `nodes/node-registry.ts`, `node-registry-persistent.ts` | **DOES NOT EXIST as a data structure** | `NodeRecord.status` is typed only `'online'\|'offline'\|'unknown'`, computed from heartbeat recency. **"BLOCKED_RUNTIME" is not representable in code at all** — it is purely an external/operator classification. A node that never successfully registers (due to the known auth gap) never gets a registry entry; `GET /api/nodes/:id/status` returns `{error:'NODE_NOT_FOUND'}` with **HTTP 200**, not a non-2xx status. Also found: `index.ts`/`routes/nodes.ts` comments claim `/api/nodes` is "public, no auth needed" — the code actually enforces `requireAuth` on every route including `/register`. Pre-existing doc/code mismatch, not fixed here (out of scope). |
| Knowledge health | `personal-os/documents/router.ts` `GET /knowledge-documents/quality-summary` | **CANONICAL (reusable, unnamed)** | Already returns `documents`, `chunks`, `activeDocuments`, `staleDocuments`, `openConflicts`, `failedIngestion`, `retryableIngestion`, `blockedIngestion`, `indexHealth: 'OK'\|'ATTENTION'`. Not documented/named as a health endpoint. A 0-document index currently reports `indexHealth: 'OK'` — no minimum-population signal (gap, addressed in the new model as `EMPTY` vs `AVAILABLE`). |
| Authority health | `authority-control-plane/router.ts` `GET /api/authority/status` | **CANONICAL (reusable)** | Confirmed shape: `{ok, counts, generatedAt}`, `counts` includes `unknownMutations`/`unresolvedLegacyMutations`. **No SHA-provenance-equality endpoint exists** (deployed SHA vs scanner SHA vs snapshot SHA) — new capability needed, added in this phase (read-only, no new mutation). |
| DB integrity | Every store class has an `.integrity()` method; only `GET /personal/integrity` calls one live (Personal OS main store only) | **LEGACY (mostly test-only) with one canonical live exception** | Every other store's `.integrity()` is only ever called from `__tests__`/acceptance scripts, never at runtime. |
| Command Center Health page | `command-center/src/routes/HealthPage.tsx` | **CANONICAL (best existing UI, needs unification)** | Already calls 3 separate endpoints (`/operating/service-health`, `/personal/integrity`, `/intelligence/status`) and reuses SelfHeal's own probe functions — does **not** call `/api/health` at all. Closest existing thing to a real dependency-health UI, but fragmented across 3 fetches with no single aggregate/overall status. |
| Operator Control (Phase 6C) | `operator-control/router.ts` | **UNRELATED** | Surfaces task/plan/delegation/approval blocking state — no PM2/HTTP-probe/DB-integrity concept present. Not a health source. |
| Other PM2 readers | 13+ files across `gstack/`, `operations/`, `company-os/`, `nodes/`, `project-registry/`, `auto-task-engine/` | **LEGACY (fragmented)** | No single "process health" abstraction exists outside Phase 7A's `runtime-preflight/` and `self-healing-monitor.ts` — everything else independently re-execs `pm2 jlist`. |

## Design conclusion

**No second health framework is being built.** The canonical Phase 7B model
(§3 below) is a new, thin aggregation layer that:

- Reuses `self-healing-monitor.ts`'s existing probe functions (PM2 + HTTP
  checks) rather than re-implementing them.
- Reuses `GET /api/auth/google/status` for the Google dimension.
- Reuses `GET /knowledge-documents/quality-summary` for the Knowledge
  dimension.
- Reuses `GET /api/authority/status` for the Authority dimension, extended
  with a new (additive, read-only) SHA-provenance-equality check.
- Adds the one genuinely-missing piece: a `NODE_AGENT` dimension that can
  represent `BLOCKED` (inferred from "PM2 process alive AND not present in
  the node registry", since no such state exists in the registry itself).
- Fixes the rate-limiter false-positive at its confirmed root cause (adds the
  `evidence-db`/`knowledge-db` probe targets to the internal-bypass
  allowlist, or switches those two probes to direct in-process function
  calls instead of HTTP `fetch` — see the implementation doc for the exact
  choice and reasoning).
- Does **not** touch `self-healing-monitor.ts`'s existing PM2-restart
  authority — it is left exactly as it was, frozen, not expanded.
- Does **not** fix the `/api/nodes` public/auth comment mismatch or the
  node-agent registration-auth gap itself — both explicitly out of scope for
  this phase.
