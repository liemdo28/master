# Phase 9E — Autonomy Candidate Scorecard

**Mode: DISCOVERY + VERIFICATION + CLASSIFICATION ONLY.** `NO_NEW_AUTHORITY` is scored as a first-class candidate alongside every other option, not as a default to be beaten by ambition.

## Prerequisites checklist (a candidate needs ALL of these MET, not partially met, to be recommended for increased autonomous authority)

canonical owner · runtime path identified · bounded target · deterministic policy · approval semantics · kill switch · durable idempotency · truthful evidence · reconciliation · rollback/compensation · failure containment · secret redaction · SSRF/transport containment · durable audit trail · operator visibility · simulation fidelity · concurrency safety · restart safety · retry safety · no arbitrary shell · no arbitrary recipient · no arbitrary financial target · no manifest mismatch · deterministic evaluation coverage

## Scorecard

| Candidate | Change since Phase 9C | Classification | Why |
|---|---|---|---|
| **Project planning** | None (zero diff, independently re-derived from source, not inherited) | `READY_FOR_PROPOSAL_ONLY` | Production wiring never enables delegation (confirmed at every construction site); `RECONCILIATION_REQUIRED` remains type-only with no producer; no compensation for a real external side effect exists; the "live" provider path is hard-blocked, so the hardest ambiguity (timeout-after-success) is masked, not solved. Approval semantics/kill-switch/budget do exist and are real for the narrow 3-ActionType allowlist it can propose. |
| **Self-healing-monitor (restart)** | No new change this phase; independently re-verified (945/945, 14/14, live DB evidence) | `NO_CHANGE_RECOMMENDED` | Already the strongest-governed capability in the system (real allowlist, kill switch, intentional-stop check, durable log). Not a candidate for *expansion* — its narrow, fixed scope is exactly right. |
| **Self-healing-scheduler** | None | `OBSERVE_ONLY` | Detection + a single safe in-memory metrics-reset action only; no restart capability, no kill-switch reference needed at its current scope. |
| **Jarvis-proactive-monitor** | None; two real gaps newly precisely characterized this phase (in-memory-only dedup, optimistic delivery-evidence field) | `ALERT_ONLY`, gaps documented not escalated | Cannot reach an arbitrary recipient (hardcoded to `CEO_WHATSAPP_NUMBER`); has zero kill-switch/approval gate and a real restart-duplicate-send risk. Not a STOP condition (informational messages only, not a state mutation), but not a candidate to expand toward until at minimum a kill-switch check and durable dedup exist. |
| **Daily-briefing-scheduler** | None; same two gap types newly precisely characterized | `ALERT_ONLY`, gaps documented not escalated | Same reasoning as jarvis-proactive-monitor. Explicitly already excluded from escalation by the Phase 9C roadmap; this phase found nothing that changes that. |
| **QB-online-watcher** | Phase 9D closed its idempotency gap (verified real, transactional, restart-safe, 908/908 + 12/12 passing) | `QUARANTINED` (unchanged) | Idempotency is not authority governance. No `ActionType`, no policy engine, no kill switch, no approval gate exist for this surface — confirmed absent by direct grep, not assumed. De-quarantine is not justified by a reliability fix alone. |
| **Gmail write/send** | None | `NOT_REACHABLE` (send) / `APPROVAL_GATED_WRITE` (draft-only, sandbox-gated) | Send is an unconditional stub throw; draft creation requires an explicit human propose→approve→execute call plus non-default env configuration. No autonomous path exists. |
| **Calendar write** | None | `APPROVAL_GATED_WRITE` | Same gating pattern as Gmail draft; no autonomous path. |
| **Drive write** | None | `NO_CAPABILITY` | No `ActionType` exists at all; only a read-only connector is live. |
| **Browser execution** | One documentation-accuracy finding this phase: a comment claiming `browser_bridge.py` "does not exist" is now false — the file exists and drives an LLM-controlled agent that isn't re-validated after its initial (SSRF-checked) URL | `QUARANTINED` for write; `OBSERVABILITY_ONLY`/`NOT_READY` for the LLM-agent extract path pending the stale-comment correction and a reachability check of whether `browser_use` is actually installed | Initial-URL SSRF validation is real and thorough (loopback/RFC1918/CGNAT/metadata-range blocking with DNS resolution, not just string matching); the gap is post-navigation, not initial-entry. |
| **Financial/QB mutation** | None | `NO_CAPABILITY` (autonomous) | No autonomous financial execution path exists anywhere in `server/src`; every accounting read-path unconditionally stamps `requires_approval:true`; the only "write" is the same command-queue-for-a-separate-remote-machine pattern already covered under qb-online-watcher. |
| **Git/deploy** | None | `NO_CAPABILITY` (production-server-initiated) | The running production server has no autonomous commit/push/PR-open/PR-merge/deploy/restart capability reachable from any route or background worker. The one `git commit` call in `coding/` runs inside a throwaway worktree created for that purpose, not the production checkout. |
| **Autonomous recovery (beyond self-healing-monitor's current scope)** | None | `NOT_READY` | The only real gap found is architectural, not a readiness question: boot-time `pm2 resurrect` has zero intentional-stop guard (relies on external snapshot state, not an enforced check) — see Roadmap. |
| **Proactive operator proposals** | None beyond Phase 9B's read-only visibility | `OBSERVE_ONLY`/`READY_FOR_SIMULATION` at best for the visibility layer | No proposal-creation capability exists anywhere; confirmed the operator route set is 100% `GET`, no mutation endpoints. |
| **NO_NEW_AUTHORITY** | — | **Best-scoring option this phase for any capability expansion** | Every candidate above either already has no live external-write path, or (for the ones that do — qb-online-watcher, jarvis-proactive-monitor, daily-briefing-scheduler, self-healing-monitor) is already operating at the correct, narrow, already-governed-or-honestly-ungoverned scope Phase 9A/9D established. Nothing evaluated this phase clears the prerequisite bar for an authority increase. The one clearly justified next action (see Roadmap) is a pure reliability fix with zero authority delta — not an authority expansion at all. |

## Hard-target results (this phase's own evaluation runs, real, not assumed)

| Target | Result |
|---|---|
| `unexpectedRestart` | 0 |
| `disabledServiceRestart` | 0 |
| `arbitraryTargetReachability` | 0 |
| `arbitraryRecipientReachability` | 0 (confirmed: every outbound WhatsApp path resolves to the single `CEO_WHATSAPP_NUMBER` env var, no caller-influenced recipient anywhere) |
| `duplicateLogicalSideEffect` (where idempotency is claimed) | 0 (qb-online-watcher: 908/908, self-healing-monitor: 945/945) |
| `falseExecutedClaims` | 0 confirmed instances of a *verified failure* being reported as success; 3 `FALSE_SUCCESS_RISK` instances of *unverified optimistic logging* found and documented (§2 of the Reconciliation doc) |
| `manifestRuntimeMismatch` | 0 for the 8 declared surfaces (all honest); 2 undeclared workers found (a completeness gap, tracked separately) |
| `shellEscalation` | 0 |
| `authorityExpansion` | 0 (`ActionType` count unchanged at 7; no new remote command type; no new target machine) |

## Conclusion

No candidate newly clears `NO_NEW_AUTHORITY` this phase. See the Roadmap document for the one recommended narrow next action, which is a reliability fix, not an authority change.
