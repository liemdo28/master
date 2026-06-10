# WhatsApp API Key Management Report

**Branch:** `feature/agent-mi-command-routing`  
**Date:** 2026-06-10  
**Status:** ✅ PASS

---

## 1. Overview

API Key Management for WhatsApp AI Gateway's Agent/MI command routing system.
Two clients are managed: `agent-coding` and `mi-core`.

Each client has:
- Unique `client_id` (no sharing)
- Hashed API key (raw key shown once at creation)
- `key_prefix` (first 8 chars for display/identification)
- `allowed_commands` (routing rules)
- `rate_limit` (per-minute)
- `permissions` (read/write)
- `callback_url` (optional endpoint override)
- `status` (active/revoked)
- `created_at`, `last_used_at`

---

## 2. Key Generation

**File:** `src/security/api-key-manager.js`

| Property | Value |
|---|---|
| Algorithm | SHA-256 with random 16-byte salt |
| Key length | 72 hex chars (36 random bytes) |
| Hash format | `salt:hex_hash` |
| Storage | Hash only — raw key never stored |
| Key prefix | First 8 chars for display |
| Library | Node.js `crypto` (built-in) |

```javascript
// generateApiKey() → { rawKey, hash, prefix }
// hashKey(rawKey) → "salt:hex_hash"
// validateKey(rawKey, storedHash) → boolean
```

---

## 3. Client Registry

**File:** `src/security/project-client-registry.js`

| Client | Commands | Rate Limit | Permissions | Description |
|---|---|---|---|---|
| `agent-coding` | `/agent` | 120/min | read,write | Coding/workflow agent |
| `mi-core` | `/mi` | 60/min | read | Executive assistant |

**CRUD Operations:**

| Operation | Endpoint | Method |
|---|---|---|
| List clients | `/api/clients` | GET |
| Create client | `/api/clients` | POST |
| Rotate key | `/api/clients/:id/rotate` | POST |
| Revoke key | `/api/clients/:id/revoke` | POST |
| Client health | `/api/clients/:id/health` | GET |
| Audit logs | `/api/audit/api-keys` | GET |

---

## 4. Rotation & Revocation

**Rotation:** `POST /api/clients/:id/rotate`
- Generates new random key
- Updates hash in database
- Status stays `active`
- Audit log: `KEY_ROTATED`

**Revocation:** `POST /api/clients/:id/revoke`
- Sets `status = 'revoked'`
- Revoked key immediately fails validation
- Audit log: `KEY_REVOKED`
- Hard rule enforced: `status !== 'active'` → rejected

---

## 5. Rate Limiting

Per-client rate limiting enforced by forwarder:
- `agent-coding`: 120 requests/minute (configurable via env)
- `mi-core`: 60 requests/minute (configurable via env)

Rate limit checked against SQLite `api_keys.rate_limit` field.
Excess requests get safe error reply, logged to `routed_messages`.

---

## 6. Audit Logging

**File:** `src/security/api-key-audit-log.js`

Audit log table: `api_key_audit`

**Actions logged:**
- `KEY_CREATED` — new client/key created
- `KEY_REVOKED` — key revoked
- `KEY_ROTATED` — key rotated
- `KEY_VALIDATED` — key validated successfully
- `KEY_FAILED` — key validation failed
- `ROUTE_SENT` — message forwarded
- `ROUTE_FAILED` — forward failed
- `ROUTE_APPROVED` — approval granted
- `ROUTE_REJECTED` — approval denied

---

## 7. Security Rules Verification

| Rule | Status |
|---|---|
| Hash API keys before storage | ✅ SHA-256+salt |
| Raw key shown once only | ✅ Console.log at creation |
| Revoked key must fail | ✅ `status !== 'active'` check |
| Invalid key must fail | ✅ validateKey() comparison |
| Rate limit per client | ✅ checked in forwarder |
| All usage must be audited | ✅ via apiKeyAuditLog |
| No shared keys between projects | ✅ Separate `client_id` per project |
| Keys not hardcoded | ✅ Env vars only, no hardcoding |

---

## 8. Migration

**File:** `src/migrations/002_api_key_management.js`

Creates tables:
- `api_keys` — client records
- `api_key_audit` — audit events
- `routed_messages` — message routing log
- `approvals` — approval records

---

## 9. Default Clients

On first boot (`ensureDefaultClients()`), two clients are created automatically:
1. `agent-coding` — key printed to console (once), logged to audit
2. `mi-core` — key printed to console (once), logged to audit

---

## 10. API Key Audit Stats Endpoint

**Endpoint:** `GET /api/audit/api-keys`

Returns:
- Recent audit log entries (filterable by `client_id`)
- Statistics: total, success, failed, by action, by client
- Recent failures for security monitoring

---

**Verdict:** ✅ PASS — All security rules implemented and enforced.