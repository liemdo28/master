# N8N Duplicate Workflow Policy

**Version:** 1.0.0
**Date:** 2026-06-28

## Policy

### Rule 1: No Duplicate Workflow ID
Every workflow must have a unique `workflow_id`. If a duplicate is detected:
- **Action:** BLOCK
- **Response:** Return error with existing workflow reference
- **Evidence:** Log to `Mi/n8n/evidence/duplicates/`

### Rule 2: No Duplicate Domain + Schedule + Owner
If a workflow with the same domain, schedule, and owner already exists:
- **Action:** MERGE or BLOCK
- If same output: MERGE into existing workflow
- If different output: BLOCK with conflict report

### Rule 3: Fingerprint-based Dedup
Use workflow-fabric dedup engine to detect:
- Same domain + same action + same time window = duplicate
- **Action:** SKIP_DUPLICATE, preserve first_seen_at, update last_seen_at

### Rule 4: Cross-department Duplicate
Same task routed to two departments:
- **Action:** Assign to primary owner department
- Log to cross-department handoff evidence
- Notify both department heads

### Enforcement

| Check | When | Action |
|-------|------|--------|
| workflow_id uniqueness | On create | BLOCK if duplicate |
| domain+schedule+owner | On create | MERGE or BLOCK |
| fingerprint dedup | On run | SKIP_DUPLICATE |
| cross-dept ownership | On assign | ROUTE_TO_OWNER |

## Evidence

All duplicate detections logged to: `Mi/n8n/evidence/duplicates/`
