# Master Journal — Specification

> **Status:** P0 — Phase 3  
> **Version:** 1.0  
> **Last Updated:** 2026-06-01  
> **Owner:** Agent OS  

---

## 1. Purpose

The Master Journal is an **append-only event store** for the entire Master ecosystem. Every task, build, deploy, QA run, decision, bug, fix, and incident creates an event record. The journal is the source of truth for "what changed, why, who, and when."

---

## 2. Journal Rules

```
No Event    = No Change
No Decision = No Merge
No Snapshot = No Release
```

---

## 3. Directory Structure

```
master-journal/
├── events/              # Task, build, deploy, git events
│   ├── {YYYY-MM}/      # Organized by month
│   └── {event-id}.json
├── decisions/          # Decision records
│   └── {YYYY-MM}/
│       └── {decision-id}.md
├── bugs/               # Bug records
│   └── {YYYY-MM}/
│       └── {bug-id}.md
├── fixes/              # Fix implementation records
│   └── {YYYY-MM}/
│       └── {fix-id}.md
├── incidents/          # Production/workflow incidents
│   └── {YYYY-MM}/
│       └── {incident-id}.md
├── snapshots/          # System state snapshots
│   └── {project}/
│       └── {timestamp}.json
├── artifacts/          # Artifact index entries
│   └── {YYYY-MM}/
│       └── {artifact-id}.md
├── ai-memory/          # Per-task AI memory entries
│   └── {task-id}/
│       └── AI_MEMORY_ENTRY.md
├── knowledge/          # Durable project/architecture knowledge
│   └── {domain}/
│       └── {topic}.md
└── schemas/            # Event and memory schemas
    ├── EVENT_SCHEMA.md
    ├── DECISION_SCHEMA.md
    ├── BUG_SCHEMA.md
    └── INCIDENT_SCHEMA.md
```

---

## 4. Event Types

### 4.1 Core Event Types

| Type | Trigger | Schema |
|------|---------|--------|
| `task.created` | New task spawned | `EVENT_SCHEMA.md` |
| `task.completed` | Task finished | `EVENT_SCHEMA.md` |
| `task.failed` | Task failed | `EVENT_SCHEMA.md` |
| `build.started` | Build initiated | `EVENT_SCHEMA.md` |
| `build.completed` | Build finished | `EVENT_SCHEMA.md` |
| `build.failed` | Build failed | `EVENT_SCHEMA.md` |
| `deploy.started` | Deploy initiated | `EVENT_SCHEMA.md` |
| `deploy.completed` | Deploy finished | `EVENT_SCHEMA.md` |
| `deploy.rollback` | Rollback executed | `EVENT_SCHEMA.md` |
| `git.push` | Code pushed | `EVENT_SCHEMA.md` |
| `git.merge` | Branch merged | `EVENT_SCHEMA.md` |
| `qa.started` | QA run started | `EVENT_SCHEMA.md` |
| `qa.completed` | QA run finished | `EVENT_SCHEMA.md` |
| `project.created` | New project added | `EVENT_SCHEMA.md` |
| `project.updated` | Project metadata changed | `EVENT_SCHEMA.md` |
| `decision.made` | Decision recorded | `DECISION_SCHEMA.md` |
| `bug.found` | Bug reported | `BUG_SCHEMA.md` |
| `bug.fixed` | Bug resolved | `BUG_SCHEMA.md` |
| `incident.opened` | Incident started | `INCIDENT_SCHEMA.md` |
| `incident.resolved` | Incident resolved | `INCIDENT_SCHEMA.md` |
| `snapshot.created` | Snapshot taken | `EVENT_SCHEMA.md` |
| `artifact.created` | Artifact stored | `EVENT_SCHEMA.md` |

---

## 5. Event Schema

```json
{
  "id": "evt_xxxxxxxxxxxx",
  "type": "task.completed",
  "timestamp": "2026-06-01T17:00:00+07:00",
  "actor": {
    "id": "agent-1",
    "name": "Agent OS Worker 1",
    "role": "agent"
  },
  "project": "agent-os",
  "payload": {
    "task_id": "tsk_xxxx",
    "task_type": "code_review",
    "duration_ms": 45000,
    "outcome": "success",
    "artifacts": ["report.md"],
    "related_events": []
  },
  "metadata": {
    "version": "1.0",
    "correlation_id": "corr_xxxx",
    "parent_event_id": null
  }
}
```

---

## 6. Decision Schema

```json
{
  "id": "dec_xxxxxxxxxxxx",
  "timestamp": "2026-06-01T17:00:00+07:00",
  "project": "agent-os",
  "title": "Switch from REST to GraphQL for API layer",
  "decision": "Use GraphQL with Apollo Server",
  "alternatives_considered": [
    "REST with OpenAPI (rejected: too rigid)",
    "tRPC (rejected: TypeScript only)"
  ],
  "rationale": "Flexibility for evolving frontend requirements",
  "risk_assessment": {
    "risk": "Learning curve for team",
    "mitigation": "Training session scheduled",
    "severity": "medium"
  },
  "rollback_plan": "Revert to REST endpoints if performance degrades",
  "decided_by": "Engineering Lead",
  "approved_by": "CTO",
  "status": "approved",
  "links": {
    "journal_event": "evt_xxxx",
    "implementation_task": "tsk_xxxx"
  }
}
```

---

## 7. Bug Schema

```json
{
  "id": "bug_421",
  "timestamp": "2026-05-15T10:00:00+07:00",
  "project": "Payroll",
  "title": "Timezone offset causes wrong pay calculation",
  "severity": "high",
  "status": "open",
  "symptoms": [
    "Users in UTC+7 see wrong overtime",
    "Reports show incorrect totals"
  ],
  "root_cause": "Session timestamps stored without timezone normalization",
  "affected_versions": ["v2.0.0", "v2.1.0"],
  "first_occurrence": "2026-05-10",
  "reported_by": "QA Team",
  "assigned_to": "Dev Lead",
  "fix": {
    "id": "fix_421",
    "applied_at": null,
    "commit": null,
    "status": "pending"
  },
  "prevention": [
    "Add timezone test matrix to regression suite",
    "Normalize all timestamps to UTC in DB"
  ],
  "related_incidents": ["inc_123"],
  "links": {
    "decision": "dec_xxx"
  }
}
```

---

## 8. Incident Schema

```json
{
  "id": "inc_123",
  "timestamp": "2026-05-20T14:00:00+07:00",
  "resolved_at": "2026-05-20T16:00:00+07:00",
  "title": "Agent Core service down (2 hours)",
  "severity": "critical",
  "status": "resolved",
  "duration_minutes": 120,
  "impact": {
    "projects_affected": ["Dashboard", "Payroll", "Review Auto", "QA Platform", "Agent Worker"],
    "users_affected": "All",
    "revenue_impact": "Unknown"
  },
  "timeline": [
    { "time": "14:00", "event": "Alert triggered", "actor": "Monitoring" },
    { "time": "14:05", "event": "Engineer notified", "actor": "On-call" },
    { "time": "14:30", "event": "Root cause identified", "actor": "Dev Lead" },
    { "time": "15:00", "event": "Fix deployed", "actor": "Dev Lead" },
    { "time": "16:00", "event": "Service restored", "actor": "Monitoring" }
  ],
  "root_cause": "Memory leak in worker pool, no auto-restart configured",
  "fix_applied": [
    "Fixed memory leak in worker pool",
    "Added auto-restart at 95% memory",
    "Added memory monitoring at 80%"
  ],
  "prevention": [
    "Memory alerts at 80%",
    "Auto-restart at 95%",
    "Regular health checks every 15 min"
  ],
  "lessons_learned": "Need better memory monitoring for critical services",
  "reported_by": "Monitoring System",
  "resolved_by": "Dev Lead"
}
```

---

## 9. Journal API

### 9.1 Record Event

```
POST /api/journal/event
```

### 9.2 Query Events

```
GET /api/journal/events?project={name}&type={type}&from={date}&to={date}
```

### 9.3 Record Decision

```
POST /api/journal/decision
```

### 9.4 Get Project Timeline

```
GET /api/journal/timeline/{project}
```

### 9.5 Get Audit Trail

```
GET /api/journal/audit/{entity_type}/{entity_id}
```

---

## 10. Journal Rules Engine

### 10.1 No Event = No Change

Every source code change must have a corresponding journal event. Git hooks can enforce this.

### 10.2 No Decision = No Merge

Critical branch merges (main, release/*) require a decision record in the journal.

### 10.3 No Snapshot = No Release

Every release must have a corresponding snapshot record capturing system state.

### 10.4 Retention Policy

| Event Type | Retention |
|-----------|-----------|
| Task events | 90 days |
| Build events | 1 year |
| Deploy events | 1 year |
| Decisions | Forever |
| Bugs | Forever |
| Incidents | Forever |
| Snapshots | 2 years |
| Artifacts | 1 year |

---

## 11. Integration Points

| Consumer | Integration |
|----------|-------------|
| Source Indexer | Records project creation/deletion events |
| Knowledge Graph | Reads events to build entity relationships |
| Health Engine | Reads incidents and bug counts |
| CEO Chat | Answers "What changed?" queries |
| QA Platform | Records QA run events |
| Review Board | Reads decision records for approvals |
| Master Indexer | Indexes project events |

---

## 12. Example Journal Entries

### 12.1 Build Event

```json
{
  "id": "evt_build_001",
  "type": "build.completed",
  "timestamp": "2026-06-01T16:30:00+07:00",
  "project": "Dashboard",
  "actor": { "id": "agent-1", "name": "Agent OS" },
  "payload": {
    "build_id": "build_001",
    "version": "v2.3.0",
    "outcome": "success",
    "duration_ms": 120000,
    "artifacts": ["dist/", "report.html"]
  }
}
```

### 12.2 Deployment Event

```json
{
  "id": "evt_deploy_001",
  "type": "deploy.completed",
  "timestamp": "2026-06-01T17:00:00+07:00",
  "project": "Dashboard",
  "actor": { "id": "agent-1", "name": "Agent OS" },
  "payload": {
    "deploy_id": "deploy_001",
    "version": "v2.3.0",
    "environment": "production",
    "outcome": "success",
    "rollback_available": true
  }
}
```
