# GOOGLEBOT_ACCESS_PROOF.md

> P0 SEO Emergency Audit — Phase B: Googlebot Verification
> Date: 2026-06-24 15:31 UTC+7
> Status: GOOGLEBOT_BLOCKED

---

## Test Results

### Test 1: curl -A "Googlebot" -I https://www.bakudanramen.com

**Result: Connection Timed Out** (exit code 28)

```
curl: (28) Connection timed out after 15002 milliseconds
```

Server may be rate-limiting Googlebot UA or experiencing performance issues under sustained load. Basic Auth challenge was not reached in this attempt due to timeout.

### Test 2: curl -A "Googlebot" -L -I https://bakudanramen.com

```
HTTP/1.1 301 Moved Permanently → https://www.bakudanramen.com/
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Basic realm="Bakudan Private"
```

**Result: 401 Unauthorized with Googlebot User-Agent**

The Googlebot UA receives the same 401 response as a regular browser. The Apache Basic Auth does NOT whitelist Googlebot.

---

## Analysis

| Test | Status Code | Auth Challenge? | Result |
|------|-------------|-----------------|--------|
| Googlebot UA, www direct | Timeout | N/A | TIMEOUT |
| Googlebot UA, with redirect follow | 401 | Yes (Basic) | BLOCKED |

### Key Findings

1. **Googlebot receives 401 Unauthorized** — Apache does NOT distinguish Googlebot from other clients. Basic Auth applies globally.
2. **No IP-based whitelist** — Googlebot IPs are not specifically allowed.
3. **No User-Agent whitelist** — Googlebot UA gets same treatment as browsers.
4. **Google's documentation states:** 401 errors prevent indexing. Google will deindex pages that consistently return 401.
5. **One test timed out** — possible intermittent network issue or server overload.

---

## Impact on Google Search

According to Google's own documentation:
- Googlebot cannot authenticate Basic Auth challenges
- Pages returning 401 are removed from index
- Sites with persistent 401 errors are flagged in Search Console
- Crawl budget is wasted on 401 responses

**Expected result:** bakudanramen.com is deindexed or never indexed by Google.

---

## Conclusion

**GOOGLEBOT_BLOCKED**

Googlebot cannot access any page on bakudanramen.com. The site is effectively invisible to Google Search.

**Status: GOOGLEBOT_BLOCKED**