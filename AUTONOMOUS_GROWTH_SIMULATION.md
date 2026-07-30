# AUTONOMOUS_GROWTH_SIMULATION.md

> Phase 29G — Autonomous Growth Simulation
> Generated: 2026-06-24 20:48 Asia/Saigon
> Objective: Increase Bakudan Revenue by 10%
> Method: Analyze → Decompose → Create Tasks → Create Source Changes → Create PRs → Create KPI Tracking → Generate Weekly Plan

---

## Objective

**Increase Bakudan Ramen revenue by 10% within 90 days.**

Assumptions:
- 3 locations, average $20K/month revenue per location (industry median)
- Total monthly revenue: ~$60,000
- 10% target: +$6,000/month → $66,000/month

---

## Decomposition: Revenue Levers

| Lever | Mechanism | Target Impact | Timeline |
|-------|-----------|---------------|----------|
| **SEO CTR improvement** | Better titles/meta → more clicks → more orders | +$1,800/month | 30–60 days |
| **SEO ranking push** | Move 10 queries from position 10–15 to positions 5–8 | +$1,200/month | 60–90 days |
| **Website conversion improvement** | More CTAs, direct-call buttons → higher conversion | +$1,200/month | 30 days |
| **Review improvement** | Higher ratings → more trust → more walk-ins | +$900/month | 60–90 days |
| **DoorDash campaign optimization** | Better ROAS → more delivery orders | +$900/month | 30–60 days |
| **TOTAL** | | **+$6,000/month (10%)** | |

---

## Analysis: Where the Revenue Gaps Are

### Gap 1: Raw Sushi CTR Is a Revenue Leak
- 28,736 impressions at 1.3% CTR = 361 clicks
- At 5.3% CTR (same as Bakudan), would be 1,523 clicks → +1,162 clicks
- Even at 2.6% CTR (modest improvement), would be 747 clicks → +386 clicks
- **Source change already committed:** Raw Sushi homepage title/meta fix

### Gap 2: Bakudan Order Page Has No Direct CTA
- Users who land on order.html see Toast links but no immediate phone number
- Adding phone CTAs captures users who want to order NOW (phone orders have higher AOV)
- **Source change already committed:** Order page phone CTA bar added

### Gap 3: 10+ Landing Pages Exist But Rankings Are Stagnant
- 8 Bakudan landing pages are live but avg position is 10.8
- Internal linking between landing pages could improve crawl authority
- Each landing page needs proper interlinking to order.html

---

## Tasks Created

### Task Group 1: SEO (COMPLETED in this session)
| Task | Owner | Status | Evidence |
|------|-------|--------|----------|
| Fix Raw Sushi homepage CTR | Mi (SEO) | ✅ DONE | Commit `09265d2` pushed |
| Fix Bakudan order page conversion | Mi (SEO) | ✅ DONE | Commit `9fe43c2` pushed |
| Create SEO Revenue Execution Loop | Mi (SEO) | ✅ DONE | `SEO_REVENUE_EXECUTION_LOOP.md` |
| Create Revenue Driver Inventory | Mi (Strategy) | ✅ DONE | `REVENUE_DRIVER_INVENTORY.md` |

### Task Group 2: Website Conversion (IN PROGRESS)
| Task | Owner | Status | Evidence |
|------|-------|--------|----------|
| Add order CTA to locations.html | Mi (Web) | ⏳ PENDING | See `WEBSITE_CONVERSION_LOOP.md` |
| Add phone CTA to homepage | Mi (Web) | ⏳ PENDING | See `WEBSITE_CONVERSION_LOOP.md` |
| Add GA4 tracking to all pages | Mi (Web) | ⏳ PENDING | Requires GA4 property setup |

### Task Group 3: Reviews (BLOCKED)
| Task | Owner | Status | Reason |
|------|-------|--------|--------|
| Activate review automation system | Operations | ⏳ PENDING | System code exists, needs activation |
| Run daily negative review report | Operations | ⏳ PENDING | Script exists, needs execution |
| Generate positive reviews via QR | Store Managers | ⏳ PENDING | Needs QR codes at 3 locations |

### Task Group 4: DoorDash (BLOCKED)
| Task | Owner | Status | Reason |
|------|-------|--------|--------|
| Audit DoorDash campaign state | Marketing | ⏳ BLOCKED | No credentials provided |
| Optimize campaign ROAS | Marketing | ⏳ BLOCKED | No credentials provided |

---

## Source Changes Created (In This Session)

| # | File | Repo | Commit | Pushed |
|---|------|------|--------|--------|
| 1 | `RawSushi/RawWebsite/index.html` | `liemdo28/rawwebsite` | `09265d2` | ✅ |
| 2 | `Bakudan/bakudanramen.com-current/order.html` | `liemdo28/bakudanwebsite_sub` | `9fe43c2` | ✅ |

---

## Weekly Plan

### Week 1 (Current)
- [x] Identify revenue gaps
- [x] Fix Raw Sushi homepage CTR (source change + push)
- [x] Fix Bakudan order page conversion (source change + push)
- [x] Create revenue driver inventory
- [x] Create SEO execution loop

### Week 2
- [ ] Add order CTAs to locations.html (3 locations)
- [ ] Add phone CTA to homepage hero
- [ ] Activate daily review report script
- [ ] Set up GA4 tracking

### Week 3
- [ ] Monitor GSC for ranking movement
- [ ] Create Bakudan spicy ramen landing page
- [ ] Review audit: run daily negative review detection
- [ ] Request DoorDash Ads Manager credentials

### Week 4
- [ ] First GSC performance report
- [ ] Compare Raw Sushi CTR (target: 2.0%)
- [ ] Compare Bakudan position (target: 9.0)
- [ ] If DoorDash unblocked: start campaign optimization

### Weeks 5–12
- [ ] Monthly GSC review
- [ ] Monthly revenue correlation
- [ ] Iterate on top-performing SEO pages
- [ ] Expand landing page inventory if rankings improve

---

## KPI Tracking for 10% Revenue Target

| KPI | Baseline | Month 1 | Month 2 | Month 3 | Target |
|-----|----------|---------|---------|---------|--------|
| Total Organic Clicks | 948/mo | 1,200 | 1,600 | 2,200 | 2,500 |
| Avg Position (Bakudan) | 10.8 | 9.5 | 8.5 | 7.0 | 6.5 |
| Raw Sushi CTR | 1.3% | 1.8% | 2.2% | 2.8% | 3.0% |
| Reviews (count) | Unknown | +20 | +40 | +60 | +60/month |
| Revenue | $60,000 | $61,200 | $63,600 | $66,000 | $66,000 |

---

## Honest Assessment

| What Mi Can Do | What Mi Cannot Do |
|----------------|-------------------|
| Identify SEO opportunities | Run GBP ads |
| Fix website metadata/conversion | Execute DoorDash campaigns |
| Create tracking frameworks | Pull POS data |
| Generate landing pages | Set up GA4 (needs property access) |
| Monitor GSC rankings | Control store operations |
| Create PRs and push to repos | Guarantee revenue outcomes |

**The simulation proves Mi can decompose a revenue objective into actionable tasks, create source changes, and track KPIs. Revenue outcome depends on: activation of blocked systems (GA4, GBP, DoorDash), operational execution, and market conditions.**
