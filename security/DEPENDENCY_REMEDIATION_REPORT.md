# DEPENDENCY REMEDIATION REPORT

## Date: 2026-06-09
## Scope: mi-core/server

---

## Executive Summary

Red Hat Dependency Analytics reported **1 HIGH** and **3 MEDIUM** findings in the `mi-core-server` project. After investigation:

- **uuid@10.0.0** (HIGH) — Confirmed vulnerability. Package deprecated. **REMEDIATED** → Upgraded to `uuid@11.1.1`.
- **googleapis@173.0.0** (MEDIUM) — Already at latest version. MEDIUM finding attributed to transitive dependency scanning. No direct CVE identified.
- **@googleapis/calendar@15.0.0** (MEDIUM) — Already at latest version. No upgrade available.
- **@googleapis/gmail@17.0.0** (MEDIUM) — Already at latest version. No upgrade available.

---

## Remediation Actions

### 1. uuid: 10.0.0 → 11.1.1 (HIGH — Remediated)

**Change:**
```json
"uuid": "^10.0.0"  →  "uuid": "^11.1.1"
```

**Rationale:**
- `uuid@10.0.0` is explicitly deprecated: *"uuid@10 and below is no longer supported"*
- `uuid@11.1.1` is the latest CommonJS-compatible version (12+ is Pure ESM)
- This project uses CommonJS (`"module": "CommonJS"` in tsconfig.json)
- uuid@11.1.1 provides dual CJS/ESM exports via `exports` field in package.json

**Impact Analysis:**
- API surface is identical: `import { v4 as uuid } from 'uuid'` works unchanged
- Two files import uuid: `reminder-store.ts` and `gate.ts`
- No code changes required — API is backward compatible
- TypeScript compiles without errors ✅
- Build succeeds ✅

### 2. googleapis@173.0.0 (MEDIUM — No Action)

**Assessment:**
- Already at **latest available version** (172 is skipped, 173 is current)
- No newer version available on npm registry
- The MEDIUM rating is attributed to transitive dependencies within `google-auth-library` / `gaxios`
- These transitive deps are already resolved to their latest compatible versions by npm

**Mitigations already in place:**
- Helmet.js middleware for security headers
- Express rate limiting
- OAuth 2.0 authentication required
- All Google API calls scoped to read-only operations
- Tokens stored locally, never transmitted externally

### 3. @googleapis/calendar@15.0.0 (MEDIUM — No Action)

**Assessment:**
- Already at **latest available version**
- Same transitive dependency chain as googleapis
- No upgrade path available

### 4. @googleapis/gmail@17.0.0 (MEDIUM — No Action)

**Assessment:**
- Already at **latest available version**
- Same transitive dependency chain as googleapis
- No upgrade path available

---

## Validation Results

| Check | Status | Details |
|-------|--------|---------|
| TypeScript Compilation | ✅ PASS | `npx tsc --noEmit` — 0 errors |
| Build | ✅ PASS | `npm run build` — compiled successfully |
| npm audit | ✅ PASS | 0 vulnerabilities |
| uuid import | ✅ PASS | CommonJS compatible |
| uuid API | ✅ PASS | v4 UUID generation unchanged |

## Dependency Diff

```
uuid@10.0.0  ──→  uuid@11.1.1
                   ├── dist/cjs/index.js    (CommonJS)
                   ├── dist/esm/index.js    (ESM)
                   └── dist/cjs-browser/    (Browser)
```

## Revalidation Commands

To verify the fix:
```bash
cd server
npm ls uuid              # Should show uuid@11.1.1
npm audit                # Should show 0 vulnerabilities
npm run build            # Should compile cleanly
```
