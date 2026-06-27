/**
 * Phase 0 — Coordination REST API Routes
 * Mounts at /api/coordination
 */
import { Router, Request, Response } from 'express';
import {
  createRegisteredObjective, getRegisteredObjectives,
} from '../executive-coordination/objective-registry';
import {
  createTask, getTask, getAllTasks, updateTaskStatus,
  getTasksByDivision, getTasksByObjective, getBlockedTasks,
} from '../executive-coordination/task-registry';
import {
  resolveOwnership, getOwnershipRules,
} from '../executive-coordination/ownership-engine';
import {
  detectDuplicates, markDuplicate, getDuplicateSummary,
} from '../executive-coordination/duplicate-detector';
import {
  buildEdges, topologicalOrder, findCycles, describeChain, getDownstream,
} from '../executive-coordination/dependency-graph';
import {
  autoClassify, sortByPriority, prioritizeTask, priorityBreakdown,
} from '../executive-coordination/priority-engine';
import {
  detectAllConflicts, summarizeConflicts,
} from '../executive-coordination/conflict-engine';
import {
  addEvidenceRecord, getEvidenceRecords, getAllEvidenceRecords,
} from '../executive-coordination/evidence-registry';
import {
  routeTask,
} from '../executive-coordination/division-router';
import {
  buildDashboard, renderAsciiDashboard,
} from '../executive-coordination/executive-dashboard';
import { runCoordinationPipeline } from '../executive-coordination/index';

export const coordinationRouter = Router();

// ── Objectives ─────────────────────────────────────────────────────────────
coordinationRouter.post('/objectives', (req: Request, res: Response) => {
  try {
    const obj = createRegisteredObjective(req.body.title ?? req.body, req.body.owner);
    res.status(201).json({ success: true, objective: obj });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

coordinationRouter.get('/objectives', (_req: Request, res: Response) => {
  try {
    res.json({ success: true, objectives: getRegisteredObjectives() });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

coordinationRouter.get('/objectives/:id', (req: Request, res: Response) => {
  const obj = getRegisteredObjectives().find(o => (o as any).id === req.params.id);
  if (!obj) return res.status(404).json({ success: false, error: 'Objective not found' });
  res.json({ success: true, objective: obj });
});

coordinationRouter.patch('/objectives/:id', (_req: Request, res: Response) => {
  res.status(501).json({ success: false, error: 'Update objective not yet implemented' });
});

coordinationRouter.post('/objectives/:id/close', (_req: Request, res: Response) => {
  res.status(501).json({ success: false, error: 'Close objective not yet implemented' });
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
    let tasks = getAllTasks();
    if (req.query.division) tasks = getTasksByDivision(req.query.division as any);
    if (req.query.objectiveId) tasks = getTasksByObjective(req.query.objectiveId as string);
    if (req.query.status === 'blocked') tasks = getBlockedTasks();
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
  const updated = updateTaskStatus(req.params.id, req.body.status);
  res.json({ success: true, task: updated ?? task });
});

coordinationRouter.post('/tasks/:id/assign', (req: Request, res: Response) => {
  const task = getTask(req.params.id);
  if (!task) return res.status(404).json({ success: false, error: 'Task not found' });
  const updated = updateTaskStatus(req.params.id, 'assigned');
  res.json({ success: true, task: updated });
});

coordinationRouter.post('/tasks/:id/block', (req: Request, res: Response) => {
  try {
    const updated = updateTaskStatus(req.params.id, 'blocked');
    res.json({ success: true, task: updated });
  } catch (e: any) {
    res.status(400).json({ success: false, error: e.message });
  }
});

coordinationRouter.post('/tasks/:id/complete', (req: Request, res: Response) => {
  try {
    const updated = updateTaskStatus(req.params.id, 'completed');
    res.json({ success: true, task: updated });
  } catch (e: any) {
    res.status(400).json({ success: false, error: e.message });
  }
});

coordinationRouter.get('/tasks/:id/history', (req: Request, res: Response) => {
  const task = getTask(req.params.id);
  if (!task) return res.status(404).json({ success: false, error: 'Task not found' });
  res.json({ success: true, history: (task as any).history ?? [] });
});

// ── Ownership ──────────────────────────────────────────────────────────────
coordinationRouter.post('/ownership/resolve', (req: Request, res: Response) => {
  const result = resolveOwnership(req.body.text ?? req.body.taskText ?? '');
  res.json({ success: true, ...result });
});

coordinationRouter.get('/ownership/rules', (_req: Request, res: Response) => {
  res.json({ success: true, rules: getOwnershipRules() });
});

// ── Duplicates ─────────────────────────────────────────────────────────────
coordinationRouter.post('/duplicates/check', (req: Request, res: Response) => {
  try {
    const tasks = getAllTasks();
    const dups = detectDuplicates(tasks);
    res.json({ success: true, duplicates: dups });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

coordinationRouter.get('/duplicates', (_req: Request, res: Response) => {
  res.json({ success: true, ...getDuplicateSummary(getAllTasks()) });
});

coordinationRouter.post('/duplicates/:id/merge', (req: Request, res: Response) => {
  const rec = markDuplicate(req.body.originalTaskId, req.body.duplicateTaskId,
    (id, patch) => { const t = getTask(id); return t ? { ...t, ...patch } as any : null; });
  res.json({ success: true, record: rec });
});

coordinationRouter.post('/duplicates/:id/ignore', (req: Request, res: Response) => {
  const rec = markDuplicate(req.body.originalTaskId, req.body.duplicateTaskId,
    (id, patch) => { const t = getTask(id); return t ? { ...t, ...patch } as any : null; });
  res.json({ success: true, record: rec });
});

// ── Dependencies ───────────────────────────────────────────────────────────
coordinationRouter.get('/dependencies', (_req: Request, res: Response) => {
  const edges = buildEdges(getAllTasks());
  res.json({ success: true, count: edges.length, edges });
});

coordinationRouter.get('/dependencies/task/:id', (req: Request, res: Response) => {
  const tasks = getAllTasks();
  const downstream = getDownstream(tasks, req.params.id);
  res.json({ success: true, task_id: req.params.id, downstream });
});

coordinationRouter.get('/dependencies/order', (_req: Request, res: Response) => {
  const result = topologicalOrder(getAllTasks());
  res.json({ success: true, ...result });
});

coordinationRouter.get('/dependencies/cycles', (_req: Request, res: Response) => {
  const cycles = findCycles(getAllTasks());
  res.json({ success: true, cycles });
});

// ── Priority ───────────────────────────────────────────────────────────────
coordinationRouter.post('/priority/score', (req: Request, res: Response) => {
  const result = autoClassify(req.body.title ?? '', req.body.description ?? '');
  res.json({ success: true, ...result });
});

coordinationRouter.get('/priority/breakdown', (_req: Request, res: Response) => {
  res.json({ success: true, breakdown: priorityBreakdown(getAllTasks()) });
});

coordinationRouter.post('/priority/sort', (_req: Request, res: Response) => {
  res.json({ success: true, tasks: sortByPriority(getAllTasks()) });
});

coordinationRouter.post('/priority/override', (req: Request, res: Response) => {
  const task = getTask(req.body.taskId);
  if (!task) return res.status(404).json({ success: false, error: 'Task not found' });
  const updated = prioritizeTask(task, req.body.priority);
  res.json({ success: true, task: updated });
});

// ── Conflicts ──────────────────────────────────────────────────────────────
coordinationRouter.post('/conflicts/check', (_req: Request, res: Response) => {
  const tasks = getAllTasks();
  const conflicts = detectAllConflicts(tasks);
  res.json({ success: true, count: conflicts.length, conflicts });
});

coordinationRouter.get('/conflicts', (_req: Request, res: Response) => {
  const tasks = getAllTasks();
  const conflicts = detectAllConflicts(tasks);
  res.json({ success: true, ...summarizeConflicts(conflicts) });
});

coordinationRouter.post('/conflicts/:id/resolve', (_req: Request, res: Response) => {
  res.status(501).json({ success: false, error: 'Conflict resolution not yet implemented' });
});

// ── Approvals ──────────────────────────────────────────────────────────────
coordinationRouter.get('/approvals', (_req: Request, res: Response) => {
  const pending = getAllTasks().filter(t => t.status === 'awaiting-approval');
  res.json({ success: true, count: pending.length, approvals: pending });
});

coordinationRouter.post('/approvals/:id/approve', (req: Request, res: Response) => {
  const updated = updateTaskStatus(req.params.id, 'completed');
  if (!updated) return res.status(404).json({ success: false, error: 'Task not found' });
  res.json({ success: true, task: updated });
});

coordinationRouter.post('/approvals/:id/reject', (req: Request, res: Response) => {
  const updated = updateTaskStatus(req.params.id, 'blocked');
  if (!updated) return res.status(404).json({ success: false, error: 'Task not found' });
  res.json({ success: true, task: updated });
});

// ── Evidence ───────────────────────────────────────────────────────────────
coordinationRouter.post('/evidence', (req: Request, res: Response) => {
  try {
    const { taskId, ...evidence } = req.body;
    const rec = addEvidenceRecord(taskId, evidence);
    res.status(201).json({ success: true, evidence: rec });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

coordinationRouter.get('/evidence', (_req: Request, res: Response) => {
  const all = getAllEvidenceRecords();
  res.json({ success: true, count: all.length, evidence: all });
});

coordinationRouter.get('/evidence/task/:id', (req: Request, res: Response) => {
  const list = getEvidenceRecords(req.params.id);
  res.json({ success: true, count: list.length, evidence: list });
});

coordinationRouter.post('/evidence/:id/verify', (_req: Request, res: Response) => {
  res.status(501).json({ success: false, error: 'Evidence verification not yet implemented' });
});

// ── Divisions / Routing ────────────────────────────────────────────────────
coordinationRouter.get('/divisions', (_req: Request, res: Response) => {
  const divisionList = ['engineering', 'computer-operator', 'finance', 'marketing', 'it'];
  res.json({ success: true, divisions: divisionList });
});

coordinationRouter.get('/divisions/:id/tasks', (req: Request, res: Response) => {
  const tasks = getTasksByDivision(req.params.id as any);
  res.json({ success: true, count: tasks.length, tasks });
});

coordinationRouter.post('/route', (req: Request, res: Response) => {
  const result = routeTask(req.body.text ?? req.body.taskText ?? '', req.body.description);
  res.json({ success: true, ...result });
});

// ── Dashboard ──────────────────────────────────────────────────────────────
coordinationRouter.get('/dashboard', (_req: Request, res: Response) => {
  const tasks = getAllTasks();
  const objectives = getRegisteredObjectives();
  const title = (objectives[0] as any)?.title ?? 'Mi-Core Operations';
  const dash = buildDashboard(tasks, title);
  res.json({ success: true, dashboard: dash, ascii: renderAsciiDashboard(dash) });
});

coordinationRouter.get('/dashboard/summary', (_req: Request, res: Response) => {
  const tasks = getAllTasks();
  res.json({
    success: true,
    summary: {
      total: tasks.length,
      by_status: tasks.reduce((acc: any, t) => { acc[t.status] = (acc[t.status] || 0) + 1; return acc; }, {}),
      priority: priorityBreakdown(tasks),
      conflicts: detectAllConflicts(tasks).length,
    },
  });
});

// ── Pipeline ───────────────────────────────────────────────────────────────
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
  res.json({ success: true, service: 'executive-coordination', status: 'operational', timestamp: new Date().toISOString() });
});
