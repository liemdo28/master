# Approval Gate — Mi GStack Layer
**Date:** 2026-06-13  
**Based on:** `src/approval/gate.ts` (existing) + GStack risk classification

---

## Principle

Mi executes autonomously up to Level 2. CEO approval is only required for actions that:
- Affect production systems
- Send external communications
- Handle money or credentials
- Cannot be automatically rolled back

CEO input = natural language only. Mi handles the rest.

---

## Risk Levels

### Level 1 — Auto-execute (no approval)
Mi does these immediately, silently, and logs to Execution Ledger.

| Action | Example |
|--------|---------|
| Read files | Scan source code |
| Search knowledge | Query Knowledge Universe |
| Run tests | Regression suite, health check |
| Audit code | Source scan, error detection |
| Create reports | Generate markdown report |
| List processes | PM2 jlist |
| Check ports | netstat scan |
| Read logs | PM2 error logs |
| Draft messages | WhatsApp reply draft |

### Level 2 — Single CEO approval
Mi proposes the action. CEO says "approve" or "cancel". Mi executes.

| Action | Example |
|--------|---------|
| Write/modify files | Patch source code |
| Create branches | Git branch + commit |
| Send draft emails | Gmail draft |
| Create tasks | Asana/Linear ticket |
| Schedule actions | Calendar event |

### Level 3 — Double CEO approval (destructive/external)
Mi presents full plan + rollback + evidence. CEO confirms twice. Mi executes with full logging.

| Action | Example |
|--------|---------|
| Production deploy | pm2 restart mi-core |
| Database changes | DROP, migration |
| Send external messages | Email send, WhatsApp to customers |
| Security changes | API key rotation, firewall |
| Financial actions | QuickBooks transaction |
| Destructive file ops | rm -rf, overwrite critical config |

---

## Approval Flow (WhatsApp)

```
Mi: ⚠️ Work Order WO-20260613-007 — kiểm tra xong.
    1 action cần anh approve:
    • Execute PM2 restart mi-core (production)
    Rollback: pm2 restart mi-core-v2 nếu có lỗi.
    
    Reply "approve WO-20260613-007" để thực thi
    hoặc "cancel" để hủy.

CEO: approve WO-20260613-007

Mi: ✅ Đã execute pm2 restart mi-core. 
    Health check: OK. Không cần rollback.
```

---

## Auto-allowed Categories (existing gate.ts)

```typescript
'read_file', 'search_file', 'scan_project', 'map_source',
'query_knowledge', 'pull_dashboard', 'pull_website',
'generate_report', 'generate_draft', 'generate_patch_proposal', 'run_qa',
'list_processes', 'check_port', 'read_log'
```

---

## CEO Approval Rate Target

| Category | Target auto-completion |
|----------|----------------------|
| Audit/check/report | 100% — no approval needed |
| Fix bug (safe) | 80% — only deploy step needs approval |
| Build feature | 60% — code change needs review |
| Deploy/rollback | 0% — always needs CEO approval |
| Overall average | 95-100% CEO requests auto-fulfilled |
