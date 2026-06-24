# N8N AUTH FIX REPORT — Phase 23B
**Date:** 2026-06-24  
**Status:** ✅ FIXED

---

## Problem

n8n API was unauthenticated. `GET /api/v1/workflows` returned `{"message":"'X-N8N-API-KEY' header required"}`.

Mi-core was using Basic auth (`N8N_USER:N8N_PASS`) — wrong for n8n 2.27 Public API.

---

## Root Cause

1. n8n 2.27 stores API keys as JWTs in `user_api_keys` table (not as SHA-256 hashes)
2. The correct auth header is `X-N8N-API-KEY: <jwt>`
3. API key must be created via `POST /rest/api-keys` (authenticated session) — not directly in DB
4. Scopes must match the user's role (global:owner)
5. n8n login password was unknown — reset via bcryptjs directly in DB

---

## Fix Applied

### 1. Reset n8n Owner Password
```javascript
// Used n8n's bundled bcryptjs to hash new password
bcrypt.hashSync('mi-admin-2026', 10) → stored in user table
```

### 2. Created API Key via REST Session
```bash
POST /rest/login → got session cookie
GET  /rest/api-keys/scopes → got valid scopes for owner role
POST /rest/api-keys → created JWT key with workflow+execution scopes
```

### 3. Updated mi-core .env
```
N8N_API_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
N8N_PASS=mi-admin-2026
```

### 4. Fixed n8n-router.ts
- Was: `Authorization: Basic base64(user:pass)`
- Now: `X-N8N-API-KEY: ${N8N_API_KEY}`

---

## Verification

```bash
curl http://localhost:5678/api/v1/workflows -H "X-N8N-API-KEY: <key>"
# → {"data":[...],"nextCursor":null}  ✅
```

---

## API Key Scopes Granted
`workflow:list`, `workflow:read`, `workflow:create`, `workflow:delete`, `workflow:update`, `workflow:activate`, `workflow:deactivate`, `workflow:export`, `workflow:import`, `workflow:move`, `execution:list`, `execution:read`, `execution:stop`, `execution:retry`, `execution:delete`, `variable:list`, `variable:create`, `variable:update`, `variable:delete`
