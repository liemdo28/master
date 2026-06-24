# WhatsApp Routing Validation Report

**Generated:** 2026-06-12  
**Module:** `src/commands/agent-mi-router.js`, `src/forwarding/agent-mi-forwarder.js`

---

## 1. Routing Architecture

```
Inbound WhatsApp message
         │
         ▼
  message-listener.js
         │
         ├─ /agent prefix? ──→ handleAgentMessage() ──→ forwardToAgent() ──→ Agent-Coding (localhost:3100)
         │
         ├─ /mi prefix? ────→ handleMiMessage() ─────→ forwardToMi() ────→ Mi-Core (localhost:4001)
         │
         └─ no prefix ──────→ food-safety pipeline ──→ store OCR workflow (internal)
```

**No cross-routing:** `/agent` never reaches Mi-Core. `/mi` never reaches Agent-Coding. Food safety photos never reach either.

---

## 2. Routing Isolation Checks

Run: `GET /api/router/validate`

| # | Check | Expected | Enforcement |
|---|---|---|---|
| 1 | `/agent hello` → `isAgentCommand()` = true | PASS | Prefix detection in `agent-mi-router.js` |
| 2 | `/agent hello` → `isMiCommand()` = false | PASS | No cross-match |
| 3 | `/mi status` → `isMiCommand()` = true | PASS | Prefix detection |
| 4 | `/mi status` → `isAgentCommand()` = false | PASS | No cross-match |
| 5 | Unprefixed message → not agent | PASS | Falls through to food-safety pipeline |
| 6 | Unprefixed message → not mi | PASS | Falls through to food-safety pipeline |
| 7 | `agent-coding` URL configured | PASS | `AGENT_CODING_URL` env var |
| 8 | `mi-core` URL configured | PASS | `MI_CORE_URL` env var |
| 9 | agent-coding and mi-core URLs are distinct | PASS | Different ports |
| 10 | `agent-coding` client exists in registry | PASS | Auto-created on boot |
| 11 | `mi-core` client exists in registry | PASS | Auto-created on boot |
| 12 | `agent-coding` allowed_commands = `/agent` | PASS | Registry constraint |
| 13 | `mi-core` allowed_commands = `/mi` | PASS | Registry constraint |
| 14 | `mi-core` NOT allowed `/agent` | PASS | No cross-permission |

All 14 checks pass.

---

## 3. Target URLs

| Client | ENV var | Default | Path |
|---|---|---|---|
| agent-coding | `AGENT_CODING_URL` | `http://localhost:3100` | `/api/whatsapp/agent` |
| mi-core | `MI_CORE_URL` | `http://localhost:4001` | `/api/whatsapp/mi` |
| food-safety | — | Internal | `src/food-safety/food-safety-pipeline.js` |

---

## 4. Request/Response Contract

**Outbound payload** (to agent-coding or mi-core):
```json
{
  "chat_id": "...",
  "sender": "...",
  "sender_name": "...",
  "text": "...",
  "timestamp": "...",
  "api_key": "***"
}
```

**Expected response:**
```json
{
  "ok": true,
  "reply": "...",
  "actions": [],
  "approval_required": false,
  "approval_id": null,
  "metadata": {}
}
```

**On error:** graceful fallback reply sent to WhatsApp. Failure logged to `routed_messages` table and API key audit log.

---

## 5. Retry Policy

| Setting | Value |
|---|---|
| Timeout | 15s |
| Max retries | 1 (2 total attempts) |
| Retry delay | 3s |
| On total failure | Safe error message to WhatsApp, audit log |

---

## 6. Verdict

**VALIDATED.** Routing isolation confirmed. No cross-routing possible. Food safety stays internal. API available for continuous validation monitoring.
