# MI Core WhatsApp Endpoint Report

## Endpoint Summary

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/whatsapp/mi` | API Key | Main message handler |
| GET | `/api/whatsapp/mi/health` | None | Lightweight health check |
| GET | `/api/whatsapp/mi/status` | None | Full connector status |
| GET | `/api/whatsapp/mi/messages` | None | Message log |
| GET | `/api/whatsapp/mi/approvals` | None | Approval records |
| GET | `/api/whatsapp/mi/audit` | None | Audit log |
| GET | `/api/whatsapp/mi/setup` | None | Setup state |
| POST | `/api/whatsapp/mi/setup` | None | Configure API key |
| POST | `/api/whatsapp/mi/rotate` | None | Rotate API key |
| POST | `/api/whatsapp/mi/revoke` | None | Revoke API key |
| GET | `/api/whatsapp/mi/check` | None | Check key validity |

## Request Payload (from whatsapp-api)

```json
{
  "source": "whatsapp",
  "client_id": "mi-core",
  "message_id": "wa-123",
  "chat_id": "chat-abc",
  "group_id": "",
  "sender": "phone-number",
  "sender_name": "CEO",
  "text": "/mi chào em",
  "timestamp": "2026-06-10T08:00:00Z",
  "attachments": [],
  "api_key": "key-from-whatsapp-api"
}
```

## Response Format

```json
{
  "ok": true,
  "reply": "Dạ anh, chào anhạ!",
  "actions": [],
  "approval_required": false,
  "approval_id": null,
  "metadata": {
    "intent": "chat",
    "source": "mi-core",
    "confidence": 0.9,
    "requires_followup": false
  }
}
```

## Supported /mi Commands

- `/mi chào em` → Greeting
- `/mi hôm nay anh nên làm gì?` → Daily briefing
- `/mi tóm tắt WhatsApp hôm nay` → Summary
- `/mi task nào overdue?` → Overdue tasks
- `/mi check dashboard` → Dashboard check
- `/mi tìm Raw project` → Project search
- `/mi project nào đang lỗi?` → Project issues
- `/mi tạo task cho Maria` → Task creation (approval)
- `/mi show pending approvals` → Pending approvals
- `/mi approve <id>` → Approve action
- `/mi reject <id>` → Reject action
