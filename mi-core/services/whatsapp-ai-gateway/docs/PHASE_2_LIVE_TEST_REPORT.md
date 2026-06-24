# PHASE 2.5 LIVE TEST REPORT — WhatsApp AI Gateway

**Date:** 2026-06-03  
**Version:** 2.0.0  
**Phase:** 2.5 — Live Device Validation  
**Tester:** [Fill in when running live test]  
**Device:** [Fill in — laptop model]  
**WhatsApp test account:** [Fill in — second phone number]  
**WhatsApp Web scanned on:** [Fill in — browser/app]

---

## Pre-flight Checklist

Before starting, confirm:

- [ ] `.env` created from `.env.example` with valid values
- [ ] `TELEGRAM_BOT_TOKEN` set and bot added to test group
- [ ] `TELEGRAM_CHAT_ID` set (the test group's chat ID)
- [ ] `node -v` shows ≥ 18.0.0
- [ ] `npm install` completed without errors
- [ ] `npm test` → 64/64 PASSED
- [ ] Second phone available to send test WhatsApp messages
- [ ] Laptop connected to internet (WiFi or LAN)

---

## Test Execution

### Step 1 — Start App

```bash
npm start
```

Expected output:
```
[INFO] Database ready
[INFO] AI control loaded
[INFO] Dashboard running at http://localhost:3210
[INFO] QR code generated — scan with WhatsApp
```

- [ ] App starts without errors
- [ ] QR appears in terminal
- [ ] Dashboard opens at http://localhost:3210
- [ ] QR visible on dashboard

**Screenshot:** `screenshots/01-qr-dashboard.png`

---

### Step 2 — WhatsApp QR Scan

1. On main phone: WhatsApp → ⋮ → Linked Devices → Link a Device
2. Scan QR from terminal or dashboard

Expected:
```
[INFO] WhatsApp authenticated
[INFO] WhatsApp client READY
```
Dashboard status changes to `READY` (green).

- [ ] QR scanned successfully
- [ ] Status = READY on dashboard
- [ ] Telegram group receives: `✅ WhatsApp bot is ONLINE`

**Screenshot:** `screenshots/02-connected-dashboard.png`  
**Time to connect:** _____ seconds

---

### Step 3 — Session Persistence Test

```bash
# Stop app with Ctrl+C, then restart
npm start
```

- [ ] App restarts WITHOUT showing QR
- [ ] Status returns to `READY` within 30 seconds
- [ ] No manual scan required
- [ ] Reconnect works after app restart

**Time to reconnect:** _____ seconds

---

### Step 4 — Real Message Matrix (send from second phone)

For each test, record: message sent, bot reply, Telegram received, dashboard updated.

---

#### T1 — Greeting: "Hello"

**Send:** `Hello`

| Check | Expected | Actual | Pass? |
|---|---|---|---|
| Bot replies | "Hello! 👋 Welcome to Bakudan Ramen..." | | |
| Telegram receives | Message forwarded with intent=greeting | | |
| Dashboard shows | Thread for test phone, intent=greeting | | |
| Handled by | 🤖 AI | | |

---

#### T2 — Store Hours: "What time does Stone Oak open?"

**Send:** `What time does Stone Oak open?`

| Check | Expected | Actual | Pass? |
|---|---|---|---|
| Bot replies | Stone Oak name + hours | | |
| Intent | hours | | |
| Store detected | stone-oak | | |
| No escalation | Not flagged | | |

---

#### T3 — Address Lookup: "Where is Bandera?"

**Send:** `Where is Bandera?`

| Check | Expected | Actual | Pass? |
|---|---|---|---|
| Bot replies | Bandera address + phone + Maps link | | |
| Intent | address | | |

---

#### T4 — FAQ: "Do you have vegan options?"

**Send:** `Do you have vegan options?`

| Check | Expected | Actual | Pass? |
|---|---|---|---|
| Bot replies | FAQ vegan answer | | |
| Not escalated | AI handles it | | |

---

#### T5 — Escalation: "I want a refund"

**Send:** `I want a refund`

| Check | Expected | Actual | Pass? |
|---|---|---|---|
| Bot sends holding message | "Our team will get back to you..." | | |
| Telegram receives | ⚠️ HUMAN REQUIRED tag | | |
| Dashboard shows | ⚠ Escalate badge | | |
| Handled by | 👤 Human (not AI) | | |

---

#### T6 — Escalation: "I need manager"

**Send:** `I need manager`

| Check | Expected | Actual | Pass? |
|---|---|---|---|
| Bot sends holding message | | | |
| Telegram escalation flag | ⚠️ Urgent keyword detected | | |

---

#### T7 — Unknown: "Random unclear message"

**Send:** `xyzabc123randomstuff`

| Check | Expected | Actual | Pass? |
|---|---|---|---|
| Bot does NOT give wrong answer | Holding message sent | | |
| Escalated to Telegram | Yes (low confidence) | | |
| NOT hallucinated | ai_replied=false in DB | | |

---

#### T8 — Soft Rate Limit: Send 11 messages within 5 minutes

**Action:** Send 11 messages rapidly from test phone (within 5 mins)

| Check | Expected | Actual | Pass? |
|---|---|---|---|
| First 10 messages get AI replies | Normal replies | | |
| Message 11 gets no auto-reply | Silent (soft rate-limited) | | |
| Telegram still receives msg 11 | Yes — forwarded but not auto-replied | | |

---

#### T9 — Hard Rate Limit: Send 31 messages within 5 minutes

**Action:** Send 31 messages rapidly from test phone (within 5 mins)

| Check | Expected | Actual | Pass? |
|---|---|---|---|
| Messages 11–30 soft-limited | No AI reply, Telegram still gets them | | |
| Messages 31+ hard-blocked | Silent drop — no reply, no Telegram | | |

---

#### T10 — Business Hours: Message outside business hours

**Action:** Set `BUSINESS_HOURS_ENABLED=true`, modify schedule so current time is "closed", restart, send message

| Check | Expected | Actual | Pass? |
|---|---|---|---|
| Bot sends closed message | "We're currently closed..." | | |
| ai_replied = false in DB | Yes | | |

---

#### T11 — AI Pause: Message while AI paused

**Action:** Dashboard → Safety Controls → ⏸ Pause AI → send message from second phone

| Check | Expected | Actual | Pass? |
|---|---|---|---|
| Red alert bar appears on dashboard | "AI is globally PAUSED" | | |
| No reply sent to WhatsApp | Silence | | |
| Telegram still receives message | Yes (forwarding unaffected) | | |
| Click Resume → AI active again | Status back to ACTIVE | | |

**Screenshot:** `screenshots/03-ai-paused.png`

---

#### T12 — Human Takeover: Message after human takeover

**Action:** Safety Controls → Enter test phone → Click "Takeover" → send message from that phone

| Check | Expected | Actual | Pass? |
|---|---|---|---|
| Takeover badge appears in thread | 👤 Takeover | | |
| No auto-reply while takeover active | Silence | | |
| Click Release → AI resumes | Normal AI reply on next message | | |

---

#### T13 — Blocklist: Message from blocked phone

**Action:** Safety Controls → Enter test phone → Click "Block" → send message from that phone

| Check | Expected | Actual | Pass? |
|---|---|---|---|
| Complete silence | No reply, no Telegram forward | | |
| Dashboard does NOT log | Message silently dropped | | |
| Unblock → send → normal behavior | AI replies again | | |

---

### Step 5 — Dashboard Validation

Open `http://localhost:3210` and verify each element:

| Element | Expected | Verified? |
|---|---|---|
| WhatsApp status | READY (green) | |
| Telegram status | CONNECTED or DISABLED | |
| AI Engine status | ACTIVE (purple) | |
| Business Hours | OPEN/CLOSED correct | |
| Messages Today | Correct count | |
| Last Message | Shows latest customer | |
| By Customer tab | All test threads visible | |
| Message Log tab | Raw messages in correct order | |
| Safety Controls tab | Pause/Takeover/Blocklist UI | |
| Escalation badge | ⚠ shown for T5/T6/T7 threads | |

**Screenshot:** `screenshots/dashboard-status.png`

---

## Verify Expected Behavior Summary

| Behavior | Pass? |
|---|---|
| Normal FAQ/store/menu messages reply correctly (T1–T4) | |
| Complaint/refund/manager escalate to Telegram (T5–T6) | |
| Unclear message does NOT hallucinate (T7) | |
| Soft rate limit forwards Telegram but no auto-reply (T8) | |
| Hard rate limit silent drops (T9) | |
| AI Pause stops auto replies, Telegram still receives (T11) | |
| Human Takeover stops AI only for that customer (T12) | |
| Blocklist silent drops completely (T13) | |
| Business hours sends closed message if enabled (T10) | |

---

## Evidence Required

| Evidence | Location | Collected? |
|---|---|---|
| Dashboard status screenshot | `screenshots/dashboard-status.png` | ☐ |
| Conversation thread screenshot | `screenshots/conversation-thread.png` | ☐ |
| Telegram escalation screenshot | `screenshots/telegram-escalation.png` | ☐ |
| Rate limit evidence | `screenshots/rate-limit.png` | ☐ |
| Log sample | `logs/YYYY-MM-DD/` | ☐ |
| Demo video (optional) | `screenshots/demo.mp4` | ☐ |

---

## Log Sample

After tests, copy a sample from `logs/YYYY-MM-DD/whatsapp.log`:

```
[paste 5-10 lines here]
```

---

## Results Summary

| Test | Result | Notes |
|---|---|---|
| T1 Greeting | PASS / FAIL | |
| T2 Stone Oak hours | PASS / FAIL | |
| T3 Bandera address | PASS / FAIL | |
| T4 FAQ vegan | PASS / FAIL | |
| T5 Refund escalation | PASS / FAIL | |
| T6 Manager escalation | PASS / FAIL | |
| T7 Unknown message | PASS / FAIL | |
| T8 Soft rate limit (11 msgs) | PASS / FAIL | |
| T9 Hard rate limit (31 msgs) | PASS / FAIL | |
| T10 Business hours | PASS / FAIL | |
| T11 AI Pause | PASS / FAIL | |
| T12 Human Takeover | PASS / FAIL | |
| T13 Blocklist | PASS / FAIL | |

**Unit tests:** 64/64  
**Live tests:** ___/13  
**Overall:** PASS / FAIL

---

## Issues Found

| # | Issue | Severity | Fix |
|---|---|---|---|
| 1 | | | |

---

## Phase 2.5 Decision

- [ ] **PASS** → Proceed to Phase 3: Bakudan Internal Pilot
- [ ] **FAIL** → List blockers above, fix and re-test

**Signed off by CEO:** _______________  
**Date:** _______________
