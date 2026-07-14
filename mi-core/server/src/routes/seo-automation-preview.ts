import { Router, Request, Response } from 'express';
import {
  classifyPublishTier,
  getFunctionalAutomationRun,
  getFunctionalAutomationStatus,
  runFunctionalPreviewAutomation,
} from '../seo/automation/preview-automation';
import { getSeoSchedulerStatus } from '../seo/scheduler/seo-scheduler';

export const seoAutomationPreviewRouter = Router();

seoAutomationPreviewRouter.get('/automation/status', (_req: Request, res: Response) => {
  res.json({ ...getFunctionalAutomationStatus(), scheduler_runtime: getSeoSchedulerStatus() });
});

seoAutomationPreviewRouter.get('/automation/runs/latest', (_req: Request, res: Response) => {
  const run = getFunctionalAutomationRun();
  if (!run) return res.status(404).json({ ok: false, error: 'no_automation_run' });
  res.json({ ok: true, ...run });
});

seoAutomationPreviewRouter.post('/automation/run-preview', async (_req: Request, res: Response) => {
  try {
    const result = await runFunctionalPreviewAutomation();
    res.json(result);
  } catch (e) {
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
});

seoAutomationPreviewRouter.get('/automation/policy-tiers', (_req: Request, res: Response) => {
  const categories = [
    'gbp_post_publish',
    'article_publish',
    'modify_gbp_core_info',
    'website_article_publish',
    'backlink_publish',
  ];
  res.json({ ok: true, tiers: categories.map(category => ({ category, ...classifyPublishTier(category) })) });
});
