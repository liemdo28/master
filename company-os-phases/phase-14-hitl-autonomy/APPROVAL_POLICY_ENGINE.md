# APPROVAL_POLICY_ENGINE.md — Approval Policy Engine

**Generated:** 2026-06-27
**Purpose:** Define which actions require human approval before execution

---

## Approval Tiers

| Tier | Action Types | Examples | Required Approver |
|------|-------------|----------|------------------|
| TIER_0_SAFE | Internal read operations | Generate report, route approval, classify issue | None |
| TIER_1_LOW | Internal writes | Create task, send alert, archive evidence | Auto-approve |
| TIER_2_MEDIUM | External writes | Publish draft, schedule reminder, refresh sync | Store Manager |
| TIER_3_HIGH | Customer-facing | Publish GBP post, review reply, public content | CEO |
| TIER_4_CRITICAL | Financial | Payroll, campaign budget, menu edit, QB write | CEO + evidence |
| TIER_5_FORBIDDEN | Prohibited | Banking, tax, payroll write, public customer reply | BLOCKED |

---

## Approval Policy Matrix

| Action | Tier | Required Approver | Evidence Required |
|--------|------|-----------------|-----------------|
| Create internal task | 1 | Auto-approve | None |
| Send internal alert | 1 | Auto-approve | Alert reason |
| Generate report | 0 | None | None |
| Refresh read-only sync | 0 | None | None |
| Archive evidence | 1 | Auto-approve | Evidence ID |
| Classify issue | 0 | None | None |
| Route approval | 0 | None | None |
| Create draft | 2 | Store Manager | Draft content |
| Schedule internal reminder | 1 | Auto-approve | Reminder text |
| DoorDash campaign adjustment | 4 | CEO | ROI evidence |
| GBP post | 3 | CEO | Content review |
| Website update | 3 | CEO | Change summary |
| Review reply | 3 | Store Manager | Reply text |
| QB alert escalation | 4 | CEO | Alert evidence |
| Toast menu edit | 4 | CEO | Change evidence |
| DoorDash menu edit | 4 | CEO | Change evidence |
| Campaign budget change | 4 | CEO | ROI evidence |

---

## Approval Rules

```
Rule 1: TIER_4_CRITICAL always requires CEO + written evidence
Rule 2: TIER_5_FORBIDDEN always BLOCKED — no approval possible
Rule 3: TIER_3_HIGH requires CEO approval with content review
Rule 4: TIER_2_MEDIUM requires Store Manager approval
Rule 5: TIER_0 and TIER_1 are autonomous — no approval needed
```

---

## Status: ✅ APPROVAL_POLICY_ENGINE_ACTIVE
