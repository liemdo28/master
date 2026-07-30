# MI Core WhatsApp Approval Report

## Approval Flow

```
WhatsApp CEO sends /mi <action>
→ Mi-Core detects action requiring approval
→ Enqueue to approval gate (Level 2 or 3)
→ Return approval_id to CEO via WhatsApp
→ CEO sends /mi approve <id> or /mi reject <id>
→ Mi-Core processes via gate
→ whatsapp-api sends reply back to CEO
```

## Approval Levels

| Level | Trigger | Approval Required |
|-------|---------|-------------------|
| Auto (L1) | Read-only queries | None |
| Single (L2) | Create/update/assign tasks | 1 approval |
| Double (L3) | Sensitive actions |2 approvals |

## Double Approval Categories

These trigger Level 3 (double approval):
- payroll
- health / private data
- financial export
- production deploy
- delete project
- database migration
- role/permission change

## WhatsApp Approval via /mi

**Approve:**
```
/mi approve APP-abc-123
→ Processes via gate.approve()
→ Logs to WhatsApp store
→ Returns ✅ confirmation
```

**Reject:**
```
/mi reject APP-abc-123
→ Processes via gate.reject()
→ Logs to WhatsApp store
→ Returns ❌ confirmation
```

## WhatsApp-Specific Approval Storage

Stored in `.local-agent-global/connectors/whatsapp/approvals.json`:
- approval_id
- message_id
- chat_id
- sender
- action_description
- status (pending/approved/rejected)
- created_at
- resolved_at
- resolved_by (WhatsApp sender info)

## Logging

All WhatsApp approvals logged with:
- sender phone number
- sender name
- chat_id
- timestamp
- action taken
