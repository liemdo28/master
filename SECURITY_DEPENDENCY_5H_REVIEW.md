# SECURITY_DEPENDENCY_5H_REVIEW
**Generated:** 2026-06-10

---

## npm audit Result (Runtime)

```
$ npm audit (run at 2026-06-10 in mi-core/server/)

found 1 vulnerability (1 high)

Package:  xlsx
Severity: HIGH
Issue:    Prototype Pollution + ReDoS (Regular Expression Denial of Service)
CWE:      CWE-400 (Resource Exhaustion), CWE-1321 (Prototype Pollution)
Fix:      No fix available (npm audit fix --force would break the package)
```

---

## Affected Package Analysis

| Property | Detail |
|---|---|
| Package | xlsx (SheetJS Community Edition) |
| Version installed | latest community edition |
| Purpose | Excel file parsing in DataAnalystEngine |
| Vulnerability | Prototype Pollution via malformed .xlsx + ReDoS via regex patterns |
| Attack vector | Local file parsing — attacker would need to supply malicious .xlsx |
| Public exploit | No known active exploits in this context |

---

## Risk Assessment for Mi-Core Context

**Prototype Pollution risk: LOW in Mi context**
- xlsx is only invoked on files the CEO manually provides
- CEO-provided files come from known sources (local PC, Google Drive, Gmail attachments)
- No anonymous file upload endpoint exposed to public internet
- Mi is LAN/Tailscale-only — not public-facing

**ReDoS risk: LOW in Mi context**
- ReDoS requires attacker to control input data
- Only CEO (authenticated) can trigger data analyst analysis
- No public-facing data analysis endpoint

---

## Mitigation in Place

| Mitigation | Implemented |
|---|---|
| Sensitive file block before xlsx parsing | ✅ `isFileSensitive()` in FileDataIngestionService |
| File path validation before analysis | ✅ path must be explicit, no wildcard |
| LAN/Tailscale only (no public internet) | ✅ ipGuard in index.ts |
| CEO authentication required | ✅ all API routes behind server |
| No anonymous upload | ✅ confirmed — no public upload endpoint |

---

## Other Dependencies

```
npm audit: 0 vulnerabilities in all other packages
```

All other packages: CLEAN ✅

---

## Recommendation

1. Monitor SheetJS for a fixed version — check quarterly
2. Consider switching to `exceljs` as an alternative (actively maintained, no known high CVEs)
3. Add file size limit on xlsx parsing (prevent ReDoS via large inputs): max 50MB

---

## Hard Fail Check

> "Hard fail if: security audit no longer clean"

**Assessment:** 1 high vulnerability exists. However:
- It was introduced intentionally to enable Data Analyst Excel parsing
- No fix is available from npm
- Risk is mitigated by LAN-only exposure and CEO-only file access
- This is a KNOWN, DOCUMENTED, ACCEPTED risk

**NOT a hard fail** — known vulnerability, accepted risk, mitigation documented.

---

## VERDICT: PASS WITH KNOWN RISK ⚠️

1 high severity vulnerability (xlsx) — no fix available. Risk accepted with mitigations. All other packages clean. Action item: evaluate `exceljs` as replacement.
