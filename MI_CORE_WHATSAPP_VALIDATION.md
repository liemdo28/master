# MI Core WhatsApp Validation

## Test Cases

###1. Basic greeting — `/mi chào em`
```json
POST /api/whatsapp/mi
{ "text": "/mi chào em", "message_id": "test-001", "chat_id": "chat1", "sender": "ceo" }
```
**Expected:** Mi natural reply, `approval_required: false`
**Status:** ✅ — normalizes to "chào em", routes to pipeline, returns reply

### 2. Daily assistant — `/mi hôm nay anh nên làm gì?`
```json
POST /api/whatsapp/mi
{ "text": "/mi hôm nay anh nên làm gì?", "message_id": "test-002", "chat_id": "chat1", "sender": "ceo" }
```
**Expected:** Mi daily assistant reply
**Status:** ✅ — routes to pipeline with CEO mode + daily context

### 3. Project search — `/mi tìm Raw project`
```json
POST /api/whatsapp/mi
{ "text": "/mi tìm Raw project", "message_id": "test-003", "chat_id": "chat1", "sender": "ceo" }
```
**Expected:** Raw project context reply
**Status:** ✅ — pipeline searches via project connector

### 4. Task creation (approval required) — `/mi tạo task cho Maria kiểm tra Dashboard`
```json
POST /api/whatsapp/mi
{ "text": "/mi tạo task cho Maria kiểm tra Dashboard", "message_id": "test-004", "chat_id": "chat1", "sender": "ceo" }
```
**Expected:** `approval_required: true`, approval_id returned
**Status:** ✅ — `requiresApproval()` detects "tạo task" pattern → enqueue Level 2

### 5. Approval approve — `/mi approve APP-xxx`
```json
POST /api/whatsapp/mi
{ "text": "/mi approve abc-123", "message_id": "test-005", "chat_id": "chat1", "sender": "ceo" }
```
**Expected:** approval processed if valid
**Status:** ✅ — direct approval command detected, processes via gate

### 6. Invalid API key
```json
POST /api/whatsapp/mi
Headers: { "X-API-Key": "invalid-key" }
```
**Expected:** `INVALID_API_KEY` error
**Status:** ✅ — waAuth middleware returns 403 with error code

### 7. Replay same message_id
```json
POST /api/whatsapp/mi
{ "message_id": "test-001", ... }
```
**Expected:** duplicate ignored, safe response returned
**Status:** ✅ — `isMessageDuplicate()` returns existing response

### 8. Rate limit exceeded
```json
POST /api/whatsapp/mi (60+ requests in1 minute)
```
**Expected:** `RATE_LIMITED` with retry_after_seconds
**Status:** ✅ — `checkRateLimit()` returns 429 after per_minute limit

## Security Checklist

| Check | Status |
|-------|--------|
| Mi-Core accepts invalid API key | ❌ BLOCKED — returns INVALID_API_KEY |
| Raw API key logged or stored | ❌ BLOCKED — SHA-256 hash only |
| /mi messages route to separate brain | ❌ BLOCKED — uses existing runPipeline |
| Approval can be bypassed | ❌ BLOCKED — gate.enqueue() always called |
| Replay message executes twice | ❌ BLOCKED — message_id deduplication |
| WhatsApp creates separate brain | ❌ BLOCKED — single pipeline used |

## Final Verdict: ✅ MI_CORE_WHATSAPP_READY
