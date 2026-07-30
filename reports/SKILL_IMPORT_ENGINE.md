# Skill Import Engine
**Module:** DEV3 Phase 11.2  
**Date:** 2026-06-13  
**Status:** PRODUCTION_READY  
**File:** `mi-core/server/src/gstack/skills/skill-import-service.ts`

---

## Capabilities

| Operation | Function | Effect |
|-----------|----------|--------|
| Install | `installSkill(def)` | Adds skill to registry; fails if already exists |
| Update | `updateSkill(id, newVersion, patch, changelog)` | Upgrades version; archives old |
| Rollback | `rollbackSkill(id)` | Restores previous version |
| Disable | `disableSkill(id)` | Sets available=false, disabled=true |
| Enable | `enableSkill(id)` | Restores availability |
| Remove | `removeSkill(id)` | Deletes from registry (protected skills refused) |

---

## Install

```typescript
installSkill({
  id: 'my_skill',
  name: 'My Skill',
  name_vi: 'Kỹ năng của tôi',
  version: '1.0.0',
  owner: 'hoang.d.le@gmail.com',
  category: 'code',
  tags: ['audit', 'safe', 'custom'],
  description: 'Does something useful',
  approval_class: 'SAFE',
  risk_level: 1,
  params: ['target'],
  dependencies: ['health'],
  available: true,
  disabled: false,
  active_version: '1.0.0',
  changelog: 'Initial install',
});
// → { success: true, action: 'install', message: 'Installed my_skill@1.0.0' }
```

---

## Update

```typescript
updateSkill('dashboard_audit', '1.2.0', { description: 'Enhanced audit with screenshot support' }, 'Added screenshot evidence collection');
// → { success: true, action: 'update', message: 'Updated dashboard_audit: 1.1.0 → 1.2.0' }
// Previous 1.1.0 archived with rollback_available: true
```

---

## Rollback

```typescript
rollbackSkill('dashboard_audit');
// → { success: true, action: 'rollback', message: 'Rolled back dashboard_audit to 1.1.0' }
```

---

## Protected Skills

These skills cannot be removed (core system dependencies):
- `health`
- `pm2_status`  
- `source_scan`

---

## Import Status

```typescript
getImportStatus();
// → { total: 11, available: 10, disabled: 0, requires_approval: 2 }
```

---

## Storage

All skill definitions persist to:
```
.local-agent-global/skills/registry.json
```

Seeded with 11 built-in skills on first boot (idempotent — only adds missing skills).
