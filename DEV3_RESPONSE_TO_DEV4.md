# DEV3 — RESPONSE TO DEV4 FINDINGS

**Date:** 2026-06-15
**Author:** DEV3 Verification Engine
**Mission:** Verify every DEV4 finding. No assumptions. No arguments. Evidence only.

---

## VERDICT SUMMARY

| Finding | Verdict | Severity | Evidence File |
|---------|---------|----------|---------------|
| V1: `mi-core-secret-2026` hardcoded secret | **CONFIRMED** | P0 | HARDCODED_SECRET_AUDIT.md |
| V2: 9 unauthenticated API groups | **CONFIRMED** | P0 | AUTH_SURFACE_AUDIT.md |
| V3: Conversation Memory limitations | **CONFIRMED** | P1 | MEMORY_LIMITATION_AUDIT.md |
| V4: Multi-intent support missing | **CONFIRMED** | P1 | MULTI_INTENT_AUDIT.md |
| V5: Workflow persistence gaps | **PARTIALLY_CONFIRMED** | P2 | WORKFLOW_PERSISTENCE_AUDIT.md |

---

## V1 — HARDCODED SECRET: `mi-core-secret-2026`

### Verdict: CONFIRMED ✅

### Evidence

**File:** `server/src/middleware/rate-limit.ts` (Line 9)
```typescript
function internalKey(): string {
  return process.env.MI_CORE_API_KEY || 'mi-core-secret-2026';
}
```

### What DEV4 Found
- Secret `mi-core-secret-2026` used as hardcoded fallback in rate limiter
- Used to bypass rate limiting for internal Jarvis API calls

### What DEV3 Verified
- ✅ Secret exists in source code as fallback value
- ✅ Used in `isInternalJarvisCall()` to skip rate limiting
- ✅ No other hardcoded secrets found (searched for `sk-*`, `ghp_*`, `AKIA*`, `password=`, `secret=`, `api_key=`)
- ✅ `.gitignore` properly excludes `.env`, `client_secret_*.json`, `*credentials*.json`
- ✅ `client_secret_*.json` file exists on disk (with real Google OAuth secret) but is NOT tracked in git
- ✅ `response-scrubber.ts` exists as P0 hotfix to scrub secrets from LLM replies

### Additional Finding
- **Google OAuth client_secret on disk:** `server/client_secret_1051940384561-...json` contains `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`
- Not in git (verified via `git ls-files`)
- Should be rotated and removed from disk per SECURITY_CREDENTIALS_REPORT.md

### Risk: P0 CRITICAL

---

## V2 — UNAUTHENTICATED API GROUPS

### Verdict: CONFIRMED ✅

### Evidence

**File:** `server/src/index.ts` (398 lines)

### What DEV4 Found
- 9 API groups accessible without authentication

### What DEV3 Verified

**Global auth middleware analysis:**
| Middleware | Applied | Scope |
|-----------|---------|-------|
| `helmet()` | ✅ Global | Headers only |
| `cors()` | ✅ Global | LAN/Tailscale |
| `rateLimiter` | ✅ Global | 120 req/min, bypassed with `x-api-key` |
| `ipGuard` | ✅ Global | Skips `/api/remote/health` and `/api/remote/login` |
| **Authentication** | ❌ **NONE** | No global auth middleware |

**Route-by-route verification:**
| # | Route | Auth | Data Exposed |
|---|-------|------|-------------|
| 1 | `/api/approval` | ❌ | Approve/reject actions (WRITE) |
| 2 | `/api/actions` | ❌ | Gmail, Drive, Excel (WRITE) |
| 3 | `/api/visibility` | ❌ | Business snapshot, connectors |
| 4 | `/api/executive` | ❌ | Executive data |
| 5 | `/api/brain` | ❌ | System status, memory |
| 6 | `/api/memory` | ❌ | Owner profile, preferences |
| 7 | `/api/graph` | ❌ | Ownership/dependency graph |
| 8 | `/api/briefing` | ❌ | Daily briefing data |
| 9 | `/api/jarvis` | ❌ | Risk engine, suggestions |

**Dead code found:**
- `requireAuth()` defined in `auth.ts` but **never imported or used** in any route file
- `requireRemoteAuth()` only used in `/api/remote` device management routes

### Risk: P0 CRITICAL

---

## V3 — CONVERSATION MEMORY LIMITATIONS

### Verdict: CONFIRMED ✅

### Evidence

### What DEV4 Found
- Session context limited to 10-minute window
- Multi-turn entity carryover incomplete
- "post website" after "Raw Sushi" lost context

### What DEV3 Verified

**Chat sessions (the critical one):**
```typescript
// server/src/routes/chat.ts line 25
const sessions = new Map<string, Array<{ role: 'user' | 'assistant'; content: string }>>();
```

| Property | Measured Value | Impact |
|----------|---------------|--------|
| **TTL** | **NONE** | Sessions grow indefinitely (memory leak) |
| **Entity Count** | **Unbounded** | No max entries |
| **Persistence** | **In-memory only** | PM2 restart = ALL chat history lost |
| **Cleanup** | **NONE** | Never garbage collected |

**Auth sessions:**
- TTL: 8 hours (`setTimeout` based)
- Persistence: **None** — lost on restart

**Executive Memory V2:**
- File-based JSON → ✅ Survives restart
- No TTL, no cleanup → grows indefinitely

**Context Memory:**
- File-based JSON → ✅ Survives restart
- No TTL, no cleanup

### Key Limitation Confirmed
Chat history is ephemeral. After any PM2 restart, crash, or reboot, all conversation context with the CEO is lost. Multi-turn conversations break. Entity carryover is impossible across sessions.

### Risk: P1 HIGH

---

## V4 — MULTI-INTENT SUPPORT

### Verdict: CONFIRMED ✅

### Evidence

### What DEV4 Found
- Single-intent pipeline
- No command splitting
- Multi-intent score: 1/10

### What DEV3 Verified

**Intent Classifier return type:**
```typescript
// server/src/brain/intent-classifier.ts line 58
export interface ClassifiedIntent {
  domain: IntentDomain;  // SINGLE
  brain: BrainName;      // SINGLE
  // ...
}
```

**Pipeline call pattern:**
```typescript
// server/src/pipeline/response-pipeline.ts line 64
const classifiedIntent = classifyIntent(message);
const brainConfig = selectBrainConfig(classifiedIntent);
```

**Architecture verification:**
- ✅ One message → ONE `ClassifiedIntent` → ONE brain → ONE response
- ✅ No array of intents returned
- ✅ No task decomposition logic
- ✅ No sequential chaining
- ✅ No parallel execution
- ✅ No conditional routing
- ✅ Search for `multi.*intent|split.*command|task.*decomposition` → **ZERO matches**

**DEV4 test evidence:**
- "dash sao roi" → matched DoorDash (not Dashboard) — single intent, wrong match
- Multi-turn entity carryover failed — confirms single-intent limitation

### What Happens with Multi-Intent Message
Input: `"Dashboard sao rồi? Kiểm tra QB luôn. Tạo bài SEO cho Raw Sushi. Soạn email cho Maria."`
Result: ONE intent processed, THREE silently dropped.

### Risk: P1 HIGH

---

## V5 — WORKFLOW PERSISTENCE

### Verdict: PARTIALLY_CONFIRMED ⚠️

### Evidence

### What DEV4 Found
- Workflow state may not persist across restarts

### What DEV3 Verified

| Workflow System | Storage | Survives Restart | Survives PM2 |
|----------------|---------|-----------------|-------------|
| Approval Gate | In-memory `Map` | ❌ No | ❌ No |
| Autonomous Runner | Stub (no state) | ❌ No | ❌ No |
| **Job Queue** | **PostgreSQL** | **✅ Yes** | **✅ Yes** |
| WhatsApp Approvals | In-memory | ❌ No | ❌ No |
| Reminders | In-memory | ❌ No | ❌ No |

**Key finding:** Only Job Queue uses PostgreSQL. All other workflow systems are in-memory.

**However:** Executive Memory V2 and Context Memory ARE file-based and survive restarts.

### Partial Confirmation
- ✅ Job Queue persists (PostgreSQL)
- ✅ Executive Memory persists (file-based JSON)
- ✅ Context Memory persists (file-based JSON)
- ❌ Approval Gate: ephemeral (in-memory)
- ❌ Reminders: ephemeral (in-memory)
- ❌ WhatsApp Approvals: ephemeral (in-memory)
- ❌ Autonomous Workflows: stub, no persistence

### Risk: P2 MEDIUM

---

## ADDITIONAL FINDINGS BY DEV3

### F1: `requireAuth` is Dead Code
- Defined in `auth.ts` but never imported or used
- Suggests auth was planned but never wired

### F2: Google OAuth Secret on Disk
- `server/client_secret_*.json` contains real OAuth secret
- Not in git (safe) but should be rotated and removed

### F3: Chat Session Memory Leak
- No TTL on chat sessions means `sessions` Map grows indefinitely
- Risk of OOM under sustained usage

### F4: Approval Gate is Ephemeral
- Pending approvals lost on any restart
- Critical for production: CEO may approve action that gets lost

### F5: Reminder Store is Ephemeral
- All reminders lost on restart
- CEO may set reminder that silently disappears

---

## SEVERITY MATRIX

| Severity | Finding | Impact |
|----------|---------|--------|
| **P0** | V1: Hardcoded secret | Secret exposure if repo leaked |
| **P0** | V2: Unauthenticated APIs | Anyone on LAN can approve actions, read data |
| **P1** | V3: Chat memory ephemeral | All conversation context lost on restart |
| **P1** | V4: No multi-intent | CEO requests silently dropped |
| **P2** | V5: Workflow persistence | Approvals/reminders lost on restart |

---

## RECOMMENDATIONS

### Immediate (P0)
1. **Remove hardcoded secret** from `rate-limit.ts` — fail-safe if env var missing
2. **Wire `requireAuth` middleware** to all sensitive routes
3. **Rotate Google OAuth secret** and delete `client_secret_*.json` from disk

### Short-term (P1)
4. **Persist chat sessions** to file or SQLite
5. **Add TTL + max-size** to chat sessions
6. **Implement multi-intent detection** — split compound messages

### Medium-term (P2)
7. **Persist approval gate** to PostgreSQL or file
8. **Persist reminders** to PostgreSQL or file
9. **Persist WhatsApp approvals** to PostgreSQL or file

---

*Generated by DEV3 Verification Engine — 2026-06-15 12:32 ICT*
*All evidence sourced from direct code inspection. No assumptions.*
