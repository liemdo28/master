# Artifact Registry

Central storage and index for all generated artifacts in the Agent OS ecosystem.

## Purpose

Every artifact (log, report, screenshot, execution trace) is registered here with a manifest containing full metadata, checksum, and traceability back to the originating task.

## Rule

**Validation complete = Artifact saved + Journal event written.**

No fake events. No hardcoded success.

## Storage Layout

```
artifact-registry/
├── screenshots/    ← type "screenshot"
├── logs/            ← type "log"
├── reports/         ← type "report"
├── executions/      ← type "execution"
├── manifests/       ← per-artifact JSON manifests (ART-*.json)
└── artifact-registry.js
```

## Artifact Manifest

```json
{
  "artifactId": "ART-20260602-3A7F9B2C",
  "taskId": "TASK-20260602-ABC123",
  "type": "log | report | screenshot | execution",
  "path": "E:\\Project\\Master\\artifact-registry\\logs\\my-task.log",
  "createdAt": "2026-06-02T04:05:00.000Z",
  "checksum": "sha256:abc123...",
  "source": "agent-os"
}
```

## API

```js
const registry = require('./artifact-registry');

// Register content directly
const { artifactId, path, checksum } = registry.createArtifact({
  taskId: 'TASK-20260602-ABC123',
  type: 'log',
  content: 'Build output here...',
  filename: 'build-001.log',
  source: 'agent-os',
});

// Register an existing file
const { artifactId } = registry.registerArtifact({
  taskId: 'TASK-20260602-ABC123',
  type: 'report',
  sourceFile: 'E:\\path\\to\\qa-report.json',
  source: 'validation-engine',
});

// List all artifacts for a task
const artifacts = registry.listArtifactsByTask('TASK-20260602-ABC123');

// Get a specific artifact manifest
const manifest = registry.getArtifact('ART-20260602-3A7F9B2C');

// Validate artifact integrity (file exists + checksum matches)
const valid = registry.validateArtifactExists('ART-20260602-3A7F9B2C');

// List all artifacts (optionally filter by type)
const all = registry.listArtifacts({ type: 'report' });
```

## Functions

| Function | Description |
|----------|-------------|
| `createArtifact()` | Create artifact from raw content (Buffer/string), saves file + manifest |
| `registerArtifact()` | Register an existing file, copies it into the registry |
| `listArtifactsByTask()` | Return all artifact manifests for a taskId |
| `listArtifacts()` | Return all artifacts, optionally filtered by type |
| `getArtifact()` | Return the manifest for a specific artifactId |
| `validateArtifactExists()` | Return true if file exists and checksum is valid |

## Supported Types

`log` | `report` | `screenshot` | `execution`

## Integration

- Validation engine → calls `createArtifact()` then `journal-engine.createValidationEvent()`
- Agent OS → calls `registerArtifact()` after task execution
- CEO Chat → queries via `listArtifactsByTask()` for evidence

## Checksum

SHA-256. Verified on `validateArtifactExists()` — any silent file corruption is detected.
