# Scope Boundary Engine
**Module:** DEV3 Phase 13.4  
**Date:** 2026-06-13  
**Status:** PRODUCTION_READY  
**File:** `mi-core/server/src/gstack/pm-agent/scope-boundary.ts`

---

## Objective

Detect problematic patterns in CEO requests before execution begins: ambiguous scope, scope creep, missing requirements, and conflicting objectives.

---

## Output Schema

```typescript
interface ScopeBoundaryResult {
  scope_clarity: 'CLEAR' | 'AMBIGUOUS' | 'MISSING';
  detected_creep: string[];
  missing_requirements: string[];
  conflicts: string[];
  recommendation: 'PROCEED' | 'CLARIFY' | 'REJECT';
  clarification_questions: string[];
  reasons: string[];
}
```

---

## Detection Rules

### Ambiguity Patterns → CLARIFY

| Pattern | Label | Question Asked |
|---------|-------|---------------|
| "fix everything / fix all" | Scope undefined | "Anh muốn fix lỗi cụ thể nào?" |
| "update everything" | Scope undefined | "Anh muốn update component nào?" |
| "check everything" | Overscoped | "Anh muốn check project nào?" |
| "improve / optimize" (vague) | Vague objective | "Anh muốn cải thiện khía cạnh nào?" |
| "asap / immediately" (no scope) | Urgency without scope | "Phần nào là ưu tiên nhất?" |

### Conflict Detection → REJECT

| Pattern Combination | Conflict |
|--------------------|---------|
| "fix bugs" + "no changes" | Cannot fix without modification |
| "deploy" + "rollback" in same request | Contradictory direction |
| "auto execute" + "needs approval" | Cannot be both |

### Scope Creep Detection → WARNING

| Trigger | Creep Warning |
|---------|--------------|
| `dashboard` mentioned | "WhatsApp routing may be affected" |
| `fix.*bug` | "Refactoring unrelated code while fixing" |
| `deploy` | "Upgrading deps as part of deployment" |

### Missing Requirement Detection → WARN

| Intent | Requirement Checked | If Missing |
|--------|-------------------|-----------|
| deploy_release | rollback plan mentioned? | "Rollback plan not specified" |
| fix_bug | post-fix test mentioned? | "Post-fix test verification not mentioned" |
| build_feature | acceptance test mentioned? | "Acceptance test criteria not specified" |

---

## Recommendation Logic

```
if conflicts.length > 0 → REJECT (scope_clarity = MISSING)
if ambiguous patterns found → CLARIFY (scope_clarity = AMBIGUOUS)
if missing_requirements.length > 1 → AMBIGUOUS but still PROCEED with defaults
else → PROCEED (scope_clarity = CLEAR)
```

---

## Example — "Fix everything"

```
Input:  "Fix everything in production immediately"
Result:
  scope_clarity: AMBIGUOUS
  recommendation: CLARIFY
  clarification_questions:
    - "Anh muốn fix những lỗi cụ thể nào?"
    - "Phần nào là ưu tiên cao nhất?"
```

## Acceptance Test Result

**Input:** "Mi ơi kiểm tra Dashboard, tìm lỗi, nếu an toàn thì fix, test lại rồi báo anh."

- Scope clarity: **CLEAR** ✅
- Recommendation: **PROCEED** ✅
- Creep: 0 | Missing: 0 | Conflicts: 0 ✅
