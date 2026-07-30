# Dynamic Skill Selection
**Module:** DEV3 Phase 11.4  
**Date:** 2026-06-13  
**Status:** PRODUCTION_READY  
**File:** `mi-core/server/src/gstack/skills/dynamic-skill-selector.ts`

---

## Before vs After

**Before (hardcoded):**
```typescript
function getSkillsForIntent(intent: string): string[] {
  const map = {
    audit_project: ['health', 'pm2_status', 'source_scan', 'log_scan', 'dashboard_audit'],
    // ... static
  };
  return map[intent] || ['health'];
}
```

**After (dynamic):**
```typescript
function getSkillsForIntent(intent: string): string[] {
  return selectBestSkillChain(intent);
  // → queries registry → tags → rank by reliability → return ordered chain
}
```

---

## Intent → Tag Profile

Each intent has a tag profile defining which tags to require, prefer, and exclude:

| Intent | Required Tags | Preferred Tags | Excluded Tags |
|--------|-------------|----------------|--------------|
| audit_project | safe | audit, monitoring, qa, dashboard | deploy, restart |
| fix_bug | safe, code | scan, qa, test, build | deploy, restart |
| build_feature | safe | code, knowledge, github | restart, test |
| deploy_release | — | deploy, restart, build | — |
| check_status | safe | monitoring, health, system | — |
| monitor_runtime | safe | monitoring, system, log | — |
| search_knowledge | safe | knowledge, search | — |

---

## Discovery Algorithm

```
For each skill in registry:
  1. Skip if disabled OR unavailable
  2. Skip if any excluded tag matches
  3. Skip if required tags not present
  4. Score += 20 × count(preferred tags matched)
  5. Score += 15 × count(explicit query tags matched)
  6. Score += reliability_score / 10
  7. Score += 5 if SAFE

Sort by score descending → take top 6 → return IDs
```

---

## Example — "Mi oi kiem tra Dashboard"

Intent: `audit_project`  
Tag profile: required=[safe], preferred=[audit, monitoring, qa, dashboard], exclude=[deploy, restart]

| Skill | Tags matched | Score |
|-------|-------------|-------|
| health | safe✓, monitoring✓ | 20 + reliability |
| source_scan | safe✓, audit✓, qa✓ | 40 + reliability |
| pm2_status | safe✓, monitoring✓ | 20 + reliability |
| log_scan | safe✓, audit✓ | 20 + reliability |
| dashboard_audit | safe✓, audit✓, qa✓, dashboard✓ | 60 + reliability |
| pm2_restart | deploy✗ | **excluded** |

Result chain: `[dashboard_audit, source_scan, log_scan, health, pm2_status, ...]`

---

## Fallback

If the registry returns 0 results (store empty, all disabled), `selectBestSkillChain` falls back to the static map — the same hardcoded chains from V1. Production never breaks.

---

## Skill Search

```typescript
searchSkills('dashboard')
// Searches: id, name, name_vi, description, tags
// Returns: [dashboard_audit]

searchSkills('qa')
// Returns: [source_scan, build_check, regression_suite, dashboard_audit]
```
