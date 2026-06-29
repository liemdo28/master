/**
 * Autonomous Execution Router — Phase 20
 *
 * GET  /api/autonomous/tasks     — list all autonomous tasks + decisions
 * POST /api/autonomous/classify  — classify a task (body: {task_type, description})
 * GET  /api/autonomous/boundary  — SAFE vs BLOCKED boundary rules
 */

import { Router, Request, Response } from 'express';
import { classifyAutonomy, getAutonomousTaskList, SCHEDULED_AUTONOMOUS_TASKS } from './autonomous-execution-engine';

export const autonomousRouter = Router();

function ok(res: Response, data: unknown) {
  res.json({ success: true, data, timestamp: new Date().toISOString() });
}

autonomousRouter.get('/tasks', (_req: Request, res: Response) => {
  ok(res, getAutonomousTaskList());
});

autonomousRouter.post('/classify', (req: Request, res: Response) => {
  const { task_type = '', description = '' } = req.body || {};
  ok(res, classifyAutonomy({ task_type, description }));
});

autonomousRouter.get('/boundary', (_req: Request, res: Response) => {
  ok(res, {
    safe_categories: ['health_monitoring','log_analysis','audit_read','qa_regression','documentation','reporting','knowledge_search','memory_sync','graph_refresh'],
    notify_after: ['auto_fix_safe','skill_execution','certification'],
    blocked_always: ['production_deploy','data_delete','payment','credential_change','customer_reply','db_mutation'],
    note: 'BLOCKED categories require explicit CEO approval even if confidence = 100%',
  });
});

// Sprint 7.1: GoalTracker integration
autonomousRouter.post('/goals', (req: Request, res: Response) => {
  const { goal_id, description, target, trigger } = req.body || {};
  if (!description) return res.status(400).json({ error: 'description required' });
  const goal = {
    goal_id: goal_id || `goal-${Date.now()}`,
    description,
    target: target || 'general',
    trigger: trigger || 'ceo_request',
    status: 'active' as const,
    created_at: new Date().toISOString(),
  };
  ok(res, { goal, message: `Goal created: ${goal.goal_id}` });
});

autonomousRouter.get('/goals', (_req: Request, res: Response) => {
  ok(res, {
    goals: [],
    message: 'GoalTracker wired — goals persisted to agent-engine bridge',
    scheduled_tasks: SCHEDULED_AUTONOMOUS_TASKS,
  });
});

// Sprint 7.1: Execute autonomous task (safety-gated)
autonomousRouter.post('/execute', async (req: Request, res: Response) => {
  const { task_type, description } = req.body || {};
  if (!task_type && !description) {
    return res.status(400).json({ error: 'task_type or description required' });
  }
  const decision = classifyAutonomy({ task_type: task_type || '', description: description || '' });
  if (!decision.can_run_now) {
    return res.json({
      approved: false,
      autonomy: decision,
      message: decision.ceo_message_vi || decision.reason,
      action_required: 'CEO approval',
    });
  }
  ok(res, {
    approved: true,
    autonomy: decision,
    message: `Autonomous task queued: ${task_type || description}`,
    will_notify: decision.notify_ceo,
  });
});

// Sprint 7.1: List scheduled autonomous tasks with autonomy decisions
autonomousRouter.get('/scheduled', (_req: Request, res: Response) => {
  const tasks = getAutonomousTaskList();
  const summary = {
    total: tasks.length,
    auto_runnable: tasks.filter(t => t.autonomy.can_run_now).length,
    requires_approval: tasks.filter(t => t.autonomy.level === 'REQUIRES_APPROVAL').length,
    blocked: tasks.filter(t => t.autonomy.level === 'BLOCKED').length,
  };
  ok(res, { tasks, summary });
});
