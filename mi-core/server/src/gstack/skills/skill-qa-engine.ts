/**
 * Skill QA Engine — Phase 12
 * Evaluates per-skill quality: success rate, duration percentiles, failure rate, confidence, evidence quality.
 * Persists evaluations to .local-agent-global/skills/qa-evaluations.json
 */

import fs from 'fs';
import path from 'path';
import { getSkillHistory, getReliabilityScore } from './skill-reliability-tracker';
import type { SkillExecutionRecord } from './agent-skill-schema';

const MI_CORE_ROOT = process.env.MI_CORE_ROOT || 'E:/Project/Master/mi-core';
const SKILLS_DIR = path.join(MI_CORE_ROOT, '.local-agent-global/skills');
const QA_FILE = path.join(SKILLS_DIR, 'qa-evaluations.json');

// ── Types ──────────────────────────────────────────────────────────────────────

export type QAGrade = 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
export type EvidenceQuality = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';

export interface SkillQAEvaluation {
  skill_id: string;
  evaluated_at: string;
  execution_count: number;
  success_rate: number;        // 0.0–1.0
  failure_rate: number;        // 0.0–1.0
  avg_duration_ms: number;
  p95_duration_ms: number;     // 95th percentile response time
  confidence: number;          // 0–100 (low exec count = low confidence)
  evidence_quality: EvidenceQuality;
  qa_grade: QAGrade;
  qa_score: number;            // 0–100 numeric equivalent
}

interface QAStore {
  evaluations: Record<string, SkillQAEvaluation>;
  last_updated: string;
}

// ── Persistence ────────────────────────────────────────────────────────────────

function loadQA(): QAStore {
  if (!fs.existsSync(QA_FILE)) return { evaluations: {}, last_updated: new Date().toISOString() };
  try { return JSON.parse(fs.readFileSync(QA_FILE, 'utf8')); }
  catch { return { evaluations: {}, last_updated: new Date().toISOString() }; }
}

function saveQA(store: QAStore): void {
  if (!fs.existsSync(SKILLS_DIR)) fs.mkdirSync(SKILLS_DIR, { recursive: true });
  store.last_updated = new Date().toISOString();
  fs.writeFileSync(QA_FILE, JSON.stringify(store, null, 2));
}

// ── Computation ────────────────────────────────────────────────────────────────

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function computeEvidenceQuality(execCount: number, successRate: number): EvidenceQuality {
  if (execCount === 0) return 'NONE';
  if (execCount < 5) return 'LOW';
  if (successRate >= 0.9 && execCount >= 20) return 'HIGH';
  if (successRate >= 0.7 && execCount >= 10) return 'MEDIUM';
  return 'LOW';
}

function gradeFromScore(score: number): QAGrade {
  if (score >= 95) return 'S';
  if (score >= 85) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 45) return 'D';
  return 'F';
}

function computeConfidence(execCount: number): number {
  // 0 executions → 0% confidence; 50+ → 100%
  return Math.min(100, Math.round(execCount * 2));
}

function computeQAScore(successRate: number, avgDurationMs: number, p95Ms: number, confidence: number): number {
  // Base: success rate × 60
  let score = successRate * 60;

  // Speed: up to 25 pts (full if p95 < 3s, zero if > 30s)
  const speedScore = Math.max(0, Math.min(25, 25 * (1 - Math.max(0, p95Ms - 3000) / 27000)));
  score += speedScore;

  // Consistency: up to 15 pts (low variance between avg and p95)
  const variance = p95Ms > 0 ? avgDurationMs / p95Ms : 1;
  const consistencyScore = Math.min(15, 15 * variance);
  score += consistencyScore;

  // Confidence dampening: scale score by confidence (low confidence → pulled toward 50)
  const confidenceFactor = confidence / 100;
  score = score * confidenceFactor + 50 * (1 - confidenceFactor);

  return Math.min(100, Math.max(0, Math.round(score)));
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function evaluateSkill(skillId: string): SkillQAEvaluation {
  const history = getSkillHistory(skillId, 500);
  const reliability = getReliabilityScore(skillId);

  const durations = history.map(r => r.duration_ms).filter(d => d > 0);
  const avgDuration = reliability.avg_duration_ms;
  const p95 = percentile(durations, 95) || avgDuration;
  const confidence = computeConfidence(history.length);
  const successRate = reliability.success_rate;
  const evidenceQuality = computeEvidenceQuality(history.length, successRate);
  const qaScore = computeQAScore(successRate, avgDuration, p95, confidence);
  const grade = gradeFromScore(qaScore);

  const evaluation: SkillQAEvaluation = {
    skill_id: skillId,
    evaluated_at: new Date().toISOString(),
    execution_count: history.length,
    success_rate: successRate,
    failure_rate: Math.round((1 - successRate) * 1000) / 1000,
    avg_duration_ms: avgDuration,
    p95_duration_ms: p95,
    confidence,
    evidence_quality: evidenceQuality,
    qa_grade: grade,
    qa_score: qaScore,
  };

  // Persist
  const store = loadQA();
  store.evaluations[skillId] = evaluation;
  saveQA(store);

  return evaluation;
}

export function evaluateAllSkills(skillIds: string[]): SkillQAEvaluation[] {
  return skillIds.map(id => evaluateSkill(id));
}

export function getQAEvaluation(skillId: string): SkillQAEvaluation | null {
  return loadQA().evaluations[skillId] || null;
}

export function getAllQAEvaluations(): SkillQAEvaluation[] {
  return Object.values(loadQA().evaluations);
}
