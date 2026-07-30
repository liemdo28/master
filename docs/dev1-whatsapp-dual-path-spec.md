# DEV1 SPEC: WhatsApp Dual-Path Architecture
> Date: 2026-06-16 | Author: Mi-Core AI (for dev1 implementation)

---

## Architecture Overview

The same WhatsApp phone number (Mi phụ) is shared across **two separate gateway processes**:

| Instance | Host | Role | Process |
|---|---|---|---|
| Admin PC gateway | Mi-Core server (port 3211) | CEO ↔ Mi-Core bridge | `whatsapp-ai-gateway` |
| Laptop1 gateway | Laptop1 | Store team chatbot | `whatsapp-ai-gateway` (dev1 instance) |

Both share the same WhatsApp session (one phone). WhatsApp web multi-device handles delivery — each device independently processes messages based on its env config.

---

## PATH 1 — Admin PC Gateway (MI-CORE)

### Current State: ✅ CONFIRMED CORRECT — NO CHANGES NEEDED

**File**: `whatsapp-ai-gateway/src/whatsapp/message-listener.js`

### Routing Logic (verified):

```
Any message received
  │
  ├─ isGroup? AND (food safety image OR broth command session)
  │    → food safety / broth workflow → replyService.send()
  │
  ├─ isCeoSender(phone)?
  │    ├─ /agent command → agentMiRouter.handleAgentMessage() → forwardToAgent()
  │    ├─ /mi command → agentMiRouter.handleMiMessage() → forwardToMi() → mi-core
  │    └─ no-prefix text → isAdmin check → handleMiMessage() → mi-core
  │
  ├─ non-CEO /agent command → forwardToAgent() [allowed for all]
  ├─ non-CEO /mi command → BLOCKED (logged: mi_blocked_non_ceo)
  ├─ non-CEO no-prefix group → silent drop (returns, no reply)
  └─ non-CEO no-prefix direct → silent drop (LAPTOP1_TEAM_ONLY_MODE=false guards this)
```

### Key env vars (Admin PC `.env`):
```
LAPTOP1_TEAM_ONLY_MODE=false
MI_CEO_WHATSAPP_IDS=+84931773657,84931773657@c.us,172425924882645@lid,84584902302@c.us
FOOD_SAFETY_REPLY_MODE=warning_only
```

### Security rules (MUST remain):
- No secret reaches CEO chat / WhatsApp / LLM context
- `MI_CORE_API_KEY` is env-only, fail-safe 503 if missing
- `reply-service.send()` blocks "temporarily unavailable" patterns

---

## PATH 2 — Laptop1 Gateway (STORE CHATBOT)

### Scope: DEV1 IMPLEMENTS THIS

### 2.1 Current behavior (already built)

The Laptop1 gateway handles store team workflows:
- **Broth logging**: team members log broth batches via WhatsApp
- **Food safety**: image scan → pass/fail → reply with warning only (`FOOD_SAFETY_REPLY_MODE=warning_only`)
- **Confirm/warning workflows**: built and working — DO NOT BREAK

### 2.2 NEW REQUIREMENT: Silent Group Mode

**Requirement**: Chatbot must work **silently inside WhatsApp groups** — auto-record data, scan images, write to files **WITHOUT sending any WhatsApp reply messages**.

Only send replies for:
- `⚠️ Warning` (food safety failure) — same as today
- Explicit `/agent` call from any user in group

Everything else = silent processing: read → analyze → write file → log → done.

---

### 2.3 Implementation Spec

#### A. Env var to control silent mode

Add to Laptop1 `.env`:
```
GROUP_SILENT_MODE=true
```

When `GROUP_SILENT_MODE=true`:
- Group messages are processed but NO reply is sent unless it's a warning or `/agent` command
- Direct (1-on-1) chat from team members can still reply normally

#### B. Silent broth logging (group)

Current: broth command session → reply with confirmation
New (silent): when message is in a group AND `GROUP_SILENT_MODE=true`:
- Parse broth data from message (existing parser)
- Write to broth log file (existing file path)
- **Skip** `replyService.send()` confirmation message
- Log internally: `[SILENT] broth recorded: {data}`

**File to modify**: wherever `brothCommandMod` or broth session handler calls `replyService.send()` in group context.

Pattern:
```javascript
// Before
await replyService.send(client, chatId, confirmMessage);

// After (group + silent mode)
if (isGroup && process.env.GROUP_SILENT_MODE === 'true') {
  log.info('[SILENT] broth recorded — no reply sent', { chatId, data });
} else {
  await replyService.send(client, chatId, confirmMessage);
}
```

#### C. Silent form/data recording (group)

New forms already updated (as per user: "chatbot đã update form mới"). For any structured data form received in group:
- Parse and validate form fields
- Write to designated file (see section D below)
- **No reply** in silent mode
- If validation fails with data loss risk → send `⚠️` warning only

#### D. File write targets

All silent-mode writes go to flat files under Laptop1's local data directory:

```
laptop1-data/
├── broth-logs/
│   └── broth_{YYYY-MM-DD}.json      ← daily broth log (append)
├── food-safety/
│   └── scans_{YYYY-MM-DD}.json      ← food safety scan results (append)
├── forms/
│   └── {form_type}_{YYYY-MM-DD}.json ← form submissions (append)
└── audit/
    └── silent_ops_{YYYY-MM-DD}.log  ← all silent operations log
```

Each record appended as newline-delimited JSON:
```json
{"ts":"2026-06-16T08:30:00Z","chatId":"120363...@g.us","sender":"849...","data":{...}}
```

#### E. Food safety in silent mode

Current behavior: `FOOD_SAFETY_REPLY_MODE=warning_only` → only reply if warning.

**This stays the same in silent mode.**
- PASS → no reply (already the case)
- FAIL/WARNING → `replyService.send(warning)` — keep this even in silent mode

No change needed here — already silent on PASS.

#### F. `/agent` command in group (always replies)

`/agent` command works for any sender in any group → reply with agent response.
This **bypasses silent mode** — always sends reply.

```javascript
// In group message handler, BEFORE silent mode check:
if (agentMiRouter.isAgentCommand(trimmedText)) {
  // handle and reply normally — not affected by GROUP_SILENT_MODE
  return;
}
```

#### G. Admin `/agent` call from Admin PC in group

If admin (CEO phone) sends `/agent` in a group where Laptop1 chatbot is active:
- Laptop1 chatbot handles it (not mi-core, since mi-core only listens to admin direct)
- Reply goes to the group from Laptop1's agent context
- This is expected behavior

---

### 2.4 Group detection helper

```javascript
function isSilentGroup(isGroup) {
  return isGroup && process.env.GROUP_SILENT_MODE === 'true';
}
```

Use this before any `replyService.send()` call that is NOT a warning or `/agent` response.

---

### 2.5 What NOT to change (Laptop1)

| Feature | Status | Action |
|---|---|---|
| Food safety image scan | ✅ Working | Keep as-is |
| Warning replies on FAIL | ✅ Working | Keep as-is |
| Broth confirm/warning workflow | ✅ Working | Only suppress confirm in silent group |
| `/agent` command reply | ✅ Working | Keep as-is, bypass silent |
| Direct chat replies | ✅ Working | Keep as-is (silent mode = groups only) |
| TRIGGER_SYNC polling from commands table | 🔲 Not built | See QB spec below |

---

## PATH 2B — QB TRIGGER_SYNC Polling (Laptop1 / qb-ops-agent)

### Current state: `qb-ops-agent/src/index.ts` sends heartbeats only

### Required addition: Poll commands table for TRIGGER_SYNC

```typescript
// Poll interval: every 60s (same as heartbeat)
const COMMAND_POLL_INTERVAL_MS = 60_000;

async function pollCommands(): Promise<void> {
  const db = getDb(); // same qb-agent.db
  const pending = db.prepare(`
    SELECT * FROM commands
    WHERE machine_id = 'qb-laptop-01'
      AND status = 'pending'
      AND command_type = 'TRIGGER_SYNC'
    ORDER BY created_at ASC
    LIMIT 5
  `).all() as QbCommand[];

  for (const cmd of pending) {
    try {
      await executeSyncCommand(cmd);
      db.prepare(`UPDATE commands SET status='done', updated_at=? WHERE command_id=?`)
        .run(new Date().toISOString(), cmd.command_id);
    } catch (e: any) {
      db.prepare(`UPDATE commands SET status='error', updated_at=?, error_message=? WHERE command_id=?`)
        .run(new Date().toISOString(), e.message, cmd.command_id);
    }
  }
}

async function executeSyncCommand(cmd: QbCommand): Promise<void> {
  // Trigger QB Web Connector sync
  // Method: call QB sync API or run QB sync script
  // Log result to heartbeats or a sync_log table
  console.log(`[QB-SYNC] Executing TRIGGER_SYNC: ${cmd.command_id}`);
  // ... QB sync implementation here
}
```

**Schema already exists** in `qb-agent.db`:
```sql
commands (command_id, machine_id, command_type, payload_json, status, created_at)
```

**Status flow**: `pending` → `done` or `error`

---

## Security Reminders for Dev1

1. **No secrets in WhatsApp replies** — never echo API keys, passwords, tokens
2. **No secrets in LLM context** — if using LLM for parsing, strip PII/creds before sending
3. **File writes are local only** — do not POST file content to external APIs without user approval
4. **Group messages are not authenticated** — any group member can send. Validate form structure, do not execute system commands from group input

---

## Summary Checklist for Dev1

### Path 1 (Admin PC): No changes needed ✅
- CEO routing: confirmed correct
- Non-CEO silence: confirmed correct
- `/agent` passthrough: confirmed correct

### Path 2 (Laptop1):
- [ ] Add `GROUP_SILENT_MODE=true` to Laptop1 `.env`
- [ ] Add `isSilentGroup()` helper
- [ ] Wrap broth confirmation sends with silent mode check
- [ ] Wrap form submission confirms with silent mode check
- [ ] Keep food safety warnings (not silenced)
- [ ] Keep `/agent` replies (not silenced)
- [ ] Set up file write targets under `laptop1-data/`
- [ ] Add audit log for all silent ops

### Path 2B (QB sync):
- [ ] Add command poll loop to `qb-ops-agent/src/index.ts`
- [ ] Implement `executeSyncCommand()` to trigger QB sync
- [ ] Update command status: `pending → done/error`
