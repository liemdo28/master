# Phase 9O — QB Agent Authority Reclassification + Ingest Route

**Status: CODE CHANGE, VALIDATED, NOT DEPLOYED.** This phase unblocks the QuickBooks laptop1 agent by narrowly reclassifying two pre-existing POST routes and adding one new route — all backed by test evidence, all confirmed to leave every other authority surface (including a separate, deliberately-locked financial-safety invariant) untouched. Nothing has been deployed to the running `mi-core` process; this is a reviewable code change only.

## A. Problem reported

Dev1's QuickBooks agent on laptop1, after resolving its own local runtime issues, reported three blockers when talking to `mi-core`:

- `POST /api/qb-agent/register` → `409 LEGACY_AUTHORITY_QUARANTINED`
- `POST /api/qb-agent/heartbeat` → `409 LEGACY_AUTHORITY_QUARANTINED`
- `POST /api/qb/ingest` → `404 Cannot POST /api/qb/ingest`
- `GET /api/qb-agent/commands?machine_id=qb-laptop-01` → `200` (works, with the current X-API-Key)

## B. Root cause (read-only discovery, before any change)

**409s on register/heartbeat:** a global middleware, `legacyAuthorityBoundary` (`server/src/authority-control-plane/guard.ts`, mounted at `server/src/index.ts:276` before all route mounts), intercepts every request and checks it against `server/authority-manifest.json`. A single broad catch-all rule in `server/src/authority-control-plane/registry.ts` (`legacy-sensitive-local`) matches **28 API prefixes** including `qb-agent` and `qb`, and blanket-assigns every POST mutation under those prefixes `phase6bDisposition: QUARANTINE_ONLY` — with `canonicalReplacement: "Phase 5 canonical stores as applicable"`, a placeholder that was never implemented for this domain. `qb-agent.ts`'s own route handlers have no quarantine logic at all; the block happens entirely upstream, before the handler ever runs. All 12 POST routes under `/api/qb-agent/*` were caught by this same rule. GET routes on the same paths are unaffected because the boundary only intercepts mutations.

**404 on `/api/qb/ingest`:** this route never existed. `qb-financial.ts` (mounted at `/api/qb`) only has GET routes. There is a `ingestQuickBooks()` function (`server/src/bigdata/connectors/quickbooks/ingest.ts`), but it is a **pull-based, Postgres-backed** internal/CLI job (via `ingestJson()` → `server/src/bigdata/source-registry.ts`, which uses `pgQuery`/`pgQueryOne`) — an entirely separate, heavier dependency from the SQLite `qb-agent.db` the rest of this flow uses, and not confirmed to have a registered source for QuickBooks at all. It was never a push-based HTTP endpoint.

**X-API-Key auth:** already works and required no change. Both `requireAgentAuth` (inner, `qb-agent.ts`) and `requireTaskRuntimeAuth` (outer, mounted on `/api/qb` in `index.ts`) already accept `X-API-Key` matching `MI_CORE_API_KEY`/`AGENT_CODING_API_KEY`.

## C. Decision: narrow reclassification, not a blanket unquarantine

Per-route review of all 12 POST routes under `/api/qb-agent/*`:

| Route | Effect | Included in this phase? |
|---|---|---|
| `register` | Local telemetry — upserts machine identity into `machines` table | **YES** |
| `heartbeat` | Local telemetry — inserts heartbeat row, updates `machines.status` | **YES** |
| `event`, `error`, `activity-log-result`, `sync-result`, `timeline-result`, `sync-cycle`, `qb-files` | Local telemetry — insert/upsert rows describing already-happened local sync activity | NOT included this phase (not reported as blocked; left quarantined pending separate review) |
| `commands` (create) | **Not pure telemetry** — creates a row later polled and acted on by the remote agent (`GET /commands` returns pending rows). A free-form dispatch/control surface, not a report of state. | **Explicitly excluded** — deserves its own review, not bundled here |
| `commands/:id/ack`, `commands/:id/result` | Report outcome of an already-created command | NOT included this phase (not reported as blocked) |

Only `register` and `heartbeat` — the two routes actually blocking the reported laptop1 agent — are reclassified. A third, brand-new route, `ingest`, is added for the same reason (generic local telemetry write) and included from the start.

## D. Code change

**`server/src/authority-control-plane/registry.ts`** — one new narrow rule inserted before the `legacy-sensitive-local` catch-all (first-match-wins array, matching the file's existing convention — see `health-detail`, `browser-extract-contained` for precedent):

```ts
rule('qb-agent-machine-registry', /^\/api\/qb-agent\/(register|heartbeat|ingest)$/, {
  authorityClass: 'ADAPTER_TO_CANONICAL', effectClass: 'LOCAL_REVERSIBLE',
  canonicalOwner: 'QB Agent Machine Registry', auth: 'STRICT_API_KEY', methods: ['POST'],
  phase6bDisposition: 'ADAPT_SAFE', ...
})
```

`ADAPT_SAFE` is explicitly excluded from `legacyAuthorityBoundary`'s matcher (`guard.ts`: `surface.phase6bDisposition !== 'ADAPT_SAFE'`), so these three routes now pass straight through to their real, already-existing (or newly added) handlers. All other 10 POST routes under `/api/qb-agent/*`, and everything else matched by `legacy-sensitive-local`, are untouched.

**`server/src/routes/qb-agent.ts`** — exported a small `recordIngestEvent()` helper (refactored out of the existing `POST /event` handler, same `events` table, no schema change), and added `POST /api/qb-agent/ingest` using it.

**`server/src/routes/qb-financial.ts`** — **no functional change.** A route was *not* added here (see next section).

## E. Rejected design: `POST /api/qb/ingest` under `/api/qb`

The original plan was to add the ingest route at the literal path the user reported (`/api/qb/ingest`). Validation caught that this would violate a **pre-existing, deliberately locked security invariant**: `server/src/__tests__/phase8a-security.test.ts` asserts

```
assert.ok(!/qbFinancialRouter\.(post|put|patch|delete)\(/.test(qbSrc),
  '/api/qb must expose no mutation route (GET-only financial proxy)');
```

labeled `financialExecutionReachable=0` — a Phase 8A guarantee that the QuickBooks financial-data proxy router can never gain any mutation capability, enforced at the router-source level with zero exceptions. This is a financial-safety boundary, not an incidental restriction, and this phase does not touch it. The ingest route was moved to `POST /api/qb-agent/ingest` instead — the router where POST mutations are already expected and already exist. **If laptop1's agent is hardcoded to call `/api/qb/ingest` specifically, Dev1 needs to point it at `/api/qb-agent/ingest` instead** (or a redirect/config change on laptop1's side) — this document does not propose relaxing the Phase 8A invariant.

## F. Auth preserved

No auth change was needed. `register`, `heartbeat`, and the new `ingest` route are protected exactly as before by `requireAuth` (outer, `/api/qb-agent` mount) + `requireAgentAuth` (inner, `qb-agent.ts`), both of which already accept `X-API-Key` matching `MI_CORE_API_KEY`/`AGENT_CODING_API_KEY`. The new registry rule's `auth: 'STRICT_API_KEY'` documents this accurately (upgraded from the catch-all's generic `REMOTE_SESSION` label, which didn't reflect the actual enforced mechanism).

## G. Validation

All validation was run against a temporary copy of the edited files placed in the deployed source tree (`F:/Projects/mi-core/server/src`, which has working `node_modules` including native `better-sqlite3` — the git worktree does not) **for validation only**. The deployed directory was byte-for-byte restored to its original committed state immediately after (confirmed via diff against `git show HEAD:...` for every touched file) — no deploy, no rebuild of `dist/`, no PM2 action, no lasting change to production.

| Check | Result |
|---|---|
| `npm run authority:manifest:check` (before regenerating) | Correctly failed `AUTHORITY_MANIFEST_STALE` — expected, since the manifest wasn't yet regenerated |
| `npm run authority:manifest` (regenerate) | Wrote new manifest cleanly |
| `npm run authority:manifest:check` (after) | **PASS** |
| Surface-level diff, old manifest vs. new | **Added:** `http:POST:/api/qb-agent/ingest`. **Changed:** `http:POST:/api/qb-agent/heartbeat`, `http:POST:/api/qb-agent/register` (both `QUARANTINE_ONLY`→`ADAPT_SAFE`). **Removed:** none. All ~1070 other surfaces byte-identical. |
| Manifest counts | `total 1072→1073`, `mutations 393→394`, `adaptedLegacy 7→10`, `quarantinedLegacy 167→165`, `legacyMutations 174→175` — reconciles exactly to 1 new route + 2 reclassified routes |
| `authority-control-plane.test.ts` | PASS |
| `legacy-authority-adapters.test.ts` | PASS — new owner `QB Agent Machine Registry` shows exactly 3 surfaces |
| `self-healing-restart-authority.test.ts` (Phase 9A governance regression) | PASS — 14 invariants |
| `phase7c-legacy-mutation-scan.test.ts` | PASS — 40/40 |
| `phase7g-legacy-authority-scan.test.ts` | PASS — 50/50 |
| `phase7c-legacy-containment.test.ts` | PASS — 4/4 |
| `phase8b-legacy-retirement.test.ts` | PASS |
| `phase8a-security.test.ts` | **PASS** — `financialExecutionReachable: 0`, `legacyMutationBypass: 0`, `unknownMutations: 0`, `unresolvedLegacyMutations: 0` (this is the test that caught the rejected `/api/qb/ingest` design in Section E) |
| `npx tsc --noEmit` (full server, temporary `tsconfig.json` copied in for this one check since the deployed tree doesn't carry it, removed after) | Zero errors |

## H. What remains explicitly out of scope

- The other 10 POST routes under `/api/qb-agent/*` remain quarantined, including `commands` (the dispatch surface) — not reported as blocked, and `commands` specifically needs its own review given its control-surface nature.
- No change to the `legacy-sensitive-local` catch-all rule itself (it still governs `whatsapp`, `memory`, `bigdata`, and ~25 other prefixes unrelated to this phase).
- No change to the Phase 8A `/api/qb` GET-only financial-proxy invariant.
- No change to `ingestQuickBooks()`/the Postgres-backed bigdata pipeline.
- QuickBooks financial data itself (accounts/receipts/invoices) is untouched — this phase only concerns machine-registry/heartbeat/generic-ingest telemetry.
- **No deploy.** `dist/` was not rebuilt, `mi-core` PM2 process was not restarted, and the running system's behavior is unchanged until this PR is merged, built, and separately, explicitly authorized to deploy.

## Authority / production boundary

- Application code changed: **YES** (first code change in this program to date — every prior Phase 9 sub-phase was docs-only or a single Windows host-config mutation).
- Schema changed: NO (reuses the existing `events` table; `recordIngestEvent()` is a refactor of existing insert logic, not a new table).
- `ActionType` changed: NO.
- Authority delta: **exactly 3 surfaces** (2 reclassified, 1 added), fully enumerated in Section G; ~1070 other surfaces confirmed byte-identical.
- Deploy performed: **NO.**
- PM2 restarted: **NO.**

## Final classification

```
PHASE 9O CLASSIFICATION:   CODE_CHANGE_VALIDATED_NOT_DEPLOYED
AUTHORITY_DELTA:           3 surfaces (register, heartbeat reclassified; ingest added) — enumerated, minimal
FINANCIAL_INVARIANT:       PRESERVED (phase8a-security.test.ts financialExecutionReachable=0 still holds)
DEPLOY_STATUS:             NOT DEPLOYED — requires separate explicit authorization after merge
```

## Recommendation

Merge this as a docs+code PR after review. **Deploying it to the live `mi-core` process (rebuild `dist/`, copy to `F:/Projects/mi-core`, restart via PM2) is a separate action** requiring its own explicit authorization, consistent with how every production-affecting step in this program has been handled. Until deployed, laptop1's agent will continue to see the same 409/404 behavior — merging this PR alone does not unblock it.
