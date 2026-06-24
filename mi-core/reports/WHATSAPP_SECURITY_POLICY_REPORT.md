# WhatsApp Security Policy Report
**Date:** 2026-06-15
**Phase:** 4 — Whitelist & Security
**Target:** SAFE_OPERATOR_MODE

---

## Security Architecture

### Three-Tier Action Policy

```
┌─────────────────────────────────────────────────────────────────┐
│  TIER 1: AUTO_ALLOWED — Execute without human approval          │
│                                                                 │
│  • summarize          — Summarize conversation                  │
│  • create_task        — Create workflow task                    │
│  • create_reminder    — Set reminder                            │
│  • classify_message   — Tag/categorize message                  │
│  • create_workflow    — Open work order in GStack               │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  TIER 2: APPROVAL_REQUIRED — CEO must confirm before execute    │
│                                                                 │
│  • send_whatsapp      — Send any WhatsApp message               │
│  • send_email         — Send any email                          │
│  • website_publish    — Publish to rawsushibar.com              │
│  • social_publish     — Post to social media                    │
│  • finance_response   — Reply with financial data               │
│  • send_report        — Deliver report to external party        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  TIER 3: BLOCKED — Never execute, return hard error             │
│                                                                 │
│  • delete_data        — Delete any data                         │
│  • transfer_money     — Move money anywhere                     │
│  • deploy_production  — Deploy to production systems            │
│  • change_credentials — Change API keys, passwords              │
│  • delete_messages    — Delete WhatsApp messages                │
└─────────────────────────────────────────────────────────────────┘
```

### WhatsApp Whitelist Policy

**File:** `mi-ceo-observer/data/whitelist.json`

```json
{
  "allowed_chat_ids": [],           // empty = observe all CEO conversations
  "blocked_chat_ids": [],           // explicitly excluded chats
  "priority_contacts": [],          // contacts that always trigger workflow
  "monitored_group_patterns": [     // group name patterns to always monitor
    "team", "staff", "nhan vien",
    "bakudan", "raw", "quan ly", "management"
  ]
}
```

**Logic:**
1. `blocked_chat_ids` always blocks (highest priority)
2. `allowed_chat_ids` — if non-empty, only those chats + pattern matches
3. If `allowed_chat_ids` is empty → observe ALL CEO conversations

---

## Security Mandates (Inherited from CEO OS Core)

These mandates are NEVER overridable:

| Mandate | Enforcement |
|---------|-------------|
| No secret in CEO chat | `responseScrubberMiddleware` on all routes |
| No secret in WhatsApp | Scrubber strips MI_CORE_API_KEY, passwords, tokens |
| No secret in LLM context | GStack never sends env vars to LLM |
| No approval bypass | `security_block` intent — highest priority rule |
| Finance Truth Layer | Never fabricates QB data |

### Existing Security Controls (mi-core)

| Control | Location | Status |
|---------|----------|--------|
| `security_block` intent | `intent-router.ts` — rule #1 | ✅ Active |
| Response scrubber | `response-scrubber.ts` middleware | ✅ Active |
| Rate limiting | `whatsapp-key-manager.ts` | ✅ Active |
| Replay protection | Message ID dedup | ✅ Active |
| CEO identity check | `mi-access-control.js` | ✅ Active |
| Approval engine | `approval-engine.ts` | ✅ Active |
| Audit log | `whatsapp-store.ts` | ✅ Active |

### New Security Controls (Session A)

| Control | Location | Status |
|---------|----------|--------|
| Chat whitelist | `whitelist.js` | ✅ Built |
| Action tier check | `whitelist.js → getActionTier()` | ✅ Built |
| Task dedup | `ceo-session.js → processedIds` | ✅ Built |
| Read-only enforcement | Session A NEVER calls `client.sendMessage()` | ✅ By design |
| API key for mi-core | `MI_CORE_API_KEY` in `.env` | ✅ Env-only |

---

## Duplicate Reply Prevention

**Security Rule:** Mi MUST NOT send duplicate WhatsApp replies.

Implemented via:
1. **Message ID dedup** — `processedIds` Set with 5-min TTL in `ceo-session.js`
2. **Response lock** — `responseLocks` Map in gateway `message-listener.js` (existing)
3. **Source tagging** — `source: 'ceo-observer-session-a'` in payload allows mi-core to track

---

## Certification

```
SAFE_OPERATOR_MODE

Group whitelist: ✅ (whitelist.json, configurable)
Contact whitelist: ✅ (allowed_chat_ids)
Channel whitelist: ✅ (monitored_group_patterns)
AUTO_ALLOWED tier: ✅ (summarize, task, reminder, classify, workflow)
APPROVAL_REQUIRED tier: ✅ (send WA, email, publish, finance, report)
BLOCKED tier: ✅ (delete data, transfer money, deploy, change creds)
No secret leaks: ✅ (scrubber + env-only keys)
No approval bypass: ✅ (security_block intent)
No duplicate replies: ✅ (dedup + response locks)
Read-only Session A: ✅ (never calls sendMessage)
```
