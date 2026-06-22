# APPROVAL ORCHESTRATOR REPORT

## Phase E3 — CERTIFIED

### Module
`server/src/execution/approval-orchestrator.ts`

### Actions Requiring Approval

- All publish/post actions (SEO, website, social)
- All send actions (email, messages)
- All campaign actions
- All flyer/video distribution
- All deployment actions
- All financial submissions

### Approval Message Format

```
--- APPROVAL REQUIRED ---

Summary:
Mi sẽ thực hiện workflow SEO_CONTENT + WEBSITE_POST cho Raw Sushi.
Các bước: Resolve entity → Pick topic → Generate article → ...

Risk:
Bài viết sẽ được đăng lên website — cần CEO xác nhận nội dung.

Preview:
Workflow ID: SEO-CONTENT-20260615-001
Target: Raw Sushi
Steps: ...

Action: Reply APPROVE / EDIT / CANCEL
```

### Resolution Actions

| Action | Result Status | Meaning |
|---|---|---|
| approve | approved | Proceed with execution |
| edit | rejected | CEO wants modifications |
| cancel | cancelled | CEO cancels the request |

### Safety Features
- Cannot resolve an already-resolved approval (returns null)
- Cannot double-approve
- All approvals persisted to disk with full audit trail
- timestamp on creation and response

### Gates
- [x] APPROVAL_ORCHESTRATOR_CERTIFIED
