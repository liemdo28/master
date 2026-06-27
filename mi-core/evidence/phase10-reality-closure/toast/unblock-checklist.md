# Toast Operational Unblock Checklist

**Generated:** 2026-06-27T07:00:00Z
**Phase:** 10.3 Final Connector Closure

## Current Status: BLOCKED

No Toast REST endpoint exists in mi-core.
No `TOAST_API_KEY` configured.
No Toast connector entry in visibility API.
No human-approved live access proof.

## Unblock Options (CEO must choose ONE)

### Option A: Provide Toast API Key (Preferred)
**Action:** CEO provides `TOAST_API_KEY` in mi-core/.env

**Steps:**
1. CEO obtains Toast API key from Toast Developer Portal
2. CEO adds `TOAST_API_KEY=your_key_here` to `D:\Project\Master\mi-core\.env`
3. Dev1 creates `GET /api/toast/status` endpoint in mi-core (if not exists)
4. Verify: `curl http://localhost:4001/api/toast/status` returns 200
5. Collect: login proof, account visibility proof, sales/report availability

**Evidence Required:**
- `evidence/phase10-reality-closure/toast/login-proof.json`
- `evidence/phase10-reality-closure/toast/account-visibility-proof.json`
- `evidence/phase10-reality-closure/toast/access-approval-proof.md`

### Option B: Formal Exclusion Approval
**Action:** CEO signs this checklist as formal exclusion approval

**Evidence Required:**
- CEO signature on this document
- Statement: "Toast is formally excluded from MI_COMPANY_OS_OPERATIONAL scope"

### Option C: Human-Approved Playwright Login
**Action:** CEO provides login credentials and write-blocking confirmation

**Constraints:**
- No budget changes
- No menu edits
- No order edits
- Only read-only screenshot capture

## Required Before TOAST_CERTIFIED

1. Toast API key in .env OR formal exclusion approval
2. GET /api/toast/status returns 200
3. Login proof captured
4. Account visibility proof captured
5. Human approval documented

## Owner: CEO

No automated path available. CEO action required.
