# DEPARTMENT ISOLATION AND MAPPING PROOF

**Version:** 1.0.0
**Date:** 2026-06-28

## Summary

| Metric | Value |
|--------|-------|
| Departments tracked | 12 |
| Departments with ownership | 12 |
| Cross-dept handoff rules | 6 |
| Boundary violation rules | 3 |
| Dependency types | 3 |

## Objective: Increase Raw Sushi Online Revenue 10%

| Aspect | Owner | Supporters | Evidence |
|--------|-------|-----------|---------|
| Revenue objective | Executive | Finance, Marketing, Operations | `department-registry.ts` |
| Baseline revenue analysis | Finance | Data Platform | Finance owns financial analysis |
| Traffic/opportunity analysis | Marketing | Operations | Marketing owns SEO and traffic |
| DoorDash campaign visibility | Operations | Marketing, IT | Operations owns DoorDash |
| Creative asset request | Creative | Marketing | Creative owns brand assets |
| Connector health | IT | All | IT owns system infrastructure |
| Approval authority | Executive | All | Executive owns all approvals |
| Evidence storage | IT | All | Single evidence path per task |
| Report merging | Executive | All | Executive merges all reports |

## Rules Enforced

1. Each task has exactly one owner department.
2. Supporting departments listed but cannot own duplicate tasks.
3. Each workflow has exactly one owner.
4. Each OSS has exactly one owner division.
5. Cross-department handoff creates dependency, not duplicate.
6. Evidence stored once per task.

## Modules

| Module | File | Purpose |
|--------|------|---------|
| department-registry | `department-map/department-registry.ts` | 12 departments with ownership |
| boundary-policy | `department-map/department-boundary-policy.ts` | Cross-ownership guard |
| task-ownership-engine | `department-map/task-ownership-engine.ts` | Task assignment |
| dependency-map | `department-map/dependency-map.ts` | Dependency tracking |
| cross-dept-router | `department-map/cross-department-router.ts` | Handoff routing |
| handoff-policy | `department-map/handoff-policy.ts` | Handoff approval |
| evidence-store | `department-map/department-evidence-store.ts` | Evidence per dept |
| scorecard | `department-map/department-scorecard.ts` | Dept metrics |

## Status

`DEPARTMENT_ISOLATION_AND_MAPPING_PROOF_VERIFIED`
