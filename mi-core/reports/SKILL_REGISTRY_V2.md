# Skill Registry V2
**Module:** DEV3 Phase 11.3  
**Date:** 2026-06-13  
**Status:** PRODUCTION_READY  
**File:** `mi-core/server/src/gstack/skills/skill-store.ts`

---

## Overview

Skill Registry V2 replaces the hardcoded `SKILLS` Record in `skill-registry.ts` with a JSON-backed store at `.local-agent-global/skills/registry.json`. The registry is the single source of truth for all skill metadata.

---

## Registered Skills (v1 — production)

| ID | Version | Category | Tags | Available |
|----|---------|----------|------|-----------|
| health | 1.0.0 | system | health, monitoring, safe, system | ✅ |
| pm2_status | 1.0.0 | system | pm2, monitoring, process, system, safe | ✅ |
| pm2_restart | 1.0.0 | system | pm2, deploy, restart, system | ✅ |
| source_scan | 1.0.0 | code | code, audit, scan, safe, qa | ✅ |
| log_scan | 1.0.0 | system | log, audit, scan, safe, system | ✅ |
| build_check | 1.0.0 | code | code, build, typescript, safe, qa | ✅ |
| regression_suite | 1.0.0 | code | test, regression, qa, safe, ceo | ✅ |
| dashboard_audit | **1.1.0** | product | dashboard, audit, qa, safe, product | ✅ |
| knowledge_search | 1.0.0 | knowledge | knowledge, search, safe, qdrant, sqlite | ✅ |
| github_read | 1.0.0 | code | github, code, safe, read | ❌ (no GH_TOKEN) |
| review_automation | 1.0.0 | product | review, automation, safe, product | ✅ |

---

## New Capabilities

### Skill Discovery
```typescript
discoverSkills({ intent: 'audit_project', available_only: true })
// Returns: ranked list of SkillDiscoveryResult with match_score + reliability
```

### Skill Search (text)
```typescript
searchSkills('dashboard')
// Returns: [dashboard_audit, knowledge_search] — searches id, name, name_vi, description, tags
```

### Skill Tagging
Every skill has a `tags[]` array. Tags are queried by the dynamic selector to find the best skill chain for an intent.

### Dependency Tracking
```typescript
getSkillFromStore('dashboard_audit').dependencies
// → ['health', 'source_scan']
```

---

## Registry File Format

```json
{
  "dashboard_audit": {
    "id": "dashboard_audit",
    "name": "Dashboard Audit",
    "version": "1.1.0",
    "owner": "mi-core",
    "category": "product",
    "tags": ["dashboard", "audit", "qa", "safe", "product"],
    "approval_class": "SAFE",
    "risk_level": 1,
    "dependencies": ["health", "source_scan"],
    "available": true,
    "disabled": false,
    "installed_at": "2026-06-13T...",
    "active_version": "1.1.0",
    "versions": [
      { "version": "1.0.0", "active": false, "rollback_available": true, "changelog": "Initial release" },
      { "version": "1.1.0", "active": true, "rollback_available": false, "changelog": "Added connector status check" }
    ]
  }
}
```

---

## Backward Compatibility

`skill-registry.ts` still exports `listSkills()`, `getSkill()`, `runSkill()`, `getSkillsForIntent()` — same public API as V1. The implementation now delegates to the JSON store. Existing code (orchestrator, agents, routes) requires zero changes.
