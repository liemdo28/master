# Phase 9C — Roadmap Decision

## Final recommendation

```
PHASE 9C RECOMMENDATION:
NEXT PHASE = narrow hardening of background:qb-online-watcher
```

This is not an authority-expansion recommendation and is not itself an implementation. It targets one narrow, precisely-evidenced, pre-existing reliability/governance gap in a capability that **already runs unattended in production today** — closing it is defensive hardening in the same spirit as Phase 9A's own fix to `self-healing-monitor.ts`, not a new capability.

## Why this, and not a bigger scope

Every one of the 12 re-scored candidates remains at or below its Phase-9F classification; none newly clears `NO NEW AUTHORITY`. Project planning is unchanged (zero diff, independently confirmed) and remains `READY_FOR_PROPOSAL_ONLY` with the same 4 documented gaps. The governance-drift audit found zero drift introduced by 9A or 9B — both phases held their own invariants cleanly.

The one genuinely new finding this phase surfaced is `qb-online-watcher.ts`'s missing idempotency check before it inserts a `TRIGGER_SYNC` command that a physically separate machine will execute with no human approval. This is not a reason to expand authority — it is the opposite: evidence that an *already-existing*, already-unattended external-mutation capability has a real, closable reliability gap. Leaving it open is a live risk (repeated flapping can queue duplicate remote-machine commands); closing it adds no new capability, only bounds an existing one more tightly — matching this program's established "smallest correct model" discipline.

## Scope of the proposed next phase, if authorized

**Purpose**: close `qb-online-watcher.ts`'s idempotency gap — either (a) add a real check for an existing `pending`/recent `TRIGGER_SYNC` row before inserting, plus a persisted (not in-memory-only) last-triggered marker surviving restarts, or (b) route the insert through `ControlledActionService`/`ActionPolicyEngine` before it may run unattended again.

**Authority delta**: zero. No new `ActionType`, no policy/risk/budget/kill-switch semantic change — this only makes an existing, already-live external-mutation path idempotent and evidenced, the same category of fix as Phase 9A.

**Explicit exclusions**: no change to `jarvis-proactive-monitor.ts` or `daily-briefing-scheduler.ts` beyond what's already documented as open follow-up (their `ALERT_ONLY` classification is not being escalated); no change to Project planning's classification or capability; no reconciliation implementation for orchestration (that remains a separate, larger, not-yet-authorized body of work).

**Not authorized by this document.** This is a recommendation for the operator's review, matching every prior phase's discipline — nothing here starts implementation.

## What "stop here" would also have been valid

Given `qb-online-watcher`'s gap is narrow, pre-existing, and not newly introduced by anything in Phase 9, `PHASE 9C RECOMMENDATION: STOP PHASE 9 HERE` would also be a defensible, non-negligent answer — the finding doesn't rise to a STOP condition (it was never a STOP-condition-triggering discovery; it's a known, bounded, already-flagged gap now precisely characterized). The recommendation above is offered because the gap is real, cheap to close, and consistent with this program's own established pattern of closing exactly this shape of debt (Phase 9A did the identical thing for a sibling worker) — not because leaving it open constitutes an emergency.
