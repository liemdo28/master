# WhatsApp Session Isolation

## Session Scope Rule

ALL sessions MUST be scoped by: `chat_id + owner`

Sessions are NEVER global. No shared state across different owners.

## Session Types

### Food Safety Session
- **Scope**: `chat_id + sender`
- **Active if**: `formPhotoWorkflow.hasActiveSession(chatId, sender)` returns true
- **Message**: CONFIRM / EDIT / RETAKE / MANAGER / CANCEL
- **Isolation**: Session is tied to specific sender in specific chat. Other senders in same chat cannot access.

### Template OCR Session  
- **Scope**: `chat_id + sender`
- **Active if**: `templateOcrWorkflow.hasActiveSession(chatId, sender)` returns true
- **Isolation**: Tied to specific sender in specific chat.

### Agent Session
- **Scope**: `chat_id`
- **Active if**: `agentMgr.hasSession(chatId)` returns true
- **Owner check**: `agentMgr.isOwner(chatId, phone)`
- **Non-owner messages**: Return warning, do not route to agent

## Dedup Store

- **Primary key**: `message_id` (from WhatsApp message)
- **Fallback key**: `chat_id + timestamp_bucket + normalized_body`
- **TTL**: 24 hours
- **Location**: `services/whatsapp-ai-gateway/src/routing/message-dedup-store.js`

## Ownership Rules

| Message Pattern | Owner | Condition |
|---|---|---|
| `mi oi`, `mi ơi`, `@mi` | mi_core | CEO sender |
| `/mi` prefix | mi_core | Any sender |
| Food safety form image | food_safety | Chat has food safety enabled |
| Active food_safety session | food_safety | Session scoped to chat_id+sender |
| APPROVE/EDIT/CANCEL for draft | marketing_preview | Active draft session exists |
| Unknown | unknown (no reply) | No match |
