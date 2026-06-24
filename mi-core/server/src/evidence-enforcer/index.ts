/**
 * Phase 25F — Evidence Enforcer (Self-Verification)
 * 
 * Mi must prove work. Every execution produces:
 *   - Evidence
 *   - Screenshots
 *   - Logs
 *   - Metrics
 *   - Before
 *   - After
 *   - Result
 * 
 * No self-certification without evidence.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import type { ObjectiveTask, ObjectiveRecord } from '../objective-engine/types';

const DATA_DIR = join(process.cwd(), '.mi-harness', 'phase25');
const EVIDENCE_DIR = join(DATA_DIR, 'evidence');
const VERIFICATION_DIR = join(DATA_DIR, 'verification');

function ensureDirs() {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  mkdirSync(VERIFICATION_DIR, { recursive: true });
}

// ── Evidence record types ────────────────────────────────────────────────────

export interface EvidenceRecord {
  id: string;
  taskId: string;
  objectiveId: string;
  type: EvidenceType;
  description: string;
  before: any;
  after: any;
  metrics: Record<string, any>;
  logs: string[];
  screenshots: string[];
  result: 'pass' | 'fail' | 'partial';
  collectedAt: string;
  collector: string;
  confidence: number;
}

export type EvidenceType =
  | 'metric-snapshot'
  | 'file-scan'
  | 'route-audit'
  | 'log-check'
  | 'test-run'
  | 'health-check'
  | 'code-analysis'
  | 'config-audit'
  | 'seo-audit'
  | 'traffic-snapshot'
  | 'api-response'
  | 'screenshot'
  | 'crawl-result'
  | 'schema-validation'
  | 'ranking-snapshot'
  | 'gsc-data'
  | 'webhook-result'
  | 'manual-verification'
  | 'diff-snapshot'
  | 'pm2-status'
  | 'agent-response';

// ── Capture before/after snapshots ───────────────────────────────────────────

export function captureSnapshot(label: string, type: EvidenceType, data: any): string {
  ensureDirs();
  const id = `snap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const snapshot = {
    id,
    label,
    type,
    data,
    capturedAt: new Date().toISOString(),
  };

  const filePath = join(EVIDENCE_DIR, `${id}.json`);
  writeFileSync(filePath, JSON.stringify(snapshot, null, 2));
  return id;
}

// ── Verify task execution ────────────────────────────────────────────────────

export function verifyTaskEvidence(task: ObjectiveTask, objectiveId: string): EvidenceRecord {
  ensureDirs();
  const id = `ev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  // Aggregate all evidence from the task
  const allLogs: string[] = [];
  const allScreenshots: string[] = [];
  const metrics: Record<string, any> = {};
  const beforeStates: any[] = [];
  const afterStates: any[] = [];

  for (const ev of task.evidence || []) {
    if (ev.beforeState !== null && ev.beforeState !== undefined) beforeStates.push(ev.beforeState);
    if (ev.afterState !== null && ev.afterState !== undefined) afterStates.push(ev.afterState);
    if (ev.type === 'screenshot') allScreenshots.push(ev.description);
    if (ev.type === 'log-check') allLogs.push(ev.description);
    if (ev.result && typeof ev.result === 'object') {
      Object.assign(metrics, ev.result);
    }
  }

  // Decide pass/fail
  const evidenceCount = (task.evidence || []).length;
  const hasApiResponse = (task.evidence || []).some(e => e.type === 'api-response');
  const hasMetricSnapshot = (task.evidence || []).some(e => e.type === 'metric-snapshot');

  let result: 'pass' | 'fail' | 'partial' = 'fail';
  if (evidenceCount === 0) {
    result = 'fail';
  } else if (evidenceCount >= 2 && (hasApiResponse || hasMetricSnapshot)) {
    result = 'pass';
  } else {
    result = 'partial';
  }

  // Confidence: how strong is the evidence?
  let confidence = 0.5;
  if (evidenceCount >= 1) confidence += 0.1;
  if (evidenceCount >= 2) confidence += 0.2;
  if (hasApiResponse) confidence += 0.1;
  if (hasMetricSnapshot) confidence += 0.1;

  const record: EvidenceRecord = {
    id,
    taskId: task.id,
    objectiveId,
    type: 'manual-verification',
    description: `Verification of task: ${task.title}`,
    before: beforeStates.length > 0 ? beforeStates[0] : null,
    after: afterStates.length > 0 ? afterStates[0] : null,
    metrics,
    logs: allLogs,
    screenshots: allScreenshots,
    result,
    collectedAt: new Date().toISOString(),
    collector: 'evidence-enforcer',
    confidence: Math.min(1.0, confidence),
  };

  writeFileSync(join(EVIDENCE_DIR, `${id}.json`), JSON.stringify(record, null, 2));
  return record;
}

// ── Capture PM2 process status as evidence ───────────────────────────────────

export function capturePM2Status(): EvidenceRecord {
  ensureDirs();
  const id = `ev-pm2-${Date.now()}`;

  let processes: any[] = [];
  let status = 'unknown';

  try {
    processes = JSON.parse(execSync('pm2 jlist 2>&1', { encoding: 'utf-8', timeout: 5000 }));
    status = processes.length > 0 ? 'running' : 'no processes';
  } catch (e: any) {
    status = `error: ${e.message?.slice(0, 100)}`;
  }

  const record: EvidenceRecord = {
    id,
    taskId: 'system',
    objectiveId: 'system',
    type: 'pm2-status',
    description: 'PM2 process status snapshot',
    before: null,
    after: { status, processCount: processes.length, processes: processes.map(p => ({ name: p.name, status: p.pm2_env?.status, restarts: p.pm2_env?.restart_time })) },
    metrics: { processCount: processes.length, onlineCount: processes.filter((p: any) => p.pm2_env?.status === 'online').length },
    logs: [status],
    screenshots: [],
    result: status === 'running' ? 'pass' : 'partial',
    collectedAt: new Date().toISOString(),
    collector: 'evidence-enforcer',
    confidence: 0.9,
  };

  writeFileSync(join(EVIDENCE_DIR, `${id}.json`), JSON.stringify(record, null, 2));
  return record;
}

// ── Capture SEO state as evidence ────────────────────────────────────────────

export function captureSEOState(): EvidenceRecord {
  ensureDirs();
  const id = `ev-seo-${Date.now()}`;

  let seoState: any = null;
  let agentCount = 0;
  let onlineCount = 0;

  try {
    const seoStatePath = join(process.cwd(), 'data', 'seo', 'seo-state.json');
    if (existsSync(seoStatePath)) {
      seoState = JSON.parse(readFileSync(seoStatePath, 'utf-8'));
      const agents = Object.values(seoState.agents || {});
      agentCount = agents.length;
      onlineCount = agents.filter((a: any) => a.status === 'online').length;
    }
  } catch { /* ignore */ }

  const record: EvidenceRecord = {
    id,
    taskId: 'system',
    objectiveId: 'system',
    type: 'metric-snapshot',
    description: 'SEO agents health snapshot',
    before: null,
    after: { agentCount, onlineCount, offlineCount: agentCount - onlineCount },
    metrics: { agentCount, onlineCount, onlineRatio: agentCount > 0 ? Math.round((onlineCount / agentCount) * 100) : 0 },
    logs: [`${onlineCount}/${agentCount} SEO agents online`],
    screenshots: [],
    result: onlineCount === agentCount && agentCount > 0 ? 'pass' : 'partial',
    collectedAt: new Date().toISOString(),
    collector: 'evidence-enforcer',
    confidence: 0.95,
  };

  writeFileSync(join(EVIDENCE_DIR, `${id}.json`), JSON.stringify(record, null, 2));
  return record;
}

// ── Verify entire objective ──────────────────────────────────────────────────

export function verifyObjective(objectiveId: string): {
  passed: boolean;
  overallScore: number;
  totalTasks: number;
  verifiedTasks: number;
  failedTasks: number;
  evidenceCount: number;
  records: EvidenceRecord[];
} {
  ensureDirs();

  const objPath = join(DATA_DIR, 'objectives', `${objectiveId}.json`);
  if (!existsSync(objPath)) {
    return { passed: false, overallScore: 0, totalTasks: 0, verifiedTasks: 0, failedTasks: 0, evidenceCount: 0, records: [] };
  }

  const obj: ObjectiveRecord = JSON.parse(readFileSync(objPath, 'utf-8'));
  if (!obj.plan) {
    return { passed: false, overallScore: 0, totalTasks: 0, verifiedTasks: 0, failedTasks: 0, evidenceCount: 0, records: [] };
  }

  const records: EvidenceRecord[] = [];
  let verified = 0;
  let failed = 0;
  let totalEvidence = 0;

  // Capture system-level evidence
  records.push(capturePM2Status());
  records.push(captureSEOState());
  totalEvidence += 2;

  for (const task of obj.plan.tasks) {
    const record = verifyTaskEvidence(task, objectiveId);
    records.push(record);
    totalEvidence++;
    if (record.result === 'pass') verified++;
    else if (record.result === 'fail') failed++;
  }

  const overallScore = Math.round((verified / obj.plan.tasks.length) * 100);
  const passed = verified === obj.plan.tasks.length;

  // Save verification report
  const verificationReport = {
    objectiveId,
    timestamp: new Date().toISOString(),
    passed,
    overallScore,
    totalTasks: obj.plan.tasks.length,
    verifiedTasks: verified,
    failedTasks: failed,
    evidenceCount: totalEvidence,
    records: records.map(r => ({ id: r.id, type: r.type, result: r.result, confidence: r.confidence })),
  };

  writeFileSync(
    join(VERIFICATION_DIR, `${objectiveId}-verification.json`),
    JSON.stringify(verificationReport, null, 2),
  );

  return {
    passed,
    overallScore,
    totalTasks: obj.plan.tasks.length,
    verifiedTasks: verified,
    failedTasks: failed,
    evidenceCount: totalEvidence,
    records,
  };
}

// ── Query ────────────────────────────────────────────────────────────────────

export function getEvidence(taskId: string): EvidenceRecord[] {
  ensureDirs();
  try {
    const files = readdirSync(EVIDENCE_DIR).filter(f => f.endsWith('.json'));
    return files
      .map(f => {
        try {
          const rec = JSON.parse(readFileSync(join(EVIDENCE_DIR, f), 'utf-8'));
          return rec.taskId === taskId ? rec : null;
        } catch { return null; }
      })
      .filter(Boolean);
  } catch { return []; }
}

export function getAllEvidence(limit: number = 100): EvidenceRecord[] {
  ensureDirs();
  try {
    const files = readdirSync(EVIDENCE_DIR).filter(f => f.endsWith('.json'))
      .sort()
      .reverse()
      .slice(0, limit);
    return files
      .map(f => {
        try { return JSON.parse(readFileSync(join(EVIDENCE_DIR, f), 'utf-8')); } catch { return null; }
      })
      .filter(Boolean);
  } catch { return []; }
}

export default {
  captureSnapshot,
  verifyTaskEvidence,
  capturePM2Status,
  captureSEOState,
  verifyObjective,
  getEvidence,
  getAllEvidence,
};
