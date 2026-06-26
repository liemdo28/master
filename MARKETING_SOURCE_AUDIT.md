# MARKETING_SOURCE_AUDIT

> Generated: 2026-06-26 11:20 Asia/Saigon
> Phase: 4A — Marketing Source Audit
> Mission: Audit all existing marketing-related source, services, reports, and runtime signals

---

## Executive Summary

Mi's marketing infrastructure is **partially built but mostly blocked**. Code-level connectors exist for GSC, GA4, GBP, reviews, DoorDash, social posting, and SEO agents. However, most connectors lack live credentials, deployed tracking, or verified runtime execution. The fastest path to Marketing Intelligence Director is activating what already exists rather than building new systems.

---

## 1. Google Search Console (GSC)

| Field | Value |
|-------|-------|
| Code | `server/src/seo/google-search-console-connector.ts` (125 lines) |
| Status | **LIVE** |
| Auth | OAuth via shared `google-tokens.json` |
| Data Available | Aggregate clicks, impressions, CTR, avg position, top queries, top pages, sitemaps |
| Live Baseline | Bakudan: 587 clicks, 11,174 imp, 5.3% CTR, pos 10.8. Raw Sushi: 361 clicks, 28,736 imp, 1.3% CTR, pos 9.4 |
| Missing | Query-level export, page-level export, automated sync workflow |
| n8n Workflow | `seo-daily-audit` ✅ verified |
| Freshness | Last confirmed 2026-06-24 |
| Risk | OAuth tokens may expire without refresh |

---

## 2. Google Analytics 4 (GA4)

| Field | Value |
|-------|-------|
| Code | `server/src/seo/ga4-connector.ts` (583 lines) |
| Status | **NOT DEPLOYED** |
| Auth | OAuth via shared `google-tokens.json` (same as GSC) |
| Connector Capabilities | Traffic overview, page-level data, channel breakdown, conversion events, per-brand properties |
| Snapshot DB | `ga4-snapshots.db` — schema ready (daily traffic, pages, conversions, channels tables) |
| Missing | GA4 property not created, no `G-XXXXXXXX` tracking code on any HTML page, no property ID in `.env` |
| Unblock | CEO creates GA4 property → Mi adds gtag to 29 Bakudan + 123 Raw Sushi pages |
| Evidence | `search_files("GA4|G-X[0-9A-Z]+|gtag", "*.html")` → 0 results |

---

## 3. Google Business Profile (GBP)

| Field | Value |
|-------|-------|
| Code | `server/src/seo/gbp-connector.ts` (350 lines) |
| Status | **PARTIAL** — connector built, scope missing |
| Auth | OAuth scope `business.manage` added but tokens don't include it yet |
| Hardcoded Locations | Bakudan Ramen (`locations/13607740634521426033`), Raw Sushi (`locations/2490512`) |
| Metrics Supported | CALL_CLICKS, WEBSITE_CLICKS, DIRECTION_REQUESTS, MAP/SEARCH impressions |
| Snapshot DB | `gbp-snapshots.db` — schema ready (daily metrics + locations tables) |
| Missing | Re-authorization with `business.manage` scope, verified metric pull |
| Unblock | CEO re-authorizes at `http://localhost:4001/api/auth/google/start` |

---

## 4. Reviews

| Field | Value |
|-------|-------|
| Code — Mi-Core | `server/src/connectors/review-automation.ts` (185 lines) — AI draft responses |
| Code — Full System | `Bakudan/review-automation-system/` — FastAPI + PostgreSQL + Playwright |
| Status | **PARTIAL** — code exists, not live-verified |
| Capabilities | AI draft response (Claude Haiku), tone selection, approval queue, Google reply posting |
| Platforms | Google, DoorDash, Yelp (schema defined) |
| Daily Script | `send_daily_negative_report.py` exists |
| Auto-Reply Policy | `app/providers/` + `app/services/auto_reply_policy.py` |
| Missing | Live review pull not executed, no verified connection to GBP review API |
| Evidence | `Bakudan/review-automation-system/` in project-registry |

---

## 5. DoorDash Campaign

| Field | Value |
|-------|-------|
| Code | `Agent/doordash-compaigns/` (Node.js + SQLite + Playwright) |
| Status | **BLOCKED** — no credentials |
| Campaign DB | `campaigns.db` exists with schema (no verified live data) |
| QA Agent | `Agent/doordash-compaigns/qa-agent/` (Python) |
| Runbooks | Production pilot, rollback, selector failure runbooks exist |
| Missing | DoorDash Merchant Portal credentials, DoorDash Ads Manager access, PM2 process stopped |
| Unblock | CEO provides credentials → restart `mi-doordash-agent` PM2 |

---

## 6. SEO Agents

| Agent | Port | Status | Evidence |
|-------|------|--------|----------|
| seo-technical-agent | 4013 | REGISTERED | auto-task-engine port map |
| seo-content-agent | 4015 | REGISTERED | auto-task-engine port map |
| seo-schema-agent | 4014 | REGISTERED | auto-task-engine port map |
| seo-local-maps-agent | 4011 | REGISTERED | auto-task-engine port map |
| seo-analytics-agent | 4017 | REGISTERED | auto-task-engine port map |

All agents are registered in the auto-task-engine but runtime status is **UNKNOWN** — not verified in this audit.

---

## 7. n8n SEO Workflows

| Workflow | Status | Evidence |
|----------|--------|----------|
| seo-daily-audit | ✅ VERIFIED | workflow-logs.jsonl — completed 2026-06-24 |
| seo-weekly-executive-report | ✅ EXISTS | workflow-registry.json |
| seo-dashboard-sync | ❌ MISSING | Not found in n8n inventory |
| seo-content-opportunity-scan | ❌ MISSING | Not found in n8n inventory |

---

## 8. Social Posting

| Field | Value |
|-------|-------|
| Code | `server/src/connectors/social-posting.ts` (220 lines) |
| Platforms | GBP Posts, Facebook Page, Instagram Business |
| Status | **NOT DEPLOYED** — no tokens in env |
| Env Required | `GOOGLE_ACCESS_TOKEN`, `FB_PAGE_ACCESS_TOKEN`, `FB_PAGE_ID`, `FB_IG_USER_ID` |
| Capabilities | Broadcast post, AI content generation (Claude Haiku) |

---

## 9. Website Sources

| Website | Pages | Status | Deploy |
|---------|-------|--------|--------|
| Bakudan (bakudanramen.com) | 29 | LIVE | Cloudflare static |
| Raw Sushi (rawstockton.com) | 123 | LIVE | Cloudflare static |
| Dashboard (dashboard.bakudanramen.com) | 50+ PHP | LIVE | PHP server |

---

## 10. Landing Pages

| Brand | Pages on Disk | Status | SEO Ready |
|-------|---------------|--------|-----------|
| Bakudan | 8+ | EXISTS | Schema + FAQ + CTAs |
| Raw Sushi | 14+ | EXISTS | Stockton/Modesto targeting |

---

## 11. Content Pipeline

| Field | Value |
|-------|-------|
| Pipeline | `SEO_CONTENT_PRODUCTION_PIPELINE.md` — defined |
| Briefs | 10 article briefs ready (5 Bakudan + 5 Raw Sushi) |
| Status | PIPELINE_DEFINED — no articles drafted yet |

---

## 12. Dashboard Marketing Widgets

| Widget | Source | Status |
|--------|--------|--------|
| Traffic (GSC) | GSC aggregate | ✅ CONFIRMED |
| Traffic (GA4) | GA4 | ❌ NOT DEPLOYED |
| Revenue | QuickBooks | ⚠️ DEGRADED (stale sync) |
| Reviews | review-automation | ⚠️ CODE EXISTS, NOT LIVE |
| Campaigns | DoorDash | ❌ BLOCKED |
| GBP Local Actions | GBP API | ❌ NEEDS SCOPE |
| Conversion Events | GA4 | ❌ NOT DEPLOYED |

---

## 13. Auto-Task Engine Signals

| Signal Type | Marketing Relevant | Owner |
|-------------|-------------------|-------|
| traffic-drop | ✅ | seo-agent |
| ranking-drop | ✅ | seo-agent |
| review-drop | ✅ | review-management |
| gsc-disconnect | ✅ | analytics-agent |
| gbp-disconnect | ✅ | local-seo |
| ga4-disconnect | ✅ | analytics-agent |

---

## Summary Classification

| Status | Count | Items |
|--------|-------|-------|
| LIVE | 3 | GSC, Websites (2), n8n SEO daily audit |
| PARTIAL | 4 | GBP (scope needed), Reviews (code exists), Dashboard (some widgets), Landing Pages (on disk) |
| STALE | 1 | QuickBooks revenue data |
| NOT_DEPLOYED | 3 | GA4, Social Posting, Content Pipeline (drafts) |
| BLOCKED | 2 | DoorDash (credentials), Toast POS (no API) |
| UNKNOWN | 5 | SEO agents runtime status |

---

## What Should Route Through Executive Coordination

| Item | Reason |
|------|--------|
| GA4 deployment | Requires CEO property creation + Mi page modification |
| GBP re-authorization | Requires CEO Google account action |
| DoorDash credential provision | Requires CEO/Marketing |
| Content brief approval | Requires CEO review |
| Landing page publication | Requires CEO approval |
| Social media tokens | Requires CEO/Marketing setup |
| SEO agent health checks | Automated signal → task creation |

---

## Final Status

```text
MARKETING_SOURCE_AUDIT_COMPLETE
```
