# RISK_TIER_MODEL.md — Risk Tier Classification

**Generated:** 2026-06-27
**Purpose:** Classify action risk levels for approval routing

---

## Risk Classification Matrix

| Risk Level | Criteria | Actions Allowed | Human Approval |
|------------|----------|----------------|---------------|
| NONE | No external impact | Internal read, classification | None |
| LOW | Reversible, internal | Task creation, alerts | Auto-approve |
| MEDIUM | External but low impact | Drafts, reminders | Store Manager |
| HIGH | External, visible to others | Public posts, review replies | CEO |
| CRITICAL | Financial, legal, brand | Budget changes, menu edits, QB writes | CEO + Evidence |
| FORBIDDEN | Regulatory, financial write | Banking, tax, payroll | BLOCKED |

---

## Action Risk Assessment

| Action | Risk Level | Reversibility | External Impact | Approval Path |
|--------|-----------|--------------|----------------|--------------|
| Internal report generation | NONE | N/A | None | Autonomous |
| DoorDash campaign +$100 | LOW | Yes | Minimal | Auto-approve |
| Review reply draft | MEDIUM | Yes | Customer | Store Manager |
| GBP post publish | HIGH | Partial | Public | CEO |
| Campaign budget +$500 | CRITICAL | Partial | Financial | CEO + Evidence |
| QB invoice write | CRITICAL | No | Financial | CEO + Evidence |
| Toast menu edit | CRITICAL | No | Customer orders | CEO + Evidence |
| Payroll write | FORBIDDEN | No | Legal | BLOCKED |
| Tax filing | FORBIDDEN | No | Legal | BLOCKED |

---

## Status: ✅ RISK_TIER_MODEL_ACTIVE
