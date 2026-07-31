/**
 * Phase 25A — Objective Engine (Main Entry)
 * 
 * Pipeline: CEO Objective → Intent Analysis → Goal Classification → Department Mapping
 *          → Task Decomposition → Execution Plan → Approval Gates → Execute → Verify → Report
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';

import type {
  ObjectiveRecord,
  ObjectiveReport,
  ExecutionPlan,
  PlanProgress,
  ApprovalGate,
  RiskLevel,
} from './types';
import { analyzeIntent } from './intent-analyzer';
import { classifyGoal } from './goal-classifier';
import { mapDepartments } from './department-mapper';
import { decomposeObjective } from './task-decomposer';

// ── Storage ──────────────────────────────────────────────────────────────────

const DATA_DIR = join(process.cwd(), '.mi-harness', 'phase25');
const OBJECTIVES_DIR = join(DATA_DIR, 'objectives');

function ensureDirs() {
  mkdirSync(OBJECTIVES_DIR, { recursive: true });
}

function generateId(): string {
  return `obj-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── Risk Assessment ──────────────────────────────────────────────────────────

function assessRisk(objective: string, targetValue: number | null): RiskLevel {
  const lower = objective.toLowerCase();
  // Critical: finance / delete / security
  if (/delete|security|breach|comply|legal|lawsuit|shutdown/i.test(lower)) return 'critical';
  // High: revenue > 20%, or legal-sensitive
  if (targetValue && targetValue > 20 && /revenue|traffic/i.test(lower)) return 'medium';
  // Low: traffic / content / operational
  if (/traffic|content|seo|blog|review|marketing/i.test(lower)) return 'low';
  // Everything else auto-approves
  return 'auto-approve';
}

// ── Main Pipeline ────────────────────────────────────────────────────────────

export function createObjective(rawObjective: string): ObjectiveRecord {
  ensureDirs();

  const id = generateId();
  const receivedAt = new Date().toISOString();

  // Step 1: Intent Analysis
  const intent = analyzeIntent(rawObjective);

  // Step 2: Goal Classification
  const goal = classifyGoal(intent);

  // Step 3: Department Mapping
  const departments = mapDepartments(intent);

  // Step 4: Task Decomposition
  const tasks = decomposeObjective(id, intent, goal, departments);

  // Step 5: Build Execution Plan
  const totalMinutes = tasks.reduce((sum, t) => sum + t.estimatedMinutes, 0);
  const riskLevel = assessRisk(rawObjective, intent.targetValue);

  const approvalGate: ApprovalGate = {
    required: riskLevel !== 'auto-approve',
    status: riskLevel === 'auto-approve' ? 'auto-approved' : 'pending',
    approvedBy: riskLevel === 'auto-approve' ? 'mi-system' : null,
    approvedAt: riskLevel === 'auto-approve' ? receivedAt : null,
    notes: null,
    riskLevel,
  };

  const progress: PlanProgress = {
    totalTasks: tasks.length,
    completedTasks: 0,
    failedTasks: 0,
    inProgressTasks: 0,
    pendingTasks: tasks.length,
    percentComplete: 0,
  };

  const plan: ExecutionPlan = {
    id: `plan-${id}`,
    objectiveId: id,
    status: approvalGate.status === 'auto-approved' ? 'approved' : 'draft',
    tasks,
    createdAt: receivedAt,
    approvedAt: approvalGate.approvedAt,
    completedAt: null,
    estimatedDurationMinutes: totalMinutes,
    approvalGate,
    progress,
  };

  // Step 6: Assemble objective record
  const objectiveRecord: ObjectiveRecord = {
    id,
    objective: rawObjective,
    status: approvalGate.status === 'auto-approved' ? 'approved' : 'awaiting-approval',
    intent,
    goal,
    departments,
    plan,
    report: null,
    receivedAt,
    completedAt: null,
    humanInterventions: 0,
    evidenceCount: 0,
  };

  saveObjective(objectiveRecord);
  return objectiveRecord;
}

// ── Approval ─────────────────────────────────────────────────────────────────

export function approveObjective(objectiveId: string, approver: string, notes?: string): ObjectiveRecord | null {
  const obj = loadObjective(objectiveId);
  if (!obj) return null;
  if (!obj.plan) return null;

  obj.plan.approvalGate.status = 'approved';
  obj.plan.approvalGate.approvedBy = approver;
  obj.plan.approvalGate.approvedAt = new Date().toISOString();
  obj.plan.approvalGate.notes = notes || null;
  obj.plan.status = 'approved';
  obj.status = 'approved';

  saveObjective(obj);
  return obj;
}

// ── Query ────────────────────────────────────────────────────────────────────

export function getObjectives(): ObjectiveRecord[] {
  ensureDirs();
  try {
    const files = readdirSync(OBJECTIVES_DIR).filter(f => f.endsWith('.json'));
    return files.map(f => {
      try { return JSON.parse(readFileSync(join(OBJECTIVES_DIR, f), 'utf-8')); } catch { return null; }
    }).filter(Boolean);
  } catch { return []; }
}

export function getObjective(id: string): ObjectiveRecord | null {
  return loadObjective(id);
}

// ── Internal helpers ─────────────────────────────────────────────────────────

function saveObjective(obj: ObjectiveRecord) {
  ensureDirs();
  writeFileSync(join(OBJECTIVES_DIR, `${obj.id}.json`), JSON.stringify(obj, null, 2));
}

function loadObjective(id: string): ObjectiveRecord | null {
  const fp = join(OBJECTIVES_DIR, `${id}.json`);
  if (!existsSync(fp)) return null;
  try { return JSON.parse(readFileSync(fp, 'utf-8')); } catch { return null; }
}

// ── Report Generation ────────────────────────────────────────────────────────

export function generateObjectiveReport(objectiveId: string): ObjectiveReport | null {
  const obj = loadObjective(objectiveId);
  if (!obj || !obj.plan) return null;

  const completedTasks = obj.plan.tasks.filter(t => t.status === 'completed' || t.status === 'qa-passed').length;
  const failedTasks = obj.plan.tasks.filter(t => t.status === 'failed' || t.status === 'qa-failed').length;
  const evidenceItems = obj.plan.tasks.reduce((s, t) => s + t.evidence.length, 0);
  const overallScore = obj.plan.tasks.length > 0
    ? Math.round((completedTasks / obj.plan.tasks.length) * 100)
    : 0;

  const report: ObjectiveReport = {
    objectiveId,
    generatedAt: new Date().toISOString(),
    summary: `Objective "${obj.objective}" — ${completedTasks}/${obj.plan.tasks.length} tasks completed (${overallScore}%)`,
    metricsBefore: { traffic: 'pending-baseline', rankings: 'pending-baseline' },
    metricsAfter: { traffic: 'pending-measurement', rankings: 'pending-measurement' },
    totalTasks: obj.plan.tasks.length,
    completedTasks,
    failedTasks,
    evidenceItems,
    overallScore,
    recommendations: [
      'Monitor GSC weekly for ranking movement',
      'Update content calendar based on keyword opportunities',
      'Review schema validation output against Rich Results Test',
    ],
    weeklyActions: [
      'Run SEO audit',
      'Analyze GSC queries',
      'Publish one new content piece',
      'Review and respond to new reviews',
      'Update internal linking',
    ],
  };

  obj.report = report;
  obj.status = 'completed';
  obj.completedAt = new Date().toISOString();
  saveObjective(obj);

  return report;
}

export default {
  createObjective,
  approveObjective,
  getObjectives,
  getObjective,
  generateObjectiveReport,
};
