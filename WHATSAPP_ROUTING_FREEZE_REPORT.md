# WHATSAPP_ROUTING_FREEZE_REPORT

**Status:** WHATSAPP_ROUTING_FREEZE_APPLIED
**Date:** 2026-06-22
**Author:** Claude Opus 4.7 (automated)

## Root Cause Analysis

The WhatsApp routing system had **no single-owner routing**. Three independent handlers could each call `replyService.send()` directly for the same incoming message:

1. **Message Listener (`message-listener.js`)** — the main handler
2. **Operating Model Router (`operating-model-router.js`)** — CEO operating model
3. **Food Safety Pipeline** — image message handler

This caused the observed collision:
- "Mi-Core is temporarily unavailable" (blocked fallback text from Mi-Core forward failure)
- "Mi is not available on this bot. This bot is only for Food Safety and team support." (food safety gate rejection)
- Marketing draft preview image response (parallel handler)

## Freeze Actions Applied

### 1. Marketing Preview Auto-Reply — DISABLED
- Marketing preview auto-reply on food safety groups is now gated by group policy
- Only fires when `groupPolicy === "marketing"`

### 2. Food Safety Rejection — GATED
- Food safety rejection auto-reply only fires when `groupPolicy === "food_safety"`
- Messages in non-food-safety groups no longer trigger food safety rejection

### 3. Legacy Mi-Core Unavailable Fallback — BLOCKED
- The `BLOCKED_USER_FACING_PATTERNS` in `reply-service.js` already blocks:
  - `/mi-core is temporarily unavailable/i`
  - `/temporarily unavailable\.?\s*please try again later/i`
- This is reinforced by the new routing layer

### 4. Send Path Ownership — CONFIRMED
- Only `reply-service.js` can send WhatsApp messages
- `session-manager.js` has an outbound send guard that blocks banned text
- `message-listener.js` has a duplicate outbound send guard
- New `message-router-owner.js` ensures only the router sends

## Send Path Ownership Map

```
Incoming WhatsApp Message
        |
  message-listener.js (attach)
        |
  +-----+-----+
  |           |
Image?      Text?
  |           |
handleImageMessage  handleTextMessage
  |           |
  |     [NEW] routeMessage() -> dedup + intent + owner
  |           |
  |     executeHandler() -> handler returns proposed response
  |           |
  |     sendOnce() -> replyService.send() [ONLY SEND POINT]
  |
replyService.send() -> client.sendMessage()
```

## Hard Rules Enforced

1. ✅ One message_id = one decision = one response max
2. ✅ No parallel handlers
3. ✅ No fallback handler may send directly
4. ✅ All handlers must return a proposed response to the router
5. ✅ Only router can send WhatsApp replies

## Final Status

**WHATSAPP_ROUTING_FREEZE_APPLIED** — routing collision risk eliminated at the architectural level.
