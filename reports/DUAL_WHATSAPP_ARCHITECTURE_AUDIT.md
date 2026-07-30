# Dual WhatsApp Architecture Audit
**Date:** 2026-06-15
**Phase:** 1 — Current Architecture Audit
**Target:** DUAL_SESSION_SUPPORTED

---

## Executive Summary

The current system runs ONE WhatsApp session (Session B — Mi Assistant account). Session A (CEO Main Account) does not yet exist as a connected session. This audit documents what is in place and what must be built for dual-session operation.

---

## Current Architecture

### Component Map

```
CEO iPhone (WhatsApp Main Account)
    ↓ sends /mi commands
WhatsApp AI Gateway (Session B — port 3211)
    ↓ POST /api/whatsapp/mi
Mi-Core Server (port 4001)
    ↓ GStack Intent Router
    ↓ Approval Engine
    ↓ Skills / Connectors
    ↓ Evidence Engine
    ↓ WhatsApp Sender
    ↓ sendToCeo()
WhatsApp AI Gateway (Session B)
    ↓ replies via existing connection
CEO iPhone receives reply
```

### Session B — Mi Assistant (Existing)

| Property | Value |
|----------|-------|
| Framework | `whatsapp-web.js` v1.34.7 |
| Client ID | `bakudan-food-safety` |
| Session storage | `./data/whatsapp/auth/` |
| Auth strategy | `LocalAuth` |
| PM2 name | `whatsapp-ai-gateway` |
| Port | 3211 (dashboard) |
| Puppeteer | Headless=false (Windows) |
| Role | **SEND** — Mi Assistant sends responses to CEO |

**Current capabilities (Session B):**
- ✅ Receives CEO messages via `/mi` prefix or private chat
- ✅ Forwards to mi-core `/api/whatsapp/mi`
- ✅ Food safety pipeline (group monitoring)
- ✅ Rate limiting, dedup, audit log
- ✅ Approval flow (returns approval requests to CEO)
- ✅ Daily briefing delivery via `sendToCeo()`
- ✅ WhatsApp reply via `replyService.send()`

### Session A — CEO Main Account (MISSING — to be built)

| Property | Status |
|----------|--------|
| Framework | `whatsapp-web.js` (same) |
| Client ID | `mi-ceo-observer` (new, isolated) |
| Session storage | `./data/ceo-session/` (isolated) |
| Auth strategy | `LocalAuth` (separate `dataPath`) |
| PM2 name | `mi-ceo-observer` (new) |
| Port | 3212 (new) |
| Role | **READ** — observes CEO conversations, detects tasks |

---

## Multi-Session Support Assessment

### whatsapp-web.js — Multi-Session Capability

| Check | Result |
|-------|--------|
| Multiple `Client` instances in same process | ✅ Supported |
| Multiple `Client` instances in separate processes | ✅ Supported (recommended) |
| `LocalAuth` with different `clientId` + `dataPath` | ✅ Full session isolation |
| Different Puppeteer profile per instance | ✅ Via `userDataDir` |
| Cross-contamination risk | ✅ NONE if `clientId` + `dataPath` differ |

**Verdict:** `whatsapp-web.js` fully supports multi-session via separate process + separate `LocalAuth` storage. The existing `session-manager.js` is single-session by design but the underlying library supports N sessions.

### Mi-Core — Multi-Session Support

| Check | Result |
|-------|--------|
| `/api/whatsapp/mi` — handles messages from any source | ✅ Source field in payload |
| `sendToCeo()` — routes via Session B | ✅ Already works |
| Approval engine — session-agnostic | ✅ |
| GStack — session-agnostic | ✅ |
| Evidence engine — session-agnostic | ✅ |

### Approval Engine

| Feature | Status |
|---------|--------|
| `classify()` — action tier classification | ✅ Implemented |
| CEO approval required for sensitive actions | ✅ |
| Blocked actions (deploy, delete, transfer) | ✅ |
| Approval flow via WhatsApp | ✅ (Session B replies) |

### Memory Engine

| Feature | Status |
|---------|--------|
| Conversation memory (per sender) | ✅ `conversations.db` |
| Follow-up resolution | ✅ |
| Group context memory | ✅ `context-memory.ts` |

---

## Gaps Identified

| Gap | Impact | Fix |
|-----|--------|-----|
| Session A does not exist | HIGH — CEO conversations not observed | Build `mi-ceo-observer` |
| No CEO chat reading | HIGH — tasks from groups not detected | Session A reads all chats |
| No task auto-detection | HIGH | `task-detector.js` NLP module |
| No group whitelist enforcement | MEDIUM | `whitelist.js` policy |
| CEO Observer not in PM2 | HIGH | Add to `ecosystem.config.js` |
| No dual-session health in dashboard | LOW | Proxy route `/api/ceo-observer` |

---

## Components Audited

| Component | Multi-Session Ready? | Notes |
|-----------|---------------------|-------|
| `whatsapp-web.js` | ✅ YES | Supports N sessions via `LocalAuth` isolation |
| `whatsapp-ai-gateway` | ✅ Session B only | Would need new process for Session A |
| `mi-core` `/api/whatsapp/mi` | ✅ YES | Accepts messages from any `client_id` |
| `GStack Orchestrator` | ✅ YES | Source-agnostic |
| `Approval Engine` | ✅ YES | Session-agnostic |
| `Memory Engine` | ✅ YES | Per-sender isolation |
| `Finance Truth Layer` | ✅ YES | No session dependency |
| `Evidence Engine` | ✅ YES | Workflow-based, session-agnostic |
| `PM2 ecosystem.config.js` | ⚠️ PARTIAL | Only Session B process defined |
| CEO Observer (Session A) | ❌ NOT BUILT | Requires new service |

---

## Certification

```
DUAL_SESSION_SUPPORTED

whatsapp-web.js multi-session: ✅ (via separate LocalAuth + dataPath)
Mi-Core accepts dual-source input: ✅
Session B (Mi Assistant) operational: ✅
Session A (CEO Main Account) design complete: ✅
Session A implementation: ⏳ Built in Phase 2
No cross-contamination risk: ✅ (separate process + storage)
```
