# INTERNAL PILOT PLAN — WhatsApp AI Gateway

**Project:** WhatsApp AI Gateway  
**Phase:** 3 — Internal Pilot (Bakudan)  
**Start Date:** _______________  
**End Date:** _______________  
**Duration:** 7 days  
**Approved by:** _______________  

---

## Pilot Objectives

1. Test real WhatsApp ↔ AI Gateway flow with internal team
2. Validate safety guards in production-like environment
3. Identify gaps before customer-facing launch
4. Train staff on AI Pause, Human Takeover, and escalation responses
5. Collect feedback for Phase 3 improvements

---

## Pilot Guardrails — NON-NEGOTIABLE

### Account Isolation

| Rule | Description | Enforced |
|---|---|---|
| WhatsApp number | TEST-ONLY number assigned for pilot | ☐ |
| Telegram group | TEST-ONLY group with pilot team only | ☐ |
| No production data | Do NOT connect to real Bakudan WhatsApp | ☐ |

### Authorized Testers

Only these people may message the AI during the pilot:

| Name | Role | Phone Number |
|---|---|---|
| CEO | Pilot lead | _______________ |
| Manager | Escalation handler | _______________ |
| Maria | Staff tester | _______________ |

> **Rule:** No other WhatsApp numbers may message the bot during the pilot.

### Safety Controls — Must Be Active

| Control | Must Remain Visible | Tested Daily |
|---|---|---|
| AI Pause button (⏸) | Dashboard Safety tab | ☐ |
| Human Takeover | Dashboard Safety tab | ☐ |
| Blocklist | Dashboard Safety tab | ☐ |
| Rate limiter | Active (10 msg/5min soft, 30 msg/5min hard) | ☐ |

---

## Daily Operations Checklist

### Each Morning

- [ ] Verify app is running (`npm start`)
- [ ] Confirm dashboard at http://localhost:3210
- [ ] Confirm WhatsApp status = READY
- [ ] Confirm AI Engine = ACTIVE
- [ ] Click Test AI Pause → verify no reply → click Resume

### Each Evening

- [ ] Review `logs/YYYY-MM-DD/whatsapp.log` for anomalies
- [ ] Check dashboard message count
- [ ] Confirm no unexpected escalations
- [ ] No unattended AI responses overnight

---

## Pilot Flow

```
WhatsApp → AI Gateway → Safety Guards
                              ↓
           ┌──────────────────┼──────────────────┐
           ↓                  ↓                  ↓
        🤖 AI Reply    👤 Hold + Telegram    🚫 Drop
     (normal FAQ,        (complaint, refund,   (blocklist,
      hours, address)     manager, unknown)     rate limit)
```

### What AI Handles During Pilot
- Greeting messages
- "What time do you open?"
- "Where is [Bandera|Stone Oak|Medical Center]?"
- "Do you have vegan options?"
- "What food do you serve?"
- "How do I earn loyalty points?"
- "Do you sell gift cards?"
- "Do you do delivery?"

### What Escalates to Telegram
- "I want a refund"
- "I need the manager"
- "I have a complaint"
- "I am very angry"
- Any unclear/unexpected message

### What Is Silently Dropped
- Blocked phone numbers
- Messages 31+ from same phone within 5 minutes
- Messages while AI is paused

---

## Escalation Response Protocol

When Telegram receives a flagged message:

1. Staff member reads Telegram alert
2. Responds to customer via Telegram bot OR WhatsApp directly
3. Marks as handled in Telegram group
4. If repeated issue → add to blocklist or use Human Takeover

---

## Known Limitations (Phase 2)

These will be fixed in Phase 3:

| # | Limitation | Impact |
|---|---|---|
| 1 | AI is regex-based, not LLM | Limited to FAQ patterns |
| 2 | No Telegram → WhatsApp reply bridge | Staff must reply from their own phone |
| 3 | No HTTPS | Dashboard only accessible on local network |
| 4 | No user authentication | Anyone with network access sees dashboard |

---

## Success Criteria

Pilot is successful if:

- [ ] 0 hallucinated responses (AI did not make up answers)
- [ ] 100% of escalations reached Telegram
- [ ] 100% of normal messages got AI replies
- [ ] 100% of blocked/rate-limited messages were silent
- [ ] AI Pause tested and working daily
- [ ] Human Takeover tested and working daily
- [ ] No unexpected WhatsApp messages from bot
- [ ] Logs reviewed daily with no anomalies
- [ ] All authorized testers able to complete test conversations

---

## Pilot Log

| Date | Tester | Tests Run | Issues | Resolved |
|---|---|---|---|---|
| | | | | |
| | | | | |
| | | | | |
| | | | | |
| | | | | |
| | | | | |
| | | | | |

---

## Post-Pilot Review

**Date:** _______________

| Question | Answer |
|---|---|
| All success criteria met? | Yes / No |
| Any safety guard failures? | |
| Staff comfortable with dashboard? | |
| Recommended improvements for Phase 3? | |
| Ready for customer-facing pilot? | |

**Phase 3 sign-off:** _______________  
**Date:** _______________

---

## Phase 3 Scope (after internal pilot)

1. Replace regex AI with Claude API (real LLM responses)
2. Telegram → WhatsApp reply bridge (staff can reply from Telegram)
3. Connect to `dashboard.bakudanramen.com`
4. HTTPS + basic auth on admin panel
5. Onboard first real Bakudan staff as pilot testers
6. Expand authorized phone list
