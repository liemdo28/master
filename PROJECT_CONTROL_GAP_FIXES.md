# PROJECT_CONTROL_GAP_FIXES.md
Generated: 2026-06-24T05:37:00Z

## CTO Directive — Phase C: Build Missing Minimums

These are the minimum viable fixes required to close the control gaps discovered in Phase A/B.

---

## C1 — CEO Task Intake API

**Gap:** No dedicated `/api/ceo/task` endpoint exists.

**Fix:** Add a new route to `mi-core/server/src/routes/`:

File: `mi-core/server/src/routes/ceo-task-router.ts`

```typescript
// POST /api/ceo/task — submit a CEO objective
// GET /api/ceo/task/:id — get task status  
// GET /api/ceo/tasks — list all CEO tasks

import { Router, Request, Response } from 'express';
import { processCEORequest } from '../execution';

export const ceoTaskRouter = Router();

ceoTaskRouter.post('/', async (req: Request, res: Response) => {
  const { message, session_id = 'ceo-api' } = req.body;
  if (!message) return res.status(400).json({ error: 'message required' });
  
  // Use existing chat processor, return structured task response
  const result = await processCEORequest(message, session_id);
  res.json({
    task_id: result.workflow_id,
    approval_id: result.approval_id,
    status: 'submitted',
    message,
    created_at: new Date().toISOString(),
  });
});

ceoTaskRouter.get('/tasks', (_req: Request, res: Response) => {
  res.json({ message: 'Task listing from execution store' });
});
```

Then register in `index.ts`:
```typescript
import { ceoTaskRouter } from './routes/ceo-task-router';
app.use('/api/ceo', ceoTaskRouter);
```

---

## C2 — bakudan-website Server Fix

**Gap:** bakudan-website server is DOWN at port 5181.

**Fix:** Restart the server:
```bash
cd E:/Project/Master/Bakudan/bakudanramen.com-current
node server/server.js &
# or via PM2 if managed:
# pm2 restart bakudan-website
```

**Then verify:**
```bash
curl http://localhost:5181/health
```

---

## C3 — Remote Project Configuration

**Gap:** integration-system and whatsapp-api remote connectors are unconfigured.

**Fix:** Add to `mi-core/.env`:
```
INTEGRATION_SYSTEM_HOST=http://<remote-host>:4001
WHATSAPP_API_HOST=http://<remote-host>:8000
```

---

## C4 — GitHub Integration

**Gap:** 0/36 projects have git remotes configured.

**Fix:** For each controlled project, initialize git and add remote:
```bash
cd E:/Project/Master/Bakudan/bakudanramen.com-current
git init
git remote add origin https://github.com/liemdo28/bakudan-website.git
git add . && git commit -m "Initial commit"
```

**Mi git operator commands to add:**
- `git branch` — list/create branches
- `git checkout -b sandbox/<task-id>` — create sandbox branch
- `git diff` — show changes
- `git add . && git commit` — commit changes
- `gh pr create` — create PR via GitHub CLI

---

## C5 — n8n API Key Configuration

**Gap:** No API key in n8n `user_api_keys` table; Basic Auth fails.

**Fix:**
1. Open n8n UI: http://localhost:5678
2. Go to Settings → API → Create API Key
3. Add to `mi-core/.env`:
```
N8N_API_KEY=<generated-key>
```
4. Update `mi-core/server/src/n8n/n8n-router.ts` to use `X-N8N-API-KEY` header:
```typescript
const N8N_API_KEY = process.env.N8N_API_KEY || '';
// In authHeaders():
return { 'X-N8N-API-KEY': N8N_API_KEY };
```

---

## C6 — SEO Data Quality

**Gap:** 0 real data records, all brands use seeded data only.

**Fix:** Configure real data connectors:
1. GSC: Add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` to SEO agents
2. GA4: Add GA4 property ID + Google Service Account JSON
3. GBP: Configure Google Business Profile API access
4. raw_sushi brand: Set status to 'active' with real domain and credentials

---

## C7 — cv-builder Initialization

**Gap:** cv-builder directory is empty.

**Fix:** Either remove from scanning or initialize the project.

---

## Priority Order

| Priority | Fix | Impact | Effort |
|----------|-----|--------|--------|
| 1 | C5: n8n API key | Unblocks n8n workflow control | 5 min |
| 2 | C1: CEO Task API | Enables structured CEO task assignment | 30 min |
| 3 | C2: bakudan-website restart | Restores live site monitoring | 2 min |
| 4 | C4: GitHub integration | Enables code change capabilities | 2 hrs |
| 5 | C3: Remote configs | Restores remote project control | 10 min |
| 6 | C6: SEO data quality | Improves SEO scores with real data | 4 hrs |
| 7 | C7: cv-builder | Clean up unused project | 5 min |
