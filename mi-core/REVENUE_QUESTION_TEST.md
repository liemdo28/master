# Revenue Question Test — Phase 34I
> CEO Query: "Mi, did SEO traffic create business value this week?"
> Test date: 2026-06-25

---

## Mi Answer (Current State)

**CEO Question:** Mi, did SEO traffic create business value this week?

---

**Mi Answer:**

Here is what I can confirm and what remains unknown.

### KNOWN ✅

**Traffic:** Organic search traffic is being tracked via GSC and GA4 tags are live on all pages for both Bakudan and Raw Sushi. GSC data shows impressions and clicks from Google Search are flowing.

**Website:** All 25 Bakudan pages and Raw Sushi pages have GA4 tracking tags (`G-3GZ2RYDR6M` / `G-WNHH66NT41`). Sessions, pageviews, and bounce rates are being collected.

**DoorDash:** All 4 delivery accounts are authenticated (Bakudan × 3, Raw Sushi × 1). Agent is running on Laptop1. However, analytics page is rate-limited — order/revenue data is not extractable this week.

### PARTIAL ⚠️

**Conversion Events:** Order buttons, phone links, and menu clicks exist across pages but are NOT yet sending GA4 events. I can see visitors arrived but I cannot confirm they clicked to order or called.

**QuickBooks:** QBWC connection was established (1 active session) but no data has synced yet. Revenue data is not available. Sync requires: remove old QBWC connector → re-add with new QWC file → trigger sync.

**GA4 Live API:** Property IDs are configured (`properties/543110659` Bakudan, `properties/532604616` Raw Sushi) but the `analytics.readonly` OAuth scope has not been granted yet. GA4 API data is not pulling — re-auth required at `/api/auth/google/start`.

### UNKNOWN / BLOCKED ❌

**GBP (Calls/Directions):** Cannot confirm whether organic visitors called stores or requested directions this week. Google Business Profile requires `business.manage` OAuth scope — not yet granted. This is the strongest local intent signal.

**Toast Orders:** No Toast developer API key configured. Cannot confirm whether site visitors placed orders via Toast this week.

**Revenue:** QB not synced. Toast API not configured. Cannot confirm actual revenue impact.

---

## Attribution Chain Status

```
GSC → "san antonio ramen" → 12 clicks       CONFIRMED ✅
GA4 → Session on /best-ramen-san-antonio.html  CONFIRMED ✅ (tag live, API needs re-auth)
CTA → Clicked "Order Now" button             UNKNOWN ❌ (events not instrumented yet)
GBP → Called Bandera store                   UNKNOWN ❌ (scope missing)
Toast → Placed order                         UNKNOWN ❌ (API key missing)
QB  → $X revenue recorded                   UNKNOWN ❌ (sync not run)
```

---

## Confidence: 30/100

| Dimension | Status | Confidence |
|-----------|--------|------------|
| Traffic reached site | YES | HIGH |
| Traffic came from SEO | YES | HIGH |
| Traffic converted to CTA | UNKNOWN | NONE |
| Traffic created calls | UNKNOWN | NONE |
| Traffic created orders | UNKNOWN | NONE |
| Traffic created revenue | UNKNOWN | NONE |

---

## Next Actions to Answer This Question Fully

**CEO must do (in order of impact):**

1. **Re-auth Google** → `http://localhost:4001/api/auth/google/start`
   - Unlocks: GA4 live API + GBP calls/directions data
   - Time to unlock: 5 minutes

2. **Fix QBWC sync** on Laptop1 QB Desktop
   - Remove "Mi-Core Financial Connector" from QBWC
   - Re-add `mi-core-financial-connector.qwc`
   - Click Update Selected → password: `b149c4783a1109ff46d01498d91766e7`
   - Unlocks: Revenue/profit ground truth
   - Time to unlock: 10 minutes

3. **Upload instrumented HTML to Dreamhost** (Phase 34F)
   - Unlocks: Order click, phone click, menu click tracking
   - Time to unlock: 30 minutes

4. **Register Toast developer app** at developer.toasttab.com
   - Unlocks: Actual order count + revenue per store
   - Time to unlock: 1–2 days (app approval)

**After items 1–3 complete, Mi can answer with 75% confidence.**
