# MI_ACTION_AUDIT_LOG_REPORT
**Generated:** 2026-06-09

## ActionAuditLog Module

### Location: `local-agent/action-layer/ActionAuditLog.mjs`
### Storage: `.local-agent-global/action-audit/action_log.json`

## Event Types Logged

| Event | Trigger | Data Captured |
|---|---|---|
| `action_drafted` | Any write action created | action_id, type, description, risk_level, created_at |
| `action_approved` | CEO approves | action_id, approved_at, approved_by |
| `action_rejected` | CEO rejects | action_id, rejected_at, reason |
| `action_executed` | After approval, execution completes | action_id, result, executed_at |
| `action_failed` | Execution error | action_id, error, failed_at |
| `action_blocked` | Security block | action_id, blocked_reason, blocked_file |

## Log Format

```json
{
  "entries": [
    {
      "event": "action_drafted",
      "action_id": "act_1749456123_abc",
      "type": "upload-file",
      "description": "Upload Raw_QA_June.pdf to Google Drive → Mi Uploads",
      "risk_level": 2,
      "created_at": "2026-06-09T14:23:45.000Z"
    },
    {
      "event": "action_approved",
      "action_id": "act_1749456123_abc",
      "approved_at": "2026-06-09T14:24:10.000Z",
      "approved_by": "CEO"
    },
    {
      "event": "action_executed",
      "action_id": "act_1749456123_abc",
      "result": "success",
      "executed_at": "2026-06-09T14:24:11.000Z"
    }
  ]
}
```

## Log Retention
- Maximum: 1000 entries
- Auto-pruned (oldest entries removed when limit exceeded)
- Log is append-only during normal operation
- No log entries are ever deleted (except auto-pruning)

## Query Functions

```javascript
// Recent actions
ActionAuditLog.getRecent(10)  → last 10 entries

// By action ID (full lifecycle)
ActionAuditLog.getByActionId("act_...")
→ [drafted, approved, executed] timeline

// By type
ActionAuditLog.getByType("upload-file")

// Blocked actions only
ActionAuditLog.getBlocked()
```

## Security Audit Use Cases

1. **CEO wants to review what Mi did today:**
   ```
   "Mi đã làm gì hôm nay?"
   → ActionAuditLog.getRecent(20) filtered by today's date
   ```

2. **CEO investigates a rejected action:**
   ```
   → getByActionId(id) → see who rejected + reason
   ```

3. **Security review — blocked attempts:**
   ```
   → getBlocked() → see all sensitive file access attempts
   ```

4. **Compliance audit:**
   ```
   → Full action_log.json available for external audit
   ```

## Dangerous Action Audit Trail

L3 actions get extra log entries:
```json
{ "event": "l3_confirm_1", "action_id": "...", "timestamp": "..." }
{ "event": "l3_confirm_2", "action_id": "...", "timestamp": "..." }
{ "event": "action_executed", "dangerous": true, "action_id": "..." }
```

---
MI_ACTION_AUDIT_LOG_COMPLETE
