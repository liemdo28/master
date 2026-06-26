/**
 * Skill Store — Phase 11
 * JSON-backed registry for AgentSkill definitions.
 * Persists to .local-agent-global/skills/registry.json
 */

import fs from 'fs';
import path from 'path';
import type { AgentSkillDefinition, SkillVersion } from './agent-skill-schema';

const MI_CORE_ROOT = process.env.MI_CORE_ROOT || 'D:/Project/Master/mi-core';
const SKILLS_DIR = path.join(MI_CORE_ROOT, '.local-agent-global/skills');
const REGISTRY_FILE = path.join(SKILLS_DIR, 'registry.json');

function ensureDir() {
  if (!fs.existsSync(SKILLS_DIR)) fs.mkdirSync(SKILLS_DIR, { recursive: true });
}

function loadRegistry(): Record<string, AgentSkillDefinition> {
  ensureDir();
  if (!fs.existsSync(REGISTRY_FILE)) return {};
  try { return JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8')); }
  catch { return {}; }
}

function saveRegistry(reg: Record<string, AgentSkillDefinition>) {
  ensureDir();
  fs.writeFileSync(REGISTRY_FILE, JSON.stringify(reg, null, 2));
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function getSkillFromStore(id: string): AgentSkillDefinition | null {
  return loadRegistry()[id] || null;
}

export function getAllSkillsFromStore(): AgentSkillDefinition[] {
  return Object.values(loadRegistry());
}

export function upsertSkill(def: AgentSkillDefinition): void {
  const reg = loadRegistry();
  reg[def.id] = { ...def, updated_at: new Date().toISOString() };
  saveRegistry(reg);
}

export function patchSkill(id: string, patch: Partial<AgentSkillDefinition>): boolean {
  const reg = loadRegistry();
  if (!reg[id]) return false;
  reg[id] = { ...reg[id], ...patch, updated_at: new Date().toISOString() };
  saveRegistry(reg);
  return true;
}

export function removeSkillFromStore(id: string): boolean {
  const reg = loadRegistry();
  if (!reg[id]) return false;
  delete reg[id];
  saveRegistry(reg);
  return true;
}

export function skillExistsInStore(id: string): boolean {
  return !!loadRegistry()[id];
}

// ── Seed built-in skills on first boot ────────────────────────────────────────

const BUILTIN_SKILLS: AgentSkillDefinition[] = [
  {
    id: 'health', name: 'Health Check', name_vi: 'Kiểm tra sức khoẻ hệ thống',
    version: '1.0.0', owner: 'mi-core', category: 'system',
    tags: ['health', 'monitoring', 'safe', 'system'],
    description: 'HTTP health check on all Mi-Core services',
    approval_class: 'SAFE', risk_level: 1, params: [], dependencies: [],
    available: true, disabled: false,
    installed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    active_version: '1.0.0',
    versions: [{ version: '1.0.0', released_at: '2026-06-13', changelog: 'Initial release', active: true, rollback_available: false }],
  },
  {
    id: 'pm2_status', name: 'PM2 Status', name_vi: 'Trạng thái tiến trình PM2',
    version: '1.0.0', owner: 'mi-core', category: 'system',
    tags: ['pm2', 'monitoring', 'process', 'system', 'safe'],
    description: 'Read PM2 process list — status, restarts, memory',
    approval_class: 'SAFE', risk_level: 1, params: [], dependencies: [],
    available: true, disabled: false,
    installed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    active_version: '1.0.0',
    versions: [{ version: '1.0.0', released_at: '2026-06-13', changelog: 'Initial release', active: true, rollback_available: false }],
  },
  {
    id: 'pm2_restart', name: 'PM2 Restart', name_vi: 'Khởi động lại tiến trình',
    version: '1.0.0', owner: 'mi-core', category: 'system',
    tags: ['pm2', 'deploy', 'restart', 'system'],
    description: 'Restart a PM2-managed service (production impact)',
    approval_class: 'REQUIRES_APPROVAL', risk_level: 3, params: ['process_name'], dependencies: ['pm2_status'],
    available: true, disabled: false,
    installed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    active_version: '1.0.0',
    versions: [{ version: '1.0.0', released_at: '2026-06-13', changelog: 'Initial release', active: true, rollback_available: false }],
  },
  {
    id: 'source_scan', name: 'Source Scan', name_vi: 'Quét mã nguồn',
    version: '1.0.0', owner: 'mi-core', category: 'code',
    tags: ['code', 'audit', 'scan', 'safe', 'qa'],
    description: 'Scan project source for issues: TODO, credentials, missing error handling',
    approval_class: 'SAFE', risk_level: 1, params: ['project_path'], dependencies: [],
    available: true, disabled: false,
    installed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    active_version: '1.0.0',
    versions: [{ version: '1.0.0', released_at: '2026-06-13', changelog: 'Initial release', active: true, rollback_available: false }],
  },
  {
    id: 'log_scan', name: 'Log Scan', name_vi: 'Quét nhật ký lỗi',
    version: '1.0.0', owner: 'mi-core', category: 'system',
    tags: ['log', 'audit', 'scan', 'safe', 'system'],
    description: 'Read recent PM2 error logs for a service',
    approval_class: 'SAFE', risk_level: 1, params: ['log_path'], dependencies: [],
    available: true, disabled: false,
    installed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    active_version: '1.0.0',
    versions: [{ version: '1.0.0', released_at: '2026-06-13', changelog: 'Initial release', active: true, rollback_available: false }],
  },
  {
    id: 'build_check', name: 'Build Check', name_vi: 'Kiểm tra biên dịch',
    version: '1.0.0', owner: 'mi-core', category: 'code',
    tags: ['code', 'build', 'typescript', 'safe', 'qa'],
    description: 'Verify TypeScript compiles with zero errors',
    approval_class: 'SAFE', risk_level: 1, params: ['project_path'], dependencies: [],
    available: true, disabled: false,
    installed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    active_version: '1.0.0',
    versions: [{ version: '1.0.0', released_at: '2026-06-13', changelog: 'Initial release', active: true, rollback_available: false }],
  },
  {
    id: 'regression_suite', name: 'Regression Suite', name_vi: 'Bộ kiểm thử hồi quy',
    version: '1.0.0', owner: 'mi-core', category: 'code',
    tags: ['test', 'regression', 'qa', 'safe', 'ceo'],
    description: '10 mandatory CEO WhatsApp cases — no English errors, <5s each',
    approval_class: 'SAFE', risk_level: 1, params: [], dependencies: [],
    available: true, disabled: false,
    installed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    active_version: '1.0.0',
    versions: [{ version: '1.0.0', released_at: '2026-06-13', changelog: 'Initial release', active: true, rollback_available: false }],
  },
  {
    id: 'dashboard_audit', name: 'Dashboard Audit', name_vi: 'Kiểm tra Dashboard',
    version: '1.1.0', owner: 'mi-core', category: 'product',
    tags: ['dashboard', 'audit', 'qa', 'safe', 'product'],
    description: 'Audit dashboard.bakudanramen.com — health, routes, connectors',
    approval_class: 'SAFE', risk_level: 1, params: [], dependencies: ['health', 'source_scan'],
    available: true, disabled: false,
    installed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    active_version: '1.1.0',
    versions: [
      { version: '1.0.0', released_at: '2026-06-01', changelog: 'Initial release', active: false, rollback_available: true },
      { version: '1.1.0', released_at: '2026-06-13', changelog: 'Added connector status check', active: true, rollback_available: false },
    ],
  },
  {
    id: 'knowledge_search', name: 'Knowledge Search', name_vi: 'Tìm kiếm tri thức',
    version: '1.0.0', owner: 'mi-core', category: 'knowledge',
    tags: ['knowledge', 'search', 'safe', 'qdrant', 'sqlite'],
    description: 'Query the Knowledge Universe (SQLite + 8000+ docs)',
    approval_class: 'SAFE', risk_level: 1, params: ['query', 'limit'], dependencies: [],
    available: true, disabled: false,
    installed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    active_version: '1.0.0',
    versions: [{ version: '1.0.0', released_at: '2026-06-13', changelog: 'Initial release', active: true, rollback_available: false }],
  },
  {
    id: 'github_read', name: 'GitHub Read', name_vi: 'Đọc GitHub',
    version: '1.0.0', owner: 'mi-core', category: 'code',
    tags: ['github', 'code', 'safe', 'read'],
    description: 'Read repos, PRs, issues, commits via GitHub API',
    approval_class: 'SAFE', risk_level: 1, params: ['repo', 'resource'], dependencies: [],
    available: false, disabled: false,
    installed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    active_version: '1.0.0',
    versions: [{ version: '1.0.0', released_at: '2026-06-13', changelog: 'Initial release — requires GH_TOKEN', active: true, rollback_available: false }],
  },
  {
    id: 'review_automation', name: 'Review Automation', name_vi: 'Tự động kiểm duyệt',
    version: '1.0.0', owner: 'mi-core', category: 'product',
    tags: ['review', 'automation', 'safe', 'product'],
    description: 'Trigger mi-review-approvals pipeline for code review actions',
    approval_class: 'SAFE', risk_level: 1, params: ['review_id', 'action'], dependencies: [],
    available: true, disabled: false,
    installed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    active_version: '1.0.0',
    versions: [{ version: '1.0.0', released_at: '2026-06-13', changelog: 'Initial release', active: true, rollback_available: false }],
  },
];

export function seedBuiltinSkills(): void {
  const reg = loadRegistry();
  let changed = false;
  for (const skill of BUILTIN_SKILLS) {
    if (!reg[skill.id]) {
      reg[skill.id] = skill;
      changed = true;
    }
  }
  if (changed) saveRegistry(reg);
}
