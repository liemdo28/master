# HARDCODED SECRET AUDIT

**Date:** 2026-06-15
**Target:** `mi-core-secret-2026`

## 1. Existence Check

- **Search Result:** Found.
- **File Location:** `server/src/middleware/rate-limit.ts` (Line 9).
- **Code Evidence:** `return process.env.MI_CORE_API_KEY || 'mi-core-secret-2026';`

## 2. Source Code Analysis

- **File Count:** 1 occurrence found in the codebase (hardcoded fallback).
- **Runtime Usage:** The `internalKey()` function provides a default fallback value if the environment variable `MI_CORE_API_KEY` is not set. This key is used to bypass rate limiting for internal Jarvis API calls.
- **Security Impact:** **HIGH**. Hardcoded secrets in source code are a security violation. If the repository is shared or leaked, the secret is compromised.

## 3. Runtime Environment

- **File `.env.example`:** The variable `MI_CORE_API_KEY` is documented as the preferred way to set this value.
- **Current Status:** The code currently defaults to the hardcoded value, which is active in production if the env var is missing.

## 4. Remediation

- **Replace with env?** **YES**.
- **Action Required:** Remove the hardcoded fallback `'mi-core-secret-2026'`. The system should fail-safe (reject requests) if the key is not configured, rather than falling back to a known constant.

## Verdict: CONFIRMED

The secret `mi-core-secret-2026` exists as a hardcoded fallback in the source code.
