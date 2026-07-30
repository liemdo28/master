# Owner Memory
**Phase 15.4 — OwnerMemory**
**Status: PRODUCTION**

---

## Purpose

Builds a behavioral profile for each agent role — what they typically work on, their success rate, their load level, and how fast they resolve issues.

---

## Role Mapping

| Display Name | DB Agent Roles |
|---|---|
| Dev1 | `engineering_manager`, `developer` |
| PM | `product_manager` |
| QA Agent | `qa`, `qa_agent` |
| Release | `release` |
| Auditor | `auditor`, `auditor_agent` |

---

## Questions Answered

| Question | Function |
|----------|----------|
| What does Dev1 usually work on? | `getOwnerProfile('dev1')` |
| Which owner resolves fastest? | `getResolutionSpeedRanking()` |
| Who is overloaded? | `getOverloadedOwners(50)` |
| Who was most active last month? | `getOwnerActivityRanking(30)` |

---

## Owner Profile

```typescript
interface OwnerProfile {
  total_actions: number;
  pass_count: number;
  success_rate: number;         // 0-100
  top_targets: Array<{ target: string; count: number }>;
  top_action_types: Array<{ action_type: string; count: number }>;
  avg_duration_ms: number;
  load_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'OVERLOADED';
}
```

**Load levels:**

| Level | Action Count |
|-------|-------------|
| LOW | < 10 |
| MEDIUM | 10–29 |
| HIGH | 30–59 |
| OVERLOADED | ≥ 60 |

---

## Acceptance Test Result — Q3

> "Dev1 thường fix gì?"

**Mi's answer:** *"Dev1 thường làm 'fix_bug' trên project 'dashboard'. Tổng 17 actions, success rate 82%."*

**Top targets:** dashboard (6), review-automation (4), mi-core (4)
**Top actions:** fix_bug (7), system_scan (3), plan_technical_work (3)

---

## API

```
GET /api/memory/owners               — activity ranking + overloaded + speed ranking
GET /api/memory/owners/:role         — full profile for a role (dev1, qa, pm, etc.)
```

**Query params for /owners:** `days` (default 30)
