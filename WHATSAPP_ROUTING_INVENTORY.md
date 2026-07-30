# WhatsApp Routing Inventory

## Listeners

### 1. `services/whatsapp-ai-gateway/src/whatsapp/message-listener.js`
- **Owner**: whatsapp-ai-gateway (mi-whatsapp-gateway PM2 process)
- **Type**: `client.on('message')` + `client.on('message_create')`
- **Lines**: 384-407
- **Can send directly**: YES — calls `replyService.send()` directly in many branches
- **Handlers that send**: 
  - `handleImageMessage` (food safety image pipeline)
  - `handleTextMessage` (all text routes)
  - `sendMiForwardResult` (dedup-locked mi-core reply)
- **Priority order**:
  1. Image: food safety pipeline (lines 411-537)
  2. Dedup gate (lines 588-609)
  3. Template OCR session (lines 611-617)
  4. Form photo session (lines 620-626)
  5. Voice message (lines 628-644)
  6. `/mi` and `/agent` commands (lines 648-650 → `handleAgentMiCommand`)
  7. Group quiet mode (lines 652-724)
  8. Language question (lines 726-735)
  9. Command routing (lines 737-764)
  10. `/agent` → agent forward (lines 769-792)
  11. `/mi` command → mi-core forward (lines 794-826) **[COLLISION ZONE]**
  12. `isNoPrefix` → mi-core forward (lines 830-874) **[COLLISION ZONE]**
  13. NLP GREETING (lines 877-885) **[COLLISION ZONE]**
  14. Safety gates + generic AI reply (lines 887-980)

### 2. `services/mi-ceo-observer/src/ceo-session.js`
- **Owner**: mi-ceo-observer (mi-ceo-observer PM2 process)
- **Type**: `client.on('message')` + `client.on('message_create')`
- **Lines**: 201-213
- **Can send directly**: NO — read-only by design
- **Behavior**: Observes CEO messages, forwards tasks to mi-core via HTTP
- **Dedup**: `processedIds` Set with 5-min TTL (lines 33-57)

## Collision Analysis

### Root Cause: isNoPrefix → mi-core → fallback → GREETING collision
**File**: `message-listener.js` lines 830-885

When CEO sends "mi oi":
1. `isMiCommand("mi oi")` → `false` (no `/mi` prefix)
2. `isNoPrefix("mi oi")` → `true` (no recognized prefix)
3. CEO is admin → `handleMiMessage` called → `/mi mi oi` sent to mi-core
4. `forwardToMi` returns `{ ok: false, reply: errorText }`
5. `sendMiForwardResult` logs warning but does NOT return
6. `forwardResult.reply` = error text → sent via `replyService.send` → **Collision #1**
7. mi-core eventually replies → **Collision #2**

### Root Cause: isNoPrefix fallback reply suppresses mi-core
**File**: `message-listener.js` lines 852-873

After `forwardToMi` fails with `ok: false` and `reply: errorText`:
- `forwardResult.reply` (error text) is treated as a valid reply
- Sent via `replyService.send` as "greeting/fallback"
- This prevents mi-core's reply from showing (stale message guard)

### Root Cause: isCeoSender bypass missing in isNoPrefix block
**File**: `message-listener.js` lines 830-874

The `isNoPrefix` block does `isCeoSender` check (line 836) but the logic is complex and may fail in edge cases. All CEO messages should be routed to mi-core regardless of admin config.

## Send Paths

| Send Path | File | Lines | Can Send Directly |
|---|---|---|---|
| `replyService.send()` | `message-listener.js` | 732, 750, 758, 781, 787, 820, 841, 869, 881, 938, 951, 976 | YES |
| `sendMediaFile()` | `message-listener.js` | 191 (inside sendMiForwardResult) | YES |
| `sendMiForwardResult()` | `message-listener.js` | 188-197 | YES |
| `food-safety-workflow` | `message-listener.js` | 516-518 | YES |
| `template-ocr-workflow` | `message-listener.js` | 498-504 | YES |
| `form-photo-workflow` | `message-listener.js` | 474-478 | YES |

## Dedup Store

- **Primary**: `services/whatsapp-ai-gateway/src/routing/message-dedup-store.js` (singleton)
- **Backup**: `services/whatsapp-ai-gateway/src/routing/message-dedup-store.ts`
- **Claim key**: `message_id`
- **TTL**: 24 hours
- **Status values**: `processing | completed | failed`

## PM2 Processes

| Process | Service | Port | Script |
|---|---|---|---|
| mi-whatsapp-gateway | whatsapp-ai-gateway | 3211 | src/index.js |
| mi-ceo-observer | mi-ceo-observer | 3212 | src/index.js |
| mi-core | server | 4001 | server/dist/index.js |
