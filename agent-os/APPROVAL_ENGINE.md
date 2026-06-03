# Agent OS - Approval Engine

## Overview

Approval Engine đánh giá risk level của mỗi task trước khi thực thi.

## Risk Levels

| Level | Risk | Require Approval | Auto-Run |
|-------|------|-----------------|----------|
| GREEN | Low | ❌ | ✅ |
| YELLOW | Medium | ✅ | ❌ |
| RED | High | ✅ + CEO | ❌ |
| BLACK | Critical | ❌ Block | ❌ |

## Task Risk Classification

### GREEN Tasks (Auto-run)

```json
{
  "type": "git_status",
  "autoRun": true,
  "riskLevel": "GREEN"
}
```

| Task Type | Executor | Risk |
|-----------|----------|------|
| git_status | Git Executor | GREEN |
| audit | Audit Executor | GREEN |
| source_scan | Audit Executor | GREEN |
| qa_run | QA Executor | GREEN |
| build_safe | Build Executor | GREEN |
| app_open | App Executor | GREEN |
| script_run_approved | Script Executor | GREEN |
| api_proxy_status | API Proxy Executor | GREEN |

### YELLOW Tasks (Approval Required)

| Task Type | Executor | Risk |
|-----------|----------|------|
| git_push | Git Executor | YELLOW |
| git_push_branch | Git Executor | YELLOW |
| file_write_outside | File Executor | YELLOW |
| script_run_custom | Script Executor | YELLOW |
| deploy_staging | Deploy Executor | YELLOW |

### RED Tasks (CEO Approval Required)

| Task Type | Executor | Risk |
|-----------|----------|------|
| git_push_main | Git Executor | RED |
| deploy_production | Deploy Executor | RED |
| file_delete | File Executor | RED |
| folder_delete | File Executor | RED |
| folder_move | File Executor | RED |
| docker_run | Docker Executor | RED |

### BLACK Tasks (Blocked)

| Task Type | Executor | Risk |
|-----------|----------|------|
| dns_change | Cloud Executor | BLACK |
| db_change_production | Cloud Executor | BLACK |
| email_send | Cloud Executor | BLACK |
| cloud_delete | Cloud Executor | BLACK |
| app_blocked | App Executor | BLACK |

## Approval Flow

```
Task Created
    │
    ▼
Risk Assessment
    │
    ├── GREEN ──────────────────────▶ Execute
    │
    ├── YELLOW ───▶ Approval ──┬──▶ Approve ──▶ Execute
    │           Queue           └──▶ Reject ────▶ Denied
    │
    ├── RED ──────▶ CEO ────────┬──▶ Approve ──▶ Execute
    │           Approval         └──▶ Reject ────▶ Denied
    │
    └── BLACK ───────────────────▶ Blocked
```

## Approval States

```typescript
enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}
```

## Approval Request

```json
{
  "id": "approval-123",
  "taskId": "task-456",
  "taskType": "git_push",
  "riskLevel": "YELLOW",
  "executor": "git",
  "requester": "worker-123",
  "reason": "Push feature branch to remote",
  "createdAt": "2026-06-01T17:00:00Z",
  "expiresAt": "2026-06-01T18:00:00Z",
  "status": "pending",
  "approver": null,
  "approvedAt": null,
  "rejectedAt": null,
  "rejectReason": null
}
```

## API Endpoints

### Create Approval Request
```
POST /api/approvals
```

### List Pending Approvals
```
GET /api/approvals?status=pending
```

### Approve Task
```
POST /api/approvals/:id/approve
```

### Reject Task
```
POST /api/approvals/:id/reject
```

### Cancel Approval
```
POST /api/approvals/:id/cancel
```

## Dashboard Approval UI

```
┌─────────────────────────────────────────────────────────┐
│ PENDING APPROVALS (3)                                   │
├─────────────────────────────────────────────────────────┤
│ ⏳ git_push feature/new-ui                              │
│    Project: E:\Project\Master\Agent                     │
│    Risk: YELLOW | Executor: Git                         │
│    Requested: 5 min ago | Expires: 55 min               │
│    [Approve] [Reject] [View Details]                   │
├─────────────────────────────────────────────────────────┤
│ ⏳ deploy_staging v1.2.3                               │
│    Project: E:\Project\Master\Bakudan                   │
│    Risk: YELLOW | Executor: Deploy                      │
│    Requested: 2 min ago | Expires: 58 min               │
│    [Approve] [Reject] [View Details]                   │
└─────────────────────────────────────────────────────────┘
```

## Notification

Approval requests trigger notification:

- Dashboard badge count
- WebSocket push to all connected clients
- (Future: Email/SMS to CEO)

## Expiration

Approvals expire after 1 hour by default.

Expired approvals:
- Cannot be executed
- Must be re-requested

## Audit Log

Every approval action is logged:

```json
{
  "timestamp": "2026-06-01T17:00:00Z",
  "type": "approval_request",
  "taskId": "task-456",
  "riskLevel": "YELLOW",
  "status": "approved",
  "approver": "ceo@company.com",
  "duration": 120
}
```

## Implementation

```typescript
class ApprovalEngine {
  async assessRisk(task: Task): Promise<RiskAssessment> {
    const riskRules: RiskRule[] = await this.loadRiskRules();
    
    for (const rule of riskRules) {
      if (rule.matches(task)) {
        return {
          level: rule.level,
          requiresApproval: rule.requiresApproval,
          autoRun: rule.autoRun,
          reason: rule.reason,
        };
      }
    }
    
    // Default: YELLOW (requires approval)
    return {
      level: 'YELLOW',
      requiresApproval: true,
      autoRun: false,
      reason: 'Default: requires approval',
    };
  }
  
  async createApprovalRequest(task: Task): Promise<Approval> {
    const assessment = await this.assessRisk(task);
    
    if (assessment.autoRun) {
      // Execute immediately
      return null;
    }
    
    // Create approval request
    const approval = {
      id: uuidv4(),
      taskId: task.id,
      taskType: task.type,
      riskLevel: assessment.level,
      status: 'pending',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    };
    
    await this.db.approvals.insert(approval);
    await this.notifyApprovalRequest(approval);
    
    return approval;
  }
  
  async approve(approvalId: string, approver: string): Promise<void> {
    const approval = await this.db.approvals.findById(approvalId);
    approval.status = 'approved';
    approval.approver = approver;
    approval.approvedAt = new Date().toISOString();
    
    await this.db.approvals.update(approvalId, approval);
    await this.executeTask(approval.taskId);
  }
  
  async reject(approvalId: string, rejector: string, reason: string): Promise<void> {
    const approval = await this.db.approvals.findById(approvalId);
    approval.status = 'rejected';
    approval.approver = rejector;
    approval.rejectedAt = new Date().toISOString();
    approval.rejectReason = reason;
    
    await this.db.approvals.update(approvalId, approval);
  }
}
```
