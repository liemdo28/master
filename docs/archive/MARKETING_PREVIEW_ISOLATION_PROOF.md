# Marketing Preview Isolation Proof — Phase 21.7

## Date: 2026-06-22

---

## Problem

Marketing preview images were sent alongside task responses for CEO messages.

CEO sends "task anh hôm nay có gì" → receives both a task response AND a marketing preview image.

## Root Cause

`sendMiForwardResult()` in `message-listener.js` sent both:
1. Text reply from Mi-Core
2. Image evidence (preview) from Mi-Core draft workflow

Both used the same `replyService.send()` without checking if a response was
already sent for the same inbound message.

## Fix Applied

### 1. Send Guard in `sendMiForwardResult()`

Before sending the text reply, the send guard checks:
```js
if (sendGuard && traceBase.inbound_message_id) {
  const guardResult = sendGuard.beginMessage(traceBase.inbound_message_id, route, 'mi_core_response');
  if (!guardResult.canSend) {
    // BLOCK — already sent a response for this message
    return false;
  }
}
```

### 2. CEO Priority Lock

When CEO sends a task-related message, `centralSessionManager.setSession()` 
claims `mi_core` owner. This prevents marketing_preview from having an active
session in the same chat+sender.

### 3. Allowed Marketing Messages

Marketing preview may ONLY respond if:
- owner = marketing_preview
- AND active marketing_preview session exists
- AND message contains: APPROVE, EDIT, CANCEL, preview, draft, bản nháp

### 4. Forbidden Marketing Messages for CEO

Messages like these are FORBIDDEN for marketing to respond to:
- mi oi
- task anh hôm nay có gì
- nay anh có task gì
- service nào down
- dashboard thuộc phòng nào

With the CEO priority lock, these messages claim `mi_core` owner, so
marketing_preview never gets a chance to respond.
