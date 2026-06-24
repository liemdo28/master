/**
 * Skill Failure Analysis — Phase 12
 * Stores failure patterns: reason, frequency, last occurrence, remediation advice.
 * Persists to .local-agent-global/skills/failure-analysis.json
 */

import fs from 'fs';
import path from 'path';
import { getSkillHistory } from './skill-reliability-tracker';

const MI_CORE_ROOT = process.env.MI_CORE_ROOT || 'E:/Project/Master/mi-core';
const SKILLS_DIR = path.join(MI_CORE_ROOT, '.local-agent-global/skills');
const FAILURE_FILE = path.join(SKILLS_DIR, 'failure-analysis.json');

// ── Types ──────────────────────────────────────────────────────────────────────

export interface FailurePattern {
  pattern_key: string;       // normalized error fingerprint
  error_sample: string;      // raw error text (truncated)
  frequency: number;
  first_seen: string;
  last_seen: string;
  remediation: string;
}

export interface SkillFailureReport {
  skill_id: string;
  total_failures: number;
  total_executions: number;
  failure_rate: number;
  patterns: FailurePattern[];
  mtbf_executions?: number;   // mean executions between failures
  updated_at: string;
}

interface FailureStore {
  reports: Record<string, SkillFailureReport>;
  last_updated: string;
}

// ── Persistence ────────────────────────────────────────────────────────────────

function loadStore(): FailureStore {
  if (!fs.existsSync(FAILURE_FILE)) return { reports: {}, last_updated: new Date().toISOString() };
  try { return JSON.parse(fs.readFileSync(FAILURE_FILE, 'utf8')); }
  catch { return { reports: {}, last_updated: new Date().toISOString() }; }
}

function saveStore(store: FailureStore): void {
  if (!fs.existsSync(SKILLS_DIR)) fs.mkdirSync(SKILLS_DIR, { recursive: true });
  store.last_updated = new Date().toISOString();
  fs.writeFileSync(FAILURE_FILE, JSON.stringify(store, null, 2));
}

// ── Remediation library ────────────────────────────────────────────────────────

const REMEDIATION_MAP: Array<{ pattern: RegExp; advice: string }> = [
  { pattern: /timeout|ETIMEDOUT/i,         advice: 'Increase timeout or check network connectivity to target service' },
  { pattern: /ECONNREFUSED|connection refused/i, advice: 'Target service is not running — check pm2 status and restart if needed' },
  { pattern: /ENOENT|no such file/i,        advice: 'Required file or directory missing — verify path configuration' },
  { pattern: /permission|EPERM|EACCES/i,    advice: 'Permission denied — check file/process ownership and user privileges' },
  { pattern: /out of memory|heap/i,         advice: 'Memory exhaustion — investigate memory leak or increase Node.js heap limit' },
  { pattern: /parse error|JSON|syntax/i,    advice: 'Malformed response — validate upstream API contract or check for encoding issues' },
  { pattern: /401|403|unauthorized|forbidden/i, advice: 'Authentication failure — rotate credentials or verify API token scope' },
  { pattern: /500|internal server error/i,  advice: 'Upstream server error — check server logs and retry with exponential backoff' },
  { pattern: /not found|404/i,              advice: 'Resource not found — verify endpoint URL and resource existence' },
];

function getRemediation(error: string): string {
  for (const entry of REMEDIATION_MAP) {
    if (entry.pattern.test(error)) return entry.advice;
  }
  return 'Review execution logs for root cause; check dependencies and environment variables';
}

function normalizePattern(error: string): string {
  return error
    .toLowerCase()
    .replace(/[0-9a-f]{8,}/g, '<hex>')        // strip hex IDs
    .replace(/\d{4}-\d{2}-\d{2}T\S+/g, '<ts>') // strip timestamps
    .replace(/:\d+/g, ':<port>')               // strip port numbers
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

// ── Core analysis ──────────────────────────────────────────────────────────────

export function analyzeSkillFailures(skillId: string): SkillFailureReport {
  const history = getSkillHistory(skillId, 500);
  const failures = history.filter(r => !r.success);
  const total = history.length;
  const failureCount = failures.length;

  // Group failures by normalized pattern
  const patternMap = new Map<string, { records: typeof failures; sample: string }>();
  for (const f of failures) {
    const raw = f.error || 'unknown error';
    const key = normalizePattern(raw);
    if (!patternMap.has(key)) patternMap.set(key, { records: [], sample: raw.slice(0, 150) });
    patternMap.get(key)!.records.push(f);
  }

  const patterns: FailurePattern[] = [];
  for (const [key, { records, sample }] of patternMap) {
    const sorted = records.sort((a, b) => a.executed_at > b.executed_at ? -1 : 1);
    patterns.push({
      pattern_key: key,
      error_sample: sample,
      frequency: records.length,
      first_seen: records[records.length - 1].executed_at,
      last_seen: sorted[0].executed_at,
      remediation: getRemediation(sample),
    });
  }

  // Sort by frequency descending
  patterns.sort((a, b) => b.frequency - a.frequency);

  // MTBF — average number of executions between failures
  let mtbf: number | undefined;
  if (failureCount > 1) {
    mtbf = Math.round(total / failureCount);
  }

  const report: SkillFailureReport = {
    skill_id: skillId,
    total_failures: failureCount,
    total_executions: total,
    failure_rate: total > 0 ? Math.round((failureCount / total) * 1000) / 1000 : 0,
    patterns,
    mtbf_executions: mtbf,
    updated_at: new Date().toISOString(),
  };

  const store = loadStore();
  store.reports[skillId] = report;
  saveStore(store);

  return report;
}

export function getFailureReport(skillId: string): SkillFailureReport | null {
  return loadStore().reports[skillId] || null;
}

export function getAllFailureReports(): SkillFailureReport[] {
  return Object.values(loadStore().reports);
}

export function recordFailurePattern(skillId: string, error: string): void {
  // Re-run analysis to pick up the new failure already in metrics
  analyzeSkillFailures(skillId);
}
