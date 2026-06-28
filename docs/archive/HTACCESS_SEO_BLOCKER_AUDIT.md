# HTACCESS_SEO_BLOCKER_AUDIT.md

> P0 SEO Emergency Audit — Phase E: .htaccess Investigation
> Date: 2026-06-24 15:32 UTC+7
> Status: BLOCKER_SEO_CRITICAL

---

## .htaccess Location

**File:** `Bakudan/bakudanramen.com-current/.htaccess`
**Live path (from AuthUserFile):** `/home/dh_d5ng5e/rim.bakudanramen.com/.htpasswd`

---

## Auth Rules Found

| Line | Rule | Purpose | Impact |
|------|------|---------|--------|
| 1 | `AuthType Basic` | Enable HTTP Basic Auth | BLOCKS ALL UNAuthenticated requests |
| 2 | `AuthName "Bakudan Private"` | Auth realm label | Browser prompt text |
| 3 | `AuthUserFile /home/dh_d5ng5e/rim.bakudanramen.com/.htpasswd` | Password file path | Validates credentials |
| 4 | `Require valid-user` | Only authenticated users allowed | BLOCKS Googlebot, visitors, crawlers |

---

## Scope of Block

The auth rules apply to ALL URLs on the domain because:
1. There is no `<Files>` or `<Location>` directive limiting scope
2. There is no conditional rule (no `SetEnvIf`, no IP check)
3. No User-Agent exception exists
4. No Googlebot IP whitelist exists
5. The rules are at the root of the Apache config

**Effect:** Every HTTP request to bakudanramen.com and www.bakudanramen.com must provide valid credentials from the .htpasswd file or receive 401.

---

## What the Auth Was Designed For

The auth appears designed to protect the staging/development version of the site from public access. The `.htpasswd` path references `rim.bakudanramen.com` — suggesting it was originally intended for a subdomain or staging environment.

**The auth is blocking the PRODUCTION domain.**

---

## Other .htaccess Rules

After the auth block, SEO 404 fix rules exist (lines 6-24):

| Lines | Rule | Purpose | Status |
|-------|------|---------|--------|
| 6-7 | SEO 404 Fix header | Comment | OK |
| 8 | `Options +FollowSymlinks` | Apache allow | OK |
| 9 | `RewriteEngine On` | Enable mod_rewrite | OK |
| 12-19 | Clean URL rewrites | /about → /about.html | Deployed but moot (auth blocks) |
| 22-24 | Missing page redirects | /gift-cards → /order | Deployed but moot (auth blocks) |

**The 404 fix rules are correct but ineffective because auth blocks access before rewrite evaluation matters.**

---

## Root Cause of SEO Block

The auth rules (lines 1-4) are positioned BEFORE any rewrite rules. Apache evaluates them first and returns 401 before any RewriteRule is processed.

---

## Conclusion

**BLOCKER_SEO_CRITICAL**

File path: `Bakudan/bakudanramen.com-current/.htaccess`
Lines: 1-4
Rule: `AuthType Basic` + `Require valid-user`
Purpose: Staging protection on production domain
Impact: Googlebot, all visitors, and all crawlers receive 401

**Status: BLOCKER_SEO_CRITICAL**
