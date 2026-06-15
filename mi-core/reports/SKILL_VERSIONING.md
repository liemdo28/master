# Skill Versioning
**Module:** DEV3 Phase 11.5  
**Date:** 2026-06-13  
**Status:** PRODUCTION_READY

---

## Version Model

Every skill tracks its full version history:

```
skill.versions = [
  { version: "1.0.0", active: false, rollback_available: true, changelog: "Initial release" },
  { version: "1.1.0", active: true,  rollback_available: false, changelog: "Added connector status" },
]
skill.active_version = "1.1.0"
```

---

## Version Lifecycle

```
Install 1.0.0
  → versions: [{ v1.0.0, active: true, rollback: false }]

Update to 1.1.0
  → versions: [{ v1.0.0, active: false, rollback: true }, { v1.1.0, active: true, rollback: false }]

Rollback to 1.0.0
  → versions: [{ v1.0.0, active: true, rollback: false }, { v1.1.0, active: false, rollback: true }]
```

---

## Current Versions in Production

| Skill | Active Version | Previous Versions | Rollback Available |
|-------|---------------|-------------------|--------------------|
| health | 1.0.0 | — | No |
| pm2_status | 1.0.0 | — | No |
| source_scan | 1.0.0 | — | No |
| log_scan | 1.0.0 | — | No |
| build_check | 1.0.0 | — | No |
| regression_suite | 1.0.0 | — | No |
| **dashboard_audit** | **1.1.0** | **1.0.0** | **Yes** |
| knowledge_search | 1.0.0 | — | No |

`dashboard_audit` is the only skill with multiple versions — it was updated from 1.0.0 (basic audit) to 1.1.0 (added connector status check).

---

## API

```typescript
// Get version history
getSkillVersions('dashboard_audit')
// → [{ version: '1.0.0', active: false, rollback_available: true }, { version: '1.1.0', active: true, ... }]

// Update skill to new version
updateSkill('dashboard_audit', '1.2.0', { description: 'New desc' }, 'Added screenshot support')

// Rollback
rollbackSkill('dashboard_audit')
// → 'Rolled back dashboard_audit to 1.0.0'
```

---

## Reliability per Version

Metrics track the version alongside each execution:

```json
{
  "skill_id": "dashboard_audit",
  "version": "1.1.0",
  "executed_at": "2026-06-13T10:30:00Z",
  "success": true,
  "duration_ms": 450
}
```

This allows comparing reliability between versions when a degradation is suspected.
