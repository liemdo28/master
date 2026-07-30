# WHATSAPP_MESSAGE_OWNERSHIP

**Status:** IMPLEMENTED
**Date:** 2026-06-22
**File:** `services/whatsapp-ai-gateway/src/routing/message-router-owner.js`

## Architecture

```
Incoming WhatsApp message
↓
Message Deduplication (message-dedup-store.js)
↓
Group / Chat Policy Resolver (resolveGroupPolicy)
↓
Intent Gate (detectIntent)
↓
Single Handler (executeHandler)
↓
Response Builder
↓
Send Once (sendOnce — only router sends)
```

## Required Fields

| Field | Type | Description |
|-------|------|-------------|
| message_id | string | WhatsApp message_id (_serialized) |
| chat_id | string | WhatsApp chat ID |
| group_name | string | Group name (empty for DM) |
| sender | string | Sender phone number |
| timestamp | string | ISO timestamp |
| normalized_text | string | Lowercase trimmed text |
| policy | string | Group policy (food_safety, marketing, team_support, admin, general) |
| intent | string | Detected intent |
| owner_handler | string | Winning handler |
| decision_reason | string | Why this handler won |
| response_allowed | boolean | Whether response should be sent |
| dedup_key | string | Dedup lookup key |

## Owner Handlers Allowed

| Handler | Value | When |
|---------|-------|------|
| MI_CORE | mi_core | Message starts with "Mi ơi", "/mi", or bot mention |
| FOOD_SAFETY | food_safety | food_safety group + image/form detected |
| MARKETING_PREVIEW | marketing_preview | Draft approval keywords + active session |
| TEAM_SUPPORT | team_support | Team support group messages |
| UNKNOWN_NO_REPLY | unknown_no_reply | No matching intent, no active session |

## Routing Rules

1. **"Mi ơi" or "mi ơi"** → owner = `mi_core`
2. **food_safety group + image** → owner = `food_safety`
3. **Draft approval keywords + active session** → owner = `marketing_preview`
4. **No active session + no explicit mention** → owner = `unknown_no_reply`
5. **Explicit bot mention + wrong group** → reply once with routing guidance
6. **Active session** → owner matches group policy

## Integration Points

- `resolveGroupPolicy(groupName, chatId)` → determines group type
- `detectIntent(text, groupName, hasImage, hasActiveSession)` → single owner
- `routeMessage(params)` → full pipeline with dedup
- `executeHandler(decision, handlerFn)` → handler returns proposed response
- `sendOnce(replyService, client, chatId, handlerResponse)` → final send

## Verification

```javascript
const { routeMessage, OWNER_HANDLERS } = require('./routing/message-router-owner');

// Test 1: Mi ơi
const d1 = routeMessage({ messageId: 'test1', chatId: 'g1', groupName: 'Team', sender: '123', text: 'Mi ơi' });
assert(d1.owner_handler === OWNER_HANDLERS.MI_CORE); // ✅

// Test 2: No mention, no session
const d2 = routeMessage({ messageId: 'test2', chatId: 'g1', groupName: 'Team', sender: '123', text: 'hello' });
assert(d2.owner_handler === OWNER_HANDLERS.UNKNOWN_NO_REPLY); // ✅
assert(d2.response_allowed === false); // ✅
```
