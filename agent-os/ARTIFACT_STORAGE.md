# Agent OS - Artifact Storage

## Overview

Mỗi task sau khi hoàn thành đều lưu artifacts để CEO có thể xem lại kết quả.

## Directory Structure

```
artifacts/
├── audit-reports/         # Source audit results
│   └── task-xxx/
│       ├── report.json
│       └── summary.md
├── build-logs/           # Build execution logs
│   └── task-xxx/
│       ├── stdout.log
│       ├── stderr.log
│       └── result.json
├── qa-results/           # QA test results
│   └── task-xxx/
│       ├── report.json
│       ├── screenshots/
│       └── videos/
├── screenshots/           # Captured screenshots
│   └── task-xxx/
│       └── *.png
├── deploy-reports/       # Deployment reports
│   └── task-xxx/
│       └── deploy.json
├── git-reports/           # Git status reports
│   └── task-xxx/
│       └── status.json
├── task-runs/            # Generic task outputs
│   └── task-xxx/
│       ├── logs.txt
│       └── artifacts/
└── cline-outputs/        # Cline/Antigravity outputs
    └── task-xxx/
        ├── logs.txt
        └── files/
```

## Artifact Types

| Task Type | Artifact Type | Contents |
|-----------|---------------|----------|
| audit | audit-reports | JSON report, summary markdown |
| build | build-logs | stdout, stderr, result JSON |
| qa | qa-results | Test report, screenshots |
| git_sync | git-reports | Status JSON, log output |
| script | task-runs | Script output logs |
| cline_control | cline-outputs | Prompt, output logs |
| deploy | deploy-reports | Deploy result JSON |

## Artifact Schema

```typescript
interface Artifact {
  id: string;
  taskId: string;
  type: string;
  name: string;
  path: string;
  size: number;
  mimeType: string;
  createdAt: string;
  metadata: Record<string, any>;
}
```

## Storage API

### Upload Artifact
```
POST /api/artifacts
Content-Type: multipart/form-data

taskId: string
type: string
name: string
file: binary
metadata: JSON
```

### List Artifacts
```
GET /api/artifacts?taskId=xxx
```

### Download Artifact
```
GET /api/artifacts/:id/download
```

### Delete Artifact
```
DELETE /api/artifacts/:id
```

## Dashboard Artifact UI

```
┌─────────────────────────────────────────────────────────┐
│ ARTIFACTS FOR TASK: xxx                              │
├─────────────────────────────────────────────────────────┤
│ 📄 audit-report.json          12.5 KB  2026-06-01 17:00 │
│ 📄 summary.md                2.1 KB   2026-06-01 17:00 │
│ 📸 screenshot-001.png        245 KB   2026-06-01 17:02 │
│ 📋 build-log.txt             8.3 KB   2026-06-01 17:05 │
│                                                         │
│ [Download All] [View] [Delete]                        │
└─────────────────────────────────────────────────────────┘
```

## Artifact Retention

| Type | Retention | Storage |
|------|-----------|---------|
| audit-reports | 30 days | Local |
| build-logs | 7 days | Local |
| qa-results | 30 days | Local |
| screenshots | 7 days | Local |
| deploy-reports | 90 days | Local |
| git-reports | 14 days | Local |

## Artifact Metadata

Mỗi artifact đều có metadata:

```json
{
  "taskId": "task-123",
  "type": "audit-report",
  "name": "E:\\Project\\Master audit",
  "createdBy": "worker-pc-1",
  "taskType": "audit",
  "project": "E:\\Project\\Master",
  "duration": 45,
  "exitCode": 0,
  "tags": ["source-audit", "inventory"]
}
```

## Implementation

```typescript
class ArtifactStorage {
  readonly BASE_PATH = 'E:\\Project\\Master\\agent-os\\artifacts';
  
  async save(task: Task, files: ArtifactFile[]): Promise<Artifact[]> {
    const taskDir = path.join(this.BASE_PATH, task.type + '-reports', task.id);
    
    if (!fs.existsSync(taskDir)) {
      fs.mkdirSync(taskDir, { recursive: true });
    }
    
    const artifacts: Artifact[] = [];
    
    for (const file of files) {
      const filePath = path.join(taskDir, file.name);
      fs.writeFileSync(filePath, file.content);
      
      artifacts.push({
        id: uuidv4(),
        taskId: task.id,
        type: task.type,
        name: file.name,
        path: filePath,
        size: file.content.length,
        mimeType: this.getMimeType(file.name),
        createdAt: new Date().toISOString(),
        metadata: file.metadata || {},
      });
    }
    
    // Save metadata
    const metaPath = path.join(taskDir, 'metadata.json');
    fs.writeFileSync(metaPath, JSON.stringify({
      taskId: task.id,
      type: task.type,
      createdAt: new Date().toISOString(),
      artifacts: artifacts.length,
    }, null, 2));
    
    // Store in database
    for (const artifact of artifacts) {
      await this.db.artifacts.insert(artifact);
    }
    
    return artifacts;
  }
  
  async list(taskId: string): Promise<Artifact[]> {
    return await this.db.artifacts.findByTaskId(taskId);
  }
  
  async download(artifactId: string): Promise<Buffer> {
    const artifact = await this.db.artifacts.findById(artifactId);
    return fs.readFileSync(artifact.path);
  }
}
```

## Cleanup

Auto-cleanup artifacts older than retention period:

```typescript
async cleanup(): Promise<void> {
  const retention = {
    'audit-reports': 30,
    'build-logs': 7,
    'qa-results': 30,
    'deploy-reports': 90,
    'git-reports': 14,
  };
  
  for (const [type, days] of Object.entries(retention)) {
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    const dir = path.join(this.BASE_PATH, type);
    
    if (fs.existsSync(dir)) {
      const folders = fs.readdirSync(dir);
      for (const folder of folders) {
        const folderPath = path.join(dir, folder);
        const stat = fs.statSync(folderPath);
        
        if (stat.mtimeMs < cutoff) {
          fs.rmSync(folderPath, { recursive: true });
          console.log(`[Cleanup] Removed ${folderPath}`);
        }
      }
    }
  }
}
```
