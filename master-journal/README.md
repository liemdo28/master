# Master Journal

Canonical append-only event store for the Agent OS ecosystem. Every task, validation, build, deploy, and system action creates an event here.

## Purpose

The journal answers: *What happened, when, why, and by whom?*

## Core Rule

```
No Event = No Change
No Artifact = No Validation
No Validation = No Success
```

**Validation complete = Artifact saved + Journal event written.**

No fake events. No hardcoded success. Status is determined by the actual result.

## Storage Layout

```
master-journal/
├── events/                 ← daily JSONL files
│   └── YYYY-MM-DD.jsonl    ← one event per line
├── query-engine.js         ← read pipeline (existing)
├── journal-engine.js       ← write pipeline (new)
└── README.md
```

## Event Format

```json
{
  "eventId": "EVT-20260602T040500-1A2B3C",
  "type": "validation_completed",
  "taskId": "TASK-20260602-ABC123",
  "status": "PASS | FAIL | UNKNOWN",
  "artifacts": ["ART-20260602-XYZ789"],
  "timestamp": "2026-06-02T04:05:00.000Z",
  "data": {},
  "actor": "worker-1",
  "project": "agent-os"
}
```

## Journal Format

`master-journal/events/YYYY-MM-DD.jsonl` — one JSON object per line, append-only.

## API

```js
const journal = require('./journal-engine');

// Write pipeline
const eventId = journal.createValidationEvent({
  taskId: 'TASK-20260602-ABC123',
  status: 'PASS',          // PASS | FAIL | UNKNOWN — never hardcoded
  artifacts: ['ART-20260602-XYZ789'],
  data: { coverage: 87 },
  actor: 'validation-engine',
  project: 'agent-os',
});

journal.createTaskEvent({
  action: 'completed',     // created | started | completed | failed | cancelled
  taskId: 'TASK-20260602-ABC123',
  actor: 'agent-os',
  project: 'agent-os',
});

journal.writeEvent({
  type: 'snapshot_created',
  taskId: 'TASK-20260602-ABC123',
  status: 'PASS',
  data: { path: 'E:\\...' },
});

// Read pipeline
const events = journal.getEventsByTaskId('TASK-20260602-ABC123');
const recent = journal.getRecentEvents(20);
const today  = journal.getTodayEvents();
const failed = journal.getFailedEvents();
const byDate = journal.getEventsByDate('2026-06-02');
const byProj = journal.getProjectEvents('agent-os');
```

## Functions

| Function | Description |
|----------|-------------|
| `createValidationEvent()` | Write validation_completed event with real status |
| `createTaskEvent()` | Write task lifecycle event (created/start/completed/failed/cancelled) |
| `writeEvent()` | Write a generic structured event |
| `appendEvent()` | Append a raw event object (caller sets all fields) |
| `getEventsByTaskId()` | Return all events for a given taskId |
| `getRecentEvents()` | Return last N events |
| `getTodayEvents()` | Return today's events |
| `getFailedEvents()` | Return all failed/error events |
| `getProjectEvents()` | Return events for a project |
| `getEventsByDate()` | Return events from a specific date |

## Validation Workflow

```
1. Run validation
2. Get real result (PASS | FAIL | UNKNOWN)
3. artifact-registry.createArtifact() → saves artifact + manifest
4. journal-engine.createValidationEvent() → writes journal event
5. Validation is only considered complete when both steps succeed
```

## ID Format

- Event: `EVT-YYYYMMDDHHMMSS-XXXXXX`
- Task: `TASK-YYYYMMDDHHMMSS-XXXXXX`
- Artifact: `ART-YYYYMMDDHHMMSS-XXXXXX`

## Read/Write Separation

- `query-engine.js` — read-only, existing
- `journal-engine.js` — write pipeline + re-exports all read functions
