# Deploy DoorDash Agent — Laptop1

**Date:** 2026-06-24  
**Target machine:** Laptop1 (100.111.97.25)  
**Port:** 3460

## Why Laptop1

DoorDash Merchant Portal requires 2FA on new devices. Laptop1 already has trusted sessions. Running the scraper there avoids 2FA.

## Steps for Dev1

### 1. Copy the service to Laptop1

From mi-core-primary, copy the folder:
```
E:\Project\Master\mi-core\services\doordash-agent\
```
To Laptop1 at:
```
C:\mi-agents\doordash-agent\
```

Or via git — the service is committed to mi-core repo.

### 2. Install dependencies on Laptop1

```bash
cd C:\mi-agents\doordash-agent
npm install
npx playwright install chromium
```

### 3. Create .env on Laptop1

```
MI_CORE_URL=http://100.119.17.30:4001
DD_AGENT_PORT=3460
NODE_ENV=production
```

(Replace `100.119.17.30` with the Tailscale IP of mi-core-primary)

### 4. Start with PM2

```bash
pm2 start src/index.js --name mi-doordash-agent
pm2 save
```

### 5. Verify

```bash
curl http://localhost:3460/health
```

Expected:
```json
{"status":"ok","running":false,"accounts":4}
```

### 6. Trigger first scrape

```bash
curl -X POST http://localhost:3460/scrape
# Wait 2 minutes
curl http://localhost:3460/metrics
```

### 7. Report back

Send the output of `curl http://localhost:3460/metrics` to Mi-Core CEO.

## Mi-Core side

Update `.env` on mi-core-primary:
```
DD_AGENT_URL=http://100.111.97.25:3460
```

Then restart mi-core:
```
pm2 restart mi-core --update-env
```

Mi-Core will proxy DoorDash metrics through `GET /api/doordash/metrics`.
