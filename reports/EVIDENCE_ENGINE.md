# Evidence Engine
**Module:** DEV3 Phase 6  
**Date:** 2026-06-13  
**Status:** PRODUCTION_READY  
**Version:** 1.0.0

---

## Objective

Every Work Order must generate verifiable evidence. No PASS allowed without evidence. All evidence files are real files on disk — not in-memory records.

---

## Evidence Directory Structure

Each Work Order gets its own isolated evidence directory:

```
.local-agent-global/evidence/
  WO-20260613-018/
    source_scan.log          ← source code scan findings
    pm2_status.log           ← pm2 process snapshot (JSON)
    error_log.log            ← error log collection
    health_check.json        ← service health results
    test_results.json        ← QA test case results
    dashboard_audit.json     ← dashboard-specific audit
    qa_report.md             ← QA certification report
    evidence_index.json      ← master manifest (auto-generated)
```

---

## Evidence Types Collected

| # | Type | File | Collector | Description |
|---|------|------|-----------|-------------|
| 1 | `source_scan` | source_scan.log | Auditor / Engineering Manager | Static analysis of source files — TODOs, credentials, issues |
| 2 | `pm2_status` | pm2_status.log | Engineering Manager | Full pm2 process snapshot (JSON format from `pm2 jlist`) |
| 3 | `error_log` | error_log.log | Engineering Manager | PM2 error log — runtime errors and stack traces |
| 4 | `health_check` | health_check.json | QA Agent / Health Skill | HTTP health check results for all services |
| 5 | `test_results` | test_results.json | QA Agent | Structured test case results with pass/fail per case |
| 6 | `dashboard_audit` | dashboard_audit.json | Dashboard Audit Skill | Dashboard-specific health + connector status |
| 7 | `qa_report` | qa_report.md | QA Certification Engine | 5-gate certification report with cert ID |
| 8 | `command_output` | cmd_*.log | Any agent | Output of any executed shell command |
| 9 | `artifact` | *.md / *.json | Any agent | Generated reports and artifacts |

---

## Evidence Package

`generateEvidencePackage(workOrderId)` produces:

```typescript
interface EvidencePackage {
  work_order_id: string;        // WO-YYYYMMDD-NNN
  directory: string;            // absolute path to evidence dir
  index_file: string;           // path to evidence_index.json
  files: EvidenceFile[];        // all collected evidence files
  ready: boolean;               // true when required types present
  missing_required: string[];   // names of missing required files
}
```

**Required for `ready = true`:**
- `health_check.json` — service health confirmed
- `test_results.json` — tests have been executed

---

## EvidenceFile Schema

```typescript
interface EvidenceFile {
  file_id: string;          // EVF-WO-YYYYMMDD-NNN-001
  work_order_id: string;
  ts: string;               // ISO timestamp
  type: EvidenceFileType;
  filename: string;         // relative filename
  filepath: string;         // absolute path
  agent_role: string;       // which agent wrote this
  title: string;            // human-readable label
  size_bytes: number;
  severity: 'info' | 'warning' | 'critical';
  outcome: 'pass' | 'fail' | 'warn';
  summary: string;          // one-line summary
  metadata: Record<string, any>;
}
```

---

## Named Evidence Writers

Each agent writes evidence using typed functions:

| Function | File Written | Agent |
|----------|-------------|-------|
| `writeSourceScan(woId, output, role)` | source_scan.log | engineering_manager |
| `writePm2Status(woId, output, role)` | pm2_status.log | engineering_manager |
| `writeErrorLog(woId, output, role)` | error_log.log | engineering_manager |
| `writeHealthCheck(woId, results, role)` | health_check.json | qa_agent |
| `writeTestResults(woId, tests, role)` | test_results.json | qa_agent |
| `writeDashboardAudit(woId, data, role)` | dashboard_audit.json | auditor |
| `writeQaReport(woId, content, role)` | qa_report.md | auditor |
| `writeCommandOutput(woId, cmd, output, ok, role)` | cmd_*.log | any |
| `writeArtifact(woId, filename, content, role, title)` | *.md / *.json | any |

---

## APIs

### GET /api/gstack/evidence/:id
Returns the full Evidence Package for a Work Order.

```json
{
  "work_order_id": "WO-20260613-018",
  "directory": "E:/Project/Master/mi-core/.local-agent-global/evidence/WO-20260613-018",
  "ready": true,
  "missing_required": [],
  "files": [
    {
      "file_id": "EVF-WO-20260613-018-001",
      "type": "source_scan",
      "filename": "source_scan.log",
      "outcome": "pass",
      "summary": "2 finding(s) in source scan",
      "agent_role": "engineering_manager"
    }
  ]
}
```

### GET /api/gstack/evidence/:id/:filename
Returns the raw content of a specific evidence file.

```
GET /api/gstack/evidence/WO-20260613-018/health_check.json
→ 200 application/json — raw health check data
```

---

## Execution Timeline

Evidence files are timestamped individually. The `evidence_index.json` manifest records creation and last-update times, providing a reconstruction of the execution timeline:

```json
{
  "work_order_id": "WO-20260613-018",
  "created_at": "2026-06-13T10:00:00Z",
  "updated_at": "2026-06-13T10:00:18Z",
  "files": [
    { "ts": "2026-06-13T10:00:02Z", "type": "source_scan", "filename": "source_scan.log" },
    { "ts": "2026-06-13T10:00:04Z", "type": "pm2_status", "filename": "pm2_status.log" },
    { "ts": "2026-06-13T10:00:14Z", "type": "health_check", "filename": "health_check.json" },
    { "ts": "2026-06-13T10:00:14Z", "type": "test_results", "filename": "test_results.json" },
    { "ts": "2026-06-13T10:00:17Z", "type": "qa_report", "filename": "qa_report.md" }
  ]
}
```

---

## Certification Status

| Criterion | Result |
|-----------|--------|
| Evidence written to disk | ✅ Real files — not in-memory |
| Per-WO isolation | ✅ Separate directory per WO |
| Named typed writers | ✅ 9 named writer functions |
| Evidence manifest | ✅ evidence_index.json auto-maintained |
| API access | ✅ GET /api/gstack/evidence/:id |
| Required types enforced | ✅ health_check + test_results required |
| G2 gate integration | ✅ QA Certification checks real files |

**Phase 6: PRODUCTION_READY**
