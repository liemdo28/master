# Phase 7B — Runbook

Date: 2026-08-13

## What changed operationally

- New module `server/src/health-truth/`: `types.ts`, `probes.ts`,
  `aggregate.ts`, `public-router.ts` (`GET /` — mounted at `/api/health`),
  `detail-router.ts` (`GET /health/detail`, `GET /health/dependencies`),
  `phase7b-evaluation.ts` (802-scenario evaluation), `phase7b-performance.ts`
  (latency measurement), `phase7b-acceptance.ts` (20-point acceptance).
- `server/src/routes/health.ts` **deleted** — superseded by
  `health-truth/public-router.ts`. No other file imported it.
- `server/src/index.ts`: import line changed from the old single
  `healthRouter` to `healthPublicRouter`/`healthDetailRouter`; the detail
  router is mounted twice (Command Center session auth + API-key auth),
  matching the existing dual-mount convention used by every other gated
  router since Phase 5E.
- `server/src/company-os/self-healing-monitor.ts`: `evidence-db` and
  `knowledge-db` entries changed from `type: 'http'` to `type: 'internal'`
  (see the Security Boundary doc for why); `personalOsIntegrityIsHealthy`
  now exported; module-level `lastHealthyAt`/`lastFailureAt` tracking and a
  `getLastScanResults()` cache added so health-truth's DATABASE probe never
  triggers a fresh scan itself.
- `command-center/src/routes/HealthPage.tsx` rewritten to consume
  `/health/detail`; `command-center/src/components/StatusBadge.tsx` gained
  4 new states; `command-center/src/lib/types.ts` gained the mirrored
  `SystemHealth`/`DependencyHealth` types.
- New test/eval/acceptance scripts: `test:health-truth-model`,
  `test:health-truth-security`, `test:selfheal-rate-limit-regression`,
  `health-truth:evaluation`, `health-truth:performance`,
  `phase7b:acceptance`.

## What did NOT change

No database schema migration — `personal-os.db` stays v10; health-truth opens
no new database and reuses `DocumentStore`/SelfHeal's existing stores. No new
mutation route. No new external action type. No change to Gmail SEND
(remains absent), financial actions (remain absent), Phase 7A's shell
containment, or WhatsApp outbound containment. Ollama/Google
OAuth/mi-ceo-observer/mi-whatsapp-gateway/mi-n8n were not started, installed,
or reconnected by this phase — health-truth only *observes* their current
state honestly. `mi-node-agent`'s registration/auth gap was not fixed (its
`BLOCKED` state is now visible instead of silently missing).

## Interpreting the states

| State | Meaning | What to do |
|---|---|---|
| `HEALTHY` | Working as expected. | Nothing. |
| `DEGRADED` | A non-required dependency has a problem; core functionality unaffected. | Check `capabilityImpact` for what's actually lost; not urgent. |
| `UNAVAILABLE` | A `REQUIRED_FOR_CORE` dependency is down. | Core functionality is impaired — investigate that specific dependency's `detail`/`reasonCode`. |
| `DISCONNECTED` | An external connector (e.g. Google OAuth) has no valid credential. | Reconnect if that capability is needed; otherwise informational. |
| `BLOCKED` | `AUTHORITY` is unhealthy (unknown/unresolved mutation or provenance mismatch), or a dependency is process-alive but never successfully registered (`NODE_AGENT`). | **AUTHORITY BLOCKED is the one state that always warrants immediate investigation** — it means the governance boundary itself can't be trusted. Check `unknownMutations`/`unresolvedLegacyMutations` via `npm run authority:manifest`, or provenance via `.env`'s `MI_DEPLOYED_SOURCE_SHA` vs. `server/snapshot-manifest.json`. |
| `INTENTIONALLY_DISABLED` | Operator decision, not a failure — `mi-whatsapp-gateway`/`mi-n8n`/`mi-ceo-observer` are not started per the standing Phase 7 safety boundary. | Nothing, unless the operator has decided to re-enable one (a separate, explicit decision outside this phase). |
| `UNKNOWN` | No observation has completed yet (e.g. SelfHeal hasn't run its first scan since process start), or the probe itself errored. | Wait for the next SelfHeal cycle, or check server logs for the specific probe's caught exception message. |

## How to check health

```bash
# Public liveness — no auth, cheap
curl http://localhost:4001/api/health

# Detailed — needs MI_CORE_API_KEY
curl -H "x-api-key: $MI_CORE_API_KEY" http://localhost:4001/api/health/detail

# Dependencies array only
curl -H "x-api-key: $MI_CORE_API_KEY" http://localhost:4001/api/health/dependencies
```

Or via Command Center: **Health** page in the sidebar (session-token gated,
same as every other Command Center screen).

## Performance

Measured via `npm run health-truth:performance` in this dev checkout (Ollama
and the Python AI service are not reachable here, so these numbers reflect
the worst case — every request pays the connection-refused/timeout cost on
both of those probes):

- Isolated `getSystemHealth()` call: ~4.0s.
- `GET /api/health` (public): p50 ~2.6s, p95 ~2.6s.
- `GET /api/health/detail`: p50 ~2.7s, p95 ~2.7s.
- `GET /api/health/dependencies`: p50 ~2.7s, p95 ~2.7s.

This is bounded (never hangs — the pre-Phase-7B `/api/health` handler had
**no timeout at all** on its two fetches, so a hung dependency could hang the
request indefinitely; every probe here uses a 5s `AbortSignal.timeout`), but
not fast when Ollama/AI-service are down. In a production runtime where those
two are actually running, both probes return in low milliseconds and total
latency drops to near-zero; if they're consistently down, latency is stable
at the connection-refused cost, not the full 5s ceiling (confirmed:
observed ~2.6s, not 5s, in this environment — refusal is faster than
timeout). If this ever becomes an operational concern, the two external
probes are the isolable cost center — everything else in the 13-dimension
sweep is either instant (CORE) or reads an already-cached result
(DATABASE/ACCOUNTING/QB_AGENT via SelfHeal's scan; AUTHORITY/KNOWLEDGE/
GOOGLE_CONNECTORS/NODE_AGENT are local reads or single fast calls).

## Troubleshooting

- **AUTHORITY is BLOCKED and I don't know why**: `npm run authority:manifest`
  in `server/`, then check `counts.unknownMutations` and
  `counts.unresolvedLegacyMutations`. If both are 0, check provenance:
  compare `.env`'s `MI_DEPLOYED_SOURCE_SHA` against
  `server/snapshot-manifest.json`'s `deployedSha`.
- **DATABASE is UNKNOWN right after a restart**: expected — SelfHeal hasn't
  completed its first scan yet. It will resolve to `HEALTHY`/`UNAVAILABLE`
  within one scan interval.
- **NODE_AGENT is BLOCKED**: this is the known, pre-existing registration/
  auth gap (Phase 7A discovery, intentionally not fixed here). The PM2
  process is alive but never registers. Not an emergency; secondary-device
  coordination is unavailable but core mi-core functionality is unaffected.
- **A dependency I expected to see is missing from the response**: the 13
  dimensions are fixed (see the Health Truth Model doc); nothing should ever
  be missing. If it is, that's a bug — check server logs for an unhandled
  exception in `getSystemHealth()`.

## Rollback

Standard: redeploy the prior `server/dist`/`command-center/dist` snapshot per
the established deploy convention. Health-truth is entirely additive/
read-only — rolling it back restores the old `/api/health` shape and removes
`/health/detail`/`/health/dependencies`; nothing it touches (SelfHeal's
`evidence-db`/`knowledge-db` check type) requires a data migration to revert.
