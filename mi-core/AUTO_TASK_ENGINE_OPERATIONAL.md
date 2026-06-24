# AUTO_TASK_ENGINE_OPERATIONAL.md

**Phase:** 25C — Auto Task Generation Engine  
**Status:** ✅ OPERATIONAL  
**Date:** 2026-06-24  

---

## Principle

**No manual task creation.** Every degraded signal automatically becomes a task with owner, severity, and escalation path.

## Signal Types Monitored

| Signal | Severity | Auto-Owner | Action |
|--------|----------|------------|--------|
| `qb-stale` | high | finance | Restart data sync |
| `website-down` | critical | web-engineering | Restore service |
| `404-spike` | medium | web-engineering | Repair broken links |
| `traffic-drop` | high | seo-agent | Diagnose and recover |
| `review-drop` | medium | review-management | Investigate |
| `email-failure` | high | operations | Fix SMTP/DNS |
| `calendar-failure` | medium | operations | Reconnect |
| `ranking-drop` | high | seo-agent | Content refresh |
| `schema-invalid` | medium | seo-agent | Fix structured data |
| `gsc-disconnect` | high | analytics-agent | Restore access |
| `gbp-disconnect` | high | local-seo | Restore location data |
| `ga4-disconnect` | high | analytics-agent | Restore analytics |
| `n8n-workflow-failed` | medium | operations | Investigate/rerun |
| `service-down` | critical | web-engineering | Restart and verify |
| `memory-low` | medium | web-engineering | Clear cache |
| `db-error` | critical | web-engineering | Investigate/repair |

## Pipeline

```
Degraded Signal Detected
    ↓
generateTaskFromSignal({ type, data })
    ↓
Task Created (auto-assigned owner, severity)
    ↓
assignOwner(taskId)
    ↓
executeOwnerAction(task)
    ↓
  ┌─ resolved → task.resolvedAt
  └─ failed (3 attempts) → escalate
    ↓
escalateTask(taskId, 'executive-assistant')
```

## Auto-Scan Function

`scanForDegradedSignals()` runs on schedule and checks:

1. **QB Stale** — QuickBooks DB age > 24 hours
2. **SEO Agents Offline** — Agents not in `online` status in seo-state.json
3. **GSC/GBP/GA4 Disconnect** — API returning 401/403 (stub ready for integration)

## Escalation Policy

| Attempt | Action |
|---------|--------|
| 1 | Execute owner action |
| 2 | Retry owner action |
| 3 | Escalate to `executive-assistant` |

## CTO Final Test Result

```json
{
  "auto_task": "auto-task-1782298043106-wxwg",
  "signal_type": "traffic-drop",
  "owner": "seo-agent",
  "severity": "high",
  "status": "resolved"
}
```

**VERDICT: AUTO TASK ENGINE OPERATIONAL**
