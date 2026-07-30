# ARCHITECTURE — WhatsApp AI Gateway

## System Overview

```
Phone (WhatsApp)
       │  incoming message
       ▼
┌─────────────────────────────────────────────────────────────┐
│                   WhatsApp AI Gateway                       │
│                                                             │
│  ┌────────────────┐    ┌──────────────────────────────┐    │
│  │ Session Manager│    │      Message Listener        │    │
│  │ (LocalAuth)    │───▶│  - receive msg               │    │
│  │ QR → Ready     │    │  - classify intent           │    │
│  │ auto-reconnect │    │  - generate AI reply         │    │
│  └────────────────┘    │  - persist to SQLite         │    │
│                         │  - forward to Telegram       │    │
│  ┌────────────────┐    └──────────────────────────────┘    │
│  │   AI Layer     │                │                        │
│  │ intent-class.  │◀───────────────┘                        │
│  │ response-gen.  │                                         │
│  │ escalation     │                                         │
│  └────────────────┘                                         │
│                                                             │
│  ┌────────────────┐    ┌──────────────────────────────┐    │
│  │  SQLite DB     │    │  Express API + Dashboard     │    │
│  │ conversations  │◀──▶│  GET /          (HTML UI)    │    │
│  │ contacts       │    │  GET /health    (JSON)       │    │
│  │ app_state      │    │  GET /api/messages           │    │
│  └────────────────┘    │  GET /api/stats              │    │
│                         └──────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
       │                              │
       ▼                              ▼
Phone (WhatsApp reply)         Telegram Group
```

---

## Component Map

| File | Responsibility |
|---|---|
| `src/index.js` | Entrypoint — wires all modules |
| `src/whatsapp/session-manager.js` | WhatsApp client lifecycle, QR, reconnect |
| `src/whatsapp/message-listener.js` | Handles incoming messages, orchestrates pipeline |
| `src/whatsapp/reply-service.js` | Sends replies with typing simulation |
| `src/ai/intent-classifier.js` | Regex-based intent classification |
| `src/ai/response-generator.js` | Canned response pool per intent |
| `src/ai/escalation-engine.js` | Decides if human intervention needed |
| `src/telegram/telegram-forwarder.js` | Forwards all messages to Telegram group |
| `src/storage/sqlite.js` | SQLite connection + schema init |
| `src/storage/conversations.js` | CRUD for messages and contacts |
| `src/api/server.js` | Express server — dashboard + REST API |
| `src/dashboard/admin-ui.js` | HTML dashboard renderer |
| `src/logger.js` | Winston multi-file logger |

---

## Data Flow — Incoming Message

```
1. WhatsApp client receives msg
2. message-listener picks it up
3. Skip if: fromMe, status@broadcast, group chat
4. Extract phone, name, text
5. classifyIntent(text) → intent string
6. shouldEscalate(intent, text) → bool
7. saveMessage(in) → SQLite
8. forwardMessage → Telegram
9. generateResponse(intent) → reply text
10. replyService.send → WhatsApp
11. saveMessage(out) → SQLite
```

---

## Intent Classification — Phase 1

Pattern-based, no ML required:

| Intent | Trigger Keywords |
|---|---|
| greeting | hello, hi, hey, good morning/evening |
| hours | open, close, hour, time, when, schedule |
| address | address, location, where, map, directions |
| menu | menu, food, drink, eat, price, ramen |
| rewards | reward, loyalty, point, discount, member |
| reservation | book, reserve, table, seat |
| complaint | complain, problem, bad, wrong, refund |
| unknown | (no match) |

---

## Session Persistence

WhatsApp session is saved to `./data/session/` using `whatsapp-web.js` `LocalAuth` strategy. On restart, the saved session is reloaded — no QR scan needed.

---

## Phase 2 Upgrade Path

- Replace regex intent classifier with LLM call (Claude API)
- Add RAG knowledge base for Bakudan menu/FAQ
- Human escalation queue with Telegram reply-back
- Multi-account support
- Integration with `dashboard.bakudanramen.com`
