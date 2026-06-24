# DOORDASH API UNBLOCK PLAN
**Date:** 2026-06-24  
**Current Status:** API_BLOCKED

## Why It's Blocked

DoorDash does not have a public merchant API. Access requires applying through the **DoorDash Drive** or **DoorDash Merchant** developer program.

## Steps to Unblock

### Step 1 — Apply for DoorDash Merchant API
1. Go to: https://developer.doordash.com/en-US/
2. Click "Get Started" → "Merchant"
3. Fill in business info (Bakudan Ramen + Raw Sushi Bar)
4. Select use case: **Order Management / Analytics**

### Step 2 — Wait for approval
- Typical wait: 2-5 business days
- DoorDash will email credentials: `developer_id`, `key_id`, `signing_secret`

### Step 3 — Add to .env
```
DOORDASH_DEVELOPER_ID=...
DOORDASH_KEY_ID=...
DOORDASH_SIGNING_SECRET=...
```

### Step 4 — Mi will auto-activate connector
Once env vars are set, restart mi-core:
```
pm2 restart mi-core --update-env
```
Connector at `GET /api/bigdata/connectors/doordash/status` will go from `API_BLOCKED` → `LIVE_READ_PASS`.

## What Mi will pull once active
- Order volume per location
- Revenue by day/week
- Average order value
- Menu item performance
- Customer ratings

## Current Workaround
DoorDash data visible in:
- DoorDash Merchant Portal (manual)
- Toast POS (if orders synced via Toast)

## Status: CEO_ACTION_REQUIRED — Apply at developer.doordash.com
