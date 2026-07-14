/**
 * SEO Control Center — Reports routes (spec §36).
 * Thin HTTP layer over seo/reporting/report-generator.ts. Mounted separately
 * from routes/seo.ts to avoid touching that file while it's being worked on
 * concurrently.
 */

import { Router, Request, Response } from 'express';
import { getSeoDb } from '../seo/seo-db';
import { generateDailyReport, generateWeeklyReport, generateMonthlyReport, type ReportType } from '../seo/reporting/report-generator';
import { getSeoWriteFlags } from '../seo/seo-write-guards';

export const seoReportsRouter = Router();

function safeParseContent(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw;
  try { return JSON.parse(raw); } catch { return raw; }
}

// GET /api/seo/write-flags
seoReportsRouter.get('/write-flags', (_req: Request, res: Response) => {
  const flags = getSeoWriteFlags();
  const publicWriteEnabled =
    flags.SEO_PRODUCTION_PUBLISH_ENABLED.enabled ||
    flags.SEO_GBP_WRITE_ENABLED.enabled ||
    flags.SEO_WEBSITE_WRITE_ENABLED.enabled ||
    flags.SEO_BACKLINK_WRITE_ENABLED.enabled;
  res.json({
    ok: true,
    flags,
    defaults: {
      absent_env_means_enabled: false,
      false_values: ['unset', '', '0', 'false', 'off'],
      true_values: ['1', 'true', 'on', 'yes', 'enabled'],
    },
    live_write_status: publicWriteEnabled ? 'PARTIALLY_ENABLED' : 'DISABLED',
  });
});

// GET /api/seo/reports?brand_id=&report_type=
seoReportsRouter.get('/reports', (req: Request, res: Response) => {
  const brandId = req.query.brand_id as string | undefined;
  const reportType = req.query.report_type as string | undefined;

  try {
    const db = getSeoDb();
    let sql = 'SELECT * FROM seo_reports WHERE 1=1';
    const params: unknown[] = [];
    if (brandId) { sql += ' AND brand_id = ?'; params.push(brandId); }
    if (reportType) { sql += ' AND report_type = ?'; params.push(reportType); }
    sql += ' ORDER BY created_at DESC LIMIT 100';

    const rows = db.prepare(sql).all(...(params as any[])) as Record<string, unknown>[];
    const reports = rows.map(r => ({ ...r, content: safeParseContent(r.content) }));

    res.json({ ok: true, total: reports.length, reports });
  } catch (e: unknown) {
    const err = e as { message?: string };
    res.status(500).json({ ok: false, error: err?.message || 'reports_query_failed' });
  }
});

// POST /api/seo/reports/generate  body: { brand_id?, report_type }
seoReportsRouter.post('/reports/generate', (req: Request, res: Response) => {
  const { brand_id, report_type } = (req.body || {}) as { brand_id?: string; report_type?: ReportType };

  if (!report_type || !['daily', 'weekly', 'monthly'].includes(report_type)) {
    return res.status(400).json({ ok: false, error: 'report_type must be one of: daily, weekly, monthly' });
  }

  try {
    let result;
    if (report_type === 'daily') result = generateDailyReport(brand_id);
    else if (report_type === 'weekly') result = generateWeeklyReport(brand_id);
    else result = generateMonthlyReport(brand_id);

    res.json({ ok: true, report_id: result.id, report: result.content });
  } catch (e: unknown) {
    const err = e as { message?: string };
    res.status(500).json({ ok: false, error: err?.message || 'report_generation_failed' });
  }
});
