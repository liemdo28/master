/**
 * Phase 5D-3 API — Daily Operating Loop.
 *
 * Every route is read-only against external systems: nothing here sends email, writes
 * a calendar event, executes a task, or triggers a deploy. The only mutation any route
 * performs is a DailyPlan status change (`approve`/`cancel`), which updates one column
 * and nothing else. Auth, rate limiting and the IP guard are applied at the mount point
 * in index.ts, exactly like every other Phase 5A-5D2 router.
 */

import express, { Router } from 'express';
import { assertPlainPayload } from '../store';
import { DailyOperatingLoop } from './loop';
import { KNOWLEDGE_QUERY_LIMITS } from '../documents/types';
import { computeProjectHealth } from './health';

export const operatingJsonParser = express.json({ limit: '1mb' });

const router = Router();
const PLAN_ID = /^plan-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function withLoop<T>(fn: (loop: DailyOperatingLoop) => Promise<T> | T): Promise<T> {
  const loop = new DailyOperatingLoop();
  return (async () => {
    try { return await fn(loop); } finally { loop.close(); }
  })();
}

function fail(res: express.Response, err: unknown): void {
  const message = (err instanceof Error ? err.message : String(err)).slice(0, 200);
  let status = 400;
  if (/not found|no daily plan|generate the morning brief/i.test(message)) status = 404;
  else if (/already|duplicate/i.test(message)) status = 409;
  res.status(status).json({ error: message });
}

function validDate(value: unknown): string | undefined {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return undefined;
  return value;
}

router.get('/operating/today', async (req, res) => {
  try {
    const date = validDate(req.query.date);
    const brief = await withLoop(loop => loop.morning(date));
    res.json(brief);
  } catch (err) { fail(res, err); }
});

router.post('/operating/today/generate', async (req, res) => {
  try {
    assertPlainPayload(req.body);
    const date = validDate(req.body?.date);
    const operationId = typeof req.body?.operationId === 'string' ? req.body.operationId.slice(0, 120) : undefined;
    const brief = await withLoop(loop => loop.morning(date, operationId));
    res.status(201).json(brief);
  } catch (err) { fail(res, err); }
});

router.post('/operating/today/refresh', async (req, res) => {
  try {
    assertPlainPayload(req.body);
    const date = validDate(req.body?.date);
    const operationId = typeof req.body?.operationId === 'string' ? req.body.operationId.slice(0, 120) : undefined;
    const result = await withLoop(loop => loop.midday(date, operationId));
    res.status(result.created ? 201 : 200).json(result.refresh);
  } catch (err) { fail(res, err); }
});

router.get('/operating/today/plan', async (req, res) => {
  try {
    const date = validDate(req.query.date);
    const plan = await withLoop(loop => loop.operatingStore.latestPlanForDate(date ?? todayDate()));
    if (!plan) return res.status(404).json({ error: 'no daily plan for that date' });
    res.json(plan);
  } catch (err) { fail(res, err); }
});

router.post('/operating/today/plan', async (req, res) => {
  try {
    assertPlainPayload(req.body);
    const date = validDate(req.body?.date);
    const plan = await withLoop(loop => loop.plan(date));
    res.status(201).json(plan);
  } catch (err) { fail(res, err); }
});

router.post('/operating/today/plan/approve', async (req, res) => {
  try {
    assertPlainPayload(req.body);
    const planId = typeof req.body?.planId === 'string' ? req.body.planId : '';
    if (!PLAN_ID.test(planId)) return res.status(400).json({ error: 'invalid planId' });
    const plan = await withLoop(loop => loop.setPlanStatus(planId, 'APPROVED'));
    if (!plan) return res.status(404).json({ error: 'plan not found' });
    res.json(plan);
  } catch (err) { fail(res, err); }
});

router.post('/operating/today/plan/cancel', async (req, res) => {
  try {
    assertPlainPayload(req.body);
    const planId = typeof req.body?.planId === 'string' ? req.body.planId : '';
    if (!PLAN_ID.test(planId)) return res.status(400).json({ error: 'invalid planId' });
    const plan = await withLoop(loop => loop.setPlanStatus(planId, 'CANCELLED'));
    if (!plan) return res.status(404).json({ error: 'plan not found' });
    res.json(plan);
  } catch (err) { fail(res, err); }
});

router.get('/operating/today/review', async (req, res) => {
  try {
    const date = validDate(req.query.date) ?? todayDate();
    const review = await withLoop(loop => loop.operatingStore.latestReviewForDate(date));
    if (!review) return res.status(404).json({ error: 'no end-of-day review for that date' });
    res.json(review);
  } catch (err) { fail(res, err); }
});

router.post('/operating/today/review/generate', async (req, res) => {
  try {
    assertPlainPayload(req.body);
    const date = validDate(req.body?.date);
    const operationId = typeof req.body?.operationId === 'string' ? req.body.operationId.slice(0, 120) : undefined;
    const review = await withLoop(loop => loop.evening(date, operationId));
    res.status(201).json(review);
  } catch (err) { fail(res, err); }
});

router.get('/operating/week', async (req, res) => {
  try {
    const weekStart = validDate(req.query.weekStart);
    const review = await withLoop(async loop => {
      const { weekStartOf, today } = await import('../../intelligence/service');
      return loop.operatingStore.latestWeeklyReview(weekStart ?? weekStartOf(today()));
    });
    if (!review) return res.status(404).json({ error: 'no weekly operating review for that week' });
    res.json(review);
  } catch (err) { fail(res, err); }
});

router.post('/operating/week/generate', async (req, res) => {
  try {
    assertPlainPayload(req.body);
    const weekStart = validDate(req.body?.weekStart);
    const operationId = typeof req.body?.operationId === 'string' ? req.body.operationId.slice(0, 120) : undefined;
    const review = await withLoop(loop => loop.weekly(weekStart, operationId));
    res.status(201).json(review);
  } catch (err) { fail(res, err); }
});

router.get('/operating/approvals', async (_req, res) => {
  try {
    const { listPendingApprovals } = await import('./approvals');
    const items = await withLoop(loop => listPendingApprovals(loop));
    res.json({ approvals: items });
  } catch (err) { fail(res, err); }
});

router.get('/operating/project-health', async (req, res) => {
  try {
    const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : undefined;
    const health = await withLoop(loop => {
      if (projectId) return [computeProjectHealth(projectId, loop)];
      const goals = loop.personalStore.listGoals().filter(g => ['DRAFT', 'ACTIVE', 'PAUSED', 'BLOCKED'].includes(g.status));
      const projectIds = [...new Set(goals.flatMap(g => g.projectIds))].slice(0, KNOWLEDGE_QUERY_LIMITS.maxProjectIds * 2);
      return projectIds.map(pid => computeProjectHealth(pid, loop));
    });
    res.json({ projectHealth: health });
  } catch (err) { fail(res, err); }
});

router.get('/operating/service-health', async (_req, res) => {
  try {
    const { computeServiceHealth } = await import('./health');
    const health = await computeServiceHealth();
    res.json({ serviceHealth: health });
  } catch (err) { fail(res, err); }
});

function todayDate(): string {
  return process.env.MI_TEST_TODAY || new Date().toISOString().slice(0, 10);
}

export const operatingRouter = router;
