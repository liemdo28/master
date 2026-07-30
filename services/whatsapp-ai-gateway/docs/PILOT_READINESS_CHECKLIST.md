# PILOT READINESS CHECKLIST — WhatsApp AI Gateway

**Project:** whatsapp-ai-gateway  
**Version:** 2.0.0  
**Target:** Bakudan Internal Pilot (pre-Phase 3)  
**Verified by:** _______________  
**Date:** _______________

---

## A — Packaging & Security

| # | Check | How to Verify | Status |
|---|---|---|---|
| A1 | Secure packaging verified using `./pack.sh` ONLY | Run `./pack.sh` (or `pack.ps1` on Windows) | ☐ |
| A2 | `.env` NOT included in zip | `unzip -l *.zip \| grep ".env$"` → 0 results | ☐ |
| A3 | `data/session/` NOT included in zip | `unzip -l *.zip \| grep "session/"` → 0 results | ☐ |
| A4 | `node_modules/` NOT included in zip | `unzip -l *.zip \| grep "node_modules"` → 0 results | ☐ |
| A5 | `.env.example` IS included (reference template) | `unzip -l *.zip \| grep ".env.example"` → 1 result | ☐ |
| A6 | `npm install` restores all dependencies cleanly | Delete node_modules, run `npm install`, no errors | ☐ |

**Verify all A checks:**
```bash
./pack.sh
unzip -l whatsapp-ai-gateway-v*.zip | grep -E "\.env$|session/|node_modules"
# Expected: 0 results
```

---

## B — WhatsApp Account

| # | Check | Status |
|---|---|---|
| B1 | WhatsApp account is TEST-ONLY, NOT a real business number | ☐ |
| B2 | QR scan works from dashboard at http://localhost:3210 | ☐ |
| B3 | Session persists after `npm start` restart (no re-scan) | ☐ |
| B4 | Auto-reconnect works after app restart | ☐ |
| B5 | WhatsApp status = `READY` visible on dashboard | ☐ |

---

## C — Telegram Alerts

| # | Check | Status |
|---|---|---|
| C1 | Telegram group is TEST-ONLY, NOT production channel | ☐ |
| C2 | Bot token configured in `.env` | ☐ |
| C3 | `TELEGRAM_CHAT_ID` set to correct test group ID | ☐ |
| C4 | Every incoming WhatsApp message appears in Telegram | ☐ |
| C5 | Escalation messages show `⚠️ HUMAN REQUIRED` tag | ☐ |
| C6 | Confidence % visible in Telegram forward | ☐ |

---

## D — AI Safety Controls

| # | Control | How to Verify | Status |
|---|---|---|---|
| D1 | AI Pause button works | Click ⏸ on dashboard → send message → no reply | ☐ |
| D2 | AI Resume button works | Click ▶ → send message → gets reply | ☐ |
| D3 | Human Takeover works for specific phone | Enter phone → send from that number → no reply | ☐ |
| D4 | Release Takeover works | Click Release → send again → gets reply | ☐ |
| D5 | Blocklist blocks specific phone | Block number → send → complete silence, no Telegram | ☐ |
| D6 | Unblock restores normal behavior | Unblock → send → normal reply | ☐ |
| D7 | Rate limit (soft) stops reply at msg 11+ | Send 12 rapid messages → msg 11+ no reply, Telegram gets it | ☐ |
| D8 | Rate limit (hard) drops completely at msg 31+ | Send 32 messages → msgs 31+ silently dropped | ☐ |
| D9 | Business hours mode sends closed message | `BUSINESS_HOURS_ENABLED=true`, test outside hours | ☐ |

---

## E — Message Quality

| # | Test Message | Expected Response | Status |
|---|---|---|---|
| E1 | `Hello` | Greeting reply from AI | ☐ |
| E2 | `What time does Stone Oak open?` | Stone Oak specific hours | ☐ |
| E3 | `Where is Bandera?` | Bandera address + phone + Maps | ☐ |
| E4 | `Do you have vegan options?` | FAQ answer about vegan menu | ☐ |
| E5 | `What food do you serve?` | Menu with prices | ☐ |
| E6 | `I want a refund` | Holding message + Telegram escalation | ☐ |
| E7 | `I need manager` | Holding message + Telegram escalation | ☐ |
| E8 | `xyzabc123randomstuff` | Holding message (NOT hallucinated answer) | ☐ |
| E9 | `I want to book a table for 2` | Reservation holding message | ☐ |

---

## F — Dashboard Validation

Open `http://localhost:3210` and verify:

| # | Element | Expected | Status |
|---|---|---|---|
| F1 | WhatsApp status | `READY` (green) after scan | ☐ |
| F2 | Telegram status | `CONNECTED` if configured | ☐ |
| F3 | AI Engine | `ACTIVE` (purple) | ☐ |
| F4 | Business Hours | `OPEN` or `CLOSED` correct for current time | ☐ |
| F5 | Messages Today counter | Increments with each message | ☐ |
| F6 | Last Message | Shows name + message text | ☐ |
| F7 | By Customer tab | All test conversation threads visible | ☐ |
| F8 | Message Log tab | Raw IN/OUT messages with intent | ☐ |
| F9 | Safety Controls tab | Pause/Resume/Takeover/Blocklist UI | ☐ |
| F10 | Escalation badge | `⚠ Escalate` visible on escalated threads | ☐ |
| F11 | Dashboard auto-refreshes | Every 10 seconds | ☐ |
| F12 | Dashboard visible to CEO | http://localhost:3210 loads | ☐ |

---

## G — Logs Verification

| # | Check | Status |
|---|---|---|
| G1 | `logs/YYYY-MM-DD/whatsapp.log` exists and has entries | ☐ |
| G2 | `logs/YYYY-MM-DD/error.log` exists (may be empty) | ☐ |
| G3 | Incoming messages logged with phone + intent | ☐ |
| G4 | AI replies logged with reply preview | ☐ |
| G5 | Escalations logged with reason | ☐ |
| G6 | No crash logs in error.log | ☐ |

---

## H — Unit Test Suite

```bash
npm test
```

| # | Check | Expected | Status |
|---|---|---|---|
| H1 | All 10 test suites pass | ✅ | ☐ |
| H2 | 64/64 tests passed | 64/64 | ☐ |
| H3 | No test failures | 0 failures | ☐ |

---

## I — Simulation Validator

```bash
node tests/live/live-validator.js --no-telegram
```

| # | Check | Expected | Status |
|---|---|---|---|
| I1 | All scenarios pass | ✅ | ☐ |
| I2 | `docs/SIMULATION_REPORT.md` generated | File exists | ☐ |

---

## J — Screenshot Evidence

Run `node tests/live/screenshot-capture.js` while gateway is running.

| # | File | Status |
|---|---|---|
| J1 | `screenshots/dashboard-status.png` | ☐ |
| J2 | `screenshots/conversation-thread.png` | ☐ |
| J3 | `screenshots/telegram-escalation.png` | ☐ |
| J4 | `screenshots/rate-limit.png` | ☐ |
| J5 | Log sample from `logs/YYYY-MM-DD/` | ☐ |

---

## K — Session Recovery

| # | Check | Status |
|---|---|---|
| K1 | Stop app (Ctrl+C), restart → no QR needed | ☐ |
| K2 | Kill process, restart → reconnects within 30s | ☐ |
| K3 | Session data persisted in `.wwebjs_auth/` | ☐ |

---

## Final Decision

### Scoring

| Section | Items | Passed | % |
|---|---|---|---|
| A Packaging & Security | 6 | ___ | ___ |
| B WhatsApp Account | 5 | ___ | ___ |
| C Telegram Alerts | 6 | ___ | ___ |
| D Safety Controls | 9 | ___ | ___ |
| E Message Quality | 9 | ___ | ___ |
| F Dashboard | 12 | ___ | ___ |
| G Logs | 6 | ___ | ___ |
| H Unit Tests | 3 | ___ | ___ |
| I Simulation | 2 | ___ | ___ |
| J Screenshots | 5 | ___ | ___ |
| K Session Recovery | 3 | ___ | ___ |
| **Total** | **66** | **___** | **___** |

### Minimum to proceed to Phase 3

- **A**: All 6 must pass (security is NON-NEGOTIABLE)
- **B**: All 5 must pass (WhatsApp session required for pilot)
- **D**: D1–D5 must pass (AI controls required)
- **E**: E1–E8 must pass (core message quality)
- **H**: 64/64 unit tests
- **I**: Simulation validator all pass
- **K**: All 3 must pass (session recovery tested)

### CEO Verification Points

The following are directly visible to CEO during live demo:

- [ ] Dashboard loads at http://localhost:3210
- [ ] WhatsApp message → AI reply visible in real-time
- [ ] Telegram group receives all messages
- [ ] Pause button immediately stops AI
- [ ] Human takeover works per-customer
- [ ] Blocklist completely silences a number
- [ ] Rate limit protects against spam

### Verdict

- [ ] **PASS** — All minimums met → Approved for Phase 3: Bakudan Internal Pilot
- [ ] **CONDITIONAL** — Minor issues, proceed with documented exceptions
- [ ] **FAIL** — Blockers present, list below

**Blockers (if any):**
1. 
2. 

**Signed off by CEO:** _______________  
**Date:** _______________

---

## Phase 3 Scope (after this checklist passes)

1. Replace regex AI with Claude API (real LLM responses)
2. Telegram → WhatsApp reply bridge (close the human escalation loop)
3. Connect to `dashboard.bakudanramen.com`
4. HTTPS + basic auth on admin panel
5. Onboard first real Bakudan staff as pilot testers
