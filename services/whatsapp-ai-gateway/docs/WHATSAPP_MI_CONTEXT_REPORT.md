# WhatsApp Mi Context Report

**Branch:** `feature/agent-mi-command-routing` | **Date:** 2026-06-10 | **Status:** ✅ PASS

## Cache Architecture
Base directory: `.local-agent-global/connectors/whatsapp/`

## Files Managed
| File | Purpose |
|---|---|
| `messages.json` | WhatsApp message history (max 1000, rotates to 500) |
| `groups.json` | Group ID → store mapping |
| `participants.json` | Sender info per group |
| `summaries.json` | Chat summaries |
| `action_items.json` | Extracted action items |
| `approvals.json` | Pending/approved/rejected approvals |
| `last_sync.json` | Sync timestamps and counts |
| `errors.json` | Recent errors (max 100) |

## Context Enrichment
Messages cached with: `chat_id`, `group_id`, `group_name`, `sender`, `sender_name`, `text`, `timestamp`, `attachments`, `cached_at`

## Group → Store Mapping
- `cacheGroup({ chatId, groupId, groupName, storeId })` — upserts group info
- Unknown groups → log warning, do not guess
- Ask CEO to map unknown groups

## Data Flow
```
WhatsApp message → cacheMessage() → messages.json
                   cacheGroup()   → groups.json
                   cacheParticipant() → participants.json
                   Last sync updated → last_sync.json
```

## Error Handling
- `logError({ chatId, operation, error })` → errors.json
- `getErrors(limit)` → recent errors
- All file operations are synchronous with fallback defaults

## Mi-Core Integration
Mi-Core can query context via:
- `getMessages(chatId, limit)` — recent messages
- `getGroup(chatId)` — group info with store_id
- `getAllGroups()` — all known groups
- `getAllParticipants()` — all known participants

**Verdict:** ✅ PASS — Context cache operational with all required files.