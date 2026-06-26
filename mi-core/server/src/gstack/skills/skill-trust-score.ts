/**
 * Skill Trust Score — Phase 12
 * Composite 0-100 score combining QA grade, reliability, certification level, and failure penalty.
 * Persists to .local-agent-global/skills/trust-scores.json
 */

import fs from 'fs';
import path from 'path';
import { getQAEvaluation, evaluateSkill } from './skill-qa-engine';
import { getReliabilityScore } from './skill-reliability-tracker';
import { getCertification, certifySkill, type CertificationLevel } from './skill-certification';
import { getFailureReport, analyzeSkillFailures } from './skill-failure-analysis';

const MI_CORE_ROOT = process.env.MI_CORE_ROOT || 'D:/Project/Master/mi-core';
const SKILLS_DIR = path.join(MI_CORE_ROOT, '.local-agent-global/skills');
const TRUST_FILE = path.join(SKILLS_DIR, 'trust-scores.json');

// ── Types ──────────────────────────────────────────────────────────────────────

export type TrustTrend = 'IMPROVING' | 'STABLE' | 'DEGRADING';

export interface SkillTrustScore {
  skill_id: string;
  score: number;             // 0–100
  computed_at: string;
  components: {
    qa_component: number;          // 0–40 — from QA engine score
    reliability_component: number; // 0–30 — from reliability tracker
    certification_bonus: number;   // 0–20 — from certification level
    failure_penalty: number;       // 0–10 (subtracted)
  };
  trend: TrustTrend;
  label: string;             // UNTRUSTED / EMERGING / TRUSTED / HIGH_TRUST / ELITE
}

interface TrustStore {
  scores: Record<string, SkillTrustScore[]>; // history per skill (last 10)
  last_updated: string;
}

// ── Persistence ────────────────────────────────────────────────────────────────

function loadStore(): TrustStore {
  if (!fs.existsSync(TRUST_FILE)) return { scores: {}, last_updated: new Date().toISOString() };
  try { return JSON.parse(fs.readFileSync(TRUST_FILE, 'utf8')); }
  catch { return { scores: {}, last_updated: new Date().toISOString() }; }
}

function saveStore(store: TrustStore): void {
  if (!fs.existsSync(SKILLS_DIR)) fs.mkdirSync(SKILLS_DIR, { recursive: true });
  store.last_updated = new Date().toISOString();
  fs.writeFileSync(TRUST_FILE, JSON.stringify(store, null, 2));
}

// ── Component calculations ─────────────────────────────────────────────────────

function qaComponent(qaScore: number): number {
  // Maps 0–100 QA score → 0–40 component
  return Math.round((qaScore / 100) * 40);
}

function reliabilityComponent(reliabilityScore: number): number {
  // Maps 0–100 reliability score → 0–30 component
  return Math.round((reliabilityScore / 100) * 30);
}

const CERT_BONUS: Record<CertificationLevel, number> = {
  EXPERIMENTAL: 0,
  BETA:         5,
  CERTIFIED:    12,
  PRODUCTION:   20,
};

function certificationBonus(level: CertificationLevel): number {
  return CERT_BONUS[level];
}

function failurePenalty(failureRate: number, recentFailures: number): number {
  // Up to 10 pts penalty
  // Heavy failures in last 10 executions weighted more
  const ratePenalty = failureRate * 6;
  const recentPenalty = Math.min(4, recentFailures * 1.5);
  return Math.round(Math.min(10, ratePenalty + recentPenalty));
}

function computeLabel(score: number): string {
  if (score >= 90) return 'ELITE';
  if (score >= 75) return 'HIGH_TRUST';
  if (score >= 55) return 'TRUSTED';
  if (score >= 35) return 'EMERGING';
  return 'UNTRUSTED';
}

function computeTrend(history: SkillTrustScore[]): TrustTrend {
  if (history.length < 2) return 'STABLE';
  const recent = history[history.length - 1].score;
  const previous = history[history.length - 2].score;
  const delta = recent - previous;
  if (delta >= 3) return 'IMPROVING';
  if (delta <= -3) return 'DEGRADING';
  return 'STABLE';
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function computeTrustScore(skillId: string): SkillTrustScore {
  // Ensure all sub-systems are up to date
  const qa = getQAEvaluation(skillId) || evaluateSkill(skillId);
  const reliability = getReliabilityScore(skillId);
  const cert = getCertification(skillId) || certifySkill(skillId);
  const failureReport = getFailureReport(skillId) || analyzeSkillFailures(skillId);

  // Recent failures in last 10 executions
  const recentFailureCount = failureReport.patterns.reduce((sum, p) => {
    const recentCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    return sum + (p.last_seen > recentCutoff ? p.frequency : 0);
  }, 0);

  const qa_component = qaComponent(qa.qa_score);
  const reliability_component = reliabilityComponent(reliability.score);
  const certification_bonus = certificationBonus(cert.level);
  const failure_penalty = failurePenalty(failureReport.failure_rate, Math.min(5, recentFailureCount));

  const rawScore = qa_component + reliability_component + certification_bonus - failure_penalty;
  const score = Math.min(100, Math.max(0, rawScore));

  const store = loadStore();
  const history = store.scores[skillId] || [];
  const trend = computeTrend(history);

  const entry: SkillTrustScore = {
    skill_id: skillId,
    score,
    computed_at: new Date().toISOString(),
    components: { qa_component, reliability_component, certification_bonus, failure_penalty },
    trend,
    label: computeLabel(score),
  };

  // Keep last 10 historical scores per skill
  history.push(entry);
  if (history.length > 10) history.shift();
  store.scores[skillId] = history;
  saveStore(store);

  return entry;
}

export function getTrustScore(skillId: string): SkillTrustScore | null {
  const history = loadStore().scores[skillId];
  return history?.length ? history[history.length - 1] : null;
}

export function getAllTrustScores(): SkillTrustScore[] {
  const store = loadStore();
  return Object.values(store.scores)
    .map(history => history[history.length - 1])
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);
}

export function getTrustHistory(skillId: string): SkillTrustScore[] {
  return loadStore().scores[skillId] || [];
}

/** Returns skills ranked by trust score — used by Phase 12.3 automatic ranking */
export function rankSkillsByTrust(skillIds: string[]): Array<{ skill_id: string; trust_score: number; label: string }> {
  return skillIds
    .map(id => {
      const ts = getTrustScore(id);
      return { skill_id: id, trust_score: ts?.score ?? 50, label: ts?.label ?? 'EMERGING' };
    })
    .sort((a, b) => b.trust_score - a.trust_score);
}
