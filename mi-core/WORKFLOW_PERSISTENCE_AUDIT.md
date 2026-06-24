# WORKFLOW PERSISTENCE AUDIT

**Date:** 2026-06-15
**Target:** Verify workflow persistence

## Questions to Answer

1. Database?
2. Filesystem?
3. Survives restart?
4. Survives PM2 restart?

## Workflow Systems Found

### 1. Approval Gate (`server/src/approval/gate.ts`)

```typescript
// In-memory queue (persisted to file in production)
const queue = new Map<string, ApprovalAction>();
```

| Property | Value | Evidence |
|----------|-------|---------|
| **Storage** | In-memory `Map` | `gate.ts` line 32 |
| **Database** | ❌ No | No SQLite, no PostgreSQL |
| **Filesystem** | ❌ No | No file write found in gate.ts |
| **Survives restart** | ❌ No | All pending approvals lost |
| **Survives PM2 restart** | ❌ No | Same as restart |

### 2. Autonomous Workflow Runner (`agent-engine/autonomous/AutonomousWorkflowRunner.js`)

```javascript
class AutonomousWorkflowRunner {
  async run(task) {
    return { status: 'proposed', task, approvalRequired: true };
  }
}
```

| Property | Value | Evidence |
|----------|-------|---------|
| **Storage** | None (stub) | Returns proposed status only |
| **Database** | ❌ No | |
| **Filesystem** | ❌ No | |
| **Survives restart** | ❌ No | No state to persist |

### 3. Job Queue (`server/src/queue/job-queue.ts`)

```typescript
// Uses PostgreSQL for queue persistence
```

| Property | Value | Evidence |
|----------|-------|---------|
| **Storage** | PostgreSQL | `pg` module used |
| **Database** | ✅ Yes | `postgres` connection in queue |
| **Filesystem** | ❌ No | |
| **Survives restart** | ✅ Yes | PostgreSQL persists |
| **Survives PM2 restart** | ✅ Yes | PostgreSQL persists |

### 4. WhatsApp Approval Store (`server/src/services/whatsapp-store.ts`)

| Property | Value | Evidence |
|----------|-------|---------|
| **Storage** | In-memory | `getPendingWhatsAppApprovals()` |
| **Database** | ❌ No | |
| **Filesystem** | ❌ No | |
| **Survives restart** | ❌ No | All WA approvals lost |

### 5. Reminder Store (`server/src/reminders/reminder-store.ts`)

| Property | Value | Evidence |
|----------|-------|---------|
| **Storage** | In-memory `Map` | |
| **Database** | ❌ No | |
| **Filesystem** | ❌ No | |
| **Survives restart** | ❌ No | All reminders lost |

## Persistence Summary

| Workflow System | Database | Filesystem | Survives Restart | Survives PM2 |
|----------------|----------|-----------|-----------------|-------------|
| Approval Gate | ❌ No | ❌ No | ❌ No | ❌ No |
| Autonomous Runner | ❌ No | ❌ No | ❌ No | ❌ No |
| Job Queue | ✅ PostgreSQL | ❌ No | ✅ Yes | ✅ Yes |
| WhatsApp Approvals | ❌ No | ❌ No | ❌ No | ❌ No |
| Reminders | ❌ No | ❌ No | ❌ No | ❌ No |

## Critical Finding

**Most workflow state is ephemeral.** Only the Job Queue uses PostgreSQL for persistence. All other workflow systems (approval gate, WhatsApp approvals, reminders, autonomous workflows) use in-memory Maps that are lost on any restart.

### Impact of PM2 Restart

1. All pending approvals → **GONE**
2. All active reminders → **GONE**
3. All WhatsApp approval requests → **GONE**
4. All autonomous workflow state → **GONE**
5. Job queue → **PRESERVED** (PostgreSQL)

### Impact of Process Crash

Same as PM2 restart for in-memory systems. Job queue survives.

### Impact of System Reboot

Same as PM2 restart for in-memory systems. Job queue survives if PostgreSQL restarts.

## Verdict: PARTIALLY_CONFIRMED

- **Job Queue** uses PostgreSQL → ✅ Persists
- **Approval Gate, Reminders, WhatsApp Approvals, Autonomous Workflows** → ❌ All in-memory, lost on restart
- The majority of workflow persistence is **NOT implemented**. Only job queue has database persistence.
