# Bakudan Page-One Push

**Phase:** 26C — Bakudan Page-One Push  
**Generated:** 2026-06-24 17:30 Asia/Saigon  
**Target:** Move at least 10 queries from positions 8–20 closer to page 1  
**Baseline:** 587 clicks, 11,174 impressions, 5.3% CTR, avg position 10.8

## Executive Summary

Bakudan’s confirmed average position is **10.8**, which indicates the site is sitting near the page-one/page-two boundary. This is the strongest ranking-growth opportunity for Bakudan.

Exact query-level rankings from positions 8–20 are **not available locally**, so this plan uses verified repository keyword/page inventory and clearly marks unavailable data.

## Queries Ranking Position 8–20 — Status

**Status: BLOCKED for exact query rows.**

Required GSC dimensions:
- query
- page
- clicks
- impressions
- CTR
- position
- date range: last 7 days and last 28 days

No GSC export/API output with these dimensions was found in the workspace.

## Candidate Query/Page Map

| Candidate Query | Target Page | Current Repo Status | Priority |
|---|---|---|---|
| best ramen San Antonio | `/best-ramen-san-antonio.html` | Exists, FAQ schema present | P1 |
| tonkotsu ramen San Antonio | `/tonkotsu-ramen-san-antonio.html` | Exists, FAQ schema present | P1 |
| Japanese food San Antonio | `/japanese-food-san-antonio.html` | Exists, FAQ schema present | P1 |
| ramen near UTSA | `/ramen-near-utsa.html` | Exists, FAQ schema present | P1 |
| ramen near The Rim | `/ramen-near-the-rim-la-cantera.html` | Exists, FAQ schema present | P1 |
| ramen near La Cantera | `/ramen-near-the-rim-la-cantera.html` or new dedicated page | Gap: keyword map had assigned_page null | P1 |
| ramen Stone Oak | `/ramen-stone-oak.html` | Exists, FAQ schema present | P1 |
| vegetarian ramen San Antonio | `/vegetarian-ramen-san-antonio.html` | Exists, FAQ schema present | P2 |
| happy hour ramen San Antonio | `/happy-hour-ramen-san-antonio.html` | Exists, FAQ schema present | P2 |
| ramen near me San Antonio | `/index.html` + location pages | Homepage optimized | P2 |

## On-Page Content Improvements

### Global Fixes

1. Reconcile URL format mismatch:
   - SEO agent mapped non-`.html` URLs.
   - Production files are `.html`.
   - Add redirects or update canonical/agent map.
2. Expand thin landing pages from short text to 650–900 words.
3. Add unique local proof to each page:
   - address
   - nearby landmarks
   - parking/delivery notes
   - menu highlights
   - CTA
4. Add 5–8 internal links per page.
5. Preserve existing FAQPage schema and expand with 2 more FAQs per page.

## FAQ Schema Additions

Existing Bakudan landing pages already include FAQPage JSON-LD. Add/expand:

| Page | New FAQ Topic |
|---|---|
| `/best-ramen-san-antonio.html` | “Which Bakudan location is closest to me?” |
| `/tonkotsu-ramen-san-antonio.html` | “What makes tonkotsu broth creamy?” |
| `/japanese-food-san-antonio.html` | “Do you serve more than ramen?” |
| `/ramen-near-utsa.html` | “How far is Bakudan from UTSA?” |
| `/ramen-near-the-rim-la-cantera.html` | “Is Bakudan near La Cantera mall?” |
| `/ramen-stone-oak.html` | “Where is Bakudan Stone Oak located?” |
| `/vegetarian-ramen-san-antonio.html` | “Can I customize vegetarian ramen?” |
| `/happy-hour-ramen-san-antonio.html` | “Are happy hour specials dine-in only?” |

## Internal Linking Patch

Recommended links:
- Homepage → all core landing pages
- Menu → best ramen, tonkotsu, vegetarian ramen
- Locations → UTSA, Stone Oak, Rim/La Cantera pages
- Happy Hour → happy-hour ramen page, menu, locations
- Blog/guide pages → landing pages using contextual anchors

## Content Patch Specification

### `/best-ramen-san-antonio.html`
- Expand proof section with signature bowls: Garlic Tonkotsu, Spicy Umami Miso, Vegetarian Shoyu.
- Add comparison copy: why Bakudan is different from generic ramen restaurants.
- Add location chooser module.

### `/tonkotsu-ramen-san-antonio.html`
- Add detailed explanation of tonkotsu broth, simmer time, toppings, and recommended add-ons.
- Link to menu and order page.

### `/ramen-near-utsa.html`
- Add distance/area copy for UTSA, Bandera Rd, Loop 1604, and Leon Valley.
- Add student lunch/dinner intent section.

### `/ramen-near-the-rim-la-cantera.html`
- Add explicit La Cantera wording in title/H1/subheads.
- Add shopping/night-out use case.

### `/ramen-stone-oak.html`
- Add Stone Oak/North San Antonio neighborhood copy.
- Add address, parking, delivery, and family dining section.

### `/vegetarian-ramen-san-antonio.html`
- Add plant-friendly ingredient section.
- Clarify vegetarian vs vegan modification options.

### `/happy-hour-ramen-san-antonio.html`
- Add happy hour menu proof and dine-in-only clarification.
- Link to locations and menu.

## Re-Submission for Indexing

After publishing patches:

1. Submit updated sitemap in GSC.
2. Use URL Inspection request indexing for:
   - `https://bakudanramen.com/best-ramen-san-antonio.html`
   - `https://bakudanramen.com/tonkotsu-ramen-san-antonio.html`
   - `https://bakudanramen.com/japanese-food-san-antonio.html`
   - `https://bakudanramen.com/ramen-near-utsa.html`
   - `https://bakudanramen.com/ramen-near-the-rim-la-cantera.html`
   - `https://bakudanramen.com/ramen-stone-oak.html`
   - `https://bakudanramen.com/vegetarian-ramen-san-antonio.html`
   - `https://bakudanramen.com/happy-hour-ramen-san-antonio.html`
3. Pull GSC data after 7 days and 28 days to measure movement.

## Expected Impact

| Metric | Current | Goal | Measurement Window |
|---|---:|---:|---|
| Avg position | 10.8 | <10.0 | 30 days |
| Queries improved | Unknown exact count | 10 | 30 days |
| CTR | 5.3% | Maintain or improve | 30 days |
| Non-brand clicks | Unknown | Increase | 30 days |

## Blockers

1. Query-level GSC exports needed for exact position 8–20 list.
2. Current SEO crawler evidence showed several non-`.html` URL checks returning 404 while production files exist with `.html`.
3. Need deployment approval for content patch.

## Final Recommendation

Proceed with content patch on the eight existing landing pages and create a dedicated `ramen-near-la-cantera.html` page. Do not claim ranking improvement until follow-up GSC data confirms movement.

---

*No query-level ranking data was fabricated. Candidate queries are based on repository keyword map and page inventory only.*
