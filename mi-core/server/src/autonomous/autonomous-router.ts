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
