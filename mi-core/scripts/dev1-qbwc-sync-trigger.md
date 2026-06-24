# Dev1 — QBWC First Sync Trigger Guide
**Date:** 2026-06-24

## What you need to do

Trigger the first QuickBooks Web Connector sync on **laptop1** so QB financial data starts flowing to Mi-Core.

## Steps

### 1. Open QuickBooks Desktop on laptop1
Make sure QuickBooks is running and a company file is open.

### 2. Open Web Connector
In QuickBooks: **File → App Management → Update Web Services**  
(or search "Web Connector" in Windows Start)

### 3. Find the Mi-Core QB Agent entry
Look for an entry with:
- URL: `http://localhost:3457/qbwc`
- App Name: something like `mi-qb-agent` or `Mi-Core QB`

### 4. Trigger sync
- Check the checkbox next to the entry
- Click **Update Selected**
- Enter password if prompted (use QB_API_KEY: `b149c4783a1109ff46d01498d91766e7`)

### 5. Confirm success
After sync completes, verify at Mi-Core:
```
curl http://100.111.97.25:3457/api/status
```
Should show last_sync timestamp updated.

## If QBWC entry doesn't exist

Run on laptop1:
```bash
curl -X POST http://localhost:3457/api/qbwc/register
```
Then repeat steps 2-5.

## After first sync

Mi-Core will have access to:
- Chart of accounts
- Invoices / payments
- P&L data
- Tax info

Mi will auto-pull every sync cycle.
