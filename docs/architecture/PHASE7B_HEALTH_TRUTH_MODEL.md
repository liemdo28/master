# Phase 7B — Health / Dependency Truth Model

Date: 2026-08-13

## Mission

Make Jarvis report actual operational state truthfully. A dependency being
unavailable must not report the whole system as generically DOWN when core
functionality remains healthy. An intentionally-disabled service must not be
reported unhealthy. Phase 7B adds **visibility**, not authority — see
[`PHASE7B_HEALTH_BOUNDARY.md`](../security/PHASE7B_HEALTH_BOUNDARY.md) for the
hard line between the two.

## The contract (`server/src/health-truth/types.ts`)

`DependencyState` is one of 7 values — **never a boolean**:

`HEALTHY | DEGRADED | UNAVAILABLE | DISCONNECTED | BLOCKED | INTENTIONALLY_DISABLED | UNKNOWN`

Each dependency also carries a `Criticality` (`REQUIRED_FOR_CORE` /
`OPTIONAL_DEGRADED` / `FEATURE_SCOPED` / `INTENTIONALLY_DISABLED`), a
structured `ReasonCode` (never free text as a decision input — free text is
for the `detail` field only, which is display-only), a `capabilityImpact:
string[]` (what Jarvis can/cannot still do because of this state), and
`lastCheckedAt`/`lastHealthyAt`/`lastFailureAt` (`string | null` — `null`
means "never observed," never fabricated).

The 13 monitored dimensions (`DependencyId`): `CORE`, `DATABASE`, `AUTHORITY`,
`KNOWLEDGE`, `PYTHON_AI`, `LOCAL_MODEL`, `GOOGLE_CONNECTORS`, `NODE_AGENT`,
`ACCOUNTING`, `QB_AGENT`, `WHATSAPP`, `N8N`, `CEO_OBSERVER`.

`SystemHealth` bundles all of the above plus a computed `overall` (`HEALTHY |
DEGRADED | UNAVAILABLE | BLOCKED`) and `overallReason`, plus a `legacy` block
that reproduces the pre-Phase-7B `/api/health` response shape byte-for-byte
for backward compatibility.

## Deterministic aggregation (`server/src/health-truth/aggregate.ts`)

`computeOverall()` is a pure function of `(state, criticality)` pairs — no
free-text heuristics, no averaging:

1. **AUTHORITY checked first and separately.** If `AUTHORITY` is not
   `HEALTHY` (and its criticality isn't `INTENTIONALLY_DISABLED`, a defensive
   branch that never triggers with the real probe wiring), overall is
   `BLOCKED`. This is a stronger claim than "a dependency is down" and no
   other state may mask it — verified by a dedicated priority-ordering test
   family (`AUTHORITY` bad + another `REQUIRED_FOR_CORE` dependency bad
   simultaneously → still `BLOCKED`, never `UNAVAILABLE`).
2. Any other `REQUIRED_FOR_CORE` dependency not `HEALTHY` (and not
   `INTENTIONALLY_DISABLED`) → `UNAVAILABLE`.
3. Any dependency not `HEALTHY`/`INTENTIONALLY_DISABLED`, and not itself
   `INTENTIONALLY_DISABLED`-criticality → `DEGRADED`.
4. Otherwise → `HEALTHY`.

`INTENTIONALLY_DISABLED` dependencies never contribute to any of the above —
being off on purpose is not unhealthiness.

## Reuse-not-rebuild — what each probe actually calls

`server/src/health-truth/probes.ts` has one function per dimension. None of
them re-implement a check that already exists canonically:

| Dimension | Reuses |
|---|---|
| CORE | Trivial — the handler executing is itself proof. |
| DATABASE | `self-healing-monitor.ts`'s **cached** last scan (`getLastScanResults()`) — never a fresh `PRAGMA integrity_check` per health request (see "Layered DB health" below). |
| AUTHORITY | `generateAuthorityManifest()` — the exact function `/api/authority/status` and every prior phase's acceptance script already uses. |
| PROVENANCE | Same `MI_DEPLOYED_SOURCE_SHA`/`snapshot-manifest.json` comparison used by deploy verification, folded into AUTHORITY's own state (not a separate, missable dimension). |
| KNOWLEDGE | `DocumentStore.stats()` / `.listDocuments()` (Phase 6E's canonical store). |
| GOOGLE_CONNECTORS | `getAuthStatus()` from `visibility/connectors/google/google-auth.ts`. |
| NODE_AGENT | `checkPm2Service()` (SelfHeal) + `getAllNodes()` (`nodes/node-registry.ts`), combined — see "NODE_AGENT BLOCKED" below. |
| ACCOUNTING / QB_AGENT | SelfHeal's cached PM2 scan, via the same `scanEntry()` helper as DATABASE. |
| WHATSAPP / N8N / CEO_OBSERVER | `fs.existsSync()` against each service's runtime directory — read-only, observational. |

No new database, no new schema migration (`personal-os.db` stays v10), no new
process/PM2/port/orphan-detection logic — that stays owned by Phase 7A's
`runtime-preflight/validator.ts`, exercised (not duplicated) from the
evaluation harness.

### Layered DB health

`probeDatabase()` reads `self-healing-monitor.ts`'s cache — populated by
SelfHeal's own periodic scan — and never opens a database connection or runs
`PRAGMA integrity_check` itself. If no scan has completed yet since process
start, it honestly reports `UNKNOWN`, not a fabricated `HEALTHY`. The
*existing* deep integrity check (SelfHeal's own scan, plus
`/api/personal/integrity`) is unchanged; Phase 7B only adds a read of its
result.

### Knowledge: EMPTY vs. failure

`probeKnowledge()` distinguishes `stats.documents === 0` (`INDEX_EMPTY`,
still reported `HEALTHY` — an empty index is a valid state, not a failure)
from a thrown exception opening the store (`INDEX_UNAVAILABLE`, reported
`UNAVAILABLE`).

### NODE_AGENT's BLOCKED state

`node-registry.ts`'s own data model has no "blocked" status
(`NodeRecord.status` is only `'online' | 'offline' | 'unknown'`) — confirmed
during the Phase 7B discovery audit. `BLOCKED` is inferred at this layer from
combining two independent, already-canonical signals: the PM2 process is
alive (`checkPm2Service`) **and** absent from `getAllNodes()`. This is the
known registration/auth gap from Phase 7A (explicitly not fixed in 7B per the
hard safety boundary) — now visible instead of silently missing.

## Bugs the evaluation harness caught (and fixed)

The `health-truth:evaluation` script (802 scenarios, see
[`PHASE7B_ACCEPTANCE.md`](../roadmap/PHASE7B_ACCEPTANCE.md)) is not a
formality — it found two real correctness bugs in `aggregate.ts` during
development, both fixed before this phase closed:

1. `requiredDown`'s `find()` predicate was missing the same
   `state !== 'INTENTIONALLY_DISABLED'` exclusion `degraded`'s predicate
   already had — an asymmetry that would incorrectly force `UNAVAILABLE` for
   a hypothetical future `REQUIRED_FOR_CORE` dependency reporting
   `INTENTIONALLY_DISABLED` (dormant with today's probe wiring, since only
   `WHATSAPP`/`N8N`/`CEO_OBSERVER` — all `INTENTIONALLY_DISABLED`-criticality
   — ever report that state, but a real internal-consistency bug).
2. The provenance-mismatch fold into `AUTHORITY` (`state → UNAVAILABLE`,
   `reasonCode → PROVENANCE_MISMATCH`) forgot to also set a non-empty
   `capabilityImpact`, silently inheriting the empty array from the
   healthy-AUTHORITY branch it was spread from. This was **live**, not just
   synthetic: this dev checkout has no `.env`, so
   `MI_DEPLOYED_SOURCE_SHA`/`_ROOT` are unset, provenance is reported
   not-aligned, and the fold path ran for real on every evaluation run.

Both are regression-locked in `phase7b-health-truth-model.test.ts`.

## Canonical read-only APIs

- `GET /api/health` — public, unauthenticated, unchanged legacy shape
  (`server`/`python_ai_service`/`ollama`/`timestamp`) plus a new `overall`
  field. Cheap: only probes AI-service/Ollama reachability, never runs the
  full dependency sweep. Bounded by a 5s `AbortSignal.timeout` on each probe
  (the original handler had no timeout at all — see the Runbook).
- `GET /api/health/detail` — full `SystemHealth`. Authenticated.
- `GET /api/health/dependencies` — `{ generatedAt, dependencies }` only.
  Authenticated.

Mounted in `server/src/index.ts`: `healthPublicRouter` at `/api/health`
(no auth); `healthDetailRouter` at both `/api/command-center`
(`requireRemoteAuth` — Command Center's PIN session) and bare `/api`
(`requireTaskRuntimeAuth` — API key), matching the dual-mount convention
established by every other Command-Center/API-key-gated router since Phase
5E.

`public-router.ts` and `detail-router.ts` are two separate files (not one
file exporting two routers) — see
[`PHASE7B_HEALTH_BOUNDARY.md`](../security/PHASE7B_HEALTH_BOUNDARY.md) for
why: the authority-control-plane scanner attributes routes to a mount by
scanning the *entire source file* a router symbol comes from, not just that
symbol's own routes, so one file exporting both would have made the scanner
attribute `healthDetailRouter`'s routes to `healthPublicRouter`'s mount too.

## Command Center

`command-center/src/routes/HealthPage.tsx` was rewritten to fetch
`/health/detail` and render OVERALL plus four groups (Core, AI / Knowledge,
Connectors, Background services), each dependency shown with a state badge,
criticality, detail, capability impact, and last-checked/last-healthy
timestamps. `StatusBadge.tsx` gained four new states
(`DEGRADED`/`UNAVAILABLE`/`DISCONNECTED`/`INTENTIONALLY_DISABLED`). No
button, no `onClick`, no `api.post`/`patch`/`del` call anywhere on the page —
verified both by a unit test and a structural acceptance check.
