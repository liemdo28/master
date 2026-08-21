# Phase 9E — Reconciliation and Outcome-Truth Audit

**Mode: DISCOVERY + VERIFICATION + CLASSIFICATION ONLY.**

## 1. System-wide reconciliation matrix

| Capability | Reachable? | Classification | Basis |
|---|---|---|---|
| QB remote command insert | Yes | **IDEMPOTENCY_ONLY** | Atomic transactional insert (see Background Worker doc §7); no retry/reconciliation on the CEO-notify failure path (`sendToCeo(...).catch(()=>{})`) |
| QB command ack/result write | Yes (`routes/qb-agent.ts:424-437`, mounted `/api/qb-agent`) | **NO_RECONCILIATION** | Bare synchronous `db.prepare(...).run(...)` with **no try/catch** on either the `/ack` or `/result` route handler. If the remote machine genuinely executed the command but this write throws, the command silently stays `pending`/`acked` forever with no cross-check against the remote machine's own log. No compensating scan exists anywhere in the codebase for "remote succeeded, local write lost." |
| WhatsApp send (direct `sendWhatsApp`/`sendToCeo` callers) | Yes | **RECONCILIATION_PARTIAL** | Gates `delivered = res.ok`, writes a durable JSON outbox (`whatsapp-sender.ts:35-46`) — real evidence, but no retry-across-restart and no idempotency key, so a timeout-after-actual-delivery scenario has no dedup (a naive retry would double-send) |
| WhatsApp send (`queueToCeo` callers — jarvis-proactive-monitor, daily-briefing-scheduler) | Yes | **NO_RECONCILIATION** | Fire-and-forget (`whatsapp-sender.ts:153-155`, `.catch(()=>{})`); caller never observes success/failure at all |
| Gmail send | **NOT_REACHABLE** | — | `GMAIL_SEND_DRAFT` unconditionally throws "not implemented" (`actions/service.ts:642`); the legacy `google-executor.ts` send path has zero callers, confirmed by the codebase's own regression test asserting `callers === 0` |
| Gmail draft creation | Reachable via explicit human propose→approve→execute | **IDEMPOTENCY_ONLY** | `getExecutionByIdempotencyKey` lookup has no status filter (`store.ts:245-248`) — a crash between the real provider call succeeding and the completion DB write leaves a stuck `EXECUTING` row that blocks retry but is never itself reconciled or completed. Additionally gated behind non-default `sandbox` mode + `SAFE_GOOGLE_SANDBOX=1` + exact-account match; `live` mode is unconditionally blocked. |
| Calendar event creation | Reachable, same gates as Gmail draft | **IDEMPOTENCY_ONLY** | Same crash-between-provider-call-and-completion gap |
| Drive write | **NOT_REACHABLE** | — | No `ActionType` exists for Drive at all; the only live Drive code is an explicitly read-only connector |
| Browser actions | Reachable (`/api/browser/extract`) | **OBSERVABILITY_ONLY** | No execution/result persistence, no idempotency key at all in `browser-router.ts`; whatever containment exists is at the SSRF/URL-validation layer, not the reconciliation layer |
| Project/task orchestration (Controlled Actions) | Reachable, but no live external side effect currently possible | **NOT_VERIFIED for a real remote provider** | `live` provider mode is hard-coded to always return `PROVIDER_UNAVAILABLE` (`actions/service.ts:382-391`) regardless of configuration — so the "transport times out after remote actually succeeded" scenario is currently structurally unreachable, not solved |
| Financial/QuickBooks writes | Same as QB command insert/ack above | **NO_RECONCILIATION** (via the ack/result gap) | No separate financial mutation path exists in `server/src` beyond the command-queue-for-remote-machine pattern |
| PM2/process recovery (self-healing-monitor) | Yes | **RECONCILIATION_PARTIAL** | Durable per-decision log, real kill-switch/intentional-stop gates, but "recovery" is only confirmed on the *next* scan cycle, not via an immediate post-restart confirmation loop (this is intentional and honestly logged: `"...will confirm recovery on next scan"`, not a false claim) |
| Coding/git/deploy from a running production instance | **NOT_REACHABLE unprompted** | — | The only `git commit` call in `coding/` runs inside an isolated, throwaway worktree the coding workflow itself creates — not the production checkout or its branch. No `git push`, no PR-open/merge, no autonomous deploy/restart capability exists anywhere reachable from a route or background worker. |

## 2. Outbound / execution truth audit

The most consequential ~15 claims found, each checked against whether the underlying action is truly confirmed before the claim is logged:

| Claim | Location | Classification |
|---|---|---|
| `"Morning sent for ${date}"` | `daily-briefing-scheduler.ts:31` | **FALSE_SUCCESS_RISK** — logged before the fire-and-forget send resolves |
| `"Evening sent for ${date}"` | `daily-briefing-scheduler.ts:110` | **FALSE_SUCCESS_RISK** — same pattern |
| `"CEO ALERT: ${svc} DOWN..."` | `self-healing-monitor.ts:372-373` | **FALSE_SUCCESS_RISK** — `sendCeoAlert` only checks for a thrown network error, never inspects `res.ok`; an HTTP 4xx/5xx from the gateway is silently swallowed while the caller logs the alert as sent |
| `sendToCeo`/outbox `delivered` flag | `whatsapp-sender.ts:56-70` | **TRUTHFUL** — gated on real `res.ok`, failures recorded with an error field |
| `"...Em đã tự động kích hoạt QB sync"` (QB trigger notify) | `qb-online-watcher.ts:138-143` | **ATTEMPT_ONLY_BUT_LABELLED_CORRECTLY** — only sent on a genuine new insert, and worded as describing the local trigger, not remote completion |
| `"Restart command issued for ${svc}... will confirm recovery on next scan"` | `self-healing-monitor.ts:357` | **TRUTHFUL** — explicitly hedged, doesn't claim recovery |
| `"${svc.name} recovered after ${count} restart(s)"` | `self-healing-monitor.ts:380` | **TRUTHFUL** — gated on a real, current health check |
| `"Email sent to ${to} — Message ID: ${id}"` | `actions/google-executor.ts:64` | **TRUTHFUL when reachable, but NOT_REACHABLE** — zero callers |
| `"Draft created — ID: ${id}"` | `actions/google-executor.ts:99` | **NOT_REACHABLE** — same dead dispatcher |
| `"Event created: ..."` / `"Uploaded ... to Google Drive"` / `"Asana task created..."` / `"Dashboard task created..."` | `google-executor.ts:159,246,302,342` | **NOT_REACHABLE** — all four routed only through a dispatcher (`routes/actions.ts`) that is never mounted in `index.ts` |
| `action.execution.completed` evidence (real Controlled Action path) | `actions/service.ts:370-379` | **TRUTHFUL** — written only after the provider call returns, with a correct `FAILED` transition on a thrown error |
| Approval queue `status='executed'` | `approval/gate.ts:192-195` | **NOT_VERIFIED / dead** — documented by the code's own comment as status-only, never wired to a real dispatch |

**Zero confirmed FALSE_SUCCESS instances where an external system was actually acted upon and the claim was false** — the false-success-risk items found (daily-briefing, jarvis-proactive-monitor's alert, self-healing's CEO alert) are all cases of *logging optimistically before/without checking a real result*, not cases where a verified failure was actively misreported as success. This is a real gap worth closing, but it is narrower than "the system lies about outcomes" — it is "the system doesn't wait to find out."

## 3. Manifest vs runtime mismatch table (8 declared BACKGROUND_WORKER surfaces)

| Surface | Manifest claim | Runtime reality | Match? | Risk |
|---|---|---|---|---|
| `background:scheduler` | No approval/quarantine claim | Matches (read-only sync) | Yes | SAFE_METADATA_DEBT |
| `background:burn-in` | No approval/quarantine claim | Matches | Yes | SAFE_METADATA_DEBT |
| `background:self-healing-scheduler` | `LEGACY_QUARANTINED`, `quarantineHandler:null` (honest non-claim) | No code-verified guard exists, matching the honest non-claim | Yes | SAFE_METADATA_DEBT |
| `background:self-healing-monitor` | `quarantineHandler:'selfHealingMonitor.evaluateRestartEligibility'` (real override) | Confirmed real: allowlist + kill-switch + intentional-stop + durable log | Yes | Resolved (Phase 9A) |
| `background:jarvis-proactive-monitor` | `LEGACY_QUARANTINED`, `quarantineHandler:null` (honest non-claim) | Confirmed no enforcement exists | Yes (manifest is honest) | BEHAVIORAL_SECURITY_GAP exists in the underlying capability, but the manifest does not misrepresent it |
| `background:daily-briefing-scheduler` | Same pattern | Confirmed no enforcement | Yes | BEHAVIORAL_SECURITY_GAP exists, manifest is honest |
| `background:leader-heartbeat` | `ADAPTER_TO_CANONICAL`, local-only | Confirmed local lock-file logic only | Yes | SAFE_METADATA_DEBT |
| `background:qb-online-watcher` | `LEGACY_QUARANTINED`, `quarantineHandler:null` | Code now has a genuine idempotency guard not cited as an override | Yes, but **understated** in the safe direction (claims less enforcement than actually exists) | SAFE_METADATA_DEBT |

The manifest's `LEGACY_AUTHORITY_BACKGROUND_FALSE_ENFORCEMENT_CLAIM` guardrail (`scanner.ts:272-280`, added by Phase 9A) was independently re-verified: it throws if any `BACKGROUND_WORKER` claims `approvalRequired:true` or the HTTP-only quarantine handler. None of the 8 declared workers currently violate this. **No IMMEDIATE_STOP_CONDITION found.** The 2 undeclared workers (review-approval sweep, whatsapp-key-manager cleanup — see Background Worker doc §1) are a completeness gap in the manifest itself, not a false-enforcement-claim violation.

## 4. Answers to the reconciliation questions

- **Is `RECONCILIATION_REQUIRED` actually reachable?** No. It exists only as a declared enum value and an allowed state-machine transition (`orchestration/types.ts`); no code path in `GovernedOrchestrationService.advance()`/`advanceControlledActionStep()` ever sets it. This is a type-level aspiration with zero producer, not implementation.
- **Does simulation drift from production execution?** Partially by design, not by accident: `AutomationSimulationService` deliberately never mutates production DB or calls the real propose/approve/execute path (by its own header comment), but it does reuse the real policy engine, risk evaluator, kill switch, budget store schema, and delegation-eligibility function — genuine shared logic for the parts that matter most for safety scoring. The step-sequencing/outcome loop itself is a separate, hand-written implementation from the real orchestration `advance()` loop — a real (if narrow) drift risk on sequencing behavior specifically, not on the underlying safety primitives.
- **Does production delegation exist?** No. Every production construction site (HTTP router, Jarvis Gateway, CLI) constructs `GovernedOrchestrationService()` with zero arguments; only two files anywhere (an evaluation harness and an acceptance test) ever pass a `DelegationService`.
