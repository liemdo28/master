# Agent OS - Permission & Capability Model

## Permission Scopes

Agent OS chia quyền theo 3 cấp để kiểm soát Agent Worker:

### Level 1 — Local Worker (Default)

| Permission | Description | Status |
|------------|-------------|--------|
| `filesystem:read` | Đọc mọi file trên PC | ✅ Allowed |
| `filesystem:write` | Ghi file trong E:\Project\Master | ✅ Allowed |
| `filesystem:write:strict` | Ghi file ngoài E:\Project\Master | ⛔ Denied |
| `filesystem:delete` | Xoá file | ⛔ Denied |
| `git:read` | Git status, log, diff | ✅ Allowed |
| `git:write` | Git add, commit (local) | ✅ Allowed |
| `git:push` | Git push | ⛔ Denied |
| `apps:open` | Mở ứng dụng whitelist | ✅ Allowed |
| `scripts:run` | Chạy script đã approve | ✅ Allowed |
| `cline:control` | Điều khiển Cline/Antigravity | ⛔ Denied |

### Level 2 — Dev Executor

| Permission | Description | Status |
|------------|-------------|--------|
| `git:push` | Git push (sau khi tạo CHANGE_SUMMARY.md) | ✅ Allowed |
| `cline:control` | Kích hoạt Cline/Antigravity | ✅ Allowed |
| `api:proxy` | Chạy API proxy | ✅ Allowed |
| `qa:run` | Chạy QA test (Playwright/Cypress) | ✅ Allowed |
| `build:run` | Build/deploy project | ✅ Allowed |
| `deploy:staging` | Deploy lên staging | ✅ Allowed |
| `deploy:production` | Deploy production | ⛔ Denied |
| `cloud:*` | Cloud access | ⛔ Denied |

### Level 3 — Cloud Operator

| Permission | Description | Status |
|------------|-------------|--------|
| `cloud:gmail` | Gmail access | 🔐 Requires separate token |
| `cloud:email` | Email SMTP | 🔐 Requires separate token |
| `cloud:dreamhost` | DreamHost panel | 🔐 Requires separate token |
| `cloud:cloudflare` | Cloudflare DNS | 🔐 Requires separate token |
| `cloud:gdrive` | Google Drive | 🔐 Requires separate token |
| `cloud:github` | GitHub API | 🔐 Requires separate token |
| `dns:change` | Thay đổi DNS | ⛔ Requires CEO approval |
| `db:production` | Thay đổi production DB | ⛔ Requires CEO approval |

---

## Approved App Whitelist

### ✅ Allowed Apps
```
VS Code
Cursor
Chrome
Edge
Firefox
Terminal / Windows Terminal
Git Bash
Docker Desktop
GitHub Desktop
Postman
npm / node
Python
```

### ⛔ Blocked Apps
```
WhatsApp
Viber
Zalo
Telegram
Discord
Skype
```

---

## Dangerous Actions (Require CEO Approval)

| Action | Permission Required | Approval |
|--------|---------------------|----------|
| Xoá file/folder | `filesystem:delete` | CEO only |
| Git push to main | `git:push` | CEO + CHANGE_SUMMARY.md |
| Deploy production | `deploy:production` | CEO only |
| Thay đổi DNS | `dns:change` | CEO only |
| Gửi email | `cloud:email` | CEO only |
| Thay đổi DB | `cloud:dreamhost` | CEO only |
| Xoá cloud resource | `cloud:*` | CEO only |

---

## Permission Enforcement

### Trong Task Handler

```typescript
// Check permission before dangerous action
function requirePermission(permission: string, task: Task): boolean {
  const workerLevel = task.workerLevel || 'L1';
  const levelPermissions = PERMISSION_LEVELS[workerLevel];
  
  if (levelPermissions[permission] === '✅ Allowed') {
    return true;
  }
  
  if (levelPermissions[permission] === '⛔ Denied') {
    throw new Error(`Permission denied: ${permission}. Requires CEO approval.`);
  }
  
  if (levelPermissions[permission] === '🔐 Requires separate token') {
    throw new Error(`Permission ${permission} requires Level 3 token.`);
  }
  
  return false;
}
```

### Audit Log

Mọi action đều được log:

```json
{
  "timestamp": "2026-06-01T17:00:00Z",
  "workerId": "worker-123",
  "taskId": "task-456",
  "action": "git:push",
  "permission": "git:push",
  "status": "denied",
  "reason": "Requires CEO approval",
  "level": "L1"
}
```

---

## CEO Override

CEO có thể approve dangerous action bằng cách:

1. Thêm `force: true` vào task payload
2. Hoặc approve qua dashboard
3. Hoặc set worker level cao hơn

---

## Quick Reference

```
┌─────────────────────────────────────────────────────┐
│  Level 1 (Local Worker)                             │
│  ✅ Read/Write E:\Project\Master                    │
│  ✅ Git local (status, pull, commit)                │
│  ✅ Run approved scripts                            │
│  ✅ Open approved apps                              │
│  ❌ Delete files                                    │
│  ❌ Git push                                        │
│  ❌ Open blocked apps                               │
├─────────────────────────────────────────────────────┤
│  Level 2 (Dev Executor)                             │
│  ✅ Everything in L1                                │
│  ✅ Git push (with CHANGE_SUMMARY.md)               │
│  ✅ Control Cline/Antigravity                       │
│  ✅ Start API proxy                                │
│  ✅ Run QA/build/deploy tasks                      │
│  ❌ Deploy to production                            │
│  ❌ Cloud access                                   │
├─────────────────────────────────────────────────────┤
│  Level 3 (Cloud Operator)                           │
│  ✅ Everything in L2                                │
│  ✅ Gmail/Email (with token)                        │
│  ✅ DreamHost (with token)                         │
│  ✅ Cloudflare (with token)                        │
│  ❌ DNS changes (CEO only)                         │
│  ❌ Production DB changes (CEO only)               │
└─────────────────────────────────────────────────────┘
```
