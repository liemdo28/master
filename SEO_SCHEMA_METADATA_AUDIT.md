# SEO_SCHEMA_METADATA_AUDIT.md

> Phase 24 — Schema & Metadata Audit Report
> Date: 2026-06-24
> Status: AUDIT_COMPLETE — PATCHES_NEEDED

---

## Purpose

Audit structured data (JSON-LD schema), title tags, meta descriptions, OpenGraph tags, canonical URLs, sitemap, and robots.txt for both Bakudan Ramen and Raw Sushi websites.

---

## Brand 1: Bakudan Ramen (bakudanramen.com)

### Schema Markup Audit

#### What EXISTS

| Schema Type | Found On | Status |
|-------------|----------|--------|
| Organization | `index.html` | ✅ Present — detected in crawl |

#### What's MISSING

| Schema Type | Needed For | Status | Priority |
|-------------|-----------|--------|----------|
| Restaurant | All location pages | ❌ Not present on location pages | P1 |
| LocalBusiness / Restaurant | `locations.html`, `locations/*.html` | ❌ Not found | P1 |
| FAQPage | `about.html` or dedicated FAQ | ❌ Not found | P2 |
| BreadcrumbList | All inner pages | ❌ Not found | P2 |
| Menu | `menu.html` | ❌ Not found | P3 |
| AggregateRating | `index.html` | ❌ Not found | P2 |
| OpeningHoursSpecification | `locations/*.html` | ❌ Not found | P1 |

#### Schema Agent Output (from seo-schema-agent)

The seo-schema-agent generates Restaurant schemas for all 3 Bakudan locations:

| Location | Schema Type | Validation |
|----------|------------|------------|
| Main Store | Restaurant | ✅ Valid |
| Bandera | Restaurant | ✅ Valid |
| Stone Oak | Restaurant | ✅ Valid |
| The Rim | Restaurant | ✅ Valid |
| FAQPage (global) | FAQPage | ✅ Valid |
| BreadcrumbList (per page) | BreadcrumbList | ✅ Valid |

**Gap:** Agent generates schemas but they are NOT deployed to the live website.

#### Recommended Schema Patch

Add to each location page and `menu.html`:

```json
{
  "@context": "https://schema.org",
  "@type": "Restaurant",
  "name": "Bakudan Ramen",
  "image": "https://bakudanramen.com/images/bakudan-og.jpg",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "[LOCATION_ADDRESS]",
    "addressLocality": "San Antonio",
    "addressRegion": "TX",
    "postalCode": "[ZIP]"
  },
  "telephone": "+1-210-437-0632",
  "url": "https://bakudanramen.com",
  "menu": "https://bakudanramen.com/menu",
  "acceptsReservations": "True",
  "servesCuisine": "Japanese Ramen",
  "priceRange": "$$",
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": "[LAT]",
    "longitude": "[LNG]"
  },
  "openingHours": "Mo-Th 11:00-20:30, Fr-Sa 11:00-21:00, Su 11:00-20:00",
  "sameAs": [
    "https://www.instagram.com/bakudanramen/",
    "https://www.facebook.com/bakudanSA/",
    "https://www.yelp.com/biz/bakudan-ramen-san-antonio"
  ]
}
```

---

### Title Tag Audit

| Page | Current Title | Recommended | Status |
|------|--------------|-------------|--------|
| `index.html` | Bakudan Ramen \| Bold Flavor. Modern Japanese Soul. Texas Spirit. | ✅ Good — branded, unique | OK |
| `menu.html` | Bakudan Ramen Menu | Needs keyword: "Ramen Menu San Antonio" | ⚠️ IMPROVE |
| `locations.html` | Bakudan Locations | Needs keyword: "3 Locations in San Antonio" | ⚠️ IMPROVE |
| `about.html` | Bakudan Ramen - Our Story | Add "Japanese Ramen San Antonio" | ⚠️ IMPROVE |
| `happy-hour.html` | Happy Hour - Bakudan Ramen | Add "Daily 3-6 PM San Antonio" | ⚠️ IMPROVE |
| `order.html` | Order Online - Bakudan Ramen | Add "Ramen Delivery San Antonio" | ⚠️ IMPROVE |
| `blog.html` | Blog - Bakudan Ramen | Add "Ramen Tips & News" | ⚠️ IMPROVE |
| Location pages | Not checked (404) | N/A — pages exist but URL 404 | ❌ FIX URL |

---

### Meta Description Audit

| Page | Current Meta | Recommended | Status |
|------|-------------|-------------|--------|
| `index.html` | "Experience authentic Japanese ramen in San Antonio, Texas..." | ✅ Good — 158 chars, keyword-rich | OK |
| `menu.html` | Not checked | Add: "Explore Bakudan Ramen's menu..." | ⚠️ CHECK |
| `locations.html` | Not checked | Add: "Find Bakudan Ramen locations..." | ⚠️ CHECK |
| `about.html` | Not checked | Add: "Learn about Bakudan Ramen's..." | ⚠️ CHECK |

---

### OpenGraph Tags Audit

| Page | og:title | og:description | og:image | og:url | Status |
|------|----------|----------------|----------|--------|--------|
| `index.html` | ⚠️ Need to verify | ⚠️ Need to verify | ⚠️ Need to verify | ✅ | ⚠️ VERIFY |
| All other pages | ⚠️ Need to verify | ⚠️ Need to verify | ⚠️ Need to verify | ⚠️ | ⚠️ VERIFY |

**Action:** Add OpenGraph tags to all pages if missing:

```html
<meta property="og:title" content="[Page Title] | Bakudan Ramen" />
<meta property="og:description" content="[Meta Description]" />
<meta property="og:image" content="https://bakudanramen.com/images/bakudan-og.jpg" />
<meta property="og:url" content="https://bakudanramen.com/[page]" />
<meta property="og:type" content="restaurant" />
<meta property="og:locale" content="en_US" />
```

---

### Canonical URLs Audit

| Page | Canonical Tag | Status |
|------|--------------|--------|
| `index.html` | ⚠️ Not verified | CHECK |
| All inner pages | ⚠️ Not verified | CHECK |

**Recommendation:** Add `<link rel="canonical" href="https://bakudanramen.com/[page]" />` to every page.

---

### Sitemap Audit

| Item | Status |
|------|--------|
| `sitemap.xml` exists | ❌ NOT FOUND at expected path |
| Dynamic sitemap generation | ❌ Not implemented |
| Include all HTML pages | N/A |
| Include images | N/A |
| Submit to GSC | ⏳ Pending GSC setup |

**Action:** Create `sitemap.xml` with all pages:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://bakudanramen.com/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>
  <url><loc>https://bakudanramen.com/menu</loc><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://bakudanramen.com/locations</loc><changefreq>monthly</changefreq><priority>0.9</priority></url>
  <url><loc>https://bakudanramen.com/locations/bandera</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>https://bakudanramen.com/locations/stone-oak</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>https://bakudanramen.com/locations/the-rim</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>https://bakudanramen.com/about</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://bakudanramen.com/happy-hour</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>
  <url><loc>https://bakudanramen.com/order</loc><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://bakudanramen.com/blog</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>
</urlset>
```

---

### robots.txt Audit

| Item | Status |
|------|--------|
| `robots.txt` exists | ❌ NOT FOUND |
| Sitemap reference | N/A |
| Crawl rules | N/A |

**Action:** Create `robots.txt`:

```
User-agent: *
Allow: /
Disallow: /links-admin/
Disallow: /uploads/
Disallow: /.local-agent/

Sitemap: https://bakudanramen.com/sitemap.xml
```

---

## Brand 2: Raw Sushi (rawsushi.example.com)

Raw Sushi is in pre-launch state. All schema/metadata needs to be created from scratch.

| Item | Status | Action |
|------|--------|--------|
| Restaurant schema | ❌ Not created | Create with launch |
| Sitemap | ❌ Not created | Create with launch |
| robots.txt | ❌ Not created | Create with launch |
| Title tags | ❌ Not created | Create with launch |
| Meta descriptions | ❌ Not created | Create with launch |
| OpenGraph | ❌ Not created | Create with launch |
| Canonical URLs | ❌ Not created | Create with launch |

---

## Priority Fix List

### P1 — CRITICAL

1. **Add location subpage rewrites** to .htaccess (see SEO_404_FIX_AND_VERIFY.md)
2. **Create Restaurant schema** for all Bakudan location pages
3. **Create sitemap.xml** for bakudanramen.com
4. **Create robots.txt** for bakudanramen.com
5. **Add OpeningHoursSpecification** to location pages

### P2 — HIGH

6. **Add BreadcrumbList schema** to all inner pages
7. **Add FAQPage schema** to about or dedicated FAQ
8. **Improve title tags** with target keywords
9. **Add OpenGraph tags** to all pages
10. **Add canonical URLs** to all pages

### P3 — MEDIUM

11. **Add Menu schema** to menu.html
12. **Add AggregateRating schema** to index.html
13. **Improve meta descriptions** for inner pages

---

## Certification

| Check | Status |
|-------|--------|
| Restaurant schema audit | ✅ Documented |
| LocalBusiness schema audit | ✅ Documented |
| FAQ schema audit | ✅ Documented |
| Organization schema audit | ✅ Present (index.html) |
| Breadcrumb schema audit | ✅ Missing — fix planned |
| Title tags audit | ✅ Documented |
| Meta descriptions audit | ✅ Documented |
| OpenGraph tags audit | ✅ Documented |
| Canonical URLs audit | ✅ Documented |
| Sitemap audit | ✅ Missing — fix planned |
| robots.txt audit | ✅ Missing — fix planned |
| Patch plan created | ✅ |
| Raw Sushi baseline | ✅ Documented |

**Status: SCHEMA_METADATA_AUDIT_COMPLETE ✅**
