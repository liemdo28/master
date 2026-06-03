# ARTIFACT REGISTRY SPEC

**Phase 5 of Master Intelligence Layer**

## Purpose

Central storage and index for all outputs produced by the company's engineering processes: build logs, QA reports, videos, screenshots, deploy reports, snapshots, git reports, and architecture reports.

## What is an Artifact?

Any file or data produced as output of a process:
- Build log from a compilation
- QA report from a test run
- Screenshot from a Playwright test
- Video recording of a walkthrough
- Deploy report from a release
- Snapshot of system state
- Git report (diff, blame, history)
- Architecture diagram or report

## Artifact Metadata

Every artifact must have:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `artifact_id` | string | ✓ | Unique identifier |
| `artifact_type` | enum | ✓ | Type classification |
| `project` | string | ✓ | Source project |
| `task_id` | string | | Originating task |
| `owner` | string | ✓ | Who produced it |
| `timestamp` | datetime | ✓ | When produced |
| `checksum` | string | ✓ | SHA-256 hash |
| `size_bytes` | number | ✓ | File size |
| `summary` | string | ✓ | Human-readable summary |
| `path` | string | ✓ | Storage location |
| `format` | string | ✓ | File format (json, html, png, mp4) |
| `retention` | enum | | How long to keep |
| `tags` | list | | Searchable tags |

## Artifact Types

| Type | Description | Typical Format |
|------|-------------|----------------|
| `build_log` | Compilation/build output | .log, .txt |
| `qa_report` | Test execution results | .json, .html |
| `qa_video` | Test recording | .mp4, .webm |
| `qa_screenshot` | Visual capture | .png, .jpg |
| `deploy_report` | Deployment results | .json, .md |
| `snapshot` | System state capture | .json, .tar.gz |
| `git_report` | Git analysis output | .json, .md |
| `architecture_report` | Structure analysis | .md, .json |
| `audit_report` | Security/code audit | .json, .html |
| `stress_report` | Load test results | .json, .html |
| `health_report` | Health engine output | .json |
| `decision_record` | Decision documentation | .md |

## Storage Layout

```
artifact-registry/
├── registry.db           # SQLite index
├── store/
│   ├── build-logs/
│   │   └── [project]/[date]/[artifact_id].log
│   ├── qa-reports/
│   │   └── [project]/[date]/[artifact_id].json
│   ├── qa-videos/
│   │   └── [project]/[date]/[artifact_id].mp4
│   ├── qa-screenshots/
│   │   └── [project]/[date]/[artifact_id].png
│   ├── deploy-reports/
│   │   └── [project]/[date]/[artifact_id].json
│   ├── snapshots/
│   │   └── [project]/[date]/[artifact_id].json
│   ├── git-reports/
│   │   └── [project]/[date]/[artifact_id].md
│   └── architecture-reports/
│       └── [project]/[date]/[artifact_id].md
├── schemas/
│   └── artifact.schema.json
└── config/
    └── retention-policy.json
```

## Database Schema

```sql
CREATE TABLE artifacts (
    artifact_id TEXT PRIMARY KEY,
    artifact_type TEXT NOT NULL,
    project TEXT NOT NULL,
    task_id TEXT,
    owner TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    checksum TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    summary TEXT NOT NULL,
    path TEXT NOT NULL,
    format TEXT NOT NULL,
    retention TEXT DEFAULT 'standard',
    tags TEXT,  -- JSON array
    journal_event_id TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_artifacts_project ON artifacts(project);
CREATE INDEX idx_artifacts_type ON artifacts(artifact_type);
CREATE INDEX idx_artifacts_timestamp ON artifacts(timestamp);
CREATE INDEX idx_artifacts_task ON artifacts(task_id);

CREATE TABLE artifact_links (
    id TEXT PRIMARY KEY,
    artifact_id TEXT NOT NULL,
    linked_artifact_id TEXT NOT NULL,
    link_type TEXT NOT NULL,  -- 'supersedes', 'related', 'depends_on'
    FOREIGN KEY (artifact_id) REFERENCES artifacts(artifact_id),
    FOREIGN KEY (linked_artifact_id) REFERENCES artifacts(artifact_id)
);
```

## Registry API

```typescript
interface ArtifactRegistry {
  // Store
  register(artifact: ArtifactMetadata, content: Buffer): Promise<string>;
  
  // Query
  findByProject(project: string): Promise<Artifact[]>;
  findByType(type: ArtifactType): Promise<Artifact[]>;
  findByTask(taskId: string): Promise<Artifact[]>;
  findByDateRange(from: Date, to: Date): Promise<Artifact[]>;
  getLatest(project: string, type: ArtifactType): Promise<Artifact>;
  
  // Retrieve
  getContent(artifactId: string): Promise<Buffer>;
  getSummary(artifactId: string): Promise<string>;
  
  // Lifecycle
  archive(artifactId: string): Promise<void>;
  delete(artifactId: string): Promise<void>;
  verify(artifactId: string): Promise<boolean>;  // checksum verification
}
```

## Retention Policy

| Artifact Type | Active | Archive | Delete |
|---------------|--------|---------|--------|
| Build logs | 30 days | 1 year | After archive |
| QA reports | 90 days | 2 years | After archive |
| QA videos | 14 days | 90 days | After archive |
| Screenshots | 30 days | 1 year | After archive |
| Deploy reports | Permanent | — | Never |
| Snapshots | 30 days | 1 year | After archive |
| Git reports | 90 days | Permanent | Never |
| Architecture reports | Permanent | — | Never |
| Audit reports | Permanent | — | Never |

## Integration Points

| System | Interaction |
|--------|-------------|
| QA Platform | Produces QA reports, videos, screenshots |
| Agent OS | Produces build logs, task artifacts |
| Master Journal | Every artifact creates a journal event |
| Knowledge Graph | Artifacts linked to projects/tasks as nodes |
| Health Engine | Reads latest reports for health calculation |
| CEO Chat | Queries artifacts for evidence |
| Review Board | Requires artifacts for approval |

## Success Criteria

- [ ] All QA outputs stored with metadata
- [ ] All build logs captured and indexed
- [ ] Artifacts retrievable by project, type, date, task
- [ ] Checksums verified on retrieval
- [ ] Retention policy enforced automatically
- [ ] CEO can ask "show me the last QA report for Dashboard"
