/**
 * Phase 25D — CEO Command Center
 * 
 * Endpoints:
 *   POST /api/ceo/objective
 *   GET  /api/ceo/objectives
 *   GET  /api/ceo/objectives/:id
 *   POST /api/ceo/objectives/:id/approve
 *   POST /api/ceo/objectives/:id/execute
 *   GET  /api/ceo/objectives/:id/progress
 *   GET  /api/ceo/objectives/:id/report
 * 
 * CEO submits a single message; Mi handles the rest.
 */

import express, { Request, Response, Router } from 'express';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import * as ObjectiveEngine from '../objective-engine';
import * as ExecutionOrchestrator from '../execution-orchestrator';
import * as AutoTaskEngine from '../auto-task-engine';

const DATA_DIR = join(process.cwd(), '.mi-harness', 'phase25');
const OBJECTIVES_DIR = join(DATA_DIR, 'objectives');

function ensureDirs() {
  mkdirSync(OBJECTIVES_DIR, { recursive: true });
}

// ── Router ───────────────────────────────────────────────────────────────────

export const ceoRouter = Router();

ceoRouter.use(express.json({ limit: '1mb' }));

/**
 * POST /api/ceo/objective
 * CEO submits a natural language objective. Mi returns structured plan.
 */
ceoRouter.post('/objective', (req: Request, res: Response) => {
  try {
    const { objective, autoExecute = false } = req.body;
    if (!objective || typeof objective !== 'string') {
      return res.status(400).json({ error: 'objective (string) required' });
    }

    // Create objective → decompose → plan
    const objRecord = ObjectiveEngine.createObjective(objective);

    const response: any = {
      objective_id: objRecord.id,
      objective: objRecord.objective,
      status: objRecord.status,
      tasks: objRecord.plan?.tasks.length || 0,
      estimated_duration: formatDuration(objRecord.plan?.estimatedDurationMinutes || 0),
      departments: objRecord.departments,
      intent: objRecord.intent,
      goal: objRecord.goal,
      risk_level: objRecord.plan?.approvalGate.riskLevel,
      approval_required: objRecord.plan?.approvalGate.required,
      created_at: objRecord.receivedAt,
    };

    if (autoExecute) {
      // Auto-approve if applicable
      if (objRecord.plan?.approvalGate.status === 'auto-approved') {
        const plan = ExecutionOrchestrator.executePlan(objRecord.id);
        response.executed = true;
        response.plan_status = plan?.status;
        response.progress = plan?.progress;
      } else {
        response.executed = false;
        response.note = 'Plan requires approval before execution. Use POST /api/ceo/objectives/:id/approve';
      }
    }

    res.json(response);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /api/ceo/objectives
 * List all objectives.
 */
ceoRouter.get('/objectives', (_req: Request, res: Response) => {
  try {
    const objectives = ObjectiveEngine.getObjectives();
    res.json({
      total: objectives.length,
      objectives: objectives.map(o => ({
        id: o.id,
        objective: o.objective,
        status: o.status,
        tasks: o.plan?.tasks.length || 0,
        completed_tasks: o.plan?.tasks.filter(t => t.status === 'completed' || t.status === 'qa-passed').length || 0,
        risk_level: o.plan?.approvalGate.riskLevel,
        created_at: o.receivedAt,
        completed_at: o.completedAt,
      })),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /api/ceo/objectives/:id
 * Get full details of a single objective.
 */
ceoRouter.get('/objectives/:id', (req: Request, res: Response) => {
  try {
    const obj = ObjectiveEngine.getObjective(req.params.id);
    if (!obj) return res.status(404).json({ error: 'Objective not found' });
    res.json(obj);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/ceo/objectives/:id/approve
 * CEO approves the plan → triggers execution.
 */
ceoRouter.post('/objectives/:id/approve', (req: Request, res: Response) => {
  try {
    const { approver = 'ceo', notes, autoExecute = true } = req.body;
    const approved = ObjectiveEngine.approveObjective(req.params.id, approver, notes);

    if (!approved) return res.status(404).json({ error: 'Objective not found' });

    let executionResult: any = null;
    let verification: any = null;
    let report: any = null;
    if (autoExecute) {
      const plan = ExecutionOrchestrator.executePlan(req.params.id);
      executionResult = plan;
      verification = ExecutionOrchestrator.verifyCompletion(req.params.id);
      report = ObjectiveEngine.generateObjectiveReport(req.params.id);
    }

    res.json({
      approved: true,
      objective: approved,
      executed: !!executionResult,
      plan: executionResult,
      verification,
      report,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/ceo/objectives/:id/execute
 * Manually trigger execution of an approved plan.
 */
ceoRouter.post('/objectives/:id/execute', (req: Request, res: Response) => {
  try {
    const plan = ExecutionOrchestrator.executePlan(req.params.id);
    if (!plan) return res.status(404).json({ error: 'Objective or plan not found' });
    res.json({ executed: true, plan });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /api/ceo/objectives/:id/progress
 * Get current progress of an executing objective.
 */
ceoRouter.get('/objectives/:id/progress', (req: Request, res: Response) => {
  try {
    const plan = ExecutionOrchestrator.trackProgress(req.params.id);
    if (!plan) return res.status(404).json({ error: 'Objective not found' });
    res.json(plan.progress);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /api/ceo/objectives/:id/verify
 * Verify completion and evidence without self-certification.
 */
ceoRouter.get('/objectives/:id/verify', (req: Request, res: Response) => {
  try {
    const verification = ExecutionOrchestrator.verifyCompletion(req.params.id);
    res.json(verification);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /api/ceo/objectives/:id/report
 * Generate the final executive report.
 */
ceoRouter.get('/objectives/:id/report', (req: Request, res: Response) => {
  try {
    const report = ObjectiveEngine.generateObjectiveReport(req.params.id);
    if (!report) return res.status(404).json({ error: 'Objective not found' });
    res.json(report);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /api/ceo/health
 * Health check for CEO command center.
 */
ceoRouter.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'ceo-command-center',
    phase: 25,
    engines: {
      'objective-engine':     'operational',
      'execution-orchestrator': 'operational',
      'auto-task-engine':     'operational',
    },
  });
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

export default ceoRouter;
