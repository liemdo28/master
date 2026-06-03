# MASTER JOURNAL SPEC

**Phase 3 of Master Intelligence Layer**

## Purpose

The Master Journal is the append-only event store for the entire company. Every task, build, QA run, deploy, git action, approval, and rollback creates an event. The journal is the single source of truth for "what happened, when, why, and by whom."

## Core Rule

```
No Event = No Change
No Decision = No Merge
No Snapshot = No Release
```

## Required Modules

| Module | Purpose | Event Types |
|--------|---------|-------------|
| `events` | All system events | task.created, task.completed, task.failed |
| `decisions` | Architectural/business decisions | decision.made, decision.reversed |
| `bugs` | Bug lifecycle | bug.reported, bug.confirmed, bug.fixed |
| `fixes` | Fix implementations | fix.applied, fix.verified, fix.reverted |
| `incidents` | Production incidents | incident.opened, incident.resolved |
| `snapshots` | System state captures | snapshot.created, snapshot.archived |
| `artifacts` | Build/QA/deploy outputs | artifact.created, artifact.verified |
| `ai-memory` | Agent learning records | memory.stored, memory.recalled |

## Event Schema

### Base Event
```json
{
  "event_id": "evt_20260601_190000_abc123",
  "event_type": "task.completed",
  "timestamp": "2026-06-01T19:00:00Z",
  "source": "agent-os",
  "actor": "worker-1",
  "project": "agent-os",
  "module": "agent-control",
  "summary": "Build completed successfully",
  "details": {},
  "tags": ["build", "success"],
  "parent_event": null,
  "correlation_id": "corr_abc123"
}
```

### Decision Event
```json
{
  "event_id": "dec_20260601_190000_abc123",
  "event_type": "decision.made",
  "timestamp": "2026-06-01T19:00:00Z",
  "decided_by": "CEO",
  "project": "payroll",
  "title": "Use UTC for all timezone calculations",
  "decision": "All payroll calculations will use UTC internally",
  "rationale": "Eliminates timezone bugs across regions",
  "alternatives_considered": ["Local time", "User timezone"],
  "risk": "Existing data needs migration",
  "rollback_plan": "Revert to local time with migration script",
  "approval_required": true,
  "approved_by": null
}
```

### Bug Event
```json
{
  "event_id": "bug_20260601_190000_abc123",
  "event_type": "bug.reported",
  "timestamp": "2026-06-01T19:00:00Z",
  "reporter": "qa-platform",
  "project": "payroll",
  "severity": "P1",
  "title": "Overtime rounding error",
  "description": "Overtime hours rounded down instead of up",
  "root_cause": null,
  "affected_files": ["src/calculations/overtime.ts"],
  "reproduction_steps": ["Enter 8.5 hours overtime", "Check calculation"],
  "fix_id": null
}
```

### Incident Event
```json
{
  "event_id": "inc_20260601_190000_abc123",
  "event_type": "incident.opened",
  "timestamp": "2026-06-01T19:00:00Z",
  "severity": "P0",
  "project": "agent-os",
  "title": "Worker network unreachable",
  "impact": "All task execution halted",
  "detected_by": "health-engine",
  "assigned_to": "engineering",
  "resolution": null,
  "resolved_at": null,
  "postmortem": null
}
```

## Storage

### File-based (Primary)
```
master-journal/
├── events/
│   ├── 2026/
│   │   └── 06/
│   │       └── 01/
│   │           ├── evt_20260601_190000_abc123.json
│   │           └── evt_20260601_190500_def456.json
│   └── latest.json  (last 100 events)
├── decisions/
│   ├── active/
│   └── reversed/
├── bugs/
│   ├── open/
│   ├── fixed/
│   └── wontfix/
├── fixes/
├── incidents/
│   ├── open/
│   └── resolved/
├── snapshots/
├── artifacts/
├── ai-memory/
└── schemas/
```

### Database (Index)
```sql
CREATE TABLE journal_events (
    event_id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    source TEXT,
    actor TEXT,
    project TEXT,
    module TEXT,
    summary TEXT,
    tags TEXT,  -- JSON array
    correlation_id TEXT,
    parent_event TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_events_project ON journal_events(project);
CREATE INDEX idx_events_type ON journal_events(event_type);
CREATE INDEX idx_events_timestamp ON journal_events(timestamp);
CREATE INDEX idx_events_correlation ON journal_events(correlation_id);
```

## Journal Writer API

```typescript
interface JournalWriter {
  // Write events
  writeEvent(event: BaseEvent): Promise<string>;
  writeDecision(decision: DecisionEvent): Promise<string>;
  writeBug(bug: BugEvent): Promise<string>;
  writeFix(fix: FixEvent): Promise<string>;
  writeIncident(incident: IncidentEvent): Promise<string>;
  writeSnapshot(snapshot: SnapshotEvent): Promise<string>;
  writeArtifact(artifact: ArtifactEvent): Promise<string>;
  writeMemory(memory: MemoryEvent): Promise<string>;
  
  // Query events
  query(filter: EventFilter): Promise<BaseEvent[]>;
  getByProject(project: string): Promise<BaseEvent[]>;
  getByCorrelation(correlationId: string): Promise<BaseEvent[]>;
  getRecent(count: number): Promise<BaseEvent[]>;
  
  // Timeline
  getTimeline(project: string, from: Date, to: Date): Promise<BaseEvent[]>;
}
```

## Integration Points

| System | Writes | Reads |
|--------|--------|-------|
| Agent OS | task events, worker events | task history |
| QA Platform | test events, audit events | test history |
| Source Indexer | index events | change history |
| Health Engine | health events | trend data |
| CEO Chat | command events | all events |
| Review Board | review events, approval events | decision history |
| Knowledge Graph | — | all events (for relationships) |

## Retention Policy

| Event Type | Retention | Archive |
|------------|-----------|---------|
| Events | 90 days active | Archive to yearly |
| Decisions | Permanent | Never archive |
| Bugs | Until fixed + 1 year | Archive |
| Incidents | Permanent | Never archive |
| Snapshots | 30 days active | Archive to yearly |
| AI Memory | Permanent | Never archive |

## Success Criteria

- [ ] Every system action creates a journal event
- [ ] Events are append-only (never modified)
- [ ] Journal is queryable by project, time, type, actor
- [ ] Decisions block merges until recorded
- [ ] Snapshots block releases until captured
- [ ] CEO can ask "what happened today?" and get a complete answer
