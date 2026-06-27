# Toast Access Approval Proof

**Captured:** 2026-06-27T09:02:00Z
**Phase:** 10.3 Connector Closure

## Status: NOT PROVIDED

The CEO has not provided Toast POS API access credentials (TOAST_API_KEY) as of 2026-06-27T09:02:00Z.

## What We Need From CEO

1. **TOAST_API_KEY** — Toast REST API authentication key
2. **Toast restaurant GUID** — the specific restaurant GUID for Raw Japanese Bistro and Sushi Bar
3. **Approval to use read-only scope** — for sales/reports visibility without mutation capabilities

## What's Available Without Toast Credentials

- Toast POS Manager Background scheduled task is referenced in QB sync runner
- Toast connector framework exists in mi-core (TOAST_CONNECTOR placeholder)
- No live Toast data is available

## How to Provide Access

CEO should:
1. Log in to https://toasttab.com/ as an admin
2. Navigate to Developer → API Keys
3. Generate a read-only API key
4. Provide the key plus the restaurant GUID to the CTO/CTO team
5. CTO will configure it in mi-core/.env

## Alternative

If CEO does not have Toast API access or prefers to exclude Toast:
1. CEO should sign an exclusion approval document
2. Toast will remain BLOCKED
3. mi-core will continue to use QB as the source of truth for restaurant financials
