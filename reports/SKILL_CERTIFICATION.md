# Skill Certification
**Module:** DEV3 Phase 12.5  
**Date:** 2026-06-13  
**Status:** PRODUCTION_READY  
**File:** `mi-core/server/src/gstack/skills/skill-certification.ts`

---

## Certification Levels

```
EXPERIMENTAL → BETA → CERTIFIED → PRODUCTION
```

| Level | Min Executions | Min Success Rate | Trust Bonus |
|-------|---------------|-----------------|-------------|
| EXPERIMENTAL | 0 | 0% | +0 |
| BETA | 10 | 70% | +5 |
| CERTIFIED | 25 | 85% | +12 |
| PRODUCTION | 50 | 95% | +20 |

---

## Promotion Logic

Each call to `certifySkill(id)` reads the current reliability metrics and applies the highest threshold the skill qualifies for. Certification is **computed, not manually set** — it reflects the current execution record.

```typescript
certifySkill('health')
// → { level: 'PRODUCTION', execution_count: 62, success_rate: 0.984 }
// → next_level: undefined (already at max)
```

---

## Acceptance Test Results

| Skill | Level | Executions | Success Rate | Next |
|-------|-------|-----------|-------------|------|
| **health** | **PRODUCTION** | 62 | 98.4% | — (max) |
| **pm2_status** | **PRODUCTION** | 61 | 100.0% | — (max) |
| **dashboard_audit** | **PRODUCTION** | 60 | 95.0% | — (max) |
| source_scan | CERTIFIED | 62 | 93.5% | PRODUCTION (needs 95%+) |
| regression_suite | CERTIFIED | 61 | 88.5% | PRODUCTION (needs 95%+) |

**Observations:**
- 3 of 5 skills reached PRODUCTION in 60 executions.
- `source_scan` and `regression_suite` stuck at CERTIFIED — their natural failure rates (6.5% and 11.5%) prevent them from reaching the 95% threshold.
- This is correct: `regression_suite` depends on live Jarvis responses and has inherent variability. CERTIFIED is its appropriate steady-state.

---

## Certification Schema

```typescript
interface SkillCertification {
  skill_id: string;
  level: CertificationLevel;
  execution_count: number;
  success_rate: number;
  certified_at: string;
  promoted_from?: CertificationLevel;     // set on promotion
  next_level?: CertificationLevel;
  next_level_requirements?: string;
}
```

Example output:
```json
{
  "skill_id": "source_scan",
  "level": "CERTIFIED",
  "execution_count": 62,
  "success_rate": 0.935,
  "certified_at": "2026-06-13T...",
  "next_level": "PRODUCTION",
  "next_level_requirements": "success rate ≥ 95% (currently 93.5%)"
}
```

---

## Storage

```
.local-agent-global/skills/certifications.json
```

Re-certified on each `certifySkill()` call (called automatically by Trust Score engine after each evaluation cycle).
