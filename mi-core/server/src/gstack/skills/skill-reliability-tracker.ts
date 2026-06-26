/**
 * Skill Reliability Tracker — Phase 11
 * Records per-skill execution metrics and computes reliability scores.
 * Persists to .local-agent-global/skills/metrics.json
 */

import fs from 'fs';
import path from 'path';
import type { SkillExecutionRecord, SkillReliabilityScore } from './agent-skill-schema';

const MI_CORE_ROOT = process.env.MI_CORE_ROOT || 'D:/Project/Master/mi-core';
const SKILLS_DIR = path.join(MI_CORE_ROOT, '.local-agent-global/skills');
const METRICS_FILE = path.join(SKILLS_DIR, 'metrics.json');

interface MetricsStore {
  records: SkillExecutionRecord[];
  last_updated: string;
}

function loadMetrics(): MetricsStore {
  if (!fs.existsSync(METRICS_FILE)) return { records: [], last_updated: new Date().toISOString() };
  try { return JSON.parse(fs.readFileSync(METRICS_FILE, 'utf8')); }
  catch { return { records: [], last_updated: new Date().toISOString() }; }
}

function saveMetrics(m: MetricsStore) {
  if (!fs.existsSync(SKILLS_DIR)) fs.mkdirSync(SKILLS_DIR, { recursive: true });
  m.last_updated = new Date().toISOString();
  // Keep last 1000 records total
  if (m.records.length > 1000) m.records = m.records.slice(-1000);
  fs.writeFileSync(METRICS_FILE, JSON.stringify(m, null, 2));
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function recordExecution(
  skillId: string,
  version: string,
  success: boolean,
  durationMs: number,
  workOrderId?: string,
  error?: string,
): void {
  const m = loadMetrics();
  m.records.push({
    skill_id: skillId,
    version,
    work_order_id: workOrderId,
    executed_at: new Date().toISOString(),
    success,
    duration_ms: durationMs,
    error: error ? error.slice(0, 200) : undefined,
  });
  saveMetrics(m);
}

export function getReliabilityScore(skillId: string): SkillReliabilityScore {
  const m = loadMetrics();
  const records = m.records.filter(r => r.skill_id === skillId);

  if (records.length === 0) {
    return {
      skill_id: skillId, score: 75, execution_count: 0,
      success_count: 0, failure_count: 0, success_rate: 1.0, avg_duration_ms: 0,
    };
  }

  const successes = records.filter(r => r.success);
  const failures = records.filter(r => !r.success);
  const successRate = successes.length / records.length;
  const avgDuration = records.reduce((s, r) => s + r.duration_ms, 0) / records.length;

  // Score formula: success_rate×80 + speed_bonus(up to 20)
  // Speed bonus: full 20pts if avg < 2s, 0pts if avg > 30s
  const speedBonus = Math.max(0, Math.min(20, 20 * (1 - Math.max(0, avgDuration - 2000) / 28000)));
  const score = Math.round(successRate * 80 + speedBonus);

  const sorted = [...records].sort((a, b) => a.executed_at > b.executed_at ? -1 : 1);
  const lastSuccess = successes.sort((a, b) => a.executed_at > b.executed_at ? -1 : 1)[0];
  const lastFailure = failures.sort((a, b) => a.executed_at > b.executed_at ? -1 : 1)[0];

  return {
    skill_id: skillId,
    score,
    execution_count: records.length,
    success_count: successes.length,
    failure_count: failures.length,
    success_rate: Math.round(successRate * 1000) / 1000,
    avg_duration_ms: Math.round(avgDuration),
    last_executed: sorted[0]?.executed_at,
    last_success: lastSuccess?.executed_at,
    last_failure: lastFailure?.executed_at,
  };
}

export function getAllReliabilityScores(): SkillReliabilityScore[] {
  const m = loadMetrics();
  const skillIds = [...new Set(m.records.map(r => r.skill_id))];
  return skillIds.map(id => getReliabilityScore(id));
}

export function getSkillHistory(skillId: string, limit = 20): SkillExecutionRecord[] {
  const m = loadMetrics();
  return m.records
    .filter(r => r.skill_id === skillId)
    .sort((a, b) => a.executed_at > b.executed_at ? -1 : 1)
    .slice(0, limit);
}
