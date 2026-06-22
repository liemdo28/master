# WHATSAPP ROUTING INVENTORY
> Phase 21.6 — CEO DIRECTIVE P0 | Generated: 2026-06-22

---

## Architecture Summary

```
WhatsApp Web.js Client
└── message-listener.js (entry point)
    ├── client.on('message')      → ALL messages (images + text)
    └── client.on('message_create')→ self-chat only
```

### Handlers called within message-listener.js

| Handler | Lines | Purpose | Owner |
|---------|-------|---------|-------|
| `handleImageMessage()` | 411–537 | Food safety image pipeline | food_safety |
| `handleTextMessage()` | 539–980 | Complex routing tree | varies |

### Inside handleTextMessage()

| Check | Line | Owner |
|-------|------|-------|
| `templateOcrWorkflow` session | 611 | food_safety |
| `formPhotoWorkflow` session | 620 | food_safety |
| `getLanguageQuestionReply()` group | 668 | generic |
| `handleAgentMiCommand()` | 648 | mi_core / agent |
| `commandRouter` group | 699 | varies |
| `commandRouter` direct | 743 | varies |
| `agentMiRouter.isAgentCommand()` | 769 | agent |
| `agentMiRouter.isMiCommand()` | 794 | mi_core |
| `agentMiRouter.isNoPrefix()` | 830 | mi_core |
| NLP greeting | 877 | generic |
| `generateResponse()` AI | 959 | generic |

### Other callers of replyService.send()

| File | Role |
|------|------|
| `workflows/operating-model-router.js` | IMAGE + TEXT routing (separate parallel path) |
| `workflows/form-photo-workflow.js` | Form photo confirmation workflow |
| `template-ocr/template-ocr-workflow.js` | Template OCR workflow |
| `index.js`, `api/server.js`, `alerts/*`, `incidents/*`, `reports/*` | Admin/system notifications |

---

## ALL `replyService.send()` Call Sites

### message-listener.js (handleImageMessage)

| Line | Function | Trigger | Owner | Direct Send |
|------|----------|---------|-------|-------------|
| 450 | `handleImageMessage()` | Media download fail | food_safety | YES |
| 470 | `handleImageMessage()` | Form photo image save fail | food_safety | YES |
| 478 | `handleImageMessage()` | Form photo upload reply | food_safety | YES |
| 483 | `handleImageMessage()` | Form photo error | food_safety | YES |
| 501 | `handleImageMessage()` | Template OCR reply | food_safety | YES |
| 507 | `handleImageMessage()` | Template OCR fail | food_safety | YES |
| 522 | `handleImageMessage()` | Food safety pipeline fail | food_safety | YES |
| 529, 532 | `handleImageMessage()` | Food safety warning/pass | food_safety | YES |

### message-listener.js (handleTextMessage)

| Line | Function | Trigger | Owner | Direct Send |
|------|----------|---------|-------|-------------|
| 188, 191 | `sendMiForwardResult()` | Mi-Core reply + image | mi_core | YES (router) |
| 346, 350 | `handleAgentMiCommand()` | /mi or /agent reply | varies | YES (handler) |
| 614, 623 | `handleTextMessage()` | Form photo reply | food_safety | YES |
| 642 | `handleTextMessage()` | Voice message not supported | generic | YES |
| 670, 680 | `handleTextMessage()` | Language question (group) | generic | YES |
| 706, 714 | `handleTextMessage()` | Group command reply | varies | YES |
| 732 | `handleTextMessage()` | Language question (direct) | generic | YES |
| 750, 758 | `handleTextMessage()` | Direct command reply | varies | YES |
| 781, 784, 787 | `handleTextMessage()` | /agent reply | agent | YES |
| 820 | `handleTextMessage()` | /mi local reply | mi_core | YES |
| 869 | `handleTextMessage()` | no-prefix local reply | mi_core | YES |
| 881 | `handleTextMessage()` | NLP greeting | generic | YES |
| 938 | `handleTextMessage()` | Business hours closed | generic | YES |
| 951 | `handleTextMessage()` | Escalation holding | generic | YES |
| 976 | `handleTextMessage()` | AI reply | generic | YES |

### workflows/form-photo-workflow.js

| Line | Function | Trigger | Owner |
|------|----------|---------|-------|
| 89 | `handleFormPhotoUpload()` | "Reading your form..." | food_safety |
| 423 | `handleManagerReview()` | Manager alert | food_safety |

### template-ocr/template-ocr-workflow.js

| Line | Function | Trigger | Owner |
|------|----------|---------|-------|
| 135 | `handleReply()` | Manager review alert | food_safety |
| 321 | `sendManagerAlert()` | OCR warning alert | food_safety |

### workflows/operating-model-router.js

| Line | Function | Trigger | Owner |
|------|----------|---------|-------|
| 68, 71, 92, 98, 101 | `routeImage()` | Food safety / form replies | food_safety |
| 127, 138, 142 | `routeImage()` | OCR / form photo | food_safety |
| 154, 159 | `routeImage()` | Evidence / unknown | food_safety |
| 184, 192, 212, 218, 233, 236, 253, 256, 278 | `routeText()` | Mi / Agent / session | varies |

---

## ALL `client.sendMessage()` Call Sites

| File | Line | Purpose |
|------|------|---------|
| `whatsapp/message-listener.js` | 360–371 | `installOutboundSendGuard()` — monkey-patch to block banned raw sends |
| `whatsapp/reply-service.js` | 35 | `send()` — sole outbound send function |
| `whatsapp/reply-service.js` | 67 | `sendMediaFile()` — outbound media |
| `whatsapp/session-manager.js` | 87–103 | `installOutboundSendGuard()` — monkey-patch on session client |

---

## Dedup Gate Status

| Component | Status | Location |
|-----------|--------|---------|
| `message-dedup-store.js` | ✅ EXISTS | `routing/message-dedup-store.js` |
| `dedup.claim()` in handleTextMessage | ✅ EXISTS | `message-listener.js:594` |
| `dedup.claim()` in handleImageMessage | ❌ MISSING | No dedup check for images |
| `dedup.isDuplicate()` in router | ✅ In router | `message-router-owner.js:221` |
| `dedup.updateStatus()` in router | ✅ In router | `message-router-owner.js:373` |

---

## Session Isolation Status

| Session | Scope Key | Isolated? | Issue |
|---------|-----------|-----------|-------|
| `templateOcrWorkflow` | `chatId:sender` | ✅ | None |
| `formPhotoWorkflow` | `chatId:sender` | ✅ | None |
| `brothCommandMod` | `chatId:sender` | ✅ | None |
| `agentMgr` | `chatId` | ✅ | Owner-based access control |
| `dedupStore` | `messageId` | ✅ | TTL-based |
| Marketing session | `chatId:owner` | ❌ | No marketing session found in codebase |

---

## Collision Root Cause

**Observed:** CEO message "nay anh có task gì" produced TWO responses:
1. "Mi is not available on this bot."
2. Marketing preview image.

**Root cause:** Multiple handlers processed the same message_id:
- `handleTextMessage()` processed it → saw no active session → fell through → sent "Mi is not available..."
- A marketing workflow also processed the same message → sent preview image.

**The dedup gate at `message-listener.js:594` exists but is only in `handleTextMessage()`**.
`handleImageMessage()` has no dedup gate at all. If the message is text but also triggers a parallel path (e.g., operating-model-router.js), both can reply.

**Fix required:** Extend dedup gate to ALL message types, enforce handler-return-only pattern, route all sends through router.
