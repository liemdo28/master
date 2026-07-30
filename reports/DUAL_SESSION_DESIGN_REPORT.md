# Dual Session Design Report
**Date:** 2026-06-15
**Phase:** 2 — Multi Session Design
**Target:** MULTI_SESSION_READY

---

## Architecture Design

```
CEO iPhone (Main WhatsApp Account)
     │
     │ All chats, groups, messages
     ▼
┌─────────────────────────────────────────────────────┐
│  SESSION A — mi-ceo-observer (port 3212)            │
│  Role: READ-ONLY observer                           │
│  ClientId: mi-ceo-observer                         │
│  Storage: E:/Project/Master/mi-ceo-observer/        │
│           data/ceo-session/auth/                    │
│  Puppeteer port: 9223                               │
│                                                     │
│  Pipeline:                                          │
│  message → whitelist check → task-detector NLP      │
│          → forward to mi-core POST /api/whatsapp/mi │
└─────────────────────────────────────────────────────┘
     │
     │ POST /api/whatsapp/mi (HTTP, x-api-key)
     │ source: 'ceo-observer-session-a'
     ▼
┌─────────────────────────────────────────────────────┐
│  MI-CORE (port 4001)                                │
│  GStack Intent Router                               │
│  → Finance Truth Layer (QB)                         │
│  → Task Workflow Engine                             │
│  → Approval Engine                                  │
│  → Evidence Generator                               │
│  → sendToCeo() → Session B                          │
└─────────────────────────────────────────────────────┘
     │
     │ Delivers reply via
     ▼
┌─────────────────────────────────────────────────────┐
│  SESSION B — whatsapp-ai-gateway (port 3211)        │
│  Role: SEND — Mi Assistant account                  │
│  ClientId: bakudan-food-safety                      │
│  Storage: ./data/whatsapp/auth/                     │
│  Puppeteer port: 9222                               │
│                                                     │
│  Delivers: CEO reports, approvals, workflow status  │
└─────────────────────────────────────────────────────┘
     │
     ▼
CEO iPhone receives Mi reply
```

---

## Session Isolation Guarantees

### Session A vs Session B — No Cross-Contamination

| Property | Session A (CEO Observer) | Session B (Mi Assistant) | Isolation |
|----------|--------------------------|--------------------------|-----------|
| Process | `mi-ceo-observer` (PM2) | `whatsapp-ai-gateway` (PM2) | ✅ Separate OS processes |
| Client ID | `mi-ceo-observer` | `bakudan-food-safety` | ✅ Different auth namespace |
| Session dir | `mi-ceo-observer/data/ceo-session/auth/` | `whatsapp-ai-gateway/data/whatsapp/auth/` | ✅ Completely separate paths |
| Puppeteer profile | `mi-ceo-observer/data/ceo-session/cache/` | `whatsapp-ai-gateway/data/whatsapp/cache/` | ✅ Separate Chrome profiles |
| Puppeteer debug port | 9223 | 9222 | ✅ Different ports |
| API port | 3212 | 3211 | ✅ Different ports |
| QR code | Separate scan (CEO phone) | Separate scan (Mi phone) | ✅ Independent auth |
| Reconnect | Independent timer | Independent timer | ✅ No coupling |
| Storage | SQLite not shared | SQLite not shared | ✅ No shared DB |
| Logs | `ceo-observer.log` | `gateway.log` | ✅ Separate logs |

### Independent Reconnect

Each session manages its own reconnect lifecycle:
- Session A reconnect: 15s delay after disconnect
- Session B reconnect: exponential backoff (15s → 30s → 60s → 120s)
- No shared state — Session B going down does NOT affect Session A

### Independent QR

- Session A QR: appears in `mi-ceo-observer` logs — scan with CEO phone
- Session B QR: appears in `whatsapp-ai-gateway` logs — scan with Mi Assistant phone
- Each scanned independently, stored in separate `LocalAuth` directories

---

## Message Flow Detail

### Session A → Mi-Core

```
1. CEO conversation received by Client A
2. Whitelist check (shouldObserve(chatId, chatName))
3. Task detection NLP (detectTaskIntents(text))
4. If should_create_workflow:
   a. Build workflow request string
   b. POST /api/whatsapp/mi with source='ceo-observer-session-a'
   c. mi-core GStack routes by intent
   d. Work order created
   e. Skills executed (with approval if REQUIRES_APPROVAL)
   f. sendToCeo() called → Session B delivers reply
```

### CEO to Mi (manual command still works)

```
1. CEO sends "/mi check QB" on Mi Assistant chat
2. Session B (whatsapp-ai-gateway) receives
3. Routes to /api/whatsapp/mi
4. mi-core processes
5. Reply via Session B
```

---

## PM2 Process Map

| PM2 Name | Port | Role | Session |
|----------|------|------|---------|
| `mi-ceo-observer` | 3212 | Session A — CEO reader | CEO main account |
| `whatsapp-ai-gateway` | 3211 | Session B — Mi sender | Mi Assistant account |
| `mi-core` | 4001 | Intelligence engine | — |
| `accounting-engine` | 8844 | Finance backend | — |
| `mi-node-agent` | 4004 | Node registry | — |
| `mi-ai-service` | 5001 | Python/Ollama wrapper | — |

---

## Activation Steps

```bash
# 1. Install CEO observer dependencies
cd E:/Project/Master/mi-ceo-observer
npm install

# 2. Create .env from .env.example
cp .env.example .env
# Fill in: MI_CORE_API_KEY, CEO_PHONE

# 3. Start the observer (will show QR code)
pm2 start ecosystem.config.js --only mi-ceo-observer

# 4. Scan QR with CEO main phone
# Watch logs: pm2 logs mi-ceo-observer

# 5. Verify status
curl http://localhost:3212/health
pm2 save
```

---

## Certification

```
MULTI_SESSION_READY

Session A design: ✅ Built (mi-ceo-observer)
Session B operational: ✅ (whatsapp-ai-gateway)
Session isolation: ✅ Separate process, storage, ports, QR
Independent reconnect: ✅ Each session self-healing
No cross-contamination: ✅ Verified via separate LocalAuth paths
PM2 ecosystem updated: ✅
Mi-Core accepts both sources: ✅ (/api/whatsapp/mi source field)
```
