# Auth Hotfix Report
**Date:** 2026-06-15
**Blocker:** B1 — Login permanently broken
**Result:** AUTH_BOOT_ORDER_FIXED

---

## Root Cause

`auth.ts` computes `PIN_HASH` at module-load time:
```typescript
const PIN_HASH = process.env.MI_PIN_HASH || hashPin(process.env.MI_PIN || '');
```

In the original `index.ts`, `dotenv.config()` was called at **line 111**, but `auth.ts` was `require()`'d as part of the import block at **line 16**. TypeScript/CommonJS evaluates module-level code synchronously at `require()` time. So `PIN_HASH` was computed when `process.env.MI_PIN` was still `undefined`.

Result: `PIN_HASH = hashPin('') = sha256('' + 'mi-salt-2024')` — a fixed hash that could never be produced by any valid PIN (since empty pin is rejected by "pin required" guard at request time).

After dotenv loaded at line 111, `process.env.MI_PIN = '4452'` was available — so `requireAuth` correctly enforced auth at request time. But the login endpoint compared `hashPin(pin)` against `hashPin('')`, which can never match.

## Fix Applied

**File:** `server/src/index.ts`

Moved `dotenv` import and both `.config()` calls to the very top of the file, before all other imports:

```typescript
// ── ENV MUST LOAD FIRST ─────────────────────────────────────────────────────
import dotenv from 'dotenv';
import path from 'path';
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: false });

// ── Auth boot assertion ──────────────────────────────────────────────────────
{
  const pin = process.env.MI_PIN || '';
  if (!pin && !process.env.MI_PIN_HASH) {
    console.warn('[Mi][Auth] WARNING: MI_PIN unset — auth disabled (dev mode)');
  } else if (pin) {
    console.log('[Mi][Auth] PIN configured — auth enforcement active');
  }
}

import express from 'express';
// ... all other imports follow
```

Removed the duplicate `dotenv.config()` calls that previously appeared after the import block.

## Verification

| Test | Before | After |
|------|--------|-------|
| `POST /api/auth/login` with PIN "4452" | 401 PIN không đúng | ✅ 200 + token (64 chars) |
| `GET /api/chat` without token | 401 | 401 ✅ (still enforced) |
| `GET /api/chat` with valid token | 401 | 404 ✅ (route exists, GET not found = auth passed) |
| `GET /api/approval/pending` with token | 401 | 200 ✅ |

## Startup assertion

On boot, the server now logs:
```
[Mi][Auth] PIN configured — auth enforcement active
```
If `MI_PIN` is missing from `.env`, it logs a warning instead of silently accepting any request.

---

## Certification

- DOTENV_LOADS_BEFORE_IMPORTS: ✅
- PIN_HASH_COMPUTED_WITH_CORRECT_VALUE: ✅
- LOGIN_RETURNS_VALID_TOKEN: ✅
- PROTECTED_ROUTES_BLOCK_WITHOUT_TOKEN: ✅
- **AUTH_BOOT_ORDER_FIXED: ✅**
