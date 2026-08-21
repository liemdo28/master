# Phase 9E — Failure Mode Matrix (optional supplement)

Concrete failure scenarios found or tested during this phase, and current behavior.

| Scenario | Current behavior | Evidence |
|---|---|---|
| Process crashes between QB command insert and CEO notify | Command row persists correctly (DB write already committed in the same transaction as the check); notify is best-effort and may be lost silently | `qb-online-watcher.ts:87-107,138-143` |
| Process crashes between remote QB ack/result and the local DB write | **Unhandled** — no try/catch on the write; command can be stuck `pending`/`acked` forever with no reconciliation scan | `routes/qb-agent.ts:424-437` |
| Process restart between a WhatsApp alert send and its "sent" log | Log already fired (synchronous, before the fire-and-forget send resolves) — log is not reliable evidence of actual delivery | `daily-briefing-scheduler.ts:31,110`; `proactive-monitor.ts:62-63` |
| Process restart during the 07:00/20:00 daily-briefing trigger minute | Can cause a duplicate briefing send for the same calendar day (in-memory guard reset) | `daily-briefing-scheduler.ts:14-15,124,135` |
| Process down entirely at 07:00, back up at 09:00 | Day's briefing is silently skipped, no catch-up, no skip log | `daily-briefing-scheduler.ts:124,135` (exact-minute match, no `>=` branch) |
| Concurrent QB TRIGGER_SYNC insert attempts (20-way, real test) | Exactly 1 succeeds | `qb-online-watcher-idempotency.test.ts` — re-run live, passed |
| Self-healing-monitor restart attempt on an intentionally-stopped service | Never attempted, never alerted — durable `intentionally_stopped` decision logged | `self-healing-monitor.ts:224-231,336-343`; live `self_heal_restart_log` rows confirmed |
| GLOBAL kill switch active during a would-be-eligible restart | Restart withheld, logged, durable evidence written | `self-healing-monitor.ts:229,361-363` |
| Stale `dump.pm2` snapshot containing an intentionally-stopped service, followed by a boot | `pm2 resurrect` runs unconditionally; whether the service actually resurrects depends entirely on snapshot contents, not on an enforced code check | `runtime-preflight/boot-cli.ts:84-86` |
| KB re-ingest running (~30-35 min, twice daily) | Entire HTTP server and every other scheduled timer unresponsive for the duration; self-resolves when ingest completes | `cron/sync-scheduler.ts:36-44`; live log/timing evidence, reproduced twice |
| Gmail/Calendar live-mode execution attempt | Unconditionally blocked (`PROVIDER_UNAVAILABLE`), regardless of configuration | `actions/service.ts:382-391` |
| Arbitrary/spoofed PM2 service name presented to `evaluateRestartEligibility` | Never eligible — confirmed across a dedicated spoofed-name sweep (`not-a-real-service`, path traversal, shell-metacharacter names, case variants, etc.) | `self-healing-restart-evaluation.ts` spoof cases — 0 `arbitraryTargetReachability` |
