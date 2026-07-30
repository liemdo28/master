# CTO HOLD — 72-HOUR RECOVERY PLAN

> Issued: 2026-06-24 21:54 Asia/Saigon
> Freeze: All AI development, agent development, architecture work
> Duration: 72 hours (2026-06-24 → 2026-06-27)

---

## Mission

Make the CEO dashboard show live data for:

- Traffic
- Orders
- Revenue
- Profit
- Calls
- Directions

Nothing else matters for 72 hours.

---

## Priority 1: QuickBooks Recovery (30 min, Dev1)

**What:** Restart heartbeat so revenue/labor/food cost data refreshes.

**How:**
```powershell
# On Laptop1 (Stockton)
cd E:\Project\Master\qb-ops-agent
npm install
npm run dev
```
OR:
```bash
pm2 restart qb-ops-agent
```

**Verify:**
- Watch logs for "Workflow cycle complete" message
- Check `mi-core/services/accounting-engine/ledgers/accounting.db` updates
- Confirm `last_successful_sync` timestamp is current (not 6 days old)

**Unblocks on CEO dashboard:**
- Revenue ($)
- Profit (P&L trend)
- Labor Cost %
- Food Cost %

---

## Priority 2: GA4 Deployment (45 min total)

**Step 2a — CEO creates property (15 min):**
1. Go to https://analytics.google.com
2. Admin → Create Property → "Bakudan Ramen"
3. Web data stream → enter bakudanramen.com
4. Copy Measurement ID: `G-XXXXXXXXXX`
5. Share the ID with Mi

**Step 2b — Mi deploys tracking (30 min):**
1. Create gtag snippet with CEO's Measurement ID
2. Insert into all 29 Bakudan pages
3. Configure conversion events: `order_click`, `call_click`, `directions_click`
4. Verify in GA4 Realtime view

**Verify:**
- Open bakudanramen.com → check GA4 Realtime shows active users
- Check conversion events firing

**Unblocks on CEO dashboard:**
- Traffic (sessions, real-time users)
- Conversion rate
- Bounce rate

---

## Priority 3: GBP API Activation (1 hour total)

**Step 3a — CEO creates service account (35 min):**
1. Google Cloud Console → Create project "Bakudan GBP"
2. Enable "Business Profile API"
3. IAM → Service Accounts → Create → download JSON key
4. Share GBP Business Profile with service account email
5. Provide JSON file to Mi

**Step 3b — Mi wires GBP connector (25 min):**
1. Add service account credentials to config/google.php
2. Add OAuth scope: `https://www.googleapis.com/auth/businessmanagement`
3. Query GBP Insights API for 3 locations
4. Wire calls, directions, website clicks to dashboard widgets

**Verify:**
- Confirm 3 locations returning data (calls, directions, clicks)
- Check dashboard shows GBP widgets with numbers

**Unblocks on CEO dashboard:**
- Phone Calls
- Directions Requests
- Website Clicks from GBP

---

## Priority 4: DoorDash Runtime Recovery (30 min total)

**Step 4a — CEO verifies credentials (15 min):**
1. Log into https://identity.doordash.com/auth/user/login
2. Verify bakudanramen210@gmail.com / Rawsushi123 still works
3. If not — reset and update .env
4. Confirm 2FA accessible (Gmail OTP)

**Step 4b — Dev1 restarts agent (15 min):**
```bash
cd mi-core/services/doordash-agent
node src/index.js
```

**Verify:**
- Check /health endpoint returns status: "ok"
- Wait for scrape cycle (~60s) — check data/latest-metrics.json
- All 4 accounts should show stores (not LOGIN_FAILED)

**Unblocks on CEO dashboard:**
- DoorDash Orders
- DoorDash Revenue
- Delivery Channel Share

---

## Timeline

| Hour | Task | Owner | Dashboard KPI |
|------|------|-------|---------------|
| 0:00 | Restart QB agent | Dev1 | +Revenue, +Profit, +Labor, +FoodCost |
| 0:30 | CEO creates GA4 property | CEO | +Traffic, +Sessions |
| 1:00 | Mi deploys GA4 to 152 pages | Mi | +Conversions, +Bounce Rate |
| 1:30 | CEO creates GBP service account | CEO | +Calls, +Directions |
| 2:05 | Mi wires GBP to dashboard | Mi | +Dashboard GBP widgets |
| 2:30 | CEO verifies DoorDash credentials | CEO | +Delivery Orders |
| 2:45 | Dev1 restarts DoorDash agent | Dev1 | +Delivery Revenue |

**Total: ~3 hours to full live dashboard**

---

## Success Condition

CEO opens dashboard and sees:

| KPI | Source | Status |
|-----|--------|--------|
| Traffic | GSC + GA4 | LIVE |
| Orders | DoorDash + Toast | LIVE (DD) |
| Revenue | QuickBooks | LIVE |
| Profit | QuickBooks | LIVE |
| Calls | GBP | LIVE |
| Directions | GBP | LIVE |

**All 6 showing real, current data = REVENUE_ACTIVATION_OPERATIONAL**

---

## What NOT to Do (72-Hour Freeze)

- No new AI agents
- No new architecture
- No new features
- No new integrations
- No Phase 34
- No new markdown files about capabilities

**Only do:** Restart, deploy, activate, verify.
