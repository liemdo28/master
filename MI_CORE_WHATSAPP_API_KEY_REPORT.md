# MI Core WhatsApp API Key Report

## Commands Available

| Command | Endpoint | Description |
|---------|----------|-------------|
| Setup API Key | `POST /api/whatsapp/mi/setup` | Configure new API key from whatsapp-api |
| Rotate API Key | `POST /api/whatsapp/mi/rotate` | Replace with new key |
| Check API Key | `GET /api/whatsapp/mi/check` | Check if key is configured |
| Revoke API Key | `POST /api/whatsapp/mi/revoke` | Revoke locally |
| API Key Status | `GET /api/whatsapp/mi/status` | Full status including last_used_at |

## Security Rules

1. **Never store raw API key** — only SHA-256 hash stored
2. **Hash uses unique salt** — `mi-wa-salt-2026` per-message salt
3. **Validate against whatsapp-api** — health endpoint check on setup
4. **Allow key rotation** — old key invalidated on rotate
5. **Audit log** — all key operations logged with timestamp

## Setup Flow

```
1. whatsapp-api generates API key
2. CEO pastes key into Mi UI → POST /api/whatsapp/mi/setup
3. Mi-Core validates against whatsapp-api /health
4. Mi-Core stores SHA-256 hash only
5. Mi-Core returns success
```

## Rotation Flow

```
1. whatsapp-api generates new API key
2. CEO rotates → POST /api/whatsapp/mi/rotate with new key
3. Old hash replaced with new hash
4. Old key immediately invalid
```

## Environment Variable Support

```bash
# In server/.env
WHATSAPP_API_BASE_URL=http://localhost:3000
```

## Rate Limits
- Per minute: 60 requests
- Per hour: 1000 requests
