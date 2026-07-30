# SEO_GOOGLE_ACCESS_REMEDIATION_PLAN.md

> P0 SEO Emergency Audit — Phase H: Remediation
> Date: 2026-06-24 15:36 UTC+7
> Status: FIX_AVAILABLE

---

## The Fix: Remove or Restrict Basic Auth

### Option A: Remove Auth Entirely (RECOMMENDED)

**What to change:**
Delete lines 1-4 from `.htaccess`:

```diff
- AuthType Basic
- AuthName "Bakudan Private"
- AuthUserFile /home/dh_d5ng5e/rim.bakudanramen.com/.htpasswd
- Require valid-user
```

**Where to change:**
File: `bakudanramen.com-current/.htaccess`
Lines: 1-4
PR: Merge to `fix/seo-404-pages-phase23` or create new PR

**Risk: LOW**
- Public restaurant website should be public
- Auth was likely a staging artifact
- No legitimate reason to block public access to a restaurant website

**Rollback:**
Restore lines 1-4 to `.htaccess` and redeploy.

**Expected SEO impact:**
- Googlebot can crawl immediately
- Pages begin indexing within days
- Traffic growth begins within 2-4 weeks
- First crawl evidence within 24-48 hours

---

### Option B: Whitelist Googlebot Only (ALTERNATIVE)

**What to change:**
Add conditional auth before lines 1-4:

```apache
# Allow Googlebot
SetEnvIf User-Agent "Googlebot" allow_googlebot
SetEnvIf User-Agent "Googlebot-Image" allow_googlebot
SetEnvIf User-Agent "AdsBot-Google" allow_googlebot
SetEnvIf Remote_Addr "^66.249" allow_googlebot
SetEnvIf Remote_Addr "^74.125" allow_googlebot

Order Deny,Allow
Deny from all
Allow from env=allow_googlebot
Satisfy any
```

Then keep AuthType Basic on lines 1-4.

**Risk: MEDIUM**
- IP ranges can change
- More complex to maintain
- Still blocks other search engines (Bing, DuckDuckGo)

**Rollback:**
Remove the SetEnvIf block and keep auth.

**Expected SEO impact:**
- Googlebot can crawl
- Same as Option A but with more maintenance burden

---

## Action Plan

### Immediate (CEO Decision Today)

| Step | Owner | Action | Time |
|------|-------|--------|------|
| 1 | CEO | Decide: Option A or Option B | Decision |
| 2 | Dev | Edit .htaccess per decision | 15 min |
| 3 | Dev | Test locally | 10 min |
| 4 | CEO | Approve PR | CEO approval |
| 5 | Dev | Deploy to Dreamhost | 10 min |
| 6 | Mi | Trigger re-crawl | 30 sec |

### Short-term (This Week)

| Step | Owner | Action |
|------|-------|--------|
| 7 | Dev | Create robots.txt (missing) |
| 8 | Dev | Create sitemap.xml (missing) |
| 9 | Dev | Add location rewrites to .htaccess |
| 10 | Dev | Submit sitemap to GSC |

### Medium-term (Next 2 Weeks)

| Step | Owner | Action |
|------|-------|--------|
| 11 | Mi | Monitor crawl results via GSC |
| 12 | Mi | Verify pages indexed |
| 13 | Dev | Deploy 8 landing pages if not merged |
| 14 | Mi | Report index coverage |

---

## Immediate Fix (One-Line Change)

**Remove lines 1-4 from .htaccess.**

The simplest, lowest-risk fix. Bakudanramen.com is a public restaurant website. It should not have Basic Auth.

---

## Certification

| Check | Status |
|-------|--------|
| Exact changes documented | YES |
| File + line numbers | YES |
| Risk assessment | YES |
| Rollback plan | YES |
| Expected SEO impact | YES |
| Action plan | YES |

**Status: FIX_AVAILABLE**
