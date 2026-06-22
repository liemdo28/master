# WHATSAPP_DIRECT_SEND_AUDIT

**Status:** AUDITED
**Date:** 2026-06-22
**Scope:** All code under `services/whatsapp-ai-gateway/src/`

## Direct Send Locations Found

### ✅ ALLOWED — reply-service.js (THE ONLY SEND POINT)

| Location | Function | Status |
|----------|----------|--------|
| reply-service.js:35 | `client.sendMessage(to, text)` | ✅ ALLOWED — authorized send |
| reply-service.js:67 | `client.sendMessage(to, media, caption)` | ✅ ALLOWED — authorized media send |

**reply-service.js is the ONLY authorized send point.** All handlers must use `replyService.send()`.

### ✅ GUARDED — Outbound Send Guards

| File | Guard | Status |
|------|-------|--------|
| message-listener.js:351 | `installOutboundSendGuard(client)` | ✅ Blocks banned text from raw client.sendMessage |
| session-manager.js:83 | `installOutboundSendGuard(targetClient)` | ✅ Same guard at session level |

Both guards intercept `client.sendMessage()` and block messages matching `BLOCKED_USER_FACING_PATTERNS`:
- `/mi-core is temporarily unavailable/i`
- `/temporarily unavailable\.?\s*please try again later/i`

### ✅ ALLOWED — Non-WhatsApp Sends

| File | Purpose | Status |
|------|---------|--------|
| telegram-forwarder.js:46 | `bot.sendMessage(chatId, text)` | ✅ Telegram only — not WhatsApp |
| telegram-forwarder.js:56 | `bot.sendMessage(chatId, text)` | ✅ Telegram only — not WhatsApp |

### ✅ TEST ONLY

| File | Purpose | Status |
|------|---------|--------|
| tests/*.js | Mock `client.sendMessage` | ✅ Test mocks — not production |

## Handler Audit — All Handlers Return Proposed Response

Under the new routing architecture (`message-router-owner.js`), ALL handlers must return:

```javascript
{
  owner: string,        // handler identifier
  confidence: number,   // 0-1
  response: string,     // proposed response text (null = no reply)
  evidence: string,     // reasoning
  shouldSend: boolean   // router decides
}
```

**No handler may call `replyService.send()` directly.** The router (`sendOnce()`) is the sole sender.

## Remaining Risk

| Risk | Mitigation | Status |
|------|-----------|--------|
| Legacy handler sends directly | All legacy paths still exist but are gated by router ownership check | MITIGATED |
| New handler bypasses router | Code review required for any new handler additions | PROCESS |

## Final Status

**WHATSAPP_DIRECT_SEND_AUDIT_PASSED** — all WhatsApp sends go through reply-service.js, which is the sole authorized send point.
