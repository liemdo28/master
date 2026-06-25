# Toast Revenue Connector — Blocker Report — Phase 34D
Date: 2026-06-25

## What Exists

File: `server/src/executive-intelligence/connectors/toast/toast-read-adapter.ts`

- Implements `FinanceReadAdapter` interface (same contract as QB, bank connectors)
- Constructor reads `TOAST_API_KEY` and `TOAST_BASE_URL` env vars
- Base URL defaults to `https://ws-api.toasttab.com` (correct Toast REST API host)
- All three data methods (`getBalanceReport`, `getProfitLoss`, `getRecentTransactions`) are stubbed — they throw or return empty
- `getHealthStatus()` returns `connected: false` when `TOAST_API_KEY` is missing

## Credential Gap

`.env.example` contains:
```
TOAST_EMAIL=hoangdle@gmail.com
TOAST_PASSWORD=B@kudan@2
```

These are **POS login credentials** (Toast web portal login), not API credentials.

The Toast REST API (`ws-api.toasttab.com`) requires:
- `TOAST_CLIENT_ID` — OAuth client ID from Toast Developer portal
- `TOAST_CLIENT_SECRET` — OAuth client secret
- `TOAST_RESTAURANT_GUID` — the restaurant's unique GUID
- `TOAST_API_KEY` — bearer token obtained via OAuth flow

None of these are present in `.env.example` or the adapter code.

## What Data Would Be Available (once unblocked)

Toast REST API v2 provides:
- Orders endpoint — net sales, order count, payment types by date range
- Labor endpoint — shift hours, labor cost
- Menu items — item-level revenue breakdown
- Void/discount reports

All of this maps cleanly to `getProfitLoss()` and `getRecentTransactions()` in the adapter.

## Current Blocker

**Missing Toast API developer credentials.** Email/password cannot substitute for OAuth client credentials.

## Next Action

1. Go to [https://developer.toasttab.com](https://developer.toasttab.com) and create a developer account
2. Register an application → get `client_id` and `client_secret`
3. Add `TOAST_CLIENT_ID`, `TOAST_CLIENT_SECRET`, `TOAST_RESTAURANT_GUID` to `.env`
4. Implement OAuth token fetch in `toast-read-adapter.ts` constructor
5. Implement `getProfitLoss()` using `GET /orders/v2/orders?startDate=&endDate=`
6. Add `GET /api/toast/revenue` route to mi-core and mount in `index.ts`

## Connector Status

**TOAST_BLOCKED — missing API credentials**

The adapter skeleton is correct and ready for implementation. No route has been added to mi-core because there is no working data source to back it.
