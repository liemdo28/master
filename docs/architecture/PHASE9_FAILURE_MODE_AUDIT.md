# Phase 9 — Failure Mode Audit (Section 24)

Optional document, included because this phase's research surfaced enough grounded evidence to fill it honestly rather than speculatively.

| Failure mode | Detection | Containment | Operator signal | Recovery | Autonomous recovery permitted today? |
|---|---|---|---|---|---|
| DB unavailable | `runtime-preflight` integrity checks; `better-sqlite3` throws synchronously | WAL mode limits corruption blast radius | preflight report, health-truth `UNKNOWN`/degraded state | manual (documented in every phase's closure runbook) | No |
| Model (Ollama) unavailable | `/api/health`'s `ollama` field | none needed — no candidate depends on it (Section 18) | `overall: DEGRADED` in health endpoint | manual start (deliberately not automated, per this program's own standing instruction) | No, and correctly not — this program was explicitly told not to auto-start it |
| OAuth unavailable | sandbox identity guard (`assertSandboxGoogleIdentity`) would fail closed | `fixture` mode is the default, never touches a real provider | proposal/execution would fail with a provider error, recorded as evidence | manual (re-auth) | No |
| External API unavailable (QB agent, Google) | `qb-financial.ts`'s `/health-check` computes staleness; Google calls would throw | read-only proxy for QB; sandbox identity guard for Google | staleness classification (`QB_LIVE`/`QB_STALE`/`QB_NEVER_SYNCED`) | manual | No |
| PM2 desync (the actual incident this program hit) | none automated — was discovered manually during Phase 8 closure verification | none — this was the actual gap | restart counter, `EADDRINUSE` log lines, `[O1-INCIDENT]`/`[O9-SELFHEAL]` alerts | manual, as performed in the Phase 8 incident (verified-identity → targeted stop → verified-orphan kill → single-app restart) | **No** — and per this audit's Section 13 finding, doing so autonomously would require a new authority boundary that doesn't exist |
| Port collision | `runtime-preflight/validator.ts` (report-only), `operations/boot-preflight.ts` (report-only) | neither binds/kills — observation only, by deliberate tested design | preflight report | manual | No, deliberately (regression-locked) |
| Restart storm | `operations/self-healing.ts`'s `detectRestartStorm()` (>50/24h → P1, >20 → P2) | none — detection only, no corrective action for this specific check (`runSelfHealingCheck()` never calls a corrective action for `restart_storm`) | `[O1-INCIDENT]`/`[O9-SELFHEAL]` console logs | manual | No |
| Stale deployed provenance | `runtime-preflight`'s `deploy-snapshot` check (compares `.env` SHA against `snapshot-manifest.json`) | self-correcting once both files are updated together | preflight `FAIL`/`WARN` | manual (this program hit this exact mismatch once during Phase 8D closure and fixed it manually) | No |
| Policy deny | `ActionPolicyEngine.evaluate()` | proposal blocked before any side effect | evidence record + decision hash | new proposal required | N/A — this is the containment working as intended |
| Risk deny | same engine | same | same | same | N/A |
| Budget exceeded | `BudgetManager.reserveExecution()` fail-closed | execution blocked | evidence record | wait for period reset or new budget row | N/A — working as intended |
| Kill switch active | checked twice (policy engine + orchestration standalone re-check) | plan paused, not silently skipped | `KILL_SWITCH_BLOCKED` evidence event | manual disable via governed endpoint | N/A — working as intended |
| Approval missing | `requireWaitingProposal` guard | execution rejected | proposal stays `WAITING_APPROVAL`, visible in operator queue | human approves | N/A |
| Approval expired | proposal expiry field checked at approval time | rejected | evidence | new proposal | N/A |
| Execution timeout | not specifically audited in this pass — flagged as NOT_VERIFIED | — | — | — | NOT_VERIFIED |
| Duplicate execution | idempotency key lookup in `prepareExecution()` before calling any provider | re-execution returns prior result, never re-sends | evidence | N/A — prevented, not just detected | N/A |
| Partial external success | **this is exactly the unimplemented reconciliation gap** — no code path distinguishes "definitely failed" from "possibly succeeded, unknown" | none — `RECONCILIATION_REQUIRED`/`RECOVERY_REQUIRED` are declared, never set | would surface as a plain `FAILED`, losing the distinction | manual investigation required, no tooling support | No, and cannot be until this gap is closed |
| Evidence write failure | not specifically audited in this pass — flagged as NOT_VERIFIED | — | — | — | NOT_VERIFIED |
| Reconciliation required | same as "partial external success" above — the state exists in the type system, never reached | — | — | — | No — capability does not exist |
| Project scope ambiguous | cross-project step targeting is a hard validation failure at plan creation | rejected before execution | validation error | fix the plan | N/A |
| Session stale | `requireRemoteAuth`'s session handling — not exhaustively audited in this pass | — | — | — | PARTIALLY_VERIFIED |
| CI timing variance | `cancel-race-regression.test.ts`'s calibration self-check (Discovery doc Section 20) | none needed — the underlying safety property is unaffected | CI failure + re-run passing is itself the signal | re-run (as this program has done twice, both times resolving cleanly) | N/A — test infrastructure, not production |

**Two rows are honestly marked NOT_VERIFIED / PARTIALLY_VERIFIED** (execution timeout, evidence write failure, session staleness) rather than filled with a plausible-sounding guess — none of the four research passes traced these specific paths to conclusive evidence within their budget. Recommended as follow-up items for a future audit, not asserted here.
