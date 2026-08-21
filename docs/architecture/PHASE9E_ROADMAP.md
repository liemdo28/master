# Phase 9E — Roadmap Decision

## Final recommendation

```
PHASE 9E RECOMMENDATION:
NEXT PHASE = fix the synchronous, blocking KB-ingest scheduler call
             (server/src/cron/sync-scheduler.ts:36-44)
```

This is a pure reliability fix with **zero authority delta** — it does not touch governance, does not change any background worker's authority classification, and does not expand what any capability can do. It closes a real, currently-reproducing production defect this phase discovered directly (not inherited from a prior report), with concrete evidence.

## Exact defect

`server/src/cron/sync-scheduler.ts:36-44`: the KB re-ingest timer's callback is not `async`, and its call to `fullIngest()` is not `await`ed — unlike the visibility-sync timer immediately above it in the same file, which correctly is. `fullIngest()` takes approximately 30-35 minutes to complete against the current document set (observed twice today: `11:56:03→12:30:53`, and `15:56:04→` still running past 30 minutes at last check), and appears to run synchronously/non-yielding for that entire duration.

## Exact runtime risk

Node.js has a single JS execution thread. A long synchronous callback blocks that thread completely: no other `setInterval` callback can fire, and no incoming HTTP request can be processed, for the callback's entire duration. This was independently confirmed two ways:
1. **Log evidence**: during the KB-ingest window, *every* other scheduled task (`visibility sync`, `DEV2 operations evidence refresh`) also stopped logging — not just the ingest's own line. Silence was total, across all scheduled work, for the same window.
2. **Live reproduction**: `GET /api/health` (whose own handler is independently bounded to ~5 seconds via parallel `AbortSignal.timeout`-guarded probes, confirmed by reading `health-truth/public-router.ts`) failed completely (timeout / connection refused) when tested from two independent HTTP clients during this exact window, despite the process being demonstrably alive (PM2 "online", port listening, log activity resuming normally before and after the window).

This means: roughly every 4 hours, for 30-35 minutes, the entire mi-core HTTP surface — including the CEO's own health checks and every WhatsApp-adjacent API this whole system exists to serve — becomes completely unresponsive. This is not a crash (the process recovers on its own every time, as it has done at least once already today) and is not related to WhatsApp Gateway/CEO Observer/Ollama being down (a separate, already-known, correctly-handled condition).

## Why existing controls are insufficient

Nothing in the current codebase detects or mitigates this. `self-healing-monitor`'s own health probe against `mi-core-http` is itself an HTTP fetch against the same blocked event loop — it would also time out during this window, but `self-healing-monitor`'s restart-eligibility logic explicitly excludes `mi-core` from ever being blindly restarted in this scenario in a way that would help (and rightly so — restarting mid-ingest would not be a safe fix and risks worse corruption/duplication; the correct fix is architectural, not operational).

## Why NO_NEW_AUTHORITY is not enough

`NO_NEW_AUTHORITY` (i.e., doing nothing) leaves a real, reproducing, twice-daily full-service outage undocumented and unaddressed. This is squarely a reliability defect, not an authority question — fixing it does not require touching governance, policy, kill-switches, or any background worker's classification, so recommending it does not conflict with this program's "smallest correct model" discipline. It is the same category of fix as Phase 9A's and 9D's prior narrow hardening work: closing a real, pre-existing, bounded gap in a capability that already runs unattended in production today.

## Zero-authority-delta proof

- No `ActionType` added (remains 7, confirmed via the real evaluation run in this phase).
- No new remote command type, no new target machine, no new recipient.
- No policy/risk/budget/kill-switch/delegation semantic touched.
- No production DB schema change required.
- The fix is scoped entirely to how one existing, already-scheduled, already-unattended function call is invoked (e.g., moved off the main thread via a worker thread/child process, or restructured to yield periodically/chunk its work) — it does not change what `fullIngest()` does, only how it is scheduled relative to the rest of the event loop.

## Explicit non-goals

- Not touching `jarvis-proactive-monitor.ts` or `daily-briefing-scheduler.ts` beyond what is already documented as open follow-up in this and the prior Phase 9C roadmap — their `ALERT_ONLY` classification is not being escalated or otherwise changed by this recommendation.
- Not changing Project Planning's classification or capability.
- Not implementing reconciliation for orchestration (remains separate, larger, not-yet-authorized work).
- Not adding a system-wide intentional-stop guard to the other 4 unguarded PM2-mutation paths found in this phase (`boot-cli.ts`'s `pm2 resurrect`, `skill-registry.ts`, `release-agent.ts`, `auto-task-engine`) — these are real, documented gaps (see Background Worker Reassessment §4) but are a separate, lower-urgency body of work (none of them has actually resurrected an intentionally-stopped service; the current safety is circumstantial, not architectural, but it is not an active incident).
- Not adding the 2 undeclared background workers to the manifest as part of this recommendation — a documentation-completeness fix that can be bundled into the same narrow phase or done separately, at the operator's discretion.

## Acceptance criteria, if authorized

1. `GET /api/health` (and other lightweight read routes) continue to respond within their normal bound (a few seconds) even while KB re-ingest is running.
2. The visibility-sync and DEV2-ops-evidence timers continue to fire on schedule during a KB re-ingest run (no total scheduler starvation).
3. KB re-ingest itself still completes correctly and ingests the same document set (no functional regression to the ingest logic itself).
4. A new deterministic test proves the above under a simulated long-running ingest (e.g., a fake slow ingest function), not just a manual timing observation.

## What "stop here" would also have been valid

If the operator's priority is strictly authority/governance (the stated purpose of the Phase 9 program), this KB-ingest finding is arguably out of that program's core scope — it is a pure performance/availability bug, not an authority or governance question. `PHASE 9E RECOMMENDATION: NO MORE PHASE 9 WORK` (on the authority/governance axis specifically) would also be a defensible answer, with the KB-ingest finding logged separately as an operations/reliability ticket rather than a "Phase 9" item. This document recommends folding it in because it was discovered *during* this phase's own health-classification work, is narrow, well-evidenced, and zero-authority-delta — not because leaving it as a separate untracked issue would be negligent.

**Not authorized by this document.** This is a recommendation for the operator's review. Nothing here starts implementation. Continuing to a Phase 9F (or any further Phase 9 work) requires separate, explicit authorization naming this exact scope.
