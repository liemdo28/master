# CEO_CONTROL_CENTER_MINIMUM.md
Generated: 2026-06-24T05:41:00Z

## CEO Control Center — Minimum Viable UI

**Location:** `mi-core/ui/ceo-control-center.html` (to be built)
**Status:** MISSING — currently no UI exists; CEO must use /api/chat or curl

---

## Required Pages

### 1. Ask Mi (`/ceo/ask`)
- Single text input + submit
- POST to `/api/chat`
- Display Mi reply, workflow_id, approval_id
- Show real-time reply from `ws://localhost:4001/ws`

### 2. Assign Task (`/ceo/assign`)
- Form: title, description, priority, departments
- POST to `/api/ceo/task` (NEW endpoint)
- Return task_id + approval_id
- Show "Approve / Reject" buttons

### 3. Task Status (`/ceo/tasks`)
- List all CEO tasks with status (pending / running / completed / failed)
- Filter by date, department, status
- Click task → see plan, departments, evidence, report

### 4. Company Health (`/ceo/health`)
- Live dashboard of:
  - 36 projects status (green/yellow/red)
  - 7 SEO agents status
  - n8n workflows status
  - 11 active departments
  - Recent errors / blockers

### 5. Reports (`/ceo/reports`)
- List of generated reports
- SEO daily audit, weekly executive, technical, content, schema
- Click → view / download report

### 6. Approvals (`/ceo/approvals`)
- List of pending approvals (risk_level 1-3)
- Click → see action detail
- Approve / Reject buttons
- History of past decisions

---

## Minimum Implementation

### Backend — New CEO Route

File: `mi-core/server/src/routes/ceo-router.ts`

```typescript
import { Router, Request, Response } from 'express';
import { processCEORequest } from '../execution';
import { listQueueJobs } from '../queue/job-queue';

export const ceoRouter = Router();

// POST /api/ceo/task — Submit a CEO objective
ceoRouter.post('/task', async (req: Request, res: Response) => {
  const { message, priority = 'normal' } = req.body;
  if (!message) return res.status(400).json({ error: 'message required' });
  const result = await processCEORequest(message, `ceo-api-${Date.now()}`);
  res.json({
    task_id: result.workflow_id,
    approval_id: result.approval_id,
    message,
    priority,
    status: 'submitted',
    created_at: new Date().toISOString(),
  });
});

// GET /api/ceo/task/:id — Get task status
ceoRouter.get('/task/:id', (req: Request, res: Response) => {
  // Read from execution log store
  res.json({ task_id: req.params.id, status: 'lookup_required' });
});

// GET /api/ceo/tasks — List all CEO tasks
ceoRouter.get('/tasks', async (_req: Request, res: Response) => {
  const jobs = await listQueueJobs(50);
  res.json({ count: jobs.length, tasks: jobs });
});

// GET /api/ceo/health — Company health overview
ceoRouter.get('/health', async (_req: Request, res: Response) => {
  // Aggregate from /api/projects/health + /api/seo/dashboard + /api/n8n/health
  const [projects, seo, n8n] = await Promise.all([
    fetch('http://localhost:4001/api/projects').then(r => r.json()).catch(() => ({})),
    fetch('http://localhost:4001/api/seo/dashboard').then(r => r.json()).catch(() => ({})),
    fetch('http://localhost:4001/api/n8n/health').then(r => r.json()).catch(() => ({})),
  ]);
  res.json({
    projects: { count: projects.total, health: 'scanned' },
    seo: { agents_online: seo.agents_online, total: seo.agents_total },
    n8n: n8n,
    timestamp: new Date().toISOString(),
  });
});

// GET /api/ceo/approvals — Pending approvals
ceoRouter.get('/approvals', (_req: Request, res: Response) => {
  // Read from approval/gate.ts
  res.json({ pending: [] });
});
```

### Register in index.ts
```typescript
import { ceoRouter } from './routes/ceo-router';
app.use('/api/ceo', requireAuth, ceoRouter);
```

### Frontend — Single HTML Page

File: `mi-core/ui/ceo-control-center.html`

```html
<!DOCTYPE html>
<html>
<head><title>CEO Control Center</title></head>
<body>
  <nav>
    <button onclick="showPage('ask')">Ask Mi</button>
    <button onclick="showPage('assign')">Assign Task</button>
    <button onclick="showPage('tasks')">Task Status</button>
    <button onclick="showPage('health')">Company Health</button>
    <button onclick="showPage('reports')">Reports</button>
    <button onclick="showPage('approvals')">Approvals</button>
  </nav>

  <section id="ask">
    <h1>Ask Mi</h1>
    <textarea id="ask-input" placeholder="What do you need?"></textarea>
    <button onclick="askMi()">Send</button>
    <div id="ask-reply"></div>
  </section>

  <section id="assign">
    <h1>Assign Task</h1>
    <input id="task-title" placeholder="Title">
    <textarea id="task-desc" placeholder="Description"></textarea>
    <button onclick="assignTask()">Assign</button>
    <div id="task-result"></div>
  </section>

  <section id="tasks">
    <h1>Task Status</h1>
    <div id="task-list"></div>
  </section>

  <section id="health">
    <h1>Company Health</h1>
    <div id="health-data"></div>
  </section>

  <section id="reports">
    <h1>Reports</h1>
    <div id="report-list"></div>
  </section>

  <section id="approvals">
    <h1>Pending Approvals</h1>
    <div id="approval-list"></div>
  </section>

  <script>
    async function askMi() {
      const message = document.getElementById('ask-input').value;
      const r = await fetch('/api/chat', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({message, session_id: 'ceo-ui'})
      });
      const data = await r.json();
      document.getElementById('ask-reply').innerText = JSON.stringify(data, null, 2);
    }

    async function assignTask() {
      const title = document.getElementById('task-title').value;
      const description = document.getElementById('task-desc').value;
      const r = await fetch('/api/ceo/task', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({message: `${title}: ${description}`})
      });
      const data = await r.json();
      document.getElementById('task-result').innerText = JSON.stringify(data, null, 2);
    }

    async function showPage(id) {
      document.querySelectorAll('section').forEach(s => s.style.display = 'none');
      document.getElementById(id).style.display = 'block';
    }

    showPage('ask');
  </script>
</body>
</html>
```

---

## Status: NOT IMPLEMENTED (gap to be closed in Phase C implementation)