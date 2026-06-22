# WHATSAPP SESSION ISOLATION
> Phase 21.6 CEO Directive P0 | Generated: 2026-06-22

## Session Isolation Matrix

| Session | Scope Key | Mi-Core | Food Safety | Marketing | Team |
|---------|-----------|---------|------------|-----------|------|
| templateOcrWorkflow | `chatId:sender` | ✅ | ✅ | ✅ | ✅ |
| formPhotoWorkflow | `chatId:sender` | ✅ | ✅ | ✅ | ✅ |
| brothCommandMod | `chatId:sender` | ✅ | ✅ | ✅ | ✅ |
| agentMgr | `chatId` | ✅ | ✅ | ✅ | ✅ |
| dedupStore | `messageId` | ✅ | ✅ | ✅ | ✅ |
| **NEW: chatId+owner** | `chatId::owner` | ✅ | ✅ | ✅ | ✅ |

## Per-Session Analysis

### formPhotoWorkflow (food-safety)
- Scope: `chatId:sender` ✅
- Isolation: Employee can only interact with their own form session
- No cross-chat leakage
- **Risk:** If same person sends to multiple chats simultaneously → separate sessions by `chatId:sender` ✅

### templateOcrWorkflow (food-safety)
- Scope: `chatId:sender` ✅
- Isolation: Employee can only confirm/edit their own OCR submission
- **Risk:** None identified

### brothCommandMod
- Scope: `chatId:sender` ✅
- Isolation: Employee can only log broth for their own session
- **Risk:** None identified

### agentMgr
- Scope: `chatId` (owner-based)
- Isolation: Non-owners see non-owner reply, cannot inject into agent session
- See message-listener.js line 678: `if (!agentMgr.isOwner(chatId, phone))` ✅
- **Risk:** Low

### mi-core (no formal session store)
- Scope: Per-request (each /mi message is independent)
- Isolation: Each message is forwarded to mi-core independently
- **Risk:** None — stateless per message

### marketing_preview
- **FINDING:** No marketing session found in codebase
- marketing_preview owner needs session management — not yet implemented
- **Action required:** Register marketing_preview session handler

## Cross-Leakage Prevention

The NEW router session store uses `chatId::owner` composite keys:

```
// Mi-Core session for CEO chat
ceo-chat-id::mi_core          → session data

// Food Safety session (different chat)
fs-chat-id::food_safety       → session data

// These keys NEVER overlap:
ceo-chat-id::food_safety      → undefined (no food safety session for CEO chat)
```

## Certified: WHATSAPP_SESSION_ISOLATION_PARTIAL
- Food Safety: ✅ Isolated
- Team Support: ✅ Isolated
- Mi-Core: ✅ Stateless
- Marketing Preview: ❌ NOT IMPLEMENTED — needs session handler
