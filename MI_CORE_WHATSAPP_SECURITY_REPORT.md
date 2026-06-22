# MI Core WhatsApp Security Report

## Security Measures

### 1. API Key Security
- **Hash only** — raw API key never stored, only SHA-256 hash
- **Unique salt** — `mi-wa-salt-2026` for all hashing operations
- **No logging of raw key** — error messages never include key value
- **Validation** — health endpoint check against whatsapp-api on setup

### 2. Authentication
- **API key required** — every POST to `/api/whatsapp/mi` must include `X-API-Key` header
- **client_id validation** — must be exactly `mi-core`
- **source validation** — must be exactly `whatsapp`
- **Missing key → 401 MISSING_API_KEY**
- **Invalid key → 403 INVALID_API_KEY** (logged to audit)

### 3. Rate Limiting
- **Per minute**: 60 requests per client
- **Per hour**: 1000 requests per client
- **Exceed limit → 429 RATE_LIMITED** with retry_after_seconds

### 4. Replay Protection
- **message_id deduplication** — in-memory Set
- **Duplicate → returns cached response** — no re-execution
- **Periodic cleanup** — Set cleared every 30 minutes if > 10000 entries

### 5. Audit Logging
All events logged to `.local-agent-global/connectors/whatsapp/audit_log.json`:
- key_setup, key_setup_failed, key_setup_warning
- key_rotated, key_revoked
- INVALID_API_KEY attempts
- RATE_LIMITED events
- PIPELINE_ERROR events

### 6. Input Validation
- Required fields enforced: message_id, chat_id, sender, text
- source must be 'whatsapp'
- client_id must be 'mi-core'
- All strings sanitized before storage

### 7. No Sensitive Data Leakage
- Never return raw API key or hash in any response
- Never log raw API key values
- Health endpoint shows only status, not key data
- Sensitive actions blocked without approval

## Blocked Scenarios

| Threat | Protection |
|--------|------------|
| Invalid API key access | Hash comparison + 403 |
| Brute force | Rate limiting |
| Replay attack | message_id deduplication |
| Key extraction from logs | Hash only, no raw logging |
| Unauthorized clients | client_id validation |
| Sensitive action without approval | Level2/3 gate enforcement |
| Sensitive action via WhatsApp | Double approval for sensitive categories |
