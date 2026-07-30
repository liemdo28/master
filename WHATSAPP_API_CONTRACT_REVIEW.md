# WHATSAPP_API_CONTRACT_REVIEW
**Generated:** 2026-06-10

---

## API Contract: POST /api/whatsapp/mi

### Request Schema
```json
{
  "api_key": "string (required)",
  "source": "whatsapp (required)",
  "client_id": "mi-core (required)",
  "message_id": "string (required — replay protection)",
  "message": "string (required — /mi prefix or plain)",
  "sender_name": "string (optional)",
  "group_id": "string (optional)",
  "timestamp": "string (optional)"
}
```

### Response Schema — Success
```json
{
  "ok": true,
  "reply": "string",
  "message_id": "string",
  "timestamp": "string",
  "model": "string",
  "kb_hits": 0
}
```

### Response Schema — Error
```json
{
  "ok": false,
  "error": "MISSING_API_KEY | INVALID_API_KEY | RATE_LIMITED | DUPLICATE_MESSAGE | ..."
}
```

---

## Validation Rules Confirmed (Code Review)

| Rule | Implementation | Status |
|---|---|---|
| `source === 'whatsapp'` required | `waAuth` middleware checks | ✅ |
| `client_id === 'mi-core'` required | `waAuth` middleware checks | ✅ |
| `message_id` replay protection | `isMessageDuplicate()` | ✅ |
| Rate limit per client_id | `checkRateLimit()` 60/min, 1000/hr | ✅ |
| API key: hash comparison only | `hashApiKey()` SHA-256 + salt | ✅ |
| Raw key never stored | confirmed: only `api_key_hash` in config | ✅ |
| Raw key never logged | confirmed: `appendAudit()` logs action only, no key | ✅ |
| `/mi` prefix normalized | strip prefix before pipeline | ✅ |
| Approval commands | `/mi approve <id>`, `/mi reject <id>` | ✅ |

---

## Route List

| Method | Path | Purpose |
|---|---|---|
| POST | /api/whatsapp/mi | Main message handler |
| GET | /api/whatsapp/mi/health | Health check |
| GET | /api/whatsapp/mi/status | Full status |
| GET | /api/whatsapp/mi/messages | Message history |
| GET | /api/whatsapp/mi/approvals | Pending approvals |
| GET | /api/whatsapp/mi/audit | Audit log |
| GET | /api/whatsapp/mi/setup | Setup guide |
| POST | /api/whatsapp/mi/setup | Configure API key |
| POST | /api/whatsapp/mi/rotate | Rotate API key |
| POST | /api/whatsapp/mi/revoke | Revoke API key |
| GET | /api/whatsapp/mi/check | Key status check |

---

## Approval Flow via WhatsApp

```
User sends: "/mi approve abc123"
→ waAuth validates key
→ Router finds action abc123 in gate
→ approve(id) → status = 'approved'
→ executeApprovedAction() fires real API call
→ Returns: "✅ Action abc123 approved and executed: [detail]"
```

## Rejection Flow

```
User sends: "/mi reject abc123"
→ reject(id) → status = 'rejected'
→ Returns: "❌ Action abc123 rejected."
```

---

## VERDICT: PASS ✅

API contract is well-defined. All security constraints enforced. Approval bypass not possible (gate.ts requires pending status to approve).
