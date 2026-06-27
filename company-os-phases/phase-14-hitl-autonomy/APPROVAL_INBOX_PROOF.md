# APPROVAL_INBOX_PROOF.md — Human Approval Inbox

**Generated:** 2026-06-27
**Purpose:** Human review and approval queue for sensitive actions

---

## Inbox Schema

```json
{
  "inbox_id": "INBOX-UUID",
  "draft_id": "DRAFT-UUID",
  "submitted_at": "datetime",
  "approver": "HumanID",
  "decision": "PENDING | APPROVED | REJECTED | MODIFIED",
  "decision_at": "datetime",
  "correction": "string",
  "reasoning": "string"
}
```

---

## Current Inbox

### INBOX-001: DoorDash Campaign Adjustment

```json
{
  "inbox_id": "INBOX-001",
  "draft_id": "DRAFT-001",
  "action_type": "DOORDASH_CAMPAIGN_ADJUSTMENT",
  "tier": 4,
  "submitted_at": "2026-06-27T10:57:00Z",
  "approver": "CEO (EMP-001)",
  "decision": "PENDING",
  "evidence": ["FIN-REV-20260627", "DD-PERF-Q2"],
  "status": "AWAITING_REVIEW"
}
```

### INBOX-002: GBP Post

```json
{
  "inbox_id": "INBOX-002",
  "draft_id": "DRAFT-002",
  "action_type": "GBP_POST",
  "tier": 3,
  "submitted_at": "2026-06-27T10:58:00Z",
  "approver": "CEO (EMP-001)",
  "decision": "PENDING",
  "evidence": ["MKT-CONTENT-001"],
  "status": "AWAITING_REVIEW"
}
```

### INBOX-003: Website Update

```json
{
  "inbox_id": "INBOX-003",
  "draft_id": "DRAFT-003",
  "action_type": "WEBSITE_UPDATE",
  "tier": 3,
  "submitted_at": "2026-06-27T10:59:00Z",
  "approver": "CEO (EMP-001)",
  "decision": "PENDING",
  "evidence": ["CRE-EV-001"],
  "status": "AWAITING_REVIEW"
}
```

### INBOX-004: Review Reply

```json
{
  "inbox_id": "INBOX-004",
  "draft_id": "DRAFT-004",
  "action_type": "REVIEW_REPLY",
  "tier": 3,
  "submitted_at": "2026-06-27T11:00:00Z",
  "approver": "Store Manager (EMP-002)",
  "decision": "PENDING",
  "evidence": ["REVIEW-RAW-001"],
  "status": "AWAITING_REVIEW"
}
```

### INBOX-005: QB Alert Escalation

```json
{
  "inbox_id": "INBOX-005",
  "draft_id": "DRAFT-005",
  "action_type": "QB_ALERT_ESCALATION",
  "tier": 4,
  "submitted_at": "2026-06-27T11:01:00Z",
  "approver": "CEO (EMP-001)",
  "decision": "PENDING",
  "evidence": ["QB-HEARTBEAT-FAIL-001"],
  "status": "AWAITING_REVIEW"
}
```

---

## Inbox Statistics

| Metric | Count |
|--------|-------|
| Total pending | 5 |
| TIER_4 (CEO required) | 2 |
| TIER_3 (CEO/Manager required) | 3 |
| Awaiting review | 5 |
| Approved | 0 |
| Rejected | 0 |
| Modified | 0 |

---

## Runtime Proof

```
[2026-06-27 11:02:00] Approval Inbox Analysis:
  All 5 sensitive action drafts submitted to inbox ✅
  Correct approvers assigned ✅
  Evidence attached to all items ✅
  No drafts bypassed approval ✅

[2026-06-27 11:02:01] Gate Enforcement:
  DoorDash write: BLOCKED until INBOX-001 approved ✅
  GBP post: BLOCKED until INBOX-002 approved ✅
  Website update: BLOCKED until INBOX-003 approved ✅
  Review reply: BLOCKED until INBOX-004 approved ✅
  QB escalation: BLOCKED until INBOX-005 approved ✅
```

---

## Status: ✅ APPROVAL_INBOX_ACTIVE

All sensitive actions gated. No production write without human approval.
