# REVIEW_REVENUE_LOOP.md

> Phase 29C — Review Recovery Loop
> Generated: 2026-06-24 20:46 Asia/Saigon
> Mission: Rating → Customer Trust → Revenue

---

## Revenue Impact of Reviews

**Research-backed facts:**
- A 1-star increase on Yelp = 5–9% revenue increase (Harvard Business School study)
- 94% of diners read online reviews before visiting a new restaurant
- Restaurants with 4.5+ stars earn 10–15% more than 4.0-star restaurants
- For 3 Bakudan locations × multiple platforms = significant revenue lever

**Estimated Revenue Impact for Bakudan:**
- Average restaurant revenue per location: ~$15K–$25K/month (industry median)
- 1-star Yelp increase → 7% revenue lift → $1,050–$1,750/month per location
- 3 locations → $3,150–$5,250/month additional revenue

---

## Current Review Infrastructure

| System | Status | Location |
|--------|--------|----------|
| Review automation system | CODE EXISTS (production?) | `Bakudan/review-automation-system/app/` |
| Review MCP | DATA EXISTS | `Agent/review-management-mcp/data/` |
| Daily negative report script | EXISTS | `Bakudan/review-automation-system/scripts/send_daily_negative_report.py` |
| Auto-reply policy | EXISTS | `Bakudan/review-automation-system/app/providers/` |

---

## Detecting Stores Below Target

**Target Rating:** 4.5 stars (industry threshold for "premium" perception)

| Location | Platform | Current Rating | Status | Action |
|----------|----------|----------------|--------|--------|
| Bandera | Google | TBD | NEEDS_VERIFICATION | Check GBP |
| Bandera | Yelp | TBD | NEEDS_VERIFICATION | Check Yelp |
| Bandera | DoorDash | TBD | NEEDS_VERIFICATION | Check DoorDash |
| Stone Oak | Google | TBD | NEEDS_VERIFICATION | Check GBP |
| Stone Oak | Yelp | TBD | NEEDS_VERIFICATION | Check Yelp |
| Stone Oak | DoorDash | TBD | NEEDS_VERIFICATION | Check DoorDash |
| The Rim | Google | TBD | NEEDS_VERIFICATION | Check GBP |
| The Rim | Yelp | TBD | NEEDS_VERIFICATION | Check Yelp |
| The Rim | DoorDash | TBD | NEEDS_VERIFICATION | Check DoorDash |

**Blocker:** Without API access to GBP/Yelp/DoorDash review feeds, live rating data is not available in this session. The `review-automation-system` has code to pull reviews, but execution was not verified.

---

## Review Recovery Task Template

For any location/platform with rating < 4.5:

### Task 1: Negative Review Response (24-hour SLA)
- Owner: Store Manager
- Action: Respond to all 1-2 star reviews within 24 hours
- Template: Apology + invite to discuss offline + phone number
- KPI: Response rate > 95%

### Task 2: Positive Review Generation
- Owner: Front-of-house leads
- Action: Ask satisfied customers to leave a review
- Method: QR code at table, follow-up text (Toast POS integration)
- KPI: 10+ new positive reviews per location per month

### Task 3: Service Recovery
- Owner: GM
- Action: Contact dissatisfied customers directly
- Method: Phone call or email, offer return visit
- KPI: 50% recovery rate (customer returns)

### Task 4: Operational Root Cause
- Owner: Operations Lead
- Action: Analyze common themes in negative reviews
- Method: Weekly review audit → identify top 3 complaints → action plan
- KPI: Negative review count decreases month-over-month

---

## Review Revenue Loop Flow

```
Review Signal (1-star = bad, 5-star = good)
        ↓
Detect (review-automation-system cron)
        ↓
Classify (positive / neutral / negative)
        ↓
Route:
  - Negative → Store Manager (24h SLA)
  - Positive → Marketing (repurpose for social)
  - Neutral → GM (investigate)
        ↓
Task Created (in dashboard.bakudanramen.com task system)
        ↓
Track Completion
        ↓
Report Impact (review count + rating trend)
```

---

## Tracking Plan

| KPI | Source | Frequency | Target |
|-----|--------|-----------|--------|
| Average rating per location | GBP + Yelp + DoorDash | Weekly | 4.5+ |
| New reviews per location/month | GBP + Yelp + DoorDash | Monthly | 10+ |
| Negative review response rate | review-automation-system | Daily | > 95% |
| Review velocity (net positive) | All platforms | Monthly | +10/month |
| Revenue correlation | QuickBooks + review trend | Monthly | Positive trend |

---

## Honest Limitations

| Data Point | Status | Reason |
|------------|--------|--------|
| Current ratings per location | BLOCKED | No live API pull completed this session |
| Negative review count | BLOCKED | review-automation-system code exists but not executed |
| Customer recovery rate | NOT MEASURED | No CRM integration |
| Revenue correlation | NOT MEASURED | No POS→review linking |

**The review system infrastructure exists but requires live data activation. The daily negative report script is the fastest path to operational review management.**
