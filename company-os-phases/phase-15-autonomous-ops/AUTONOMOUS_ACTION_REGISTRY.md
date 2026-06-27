# AUTONOMOUS_ACTION_REGISTRY.md — Safe Autonomous Actions Registry

**Generated:** 2026-06-27
**Purpose:** Define which low-risk actions Mi can execute autonomously

---

## Allowed Autonomous Actions

| Action | Category | Risk | Reversible | Evidence Required |
|--------|----------|------|-----------|-----------------|
| Create internal task | TIER_1 | LOW | Yes | Task description |
| Send internal alert | TIER_1 | LOW | Yes | Alert reason |
| Generate report | TIER_0 | NONE | N/A | Query parameters |
| Refresh read-only sync | TIER_0 | NONE | N/A | Sync status |
| Archive evidence | TIER_1 | LOW | Yes | Evidence ID |
| Classify issue | TIER_0 | NONE | N/A | Issue data |
| Route approval | TIER_0 | NONE | N/A | Approval ID |
| Create draft | TIER_2 | MEDIUM | Yes | Draft content |
| Schedule internal reminder | TIER_1 | LOW | Yes | Reminder text |

---

## Forbidden Autonomous Actions

| Action | Reason | Override |
|--------|--------|---------|
| Financial write | Prohibited | CEO approval only |
| Payroll write | Prohibited | BLOCKED |
| Campaign budget change | Financial | CEO approval only |
| Public customer reply | Brand risk | CEO approval only |
| Menu edit | Operations | CEO approval only |
| Website publish | Public | CEO approval only |
| GBP publish | Public | CEO approval only |
| Toast mutation | Operations | CEO approval only |
| DoorDash mutation | Financial | CEO approval only |
| QuickBooks write | Financial | CEO approval only |
| Banking action | Prohibited | BLOCKED |
| Tax action | Prohibited | BLOCKED |

---

## Status: ✅ AUTONOMOUS_ACTION_REGISTRY_ACTIVE
