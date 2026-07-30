# WHATSAPP_ERROR_POLICY

**Status:** IMPLEMENTED
**Date:** 2026-06-22

## Before (Broken)

Generic error messages sent to ALL users:
- "Mi-Core is temporarily unavailable"
- "Mi is not available on this bot. This bot is only for Food Safety and team support."

## After (Fixed)

### Error Classification

| Error Type | Code | Send to User? | Send to Admin? |
|-----------|------|---------------|----------------|
| Mi-Core timeout | `MI_CORE_TIMEOUT` | Only if explicit mention | Yes |
| Mi-Core returned 500 | `MI_CORE_500` | Only if explicit mention | Yes |
| Router ownership rejected | `ROUTER_REJECTED` | No | Yes (log only) |
| Handler exception | `HANDLER_EXCEPTION` | No | Yes (log only) |
| Session missing | `SESSION_MISSING` | Only if explicit mention | No |
| Wrong group policy | `WRONG_GROUP` | Yes (routing guidance) | No |
| Dedup blocked | `DEDUP_BLOCKED` | No | No (log only) |

### Error Response Rules

1. **CEO/admin groups** — structured error messages sent directly
2. **Normal staff groups** — log only unless message explicitly mentions "Mi"
3. **Food safety groups** — food safety errors only, no Mi-Core errors
4. **Marketing groups** — marketing errors only

### Blocked User-Facing Text

The following patterns are permanently blocked from user-facing WhatsApp messages:

```
/mi-core is temporarily unavailable/i
/temporarily unavailable\.?\s*please try again later/i
```

These are enforced at THREE levels:
1. `reply-service.js` — `isBlockedUserFacingText()` check before send
2. `message-listener.js` — outbound send guard on `client.sendMessage`
3. `session-manager.js` — outbound send guard on session client

### Error Response Templates

| Error | CEO/Admin | Staff |
|-------|-----------|-------|
| MI_CORE_TIMEOUT | "⚠️ Mi-Core timeout ({ms}ms). Retry or check server." | (log only) |
| MI_CORE_500 | "⚠️ Mi-Core error 500. Server issue detected." | (log only) |
| ROUTER_REJECTED | (log only) | (log only) |
| HANDLER_EXCEPTION | "⚠️ Handler error: {error}" | (log only) |
| WRONG_GROUP | "Message routed to correct handler. This group is for {policy}." | Same |
| DEDUP_BLOCKED | (log only) | (log only) |

## Verification

- [x] "Mi-Core is temporarily unavailable" — BLOCKED at 3 levels
- [x] "Mi is not available on this bot" — BLOCKED by food safety group gate
- [x] Generic error messages — REPLACED with structured errors
- [x] Error routing — admin-only errors never reach staff groups

## Final Status

**WHATSAPP_ERROR_POLICY_ENFORCED** — structured errors replace generic fallbacks.
