# Error Gap Performance Audit

Generated: 2026-06-16 05:40 Asia/Saigon

## Fixed During Audit

- Multi-intent WhatsApp path dropped children before patch. Fixed by routing compound WhatsApp requests to deterministic multi-intent executor.
- Finance truth questions previously created workflows. Fixed by routing read-only finance questions to QuickBooks runtime truth.
- Rate-limit exhaustion previously degraded safety/diagnostic replies. Fixed dangerous-command handling while rate-limited and raised the operational WhatsApp client limit to 120/minute for certification load.
- Unknown ambiguous request previously entered slow AI fallback and timed out at gateway. Fixed with deterministic clarification for obvious unknown requests.
- Legacy SEO advice text existed in production skill registry. Removed.
- TypeScript build failed on impossible voice approval comparison. Fixed.

## Remaining Operational Gaps

- Gmail freshness is stale.
- QuickBooks runtime is degraded and not certified.
- Mi-Core restart count increased during planned audit restarts, so 24h restart stability is not certified from this window.
- Historical gateway logs still contain earlier EADDRINUSE events from before this audit window; current port/PID check is clean.

## Performance Notes

- Final 100-case regression completed without gateway timeouts.
- Unknown request now returns immediately with clarification.
- No false `Mi-Core unavailable` response appeared in final regression.

