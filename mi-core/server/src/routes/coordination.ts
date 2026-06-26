/**
 * Phase 0 — Coordination REST API Routes
 *
 * Mounts at /api/coordination
 *
 * Objective APIs:   POST/GET/PATCH/DELETE /objectives
 * Task APIs:        POST/GET/PATCH/DELETE /tasks, /tasks/:id/assign, /tasks/:id/block, /tasks/:id/complete
 * Ownership APIs:   POST /ownership/resolve, GET/PATCH /ownership/rules
 * Duplicate APIs:   POST /duplicates/check, GET /duplicates, POST /duplicates/:id/merge, POST /duplicates/:id/ignore
 * Dependency APIs:  POST/GET /dependencies, GET /dependencies/task/:id, GET /dependencies/objective/:id, POST /dependencies/check-blockers
 * Priority APIs:    POST /priority/score, GET /priority/rules, PATCH /priority/rules
 * Conflict APIs:    POST /conflicts/check, GET /conflicts, POST /conflicts/:id/resolve
 * Approval APIs:    POST/GET /approvals, GET /approvals/:id, POST /approvals/:id/approve, POST /approvals/:id/reject
 * Evidence APIs:    POST/GET /evidence, GET /evidence/:id, GET /evidence/task/:id, POST /evidence/:id/verify
 * Division APIs:    GET /divisions, GET /divisions/:id/tasks, POST /route
 * Dashboard APIs:   GET /dashboard, GET /dashboard/summary, GET /dashboard/risks
 * Pipeline:         POST /pipeline/run
 */
import { Router, Request, Response } from 'express';
import {
  createRegisteredObjective, getRegisteredObjectives,
  getRegisteredObjective, updateRegisteredObjective, closeObjective,
} from '../executive-coordination/objective-registry';
import {
  createTask, getTask, getAllTasks, updateTaskStatus,
  getTaskHistory, deleteTask,
} from '../executive-coordination/task-registry';
import {
  resolveOwnership, getOwnershipRules, resolveOwnerEscalation,
} from '../executive-coordination/ownership-engine';
import {
  detectDuplicates, markDuplicate, getDuplicateSummary,
} from '../executive-coordination/duplicate-detector';
import {
  addEdge, getAllEdges, getEdgesForTask, getEdgesForObjective,
  checkBlockers, topologicalOrder, findCycles, describeChain,
} from '../executive-coordination/dependency-graph';
import {
  autoClassify, sortByPriority, priorityBreakdown, ceoOverridePriority,
  getOverrideLog,
} from '../executive-coordination/priority-engine';
import {
  detectAllConflicts, resolveConflict, summarizeConflicts,
} from '../executive-coordination/conflict-engine';
import {
  createApproval, getApproval, getAllApprovals,
  approveApproval, rejectApproval, getPendingApprovals,
} from '../executive-coordination/approval-registry';
import {
  addEvidenceRecord, getEvidenceRecord, getEvidenceRecords,
  getAllEvidenceRecords, verifyEvidence,
} from '../executive-coordination/evidence-registry';
import {
  routeTask, getDivisions, getDivisionById,
} from '../executive-coordination/division-router';
import {
  buildDashboard, renderAsciiDashboard, getRisks,
} from '../executive-coordination/executive-dashboard';
import { runCoordinationPipeline } from '../executive-coordination/index';

export const coordinationRouter = Router();

// ── Objectives ─────────────────────────────────────────────────────────────
coordinationRouter.post('/objectives', (req: Request, res: Response) => {
  try {
    const obj = createRegisteredObjective(req.body);
    res.status(201).json({ success: true, objective: obj });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

coordinationRouter.get('/objectives', (req: Request, res: Response) => {
  try {
    const objs = getRegisteredObjectives({
      status: req.query.status as any,
      priority: req.query.priority as any,
    });
    res.json({ success: true, count: objs.length, objectives: objs });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

coordinationRouter.get('/objectives/:id', (req: Request, res: Response) => {
  const obj = getRegisteredObjective(req.params.id);
  if (!obj) return res.status(404).json({ success: false, error: 'Objective not found' });
  res.json({ success: true, objective: obj });
});

coordinationRouter.patch('/objectives/:id', (req: Request, res: Response) => {
  const obj = updateRegisteredObjective(req.params.id, req.body);
  if (!obj) return res.status(404).json({ success: false, error: 'Objective not found' });
  res.json({ success: true, objective: obj });
});

coordinationRouter.post('/objectives/:id/close', (req: Request, res: Response) => {
  const obj = closeObjective(req.params.id);
  if (!obj) return res.status(404).json({ success: false, error: 'Objective not found' });
  res.json({ success: true, objective: obj });
});

// ── Tasks ──────────────────────────────────────────────────────────────────
coordinationRouter.post('/tasks', (req: Request, res: Response) => {
  try {
    const task = createTask(req.body);
    res.status(201).json({ success: true, task });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

coordinationRouter.get('/tasks', (req: Request, res: Response) => {
  try {
    const tasks = getAllTasks({
      status: req.query.status as any,
      division: req.query.division as string,
      objectiveId: req.query.objectiveId as string,
      priority: req.query.priority as any,
    });
    res.json({ success: true, count: tasks.length, tasks });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

coordinationRouter.get('/tasks/:id', (req: Request, res: Response) => {
  const task = getTask(req.params.id);
  if (!task) return res.status(404).json({ success: false, error: 'Task not found' });
  res.json({ success: true, task });
});

coordinationRouter.patch('/tasks/:id', (req: Request, res: Response) => {
  const task = getTask(req.params.id);
  if (!task) return res.status(404).json({ success: false, error: 'Task not found' });
  const updated = updateTaskStatus(req.params.id, req.body.status, req.body.actor, req.body.note);
  res.json({ success: true, task: updated ?? task });
});

coordinationRouter.post('/tasks/:id/assign', (req: Request, res: Response) => {
  const task = getTask(req.params.id);
  if (!task) return res.status(404).json({ success: false, error: 'Task not found' });
  task.owner = req.body.owner ?? task.owner;
  task.assignee = req.body.assignee ?? task.assignee;
  const updated = updateTaskStatus(req.params.id, 'ASSIGNED', req.body.actor, `Assigned to ${req.body.owner ?? task.owner}`);
  res.json({ success: true, task: updated });
});

coordinationRouter.post('/tasks/:id/block', (req: Request, res: Response) => {
  try {
    const updated = updateTaskStatus(req.params.id, 'BLOCKED', req.body.actor, req.body.reason ?? 'blocked');
    res.json({ success: true, task: updated });
  } catch (e: any) {
    res.status(400).json({ success: false, error: e.message });
  }
});

coordinationRouter.post('/tasks/:id/complete', (req: Request, res: Response) => {
  try {
    const updated = updateTaskStatus(req.params.id, 'DONE', req.body.actor, req.body.note ?? '');
    res.json({ success: true, task: updated });
  } catch (e: any) {
    res.status(400).json({ success: false, error: e.message });
  }
});

coordinationRouter.get('/tasks/:id/history', (req: Request, res: Response) => {
  const hist = getTaskHistory(req.params.id);
  if (hist === null) return res.status(404).json({ success: false, error: 'Task not found' });
  res.json({ success: true, history: hist });
});

// ── Ownership ──────────────────────────────────────────────────────────────
coordinationRouter.post('/ownership/resolve', (req: Request, res: Response) => {
  const text = req.body.text ?? req.body.taskText ?? '';
  const result = resolveOwnership(text);
  res.json({ success: true, ...result });
});

coordinationRouter.get('/ownership/rules', (_req: Request, res: Response) => {
  res.json({ success: true, rules: getOwnershipRules() });
});

// ── Duplicates ─────────────────────────────────────────────────────────────
coordinationRouter.post('/duplicates/check', (req: Request, res: Response) => {
  try {
    const task = req.body;
    const taskObj = { ...task, description: task.description ?? '', id: task.id ?? 'temp' };
    const dups = detectDuplicates([taskObj as any]);
    const blocked = dups.some(d => d.confidence > 0.85);
    const needsReview = dups.some(d => d.confidence >= 0.60 && d.confidence <= 0.85);
    res.json({ success: true, duplicates: dups, blocked, needsReview });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

coordinationRouter.get('/duplicates', (_req: Request, res: Response) => {
  res.json({ success: true, ...getDuplicateSummary() });
});

coordinationRouter.post('/duplicates/:id/merge', (req: Request, res: Response) => {
  const rec = markDuplicate(req.body.originalTaskId, req.body.duplicateTaskId, req.body.confidence ?? 0.9, 'merged');
  res.json({ success: true, record: rec });
});

coordinationRouter.post('/duplicates/:id/ignore', (req: Request, res: Response) => {
  const rec = markDuplicate(req.body.originalTaskId, req.body.duplicateTaskId, req.body.confidence ?? 0.9, 'ignored');
  res.json({ success: true, record: rec });
});

// ── Dependencies ───────────────────────────────────────────────────────────
coordinationRouter.post('/dependencies', (req: Request, res: Response) => {
  const edge = addEdge(req.body);
  res.status(201).json({ success: true, edge });
});

coordinationRouter.get('/dependencies', (_req: Request, res: Response) => {
  const edges = getAllEdges();
  res.json({ success: true, count: edges.length, edges });
});

coordinationRouter.get('/dependencies/task/:id', (req: Request, res: Response) => {
  const edges = getEdgesForTask(req.params.id);
  res.json({ success: true, edges });
});

coordinationRouter.get('/dependencies/objective/:id', (req: Request, res: Response) => {
  const tasks = getAllTasks({ objectiveId: req.params.id });
  const edges = getEdgesForObjective(req.params.id, tasks);
  res.json({ success: true, edges });
});

coordinationRouter.post('/dependencies/check-blockers', (req: Request, res: Response) => {
  const blockers = checkBlockers(getAllTasks());
  res.json({ success: true, blockers });
});

// ── Priority ───────────────────────────────────────────────────────────────
coordinationRouter.post('/priority/score', (req: Request, res: Response) => {
  const result = autoClassify(req.body.title ?? '', req.body.description ?? '');
  res.json({ success: true, ...result });
});

coordinationRouter.get('/priority/rules', (_req: Request, res: Response) => {
  res.json({ success: true, rules: getOverrideLog() });
});

coordinationRouter.post('/priority/override', (req: Request, res: Response) => {
  const result = ceoOverridePriority(req.body.taskId, req.body.priority, req.body.reason ?? '');
  res.json(result);
});

// ── Conflicts ──────────────────────────────────────────────────────────────
coordinationRouter.post('/conflicts/check', (_req: Request, res: Response) => {
  const conflicts = detectAllConflicts(getAllTasks());
  res.json({ success: true, count: conflicts.length, conflicts });
});

coordinationRouter.get('/conflicts', (_req: Request, res: Response) => {
  res.json({ success: true, ...summarizeConflicts(getAllTasks()) });
});

coordinationRouter.post('/conflicts/:id/resolve', (req: Request, res: Response) => {
  const rec = resolveConflict(req.params.id, req.body.resolvedBy ?? 'coordinator');
  res.json({ success: true, record: rec });
});

// ── Approvals ──────────────────────────────────────────────────────────────
coordinationRouter.post('/approvals', (req: Request, res: Response) => {
  const rec = createApproval(req.body);
  res.status(201).json({ success: true, approval: rec });
});

coordinationRouter.get('/approvals', (req: Request, res: Response) => {
  const approvals = getAllApprovals({
    status: req.query.status as any,
    taskId: req.query.taskId as string,
    objectiveId: req.query.objectiveId as string,
    approvalType: req.query.approvalType as any,
  });
  res.json({ success: true, count: approvals.length, approvals });
});

coordinationRouter.get('/approvals/:id', (req: Request, res: Response) => {
  const rec = getApproval(req.params.id);
  if (!rec) return res.status(404).json({ success: false, error: 'Approval not found' });
  res.json({ success: true, approval: rec });
});

coordinationRouter.post('/approvals/:id/approve', (req: Request, res: Response) => {
  const rec = approveApproval(req.params.id, req.body.approver ?? 'ceo');
  res.json({ success: true, approval: rec });
});

coordinationRouter.post('/approvals/:id/reject', (req: Request, res: Response) => {
  const rec = rejectApproval(req.params.id, req.body.approver ?? 'ceo', req.body.reason ?? '');
  res.json({ success: true, approval: rec });
});

// ── Evidence ───────────────────────────────────────────────────────────────
coordinationRouter.post('/evidence', (req: Request, res: Response) => {
  try {
    const rec = addEvidenceRecord(req.body);
    res.status(201).json({ success: true, evidence: rec });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

coordinationRouter.get('/evidence', (_req: Request, res: Response) => {
  const all = getAllEvidenceRecords();
  res.json({ success: true, count: all.length, evidence: all });
});

coordinationRouter.get('/evidence/:id', (req: Request, res: Response) => {
  const rec = getEvidenceRecord(req.params.id);
  if (!rec) return res.status(404).json({ success: false, error: 'Evidence not found' });
  res.json({ success: true, evidence: rec });
});

coordinationRouter.get('/evidence/task/:id', (req: Request, res: Response) => {
  const list = getEvidenceRecords(req.params.id);
  res.json({ success: true, count: list.length, evidence: list });
});

coordinationRouter.post('/evidence/:id/verify', (req: Request, res: Response) => {
  const rec = verifyEvidence(req.params.id, req.body.method ?? 'manual_review');
  res.json({ success: true, evidence: rec });
});

// ── Divisions / Routing ────────────────────────────────────────────────────
coordinationRouter.get('/divisions', (_req: Request, res: Response) => {
  res.json({ success: true, divisions: getDivisions() });
});

coordinationRouter.get('/divisions/:id/tasks', (req: Request, res: Response) => {
  const tasks = getAllTasks({ division: req.params.id });
  res.json({ success: true, count: tasks.length, tasks });
});

coordinationRouter.post('/route', (req: Request, res: Response) => {
  const result = routeTask(req.body.text ?? req.body.taskText ?? '');
  res.json({ success: true, ...result });
});

// ── Dashboard ──────────────────────────────────────────────────────────────
coordinationRouter.get('/dashboard', (_req: Request, res: Response) => {
  const dash = buildDashboard();
  res.json({ success: true, dashboard: dash, ascii: renderAsciiDashboard(dash) });
});

coordinationRouter.get('/dashboard/summary', (_req: Request, res: Response) => {
  const dash = buildDashboard();
  res.json({
    success: true,
    summary: {
      objectives: dash.objectives,
      tasks: dash.tasks,
      conflicts: dash.conflicts,
      approvals: dash.approvals,
      evidence: dash.evidence,
      divisionLoad: dash.divisionLoad,
    },
  });
});

coordinationRouter.get('/dashboard/risks', (_req: Request, res: Response) => {
  res.json({ success: true, risks: getRisks() });
});

// ── Pipeline (one-shot) ────────────────────────────────────────────────────
coordinationRouter.post('/pipeline/run', (req: Request, res: Response) => {
  try {
    const result = runCoordinationPipeline(req.body.objective, req.body.tasks ?? []);
    res.json({ success: true, ...result });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── Health ─────────────────────────────────────────────────────────────────
coordinationRouter.get('/health', (_req: Request, res: Response) => {
  res.json({
    success: true,
    service: 'executive-coordination',
    status: 'operational',
    timestamp: new Date().toISOString(),
    endpoints: [
      'POST /objectives', 'GET /objectives', 'GET /objectives/:id',
      'POST /tasks', 'GET /tasks', 'GET /tasks/:id', 'GET /tasks/:id/history',
      'POST /ownership/resolve', 'GET /ownership/rules',
      'POST /duplicates/check', 'GET /duplicates',
      'POST /dependencies', 'GET /dependencies', 'GET /dependencies/task/:id',
      'POST /priority/score', 'GET /priority/rules', 'POST /priority/override',
      'POST /conflicts/check', 'GET /conflicts',
      'POST /approvals', 'GET /approvals', 'POST /approvals/:id/approve',
      'POST /evidence', 'GET /evidence', 'GET /evidence/task/:id',
      'GET /divisions', 'POST /route',
      'GET /dashboard', 'GET /dashboard/summary', 'GET /dashboard/risks',
      'POST /pipeline/run',
    ],
  });
});
