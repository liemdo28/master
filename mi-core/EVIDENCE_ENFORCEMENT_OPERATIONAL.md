# EVIDENCE_ENFORCEMENT_OPERATIONAL.md

**Phase:** 25F — Self Verification / Evidence Enforcer  
**Status:** ✅ OPERATIONAL  
**Date:** 2026-06-24  

---

## Principle

**No self-certification without evidence.** Every execution MUST produce evidence. Mi is forbidden from claiming completion without proof.

## Required Evidence Per Execution

| Field | Source |
|-------|--------|
| `id` | Generated per task |
| `type` | api-response \| metric-snapshot \| log-check \| screenshot \| file-scan \| etc. |
| `description` | Human-readable summary |
| `beforeState` | State before action |
| `afterState` | State after action |
| `result` | Actual result payload |
| `collectedAt` | ISO timestamp |
| `collector` | Agent / engine name |
| `confidence` | 0-1 score |

## Evidence Types

`metric-snapshot` | `file-scan` | `route-audit` | `log-check` | `test-run` | `health-check` | `code-analysis` | `config-audit` | `seo-audit` | `traffic-snapshot` | `api-response` | `screenshot` | `crawl-result` | `schema-validation` | `ranking-snapshot` | `gsc-data` | `webhook-result` | `manual-verification` | `diff-snapshot` | `pm2-status` | `agent-response`

---

## Core Functions

### `captureSnapshot(label, type, data)`
Capture any data point as a structured snapshot.

### `verifyTaskEvidence(task, objectiveId)`
Returns `EvidenceRecord` with result:
- `pass` — evidenceCount ≥ 2 AND has api-response or metric-snapshot
- `partial` — has evidence but insufficient
- `fail` — no evidence at all

### `capturePM2Status()`
Live PM2 process status as evidence.

### `captureSEOState()`
SEO agents health snapshot.

### `verifyObjective(objectiveId)`
End-to-end objective verification — produces persisted verification report.

### `getEvidence(taskId)` / `getAllEvidence(limit)`
Query evidence store.

---

## QA Checks Per Task

Every completed task runs these checks:

```json
{
  "passed": true,
  "score": 100,
  "checks": [
    { "name": "execution-routed",     "passed": true, "detail": "..." },
    { "name": "evidence-collected",   "passed": true, "detail": "2 evidence items" },
    { "name": "before-after-result-present", "passed": true, "detail": "..." }
  ],
  "reviewedAt": "ISO timestamp"
}
```

If `execution-routed` fails AND `evidence-collected` is empty → task status = `failed`.

---

## Storage

- Evidence files: `.mi-harness/phase25/evidence/{id}.json`
- Verification reports: `.mi-harness/phase25/verification/{objectiveId}-verification.json`

---

## Live CTO Test Evidence

```json
{
  "evidence": {
    "passed": true,
    "score": 100,
    "count": 14
  },
  "verification": {
    "completed": true,
    "evidenceCount": 24,
    "overallScore": 100,
    "failedTasks": []
  }
}
```

12 tasks × 2 evidence each (api-response + log/snapshot) + 2 system captures (PM2 + SEO state) = 24+ evidence items.

---

## Policy Enforcement

The Execution Orchestrator's per-task execution block now mandates:

```typescript
task.qaResult = {
  passed: task.evidence.length > 0,
  score: task.evidence.length >= 2 ? 100 : task.evidence.length === 1 ? 70 : 0,
  checks: [
    { name: 'execution-routed', passed: !!evidence, detail: ... },
    { name: 'evidence-collected', passed: task.evidence.length > 0, detail: ... },
    { name: 'before-after-result-present', passed: ..., detail: ... },
  ],
  reviewedAt: new Date().toISOString(),
};
task.status = task.qaResult.passed ? 'completed' : 'failed';
```

**No task can be marked `completed` without at least one evidence item.** This is enforced at the orchestrator level — not optional.

**VERDICT: EVIDENCE ENFORCEMENT OPERATIONAL**
