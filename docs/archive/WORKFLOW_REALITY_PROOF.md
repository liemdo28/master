# WORKFLOW REALITY PROOF

## Phase E8 — CERTIFIED

### Module
`server/src/execution/workflow-reality-proofer.ts`

### Principle
When Mi says "Em đã tạo workflow" → verify actual workflow exists.
When Mi says "Em đã tạo draft" → verify file exists.
When Mi says "Đang chờ duyệt" → verify approval exists.

### Claim Types Verified

| Claim | Verification | Evidence |
|---|---|---|
| workflow_created | File exists in .local-agent-global/workflows/ | File path, status, step count |
| draft_created | Workflow status is draft/draft_created OR preview file exists | File size, modification time |
| approval_pending | Approval record exists with status=pending | Approval ID, status |
| step_completed | Step exists with status=done/running | Step name, output path |
| queue_job_created | Job exists in queue | Job ID, status |

### Fake Claim Detection

```
verifyWorkflowClaim('FAKE-WF-123')
→ is_real: false
→ evidence: 'No file found for workflow FAKE-WF-123'
```

### Reality Report Format

```
=== WORKFLOW REALITY PROOF ===

[VERIFIED] workflow_created: Workflow SEO-CONTENT-... exists
  Evidence: File: .../SEO-CONTENT-...json | Status: draft_created | Steps: 8

[VERIFIED] draft_created: Draft file exists
  Evidence: File: .../seo-preview-...md | Size: 5234 bytes

[VERIFIED] approval_pending: Approval APPR-... pending
  Evidence: Approval ID: APPR-... | Status: pending

RESULT: All claims verified.
```

### Safety
- Every claim must have file-system evidence
- No fake workflow IDs accepted
- Real-time verification on demand

### Gates
- [x] WORKFLOW_REALITY_CERTIFIED
