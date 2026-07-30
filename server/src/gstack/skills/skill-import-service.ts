/**
 * Skill Import Service — Phase 11
 * install / update / disable / remove skills from the registry.
 */

import type { AgentSkillDefinition, SkillVersion } from './agent-skill-schema';
import {
  getAllSkillsFromStore, getSkillFromStore, upsertSkill, patchSkill,
  removeSkillFromStore, skillExistsInStore,
} from './skill-store';

export interface ImportResult {
  success: boolean;
  skill_id: string;
  action: string;
  message: string;
}

// ── Install ────────────────────────────────────────────────────────────────────

export function installSkill(def: Omit<AgentSkillDefinition, 'installed_at' | 'updated_at' | 'versions'> & { changelog?: string }): ImportResult {
  if (skillExistsInStore(def.id)) {
    return { success: false, skill_id: def.id, action: 'install', message: `Skill '${def.id}' already installed. Use updateSkill() to upgrade.` };
  }

  const now = new Date().toISOString();
  const version: SkillVersion = {
    version: def.version,
    released_at: now,
    changelog: def.changelog || 'Initial install',
    active: true,
    rollback_available: false,
  };

  const full: AgentSkillDefinition = {
    ...def,
    installed_at: now,
    updated_at: now,
    active_version: def.version,
    versions: [version],
  };

  upsertSkill(full);
  return { success: true, skill_id: def.id, action: 'install', message: `Installed ${def.id}@${def.version}` };
}

// ── Update ─────────────────────────────────────────────────────────────────────

export function updateSkill(id: string, newVersion: string, patch: Partial<AgentSkillDefinition>, changelog = ''): ImportResult {
  const existing = getSkillFromStore(id);
  if (!existing) {
    return { success: false, skill_id: id, action: 'update', message: `Skill '${id}' not found. Use installSkill() first.` };
  }

  // Mark all previous versions as inactive + rollback_available
  const prevVersions: SkillVersion[] = existing.versions.map(v => ({ ...v, active: false, rollback_available: true }));
  const newVer: SkillVersion = {
    version: newVersion,
    released_at: new Date().toISOString(),
    changelog: changelog || `Updated to ${newVersion}`,
    active: true,
    rollback_available: false,
  };

  const updated: AgentSkillDefinition = {
    ...existing,
    ...patch,
    version: newVersion,
    active_version: newVersion,
    updated_at: new Date().toISOString(),
    versions: [...prevVersions, newVer],
  };

  upsertSkill(updated);
  return { success: true, skill_id: id, action: 'update', message: `Updated ${id}: ${existing.version} → ${newVersion}` };
}

// ── Rollback ───────────────────────────────────────────────────────────────────

export function rollbackSkill(id: string): ImportResult {
  const existing = getSkillFromStore(id);
  if (!existing) return { success: false, skill_id: id, action: 'rollback', message: `Skill '${id}' not found` };

  const rollbackTarget = [...existing.versions]
    .reverse()
    .find(v => !v.active && v.rollback_available);

  if (!rollbackTarget) {
    return { success: false, skill_id: id, action: 'rollback', message: `No rollback version available for '${id}'` };
  }

  const versions: SkillVersion[] = existing.versions.map(v => ({
    ...v,
    active: v.version === rollbackTarget.version,
    rollback_available: v.version !== rollbackTarget.version,
  }));

  upsertSkill({ ...existing, version: rollbackTarget.version, active_version: rollbackTarget.version, versions, updated_at: new Date().toISOString() });
  return { success: true, skill_id: id, action: 'rollback', message: `Rolled back ${id} to ${rollbackTarget.version}` };
}

// ── Disable / Enable ──────────────────────────────────────────────────────────

export function disableSkill(id: string): ImportResult {
  const ok = patchSkill(id, { disabled: true, available: false });
  return ok
    ? { success: true, skill_id: id, action: 'disable', message: `Skill '${id}' disabled` }
    : { success: false, skill_id: id, action: 'disable', message: `Skill '${id}' not found` };
}

export function enableSkill(id: string): ImportResult {
  const ok = patchSkill(id, { disabled: false, available: true });
  return ok
    ? { success: true, skill_id: id, action: 'enable', message: `Skill '${id}' enabled` }
    : { success: false, skill_id: id, action: 'enable', message: `Skill '${id}' not found` };
}

// ── Remove ─────────────────────────────────────────────────────────────────────

export function removeSkill(id: string): ImportResult {
  const PROTECTED = ['health', 'pm2_status', 'source_scan'];
  if (PROTECTED.includes(id)) {
    return { success: false, skill_id: id, action: 'remove', message: `Skill '${id}' is protected and cannot be removed` };
  }
  const ok = removeSkillFromStore(id);
  return ok
    ? { success: true, skill_id: id, action: 'remove', message: `Skill '${id}' removed from registry` }
    : { success: false, skill_id: id, action: 'remove', message: `Skill '${id}' not found` };
}

// ── Introspection ──────────────────────────────────────────────────────────────

export function getInstalledSkills(): AgentSkillDefinition[] {
  return getAllSkillsFromStore().filter(s => !s.disabled);
}

export function getSkillVersions(id: string): SkillVersion[] {
  return getSkillFromStore(id)?.versions || [];
}

export function getImportStatus(): { total: number; available: number; disabled: number; requires_approval: number } {
  const all = getAllSkillsFromStore();
  return {
    total: all.length,
    available: all.filter(s => s.available && !s.disabled).length,
    disabled: all.filter(s => s.disabled).length,
    requires_approval: all.filter(s => s.approval_class === 'REQUIRES_APPROVAL').length,
  };
}
