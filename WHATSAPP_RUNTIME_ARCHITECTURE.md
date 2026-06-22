# WhatsApp Runtime Architecture Audit

**Date**: 2026-06-18  
**Status**: COMPLETE

---

## Architecture Overview

```
CEO iPhone (WhatsApp)
        │ incoming message via WhatsApp protocol
        ▼
┌─────────────────────────────────────────────────────────┐
│           WhatsApp AI Gateway (port 3211)                │
│  Source: services/whatsapp-ai-gateway/                   │
│                                                         │
│  ┌─────────────────┐   ┌────────────────────────────┐  │
│  │ session-manager │   │   message-listener.js      │  │
│  │ (whatsapp-web.js│──▶│ - classify intent          │  │
│  │  + Puppeteer    │   │ - route /mi → Mi-Core      │  │
│  │  + LocalAuth)   │   │ - route /agent → Agent     │  │
│  └─────────────────┘   │ - food safety pipeline     │  │
│                         └────────────────────────────┘  │
│           │                                             │
│           ▼                                             │
│  ┌─────────────────────────────────────────────────┐    │
│  │ agent-mi-forwarder.js                           │    │
│  │ HTTP POST → http://localhost:4001/api/whatsapp/mi│    │
│  │ Timeout: 15s | Retries: 0 (for mi-core)        │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
        │ HTTP response with { ok, reply }
        ▼
┌─────────────────────────────────────────────────────────┐
│               Mi-Core Server (port 4001)                │
│  Source: server/src/routes/whatsapp.ts                   │
│                                                         │
│  Pipeline: API key → rate limit → replay protection →   │
│  normalize → execution engine → jarvis → human assist → │
│  skill registry → CEO commands → AI pipeline (Ollama)   │
│                                                         │
│  Chat queue: max 3 concurrent, 20 queued, 90s timeout   │
│  AI backend: Ollama (localhost:11434) via ai-service     │
└─────────────────────────────────────────────────────────┘
```

---

## Key Architecture Questions — Answered

| Question | Answer | Source |
|---|---|---|
| Is whatsapp-web.js used? | **YES** — `whatsapp-web.js@^1.34.7` | `package.json:21` |
| Is Puppeteer used? | **YES** — `puppeteer@^25.1.0` | `package.json:16` |
| Is Chrome required? | **YES** — Puppeteer launches Chromium | `session-manager.js:233-244` |
| Is visible browser required? | **NO** — `WHATSAPP_HEADLESS` env var supported | `session-manager.js:21` |
| Is headless supported? | **YES** — but defaults to `false` (visible) | `session-manager.js:21` |
| Where is session stored? | `data/whatsapp/auth/session-bakudan-food-safety/` | `session-manager.js:14-16` |
| What happens after reboot? | **NOTHING** — Gateway not in autostart chain | `start.bat` analysis |
| What happens after logout? | Auth failure → QR required → no auto-recovery | `session-manager.js:322-326` |

---

## Process Inventory

| Process | Port | Manager | Autostart | Status |
|---|---|---|---|---|
| Mi-Core Server | 4001 | PM2 (`ecosystem.config.js`) | Via `start.bat` | **NOT RUNNING** |
| Python AI Service | 4002 | PM2 / standalone | Via `start.bat` | **NOT RUNNING** |
| Agent Engine Bridge | 4003 | PM2 / standalone | Via `start.bat` | **NOT RUNNING** |
| WhatsApp AI Gateway | 3211 | **NONE** | **NOT CONFIGURED** | **NOT RUNNING** |
| Mi CEO Observer | 3212 | PM2 (`ecosystem.config.js`) | **NOT CONFIGURED** | **NOT RUNNING** |
| Ollama | 11434 | System service | Via `Ollama.lnk` in Startup | Unknown |
| Node Agent | 4004 | PM2 (`ecosystem.config.js`) | **NOT CONFIGURED** | **NOT RUNNING** |

---

## Session Persistence Mechanism

```
whatsapp-web.js LocalAuth strategy
        │
        ▼
Stores browser session data in:
  E:\Project\Master\mi-core\services\whatsapp-ai-gateway\data\whatsapp\auth\session-bakudan-food-safety\

Files include:
  - Chrome profile data (cookies, localStorage, IndexedDB)
  - WhatsApp Web session tokens
  - Encryption keys for E2E

On restart:
  - LocalAuth reloads session from disk
  - No QR scan needed IF session is valid
  - Session can expire if phone disconnects for >14 days
```

---

## Headless Configuration

```javascript
// session-manager.js:21
const HEADLESS = String(process.env.WHATSAPP_HEADLESS || 'false').toLowerCase() !== 'false';

// Puppeteer config: session-manager.js:233-244
function getPuppeteerConfig() {
  return {
    headless: HEADLESS,  // controls visible vs headless
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  };
}
```

**Current default**: `WHATSAPP_HEADLESS=false` (browser window visible)  
**ecosystem.config.js for mi-ceo-observer**: `WHATSAPP_HEADLESS: 'true'` (headless)

---

## Auto-Recovery Mechanism

```javascript
// session-manager.js:356-373
function scheduleReconnect() {
  // Exponential backoff: 15s → 30s → 60s → 120s (cap)
  reconnectTimer = setTimeout(() => restart(), delay);
}

// Heartbeat: every 60s checks client.getState()
// If state is null/CONFLICT/UNPAIRED → scheduleReconnect()

// On disconnect event → scheduleReconnect() if AUTO_RECONNECT !== 'false'
```

---

## Critical Gaps Found

1. **WhatsApp Gateway has NO process manager** — not in PM2 ecosystem, not in start.bat
2. **Headless defaults to false** — requires visible Chrome window
3. **No Windows scheduled task** for gateway autostart
4. **PM2 startup not configured** — `pm2 save && pm2 startup` never executed
5. **ecosystem.config.js does NOT include whatsapp-ai-gateway** — only mi-core, ai-service, ceo-observer, node-agent, accounting
