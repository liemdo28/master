/**
 * Skill Certification — Phase 12
 * Assigns EXPERIMENTAL / BETA / CERTIFIED / PRODUCTION levels based on execution count + success rate.
 * Persists to .local-agent-global/skills/certifications.json
 */

import fs from 'fs';
import path from 'path';
import { getReliabilityScore } from './skill-reliability-tracker';

const MI_CORE_ROOT = process.env.MI_CORE_ROOT || 'D:/Project/Master/mi-core';
const SKILLS_DIR = path.join(MI_CORE_ROOT, '.local-agent-global/skills');
const CERT_FILE = path.join(SKILLS_DIR, 'certifications.json');

// ── Types ──────────────────────────────────────────────────────────────────────

export type CertificationLevel = 'EXPERIMENTAL' | 'BETA' | 'CERTIFIED' | 'PRODUCTION';

export interface CertificationThreshold {
  level: CertificationLevel;
  min_executions: number;
  min_success_rate: number;
}

export interface SkillCertification {
  skill_id: string;
  level: CertificationLevel;
  execution_count: number;
  success_rate: number;
  certified_at: string;
  promoted_from?: CertificationLevel;
  next_level?: CertificationLevel;
  next_level_requirements?: string;
}

interface CertStore {
  certifications: Record<string, SkillCertification>;
  last_updated: string;
}

// ── Thresholds ─────────────────────────────────────────────────────────────────

const THRESHOLDS: CertificationThreshold[] = [
  { level: 'PRODUCTION',   min_executions: 50,  min_success_rate: 0.95 },
  { level: 'CERTIFIED',    min_executions: 25,  min_success_rate: 0.85 },
  { level: 'BETA',         min_executions: 10,  min_success_rate: 0.70 },
  { level: 'EXPERIMENTAL', min_executions: 0,   min_success_rate: 0.00 },
];

function computeLevel(execCount: number, successRate: number): CertificationLevel {
  for (const t of THRESHOLDS) {
    if (execCount >= t.min_executions && successRate >= t.min_success_rate) return t.level;
  }
  return 'EXPERIMENTAL';
}

function nextLevel(current: CertificationLevel): CertificationLevel | undefined {
  const order: CertificationLevel[] = ['EXPERIMENTAL', 'BETA', 'CERTIFIED', 'PRODUCTION'];
  const idx = order.indexOf(current);
  return idx < order.length - 1 ? order[idx + 1] : undefined;
}

function nextLevelRequirements(execCount: number, successRate: number, next?: CertificationLevel): string | undefined {
  if (!next) return undefined;
  const t = THRESHOLDS.find(th => th.level === next)!;
  const parts: string[] = [];
  if (execCount < t.min_executions) parts.push(`${t.min_executions - execCount} more executions`);
  if (successRate < t.min_success_rate) parts.push(`success rate ≥ ${(t.min_success_rate * 100).toFixed(0)}% (currently ${(successRate * 100).toFixed(1)}%)`);
  return parts.length > 0 ? parts.join(', ') : 'Requirements met — re-certify to promote';
}

// ── Persistence ────────────────────────────────────────────────────────────────

function loadStore(): CertStore {
  if (!fs.existsSync(CERT_FILE)) return { certifications: {}, last_updated: new Date().toISOString() };
  try { return JSON.parse(fs.readFileSync(CERT_FILE, 'utf8')); }
  catch { return { certifications: {}, last_updated: new Date().toISOString() }; }
}

function saveStore(store: CertStore): void {
  if (!fs.existsSync(SKILLS_DIR)) fs.mkdirSync(SKILLS_DIR, { recursive: true });
  store.last_updated = new Date().toISOString();
  fs.writeFileSync(CERT_FILE, JSON.stringify(store, null, 2));
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function certifySkill(skillId: string): SkillCertification {
  const reliability = getReliabilityScore(skillId);
  const store = loadStore();
  const existing = store.certifications[skillId];

  const level = computeLevel(reliability.execution_count, reliability.success_rate);
  const next = nextLevel(level);

  const cert: SkillCertification = {
    skill_id: skillId,
    level,
    execution_count: reliability.execution_count,
    success_rate: reliability.success_rate,
    certified_at: new Date().toISOString(),
    promoted_from: existing?.level !== level ? existing?.level : undefined,
    next_level: next,
    next_level_requirements: nextLevelRequirements(reliability.execution_count, reliability.success_rate, next),
  };

  store.certifications[skillId] = cert;
  saveStore(store);

  return cert;
}

export function certifyAllSkills(skillIds: string[]): SkillCertification[] {
  return skillIds.map(id => certifySkill(id));
}

export function getCertification(skillId: string): SkillCertification | null {
  return loadStore().certifications[skillId] || null;
}

export function getAllCertifications(): SkillCertification[] {
  return Object.values(loadStore().certifications);
}
