# Artifact Registry — Specification

> **Status:** P0 — Phase 5  
> **Version:** 1.0  
> **Last Updated:** 2026-06-01  
> **Owner:** Agent OS  

---

## 1. Purpose

The Artifact Registry is the **central storage index** for all generated artifacts across the Master ecosystem — build logs, QA reports, videos, screenshots, deploy reports, snapshots, git reports, and architecture documents. Every artifact is registered with rich metadata for traceability.

---

## 2. Directory Structure

```
artifact-registry/
├── build/                  # Build output artifacts
│   └── {project}/
│       └── {version}/
│           ├── build.log
│           ├── dist/
│           └── metadata.json
├── qa/                     # QA report artifacts
│   └── {project}/
│       └── {timestamp}/
│           ├── audit-report.html
│           ├── test-report.html
│           ├── security-report.html
│           └── metadata.json
├── deploy/                 # Deploy artifacts
│   └── {project}/
│       └── {timestamp}/
│           ├── deploy.log
│           ├── rollback-script.sh
│           └── metadata.json
├── snapshots/              # System state snapshots
│   └── {project}/
│       └── {timestamp}/
│           ├── state.json
│           └── metadata.json
├── videos/                 # Recording artifacts
│   └── {project}/
│       └── {task-id}/
│           └── recording.mp4
├── screenshots/           # Screenshot artifacts
│   └── {project}/
│       └── {task-id}/
│           └── screenshot.png
├── git-reports/           # Git analysis artifacts
│   └── {project}/
│       └── {timestamp}/
│           └── report.md
└── architecture/          # Architecture documents
    └── {project}/
        └── {timestamp}/
            └── diagram.pdf
```

---

## 3. Metadata Schema

### 3.1 Base Metadata

```json
{
  "id": "art_xxxxxxxxxxxx",
  "type": "qa_report",
  "project": "Dashboard",
  "task_id": "tsk_123",
  "version": "v2.3.0",
  "timestamp": "2026-06-01T17:00:00+07:00",
  "owner": "QA Lead",
  "created_by": "Agent OS Worker 1",
  "files": [
    {
      "path": "audit-report.html",
      "size_bytes": 45678,
      "checksum": "sha256:abc123...",
      "type": "text/html"
    }
  ],
  "summary": "Full audit of Dashboard v2.3.0 — 156 files scanned, 3 issues found",
  "status": "complete",
  "retention_days": 365,
  "tags": ["audit", "v2.3.0", "2026-06"],
  "links": {
    "journal_event": "evt_xxx",
    "project_dna": "Dashboard/PROJECT_DNA.md",
    "related_artifacts": []
  }
}
```

### 3.2 Artifact Types

| Type | Description | Retention |
|------|-------------|-----------|
| `build_log` | Build process output | 365 days |
| `dist` | Built artifacts (zipped) | 90 days |
| `audit_report` | Source/structure audit | 365 days |
| `test_report` | Test run results | 365 days |
| `security_report` | Security scan results | 365 days |
| `deploy_log` | Deployment output | 365 days |
| `rollback_script` | Rollback automation | 730 days |
| `snapshot` | System state | 730 days |
| `video` | Recording | 90 days |
| `screenshot` | Screenshot | 90 days |
| `git_report` | Git analysis | 180 days |
| `architecture_doc` | Arch diagrams | Forever |
| `release_notes` | Release documentation | Forever |

---

## 4. Storage Policy

### 4.1 Local Storage

Primary: `E:\Project\Master\artifact-registry\`

### 4.2 Checksum Validation

Every artifact file is stored with its SHA-256 checksum in metadata. On retrieval, checksums are verified.

### 4.3 Retention Policy

| Type | Retention | Archive After |
|------|-----------|---------------|
| Build logs | 1 year | Auto-archive |
| QA reports | 1 year | Manual review |
| Deploy reports | 1 year | Auto-archive |
| Snapshots | 2 years | Manual review |
| Videos | 90 days | Auto-delete |
| Screenshots | 90 days | Auto-delete |
| Architecture docs | Forever | Never |
| Release notes | Forever | Never |

---

## 5. Registry API

### 5.1 Register Artifact

```
POST /api/artifacts/register
```

### 5.2 Query Artifacts

```
GET /api/artifacts?project={name}&type={type}&from={date}&to={date}
```

### 5.3 Get Artifact

```
GET /api/artifacts/{id}
```

### 5.4 Download Artifact

```
GET /api/artifacts/{id}/download/{filename}
```

### 5.5 Verify Checksum

```
GET /api/artifacts/{id}/verify
```

---

## 6. Integration Points

| System | Integration |
|--------|-------------|
| Source Indexer | Registers build artifacts |
| QA Platform | Registers all QA reports |
| Master Journal | Creates artifact index entries |
| Health Engine | Reads QA reports for health scores |
| CEO Chat | Links to artifacts for evidence |
| Review Board | References artifacts for decisions |
