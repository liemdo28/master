# Agent OS - Git Access Layer

## Overview

Quản lý Git operations với permission checking và audit logging.

## Git Operations by Permission Level

### Level 1 (Local Worker)

| Operation | Command | Status |
|-----------|---------|--------|
| Status | `git status` | ✅ |
| Log | `git log` | ✅ |
| Diff | `git diff` | ✅ |
| Branch | `git branch` | ✅ |
| Remote | `git remote -v` | ✅ |
| Show | `git show` | ✅ |
| Fetch | `git fetch` | ✅ |
| Pull | `git pull` | ✅ |
| Add | `git add` | ✅ |
| Commit | `git commit` | ✅ |
| Checkout | `git checkout` | ✅ |
| Push | `git push` | ❌ |

### Level 2 (Dev Executor)

| Operation | Command | Status |
|-----------|---------|--------|
| Push | `git push` | ✅ (requires CHANGE_SUMMARY.md) |
| Force Push | `git push --force` | ⛔ |
| Push to main | `git push origin main` | ⛔ |

### Level 3 (Cloud Operator)

All Level 2 operations + cloud Git hosting.

---

## CHANGE_SUMMARY.md Requirement

Trước khi `git push`, Agent phải tạo file `CHANGE_SUMMARY.md`:

```markdown
# Change Summary

## Task
Audit E:\Project\Master

## Changes Made
- Added source audit feature
- Enhanced project discovery
- Improved log streaming

## Files Changed
- src/audit.ts
- src/discovery.ts
- src/logging.ts

## Testing
- ✅ Unit tests pass
- ✅ Integration tests pass

## Approval
- [ ] CEO Approved

## Timestamp
2026-06-01T17:00:00Z
```

## Handler Implementation

```typescript
export async function handleGitSync(task: any) {
  const { project, payload } = task;
  const operations = payload?.operations || ['status'];
  const results: any = {};
  
  for (const op of operations) {
    switch (op) {
      case 'status':
        results.status = await gitStatus(project);
        break;
        
      case 'pull':
        results.pull = await gitPull(project);
        break;
        
      case 'fetch':
        results.fetch = await gitFetch(project);
        break;
        
      case 'log':
        results.log = await gitLog(project, 10);
        break;
        
      case 'push':
        // Check permission
        if (!hasPermission('git:push', task.workerLevel)) {
          throw new Error('Permission denied: git:push requires Level 2');
        }
        
        // Require CHANGE_SUMMARY.md
        const summaryPath = path.join(project, 'CHANGE_SUMMARY.md');
        if (!fs.existsSync(summaryPath)) {
          throw new Error('git:push requires CHANGE_SUMMARY.md');
        }
        
        results.push = await gitPush(project);
        break;
    }
    
    // Audit log
    log('info', `Git ${op} completed`, { project, result: results[op] });
  }
  
  return results;
}

async function gitStatus(project: string): Promise<string> {
  const result = await execCommand('git status --short', project);
  return result.stdout;
}

async function gitPush(project: string): Promise<any> {
  // Create CHANGE_SUMMARY.md if not exists
  const summaryPath = path.join(project, 'CHANGE_SUMMARY.md');
  
  if (!fs.existsSync(summaryPath)) {
    const summary = generateChangeSummary(project);
    fs.writeFileSync(summaryPath, summary);
    log('info', 'Created CHANGE_SUMMARY.md');
  }
  
  const result = await execCommand('git push', project);
  
  return {
    success: result.exitCode === 0,
    output: result.stdout + result.stderr,
  };
}
```

## Security Checks

1. **Blocked branches**: `main`, `master`, `production`
2. **Force push**: Blocked for all branches
3. **Large commits**: Warn if > 50 files
4. **Sensitive files**: Warn if .env, secrets detected

---

## Audit Log Format

```json
{
  "timestamp": "2026-06-01T17:00:00Z",
  "workerId": "worker-123",
  "taskId": "task-456",
  "operation": "git:push",
  "project": "E:\\Project\\Master\\Agent",
  "branch": "feature/new-feature",
  "filesChanged": 5,
  "permissionLevel": "L2",
  "changeSummary": "CHANGE_SUMMARY.md exists",
  "status": "success"
}
```
