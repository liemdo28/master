# CONTENT_FACTORY_DESIGN

> Generated: 2026-06-26 11:24 Asia/Saigon
> Phase: 4F — Content Factory Design

---

## Content Types

| Type | Platform | Owner | Approval Required |
|------|----------|-------|-------------------|
| Blog Article | Website | Content Agent | YES (SEO QA + CEO) |
| Landing Page | Website | Web Engineering | YES (SEO + CEO) |
| Social Post | Facebook/Instagram | Social Agent | YES (CEO) |
| Email Campaign | Email Platform | Marketing | YES (CEO) |
| SMS Promotion | SMS Platform | Marketing | YES (CEO) |
| In-Store Promotion | POS/Dashboard | Operations | YES (GM) |
| GBP Post | Google Business Profile | Local SEO | YES (CEO) |
| Review Response | Google/Yelp | Operations | YES (CEO) |
| Video Brief | YouTube/TikTok | Creative | YES (CEO) |
| Image Brief | Social/Website | Creative | YES (CEO) |

---

## Content Lifecycle

```
IDEA
 │  Source: GSC gaps, competitor analysis, customer feedback, seasonal events
 │  Owner: Marketing / Content Agent
 ▼
BRIEF
 │  Fields: topic, target_keyword, audience, channel, brand, store, owner, deadline
 │  Template: SEO_CONTENT_PRODUCTION_PIPELINE.md
 ▼
DRAFT
 │  Writer: Mi AI (Claude/GPT/Qwen) or human writer
 │  Output: article body, meta title, meta description, FAQ schema, CTAs
 │  Store: .mi-harness/content/drafts/{id}.json
 ▼
REVIEW
 │  Reviewer: QA agent (schema, SEO, readability)
 │  Checks: keyword placement, internal links, CTA, meta length, mobile
 ▼
APPROVAL
 │  Approver: CEO via WhatsApp or Executive Coordination
 │  Gate: approval_id required before publish
 ▼
PUBLISH
 │  Deployer: Mi (git push + deploy) or human
 │  Channels: website, WordPress, GBP, social, email
 │  UTM: required on all outbound links
 ▼
MEASURE
   KPIs: GSC clicks, GA4 sessions, engagement rate, conversions
   Frequency: 7-day, 30-day, 90-day checkpoints
   Store: .mi-harness/content/performance/{id}.json
```

---

## Content Queue

| Queue Status | Meaning |
|-------------|---------|
| IDEA | Concept logged, no brief yet |
| BRIEF_READY | Brief written, awaiting CEO approval to draft |
| DRAFTING | AI/human actively writing |
| DRAFT_READY | Draft complete, awaiting QA |
| QA_PASSED | All SEO checks passed |
| QA_FAILED | Issues found, returned to DRAFTING |
| APPROVAL_PENDING | Sent to CEO for approval |
| APPROVED | CEO approved, ready to publish |
| PUBLISHING | Being deployed |
| PUBLISHED | Live on channel |
| MEASURING | 7/30/90 day checkpoints tracking |
| ARCHIVED | Campaign complete |

---

## Owner Mapping

| Content Type | Primary Owner | Backup Owner |
|-------------|---------------|--------------|
| Blog Article | seo-content-agent | Human writer |
| Landing Page | Web Engineering | seo-content-agent |
| Social Post | Social Agent | Human designer |
| Email Campaign | Marketing Lead | Human writer |
| GBP Post | Local SEO Agent | Operations |
| Review Response | review-automation | Store Manager |
| Video Brief | Creative | Marketing Lead |

---

## Approval Rules

| Content Type | Approval Gate | Evidence Required |
|-------------|---------------|-------------------|
| Blog Article | CEO | keyword research + draft + QA report |
| Landing Page | CEO | SEO brief + mockup |
| Social Post | CEO | draft copy + image |
| Email Campaign | CEO | draft copy + audience segment |
| GBP Post | CEO | draft + location target |
| Review Response | CEO | review text + AI draft |

---

## Publishing Channels

| Channel | Method | UTM Required |
|---------|--------|-------------|
| Website (Bakudan) | git push → Cloudflare | Yes |
| Website (Raw Sushi) | git push → Cloudflare | Yes |
| WordPress (future) | WP API | Yes |
| Facebook | Graph API v19 | Yes |
| Instagram | Graph API v19 | Yes |
| GBP | MyBusiness API | Yes |
| Email | Mailchimp/Mautic | Yes |

---

## Performance Tracking

| Checkpoint | What to Measure | Source |
|-----------|-----------------|--------|
| 7-day | Initial indexing, early impressions | GSC |
| 30-day | Click growth, position change, engagement | GSC + GA4 |
| 90-day | Revenue attribution, conversion lift | GA4 + POS |

---

## Coordination Integration

Each content piece generates an Executive Coordination task