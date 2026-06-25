# Deploy QB SOAP Server — Laptop1

**Date:** 2026-06-24  
**What changed:** qb-ops-agent now has a SOAP/HTTP server on port 3457 for QBWC

## Steps for Dev1

### 1. Pull latest source

On Laptop1, update the qb-ops-agent source (or copy dist/ folder from mi-core-primary):

```
E:\Project\Master\mi-core\services\qb-ops-agent\dist\
```

Copy to wherever qb-ops-agent lives on Laptop1, e.g.:
```
C:\mi-agents\qb-ops-agent\dist\
```

### 2. Install new dependency (express)

```bash
cd C:\mi-agents\qb-ops-agent
npm install
```

### 3. Restart the agent

```bash
pm2 restart mi-qb-agent
```

Or if not using PM2:
```bash
node dist/index.js
```

### 4. Verify SOAP server is running

```bash
curl http://localhost:3457/api/status
```

Expected:
```json
{"status":"ok","qbwc_port":3457,"last_sync":null,"requests_received":0}
```

```bash
curl http://localhost:3457/qbwc?wsdl
```

Should return XML WSDL document.

### 5. Point QBWC to this endpoint

In QuickBooks Web Connector:
- **App URL:** `http://localhost:3457/qbwc`
- **Username:** `mi-qb-agent` (or whatever is in QBWC config)
- **Password:** `b149c4783a1109ff46d01498d91766e7`

Click **Update Selected** to trigger first sync.

### 6. Confirm sync success

```bash
curl http://localhost:3457/api/status
```

`last_sync` should show a recent timestamp. `requests_received` should be 3 (accounts + sales receipts + invoices).

### 7. Report back

Send output of step 6 to Mi-Core.

## What Mi pulls from QB each sync

1. Chart of accounts (income + expense)
2. Sales receipts — last 30 days
3. Invoices — last 30 days

Data stored at: `C:\mi-agents\qb-ops-agent\data\qb-raw-data.json`
