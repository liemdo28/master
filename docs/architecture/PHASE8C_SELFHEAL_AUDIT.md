# Phase 8C — SelfHeal / Recovery Intelligence — Reality Audit

Per the existing Phase 8 roadmap (`PHASE8_DISCOVERY_AND_ROADMAP.md`), 8C's scope is two concrete items: wire SelfHeal onto canonical health-truth (or retire its independent logic entirely), and fix the unconditional "Restarted" log line.

## Two SelfHeal implementations, confirmed complementary (not duplicate)

Re-confirming Phase 8B inventory §6's finding, now with full detail:

- **`operations/self-healing.ts`** ("O9-SELFHEAL", 5min interval) — anomaly detection only: restart storms, stale connectors, stuck chat queues, stuck workflows, stale pending approvals. Raises incidents via `raiseIncident()`. No PM2 restart logic, no service up/down probing.
- **`company-os/self-healing-monitor.ts`** ("[SelfHeal]", 60s interval) — the one with PM2 restart logic, HTTP/internal health probes for 10 named services, and CEO WhatsApp alerting after 2 failed restart attempts.

These have zero overlapping responsibility. No action needed.

## SelfHeal ↔ Health Truth Model wiring: already substantially done (Phase 7B)

`health-truth/probes.ts` already reads from `company-os/self-healing-monitor.ts`'s cached scan (`getLastScanResults()`) as a read-only consumer — built in Phase 7B, not something 8C needs to create. Confirmed wired: `DATABASE` (via `knowledge-db`), `ACCOUNTING` (via `mi-accounting`), `QB_AGENT` (via `qb-ops-agent`), all via `scanEntry()`. `WHATSAPP`/`CEO_OBSERVER`/`N8N` are correctly *not* wired to SelfHeal's cache — they use a separate `probeIntentionallyDisabled()` because their semantics differ (SelfHeal's boolean can't express "intentionally not started" vs "failed"; the health-truth probe checks for runtime-code presence instead).

**One real duplication found:** `LOCAL_MODEL` (Ollama). `health-truth/probes.ts`'s `probeLocalModel()` does its own live `fetch()` to Ollama on every `/api/health` request — a second, independent probe of the exact same `http://localhost:11434/api/tags` endpoint SelfHeal already polls every 60s and caches.

**Not merged, evidence why:** SelfHeal's own `ollama` check hardcodes `http://localhost:11434` and does not read `OLLAMA_URL`. `probeLocalModel()`, like 10+ other Ollama call sites across this codebase (`ollama-client.ts`, `brain-registry.ts`, `model-router.ts`, `qdrant-client.ts`, `ollama-router.ts`, `model-benchmark.ts`, `model-health.ts`, `dev2-operations.ts`, `provider-router.ts`, `health-truth/public-router.ts`), does respect `OLLAMA_URL` (documented in `.env.example`). Wiring `probeLocalModel()` to SelfHeal's cache would silently stop honoring a real, documented, actively-used config override for anyone who runs Ollama on a non-default endpoint. A correct fix requires first making SelfHeal's own check `OLLAMA_URL`-aware — that's a second, separate change with its own testing surface, not something to bundle into this pass on inference. Flagged here for a future phase rather than guessed at.

**A third, separate Ollama probe also exists:** `health-truth/public-router.ts` (backing the simple public `/api/health` endpoint, distinct from `/api/health/detail`'s full `DependencyHealth` model) does its *own* independent Ollama fetch too — so there are three unrelated Ollama probes in this codebase today (SelfHeal, `probes.ts`, `public-router.ts`). Documented here as a discovered fact; not remediated this pass for the same reason as above (each currently respects config correctly on its own; a real fix means unifying them behind one `OLLAMA_URL`-aware source, which is more than a "wire the read-only side" change).

## The "Restarted" log line bug — confirmed live, fixed

`runHealthScan()` (`company-os/self-healing-monitor.ts`) previously logged `[SelfHeal] Restarted ${svc.name} (attempt N/2)` unconditionally whenever a PM2 restart was *attempted* — without checking `restartPm2Service()`'s own return value, and a full 60s before the next scan could confirm whether the service actually came back up. Confirmed live in production logs during this session: `[SelfHeal] Restarted WhatsApp Gateway (attempt 1/2)` was immediately followed by continued `DOWN` alerts for WhatsApp Gateway in the next several cycles — the log claimed success that hadn't happened yet.

Fixed: the message now distinguishes "restart command issued, will confirm next scan" (when `restartPm2Service()` returns true) from "restart command FAILED" (when it returns false, previously silently treated the same as success). The already-correct, truthful "recovered after N restart(s)" message (printed only once a subsequent scan observes `healthy: true`) is unchanged — that was always accurate and remains the actual confirmation signal.

## Conclusion

Both items in 8C's defined roadmap scope are addressed: the wiring question is answered (already substantially done for the dimensions that make sense; the one real gap — LOCAL_MODEL — is documented with evidence for why merging it now would be a regression, not guessed at); the log-line bug is fixed with a narrow, evidenced change. No other SelfHeal changes made. `operations/self-healing.ts` untouched (different, complementary scope). No new authority, no schema change, no new external action.
