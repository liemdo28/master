# WEBSITE_CONVERSION_LOOP.md

> Phase 29E — Website Conversion Loop
> Generated: 2026-06-24 20:47 Asia/Saigon
> Mission: Traffic → Visitor → Action
> Real source changes: order.html (committed + pushed)

---

## Executive Summary

Bakudan's website has strong SEO foundations (8 landing pages, structured data, FAQ schema) but conversion barriers exist. One real source change was committed to fix the highest-impact barrier.

---

## Conversion Barrier Audit

### Order Page (order.html)
| Issue | Severity | Status |
|-------|----------|--------|
| Generic title: "Order Online - Bakudan Ramen" | HIGH | ✅ FIXED (committed + pushed) |
| No phone CTAs above the fold | HIGH | ✅ FIXED (added 3 direct-call buttons) |
| "Third-party fees" not addressed | MEDIUM | ✅ FIXED (added "No Third-Party Fees" message) |
| No mobile sticky CTA bar | MEDIUM | ⏳ Pending |

### Menu Page (menu.html)
| Issue | Severity | Status |
|-------|----------|--------|
| No "Order Now" CTA in menu section | MEDIUM | ⏳ Pending |
| Schema exists (Menu type) ✅ | LOW | OK |
| Price not displayed for all items | LOW | Minor |

### Locations Page (locations.html)
| Issue | Severity | Status |
|-------|----------|--------|
| No embedded Google Maps | MEDIUM | ⏳ Pending |
| No "Order from X" buttons on location cards | HIGH | ⏳ Pending |
| Phone numbers present ✅ | LOW | OK |

### Homepage (index.html)
| Issue | Severity | Status |
|-------|----------|--------|
| CTA "Order Now" exists in nav ✅ | LOW | OK |
| Phone numbers not visible on homepage | MEDIUM | ⏳ Pending |
| No "Popular Items" section | LOW | Enhancement |
| Schema exists (Organization + restaurants) ✅ | LOW | OK |

### Happy Hour Page (happy-hour.html)
| Issue | Severity | Status |
|-------|----------|--------|
| No CTA to visit during happy hour | LOW | ⏳ Pending |
| Content exists ✅ | LOW | OK |

---

## Real Source Changes Created

### Change: Order Page Conversion Fix (COMMITTED + PUSHED)
- **Repo:** `liemdo28/bakudanwebsite_sub`
- **Commit:** `9fe43c2`
- **Branch:** `seo/phase-28-homepage-og-tags`
- **Changes:**
  1. Title updated to include "Pickup & Delivery in San Antonio" (SEO + relevance)
  2. Meta description updated to emphasize "order direct and save"
  3. Added direct-call CTA bar with all 3 phone numbers
  4. Added "No Third-Party Fees" value proposition
  5. Styled with red gradient banner for visual urgency

### Change: Raw Sushi Homepage CTR Fix (COMMITTED + PUSHED)
- **Repo:** `liemdo28/rawwebsite`
- **Commit:** `09265d2`
- **Branch:** `master`
- **Changes:**
  1. Title now targets "Best Sushi in Stockton & Modesto, CA"
  2. Meta description includes social proof (4.5 stars, 655+ reviews)
  3. OG/Twitter cards updated to match
  4. Keywords refocused on location-specific terms

---

## Conversion Improvement Roadmap

### Priority 1 (Revenue Impact: HIGH)
| Change | Est. Impact | Effort |
|--------|-------------|--------|
| Add order CTA bar to locations.html per location | +10% online orders | LOW |
| Add phone CTA to homepage hero | +5% calls | LOW |
| Add "Order from [Location]" buttons on menu.html | +8% order conversions | LOW |

### Priority 2 (Revenue Impact: MEDIUM)
| Change | Est. Impact | Effort |
|--------|-------------|--------|
| Add Google Maps embed to locations.html | +3% directions | LOW |
| Add mobile sticky "Order" bar to all pages | +5% mobile conversions | MEDIUM |
| Add schema for individual location hours | +2% GBP clicks | LOW |

### Priority 3 (Revenue Impact: LOW-MEDIUM)
| Change | Est. Impact | Effort |
|--------|-------------|--------|
| Add "Popular Items" section to homepage | +2% engagement | MEDIUM |
| Add reservation system integration | +1% conversion | HIGH |
| Add live chat / chatbot | +2% conversion | HIGH |

---

## Technical SEO + Conversion Overlap

| Page | Schema ✅ | FAQ ✅ | Breadcrumb ✅ | CTA ✅ | Title Optimized | Meta Optimized |
|------|-----------|--------|--------------|--------|-----------------|----------------|
| index.html | Organization + Restaurants | Brand FAQ | ❌ | Nav CTA | ✅ | ✅ |
| order.html | ❌ | ❌ | ❌ | ✅ (Phase 29 fix) | ✅ (Phase 29 fix) | ✅ (Phase 29 fix) |
| menu.html | Menu | ❌ | ❌ | Partial | ✅ | ✅ |
| locations.html | Organization | ❌ | ❌ | ❌ | ⏳ | ⏳ |
| happy-hour.html | ❌ | ❌ | ❌ | Nav CTA only | ⏳ | ✅ |
| best-ramen-san-antonio.html | BreadcrumbList + FAQPage | ✅ (4 Qs) | ✅ | ✅ (Order Now) | ✅ | ✅ |
| ramen-stone-oak.html | BreadcrumbList + FAQPage | ✅ (3 Qs) | ✅ | ✅ (Order Now) | ✅ | ✅ |
| ramen-near-the-rim-la-cantera.html | BreadcrumbList + FAQPage | ✅ (3 Qs) | ✅ | ✅ (Order Now) | ✅ | ✅ |

---

## Result Tracking

| KPI | Current | Target (30 days) | Source |
|-----|---------|-------------------|--------|
| Order page → Toast click-through | Unknown | +20% | Google Analytics (pending) |
| Phone calls from order page | Unknown | +15% | Call tracking (pending) |
| Mobile "Order Now" CTA clicks | Unknown | +25% | GA4 (pending) |
| Bounce rate on order page | Unknown | -10% | GA4 (pending) |
| Average session duration | Unknown | +15% | GA4 (pending) |

---

## Blocked

| Requirement | Status |
|-------------|--------|
| GA4 property setup | BLOCKED — no GA4 ID |
| Call tracking number | BLOCKED — no provider |
| Hotjar/session recording | BLOCKED — not configured |
