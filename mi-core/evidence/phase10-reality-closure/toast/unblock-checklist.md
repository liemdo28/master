# Toast Unblock Checklist

**Generated:** 2026-06-27T09:03:00Z
**Status:** TOAST_BLOCKED — unblock path documented

## Current Blocker

No Toast API access has been provided. No `TOAST_API_KEY` is configured. The Toast connector is a placeholder only.

---

## Unblock Checklist for CEO

- [ ] 1. Log in to [Toast Admin Dashboard](https://toasttab.com/) as a restaurant admin
- [ ] 2. Navigate to: Settings → Developer → API Keys
- [ ] 3. Click "Create API Key"
- [ ] 4. Set scope to: `READ ONLY` (no orders, no menu, no POS actions)
- [ ] 5. Set permissions to: `restaurants.read` and `orders.read` only
- [ ] 6. Copy the generated API key
- [ ] 7. Identify the restaurant GUID for Raw Japanese Bistro and Sushi Bar
      (from Toast dashboard URL: `/restaurants/{GUID}/overview`)
- [ ] 8. Provide the following to CTO:
      - `TOAST_API_KEY` = [key from step 6]
      - `TOAST_RESTAURANT_GUID` = [GUID from step 7]
- [ ] 9. CTO will configure in `mi-core/.env`:
      ```
      TOAST_API_KEY=your_key_here
      TOAST_RESTAURANT_GUID=your_guid_here
      ```
- [ ] 10. CTO will test with: `curl -s http://localhost:4001/api/toast/health`
- [ ] 11. Verify account visibility: `curl -s http://localhost:4001/api/toast/accounts`

---

## CTO Checklist After CEO Provides Credentials

- [ ] 1. Add TOAST_API_KEY to mi-core/.env
- [ ] 2. Add TOAST_RESTAURANT_GUID to mi-core/.env
- [ ] 3. Create `/api/toast/health` endpoint in mi-core if not exists
- [ ] 4. Create `/api/toast/accounts` endpoint in mi-core if not exists
- [ ] 5. Run `node tests/phase10-company-os-operational-runtime-test.mjs`
- [ ] 6. Verify: `GET /api/toast/health` returns 200
- [ ] 7. Verify: `GET /api/toast/accounts` returns restaurant list
- [ ] 8. Update `TOAST_OPERATIONAL_CERTIFICATION.md` to TOAST_PARTIAL or TOAST_CERTIFIED
- [ ] 9. Run validation: `git add . && node tests/phase10-company-os-operational-runtime-test.mjs`

---

## Alternative: Formal Exclusion

If Toast POS integration is not required:
- [ ] CEO signs exclusion approval: `TOAST_EXCLUSION_APPROVAL.md`
- [ ] Status set to `TOAST_EXCLUDED` (not BLOCKED)
- [ ] QB remains the source of truth for restaurant financials
- [ ] Toast connector removed from connector registry

---

## Estimated Time to Unblock

- If CEO provides credentials: 15 minutes (CTO configuration + testing)
- If exclusion is chosen: 5 minutes (CEO signs document)
