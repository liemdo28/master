# REVENUE_REGRESSION_DIAGNOSTIC.md

> Phase 30.2 — Revenue Regression Diagnostic Play
> Generated: 2026-06-24 20:59 Asia/Saigon
> Mission: Answer the CEO's question "Why is revenue down this week?" with evidence

---

## The CEO's Question

> "Why is revenue down this week?"

This document is the diagnostic play for answering that question. It is the single most important use case for revenue observability.

---

## Diagnostic Flow

```
CEO asks: "Why is revenue down this week?"
                ↓
    ┌───────────────────────┐
    │  Step 1: Quantify     │  → How much is revenue down? vs What baseline?
    └───────────┬───────────┘
                ↓
    ┌───────────────────────┐
    │  Step 2: Decompose    │  → Which location? Which channel? Which day?
    └───────────┬───────────┘
                ↓
    ┌───────────────────────┐
    │  Step 3: Trace funnel │  → GSC → GBP → GA4 → Toast → QB
    └───────────┬───────────┘
                ↓
    ┌───────────────────────┐
    │  Step 4: Identify     │  → What changed at the weakest point?
    │  root cause           │
    └───────────┬───────────┘
                ↓
    ┌───────────────────────┐
    │  Step 5: Recommend    │  → Specific action to fix
    │  action               │
    └───────────────────────┘
```

---

## Step 1: Quantify

**Question:** "How much is revenue down?"

| Data Source | Metric | Baseline (4-week avg) | This Week | Delta |
|-------------|--------|------------------------|-----------|-------|
| Toast | Weekly revenue | $XX,XXX | $X,XXX | -XX% |
| Toast | Orders | X,XXX | XXX | -XX% |
| Toast | AOV | $XX.XX | $XX.XX | -$X.XX |
| DoorDash | ROAS | X.Xx | X.Xx | -X.Xx |
| DoorDash | Spend | $X,XXX | $X,XXX | +XX% |
| GBP | Calls | XXX | XXX | -XX% |
| GSC | Clicks | XXX | XXX | +/-XX% |
| GSC | CTR | X.X% | X.X% | +/-X.X% |

**Status Today:** ❌ CANNOT QUANTIFY (no Toast/DoorDash/GBP integration)

---

## Step 2: Decompose

**Question:** "Where is the drop?"

### By Location
| Location | Revenue | Orders | Calls | Status |
|----------|---------|--------|-------|--------|
| Bandera | $X,XXX | XXX | XXX | ✅ Normal / 🔴 Drop / 🟡 Spike |
| Stone Oak | $X,XXX | XXX | XXX | ✅ Normal / 🔴 Drop / 🟡 Spike |
| The Rim | $X,XXX | XXX | XXX | ✅ Normal / 🔴 Drop / 🟡 Spike |

### By Channel
| Channel | Revenue | % of Total | Status |
|---------|---------|------------|--------|
| Direct (Toast) | $X,XXX | XX% | ✅ / 🔴 / 🟡 |
| DoorDash | $X,XXX | XX% | ✅ / 🔴 / 🟡 |
| UberEats | $X,XXX | XX% | ✅ / 🔴 / 🟡 |
| Catering | $X,XXX | XX% | ✅ / 🔴 / 🟡 |

### By Day of Week
| Day | Revenue | vs Avg | Status |
|-----|---------|--------|--------|
| Mon | $X,XXX | -XX% | 🔴 |
| Tue | $X,XXX | -XX% | 🔴 |
| Wed | $X,XXX | -XX% | 🔴 |
| Thu | $X,XXX | normal | ✅ |
| Fri | $X,XXX | normal | ✅ |
| Sat | $X,XXX | normal | ✅ |
| Sun | $X,XXX | normal | ✅ |

**Status Today:** ❌ CANNOT DECOMPOSE (no Toast data)

---

## Step 3: Trace the Funnel

For each location, trace the revenue funnel from impression to dollar.

### Funnel Stages (Top to Bottom)

```
GSC Impressions
    ↓  [GSC: clicks]
Website Clicks
    ↓  [GBP: website clicks OR GA4: sessions]
Website Sessions
    ↓  [GA4: phone click events]
Phone Calls
    ↓  [Toast: call-attributed orders]
Phone Orders
    +
Direct Online Orders
    +
DoorDash Orders
    ↓  [Toast: total revenue]
Total Revenue
    ↓  [QB: costs]
Net Profit
```

### Diagnostic Questions (Per Stage)

| Stage | Question | Healthy | Warning | Critical |
|-------|----------|---------|---------|----------|
| Impressions | Are we showing up in search? | -20% | -50% | -70% |
| CTR | Are people clicking? | 4-7% | 2-4% | <2% |
| Clicks | Are we getting traffic? | ±20% wk/wk | ±50% | ±70%+ |
| Sessions | Are sessions happening? | -10% | -30% | -50% |
| Bounce rate | Are users staying? | <60% | 60-75% | >75% |
| Phone clicks | Are users calling? | -10% | -30% | -50% |
| Calls | Are calls happening? | -10% | -30% | -50% |
| Orders | Are orders being placed? | -10% | -30% | -50% |
| Revenue | Is revenue tracking? | -10% | -20% | -30% |
| Profit | Is profit holding? | -10% | -20% | -30% |

**Status Today:** ❌ CANNOT TRACE FULL FUNNEL (5 of 9 stages blocked)

---

## Step 4: Identify Root Cause

### Common Revenue Regression Patterns (Pre-Mapped)

#### Pattern A: "Traffic Up, Revenue Down"
- **Symptoms:** GSC clicks up, but orders/revenue down
- **Likely causes:**
  - Wrong audience (irrelevant queries ranking higher)
  - Landing page issue (e.g., new CTA bar confusing users)
  - Phone system down
  - Toast ordering broken
- **Diagnostic:** Compare GSC landing pages with conversion data

#### Pattern B: "Calls Down, Revenue Down"
- **Symptoms:** GBP calls down, revenue down proportionally
- **Likely causes:**
  - GBP listing updated incorrectly (wrong hours, wrong number)
  - Competitor opening nearby
  - Local search algorithm change
  - Phone system down
- **Diagnostic:** Audit GBP listing, check hours, check phone IVR

#### Pattern C: "AOV Down, Revenue Down"
- **Symptoms:** Same orders, lower revenue
- **Likely causes:**
  - Menu price change error
  - High-value item out of stock
  - Promo code applied incorrectly
  - Customer mix shifted to lower-value items
- **Diagnostic:** Compare menu item mix week-over-week

#### Pattern D: "DoorDash ROAS Down"
- **Symptoms:** Spend up or same, orders from ads down
- **Likely causes:**
  - Ad creative fatigue
  - Competitor bidding up
  - Menu items out of stock
  - Wrong campaign targeting
- **Diagnostic:** Pause underperformers, refresh creative

#### Pattern E: "Labor Cost Up, Profit Down"
- **Symptoms:** Revenue same, profit down
- **Likely causes:**
  - Overtime spike
  - New staff training
  - Schedule over-allocation
  - Wage increase
- **Diagnostic:** Compare labor hours to revenue per hour

#### Pattern F: "Food Cost Up, Profit Down"
- **Symptoms:** Same orders, food cost up
- **Likely causes:**
  - Supplier price increase
  - Waste spike
  - Menu mix shift to high-cost items
  - Portion control issue
- **Diagnostic:** Audit supplier invoices, check waste log

**Status Today:** ❌ CANNOT IDENTIFY ROOT CAUSE (no Toast/GBP/QB data)

---

## Step 5: Recommend Action

For each root cause pattern, pre-mapped actions:

| Pattern | Immediate Action | Owner | Time |
|---------|------------------|-------|------|
| A: Traffic up, revenue down | Audit top landing pages, check Toast | Mi + Operations | 1 hour |
| B: Calls down | Audit GBP listing for 3 locations | Operations | 30 min |
| C: AOV down | Compare menu mix, check pricing | Operations + Finance | 2 hours |
| D: DoorDash ROAS down | Pause underperformers, refresh creative | Marketing | 1 hour |
| E: Labor cost up | Audit schedule, check overtime | Operations | 2 hours |
| F: Food cost up | Audit supplier invoices, check waste | Operations | 4 hours |

---

## Full Worked Example: "Revenue Down 12% This Week"

### CEO Question
"Why is revenue down 12% this week vs last week?"

### Mi's Answer (with all integrations active)

```
REVENUE DIAGNOSTIC REPORT — Week of June 17-23, 2026
═══════════════════════════════════════════════════════

HEADLINE: Revenue -12% week-over-week ($66,000 → $58,000)

DECOMPOSITION:
┌────────────────────────────────────────────────────┐
│  Bandera     -18%  🔴  $22,000 → $18,000          │
│  Stone Oak   -5%   🟡  $24,000 → $22,800          │
│  The Rim     -10%  🟡  $20,000 → $18,000          │
└────────────────────────────────────────────────────┘

CHANNEL DECOMPOSITION:
┌────────────────────────────────────────────────────┐
│  Direct       -15%  🔴  $36,000 → $30,600         │
│  DoorDash     -8%   🟡  $20,000 → $18,400         │
│  Catering     0%    ✅  $10,000 → $10,000         │
└────────────────────────────────────────────────────┘

FUNNEL ANALYSIS:
┌────────────────────────────────────────────────────┐
│  GSC Impressions:  +3%    ✅                       │
│  GSC Clicks:       +5%    ✅                       │
│  GBP Calls:        -22%   🔴  ← DROP HERE         │
│  Toast Orders:     -15%   🔴  ← DIRECT CAUSE       │
└────────────────────────────────────────────────────┘

ROOT CAUSE: GBP call volume dropped 22% week-over-week,
driving the direct order count drop. Bandera location
drove 70% of the call drop.

SECONDARY: DoorDash ROAS dropped 3.2x → 2.8x (campaign
"summer-spicy" is underperforming).

PROBABLE CAUSE: Bandera GBP listing was updated Tue Jun 18
(hours changed to "open until 9pm" but actual hours are 8:30pm).
This caused Google to suppress the listing for "open now" queries
during the 8:30-9pm window.

ACTION ITEMS:
1. ✅ Revert Bandera GBP hours to "8:30pm close" (Operations, 10 min)
2. ✅ Pause DoorDash campaign "summer-spicy" (Marketing, 5 min)
3. ⏳ Re-evaluate Bandera call volume in 48 hours
4. ⏳ Re-evaluate DoorDash ROAS in 24 hours
5. ⏳ CEO to confirm extended hours are actually intended

PROJECTED RECOVERY: +$4,000-$5,000 in next 7 days if actions
taken immediately.
```

**This entire diagnostic can be generated in ~30 seconds once the 5 integrations are connected.**

---

## What Mi Can Answer Today (Without Integrations)

| CEO Question | Can Answer Today? | What's Needed |
|--------------|-------------------|---------------|
| Why is traffic down? | ⚠️ Partially (GSC only) | GA4 for full funnel |
| Why are clicks down? | ✅ Yes (GSC data) | — |
| Why is CTR down? | ✅ Yes (GSC data) | — |
| Why are calls down? | ❌ No | GBP API |
| Why are orders down? | ❌ No | Toast API |
| Why is revenue down? | ❌ No | Toast + QB |
| Why is profit down? | ❌ No | QB + Toast |

**Bottom line: Mi can answer 3 of 7 CEO questions today. After unblock: 7 of 7.**

---

## Activation Checklist

To make this diagnostic play executable:

- [ ] Connect GA4 (30 min)
- [ ] Connect GBP API (1 hour)
- [ ] Connect DoorDash (10 min)
- [ ] Connect Toast (2 hours)
- [ ] Connect QuickBooks (4 hours / 2-4 weeks)
- [ ] Build diagnostic engine (~2 days)
- [ ] Add auto-trigger on weekly revenue drop
- [ ] Test with historical data (when available)
- [ ] Wire to CEO dashboard widget
- [ ] Schedule weekly auto-report

**Total time: ~5 days once integrations are active.**
