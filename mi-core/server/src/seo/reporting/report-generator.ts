/**
 * SEO Control Center — Reporting Engine (spec §36).
 * Generates daily / weekly / monthly reports from REAL rows in the SEO
 * control-center database (seo_issues, seo_actions, seo_evidence,
 * seo_keywords, seo_backlinks, seo_audits, seo_automation_runs,
 * seo_content_items, seo_rankings, seo_analytics_daily) plus the live
 * approval queue (approval/gate.ts, filtered to seo_* categories).
 * Persists into seo_reports and pushes a short WhatsApp summary to the CEO
 * via queueToCeo() — never the full JSON payload.
 */

import { getSeoDb, nowIso, seoId } from '../seo-db';
import { getBrandById } from '../brand-config';
import { getPending } from '../../approval/gate';
import { queueToCeo } from '../../services/whatsapp-sender';

export type ReportType = 'daily' | 'weekly' | 'monthly';

// ── Period bounds ─────────────────────────────────────────────────────────

function periodBounds(type: ReportType): { start: string; end: string } {
  const end = new Date();
  const start = new Date(end);
  if (type === 'daily') start.setDate(start.getDate() - 1);
  else if (type === 'weekly') start.setDate(start.getDate() - 7);
  else start.setDate(start.getDate() - 30);
  return { start: start.toISOString(), end: end.toISOString() };
}

// ── Row-count helpers ────────────────────────────────────────────────────

interface CountRow { c: number }

function count(sql: string, params: unknown[]): number {
  return (getSeoDb().prepare(sql).get(...(params as any[])) as CountRow | undefined)?.c ?? 0;
}

// ── Issues ───────────────────────────────────────────────────────────────

function issuesStats(brandId: string | undefined, start: string, end: string) {
  const db = getSeoDb();
  const openTotal = brandId
    ? count(`SELECT COUNT(*) as c FROM seo_issues WHERE status='open' AND brand_id=?`, [brandId])
    : count(`SELECT COUNT(*) as c FROM seo_issues WHERE status='open'`, []);

  const criticalOpen = brandId
    ? db.prepare(`SELECT id, issue_type, description, affected_url, created_at FROM seo_issues
                  WHERE status='open' AND severity='critical' AND brand_id=? ORDER BY created_at DESC LIMIT 25`).all(brandId)
    : db.prepare(`SELECT id, issue_type, description, affected_url, created_at FROM seo_issues
                  WHERE status='open' AND severity='critical' ORDER BY created_at DESC LIMIT 25`).all();

  const openedInPeriod = brandId
    ? count(`SELECT COUNT(*) as c FROM seo_issues WHERE created_at BETWEEN ? AND ? AND brand_id=?`, [start, end, brandId])
    : count(`SELECT COUNT(*) as c FROM seo_issues WHERE created_at BETWEEN ? AND ?`, [start, end]);

  const resolvedInPeriod = brandId
    ? count(`SELECT COUNT(*) as c FROM seo_issues WHERE resolved_at IS NOT NULL AND resolved_at BETWEEN ? AND ? AND brand_id=?`, [start, end, brandId])
    : count(`SELECT COUNT(*) as c FROM seo_issues WHERE resolved_at IS NOT NULL AND resolved_at BETWEEN ? AND ?`, [start, end]);

  return {
    open_total: openTotal,
    critical_open: criticalOpen,
    opened_in_period: openedInPeriod,
    resolved_in_period: resolvedInPeriod,
  };
}

// ── Automation runs (seo_automation_runs has no brand_id — automation-wide) ─

function automationStats(start: string, end: string) {
  const db = getSeoDb();
  const failedRuns = db.prepare(`SELECT id, job_id, started_at, completed_at, detail FROM seo_automation_runs
                                  WHERE status='failed' AND started_at BETWEEN ? AND ? ORDER BY started_at DESC LIMIT 25`).all(start, end);
  const totalRuns = count(`SELECT COUNT(*) as c FROM seo_automation_runs WHERE started_at BETWEEN ? AND ?`, [start, end]);
  return {
    failed_runs: failedRuns,
    failed_count: (failedRuns as unknown[]).length,
    total_runs_in_period: totalRuns,
  };
}

// ── Approvals needed (live approval gate, org-wide — gate.ts has no brand_id column) ─

function approvalsNeededStats() {
  const pending = getPending().filter(a => a.category.startsWith('seo_'));
  return {
    count: pending.length,
    items: pending.slice(0, 25).map(a => ({
      id: a.id, category: a.category, description: a.description, target: a.target, created_at: a.created_at,
    })),
    note: 'org-wide (the approval queue does not carry a brand_id column) — not filtered by brand',
  };
}

// ── Published content (no content-generation pipeline built yet — expect empty) ─

function contentPublishedStats(brandId: string | undefined, start: string, end: string) {
  const db = getSeoDb();
  const rows = brandId
    ? db.prepare(`SELECT id, title, published_at FROM seo_content_items
                  WHERE published_at IS NOT NULL AND published_at BETWEEN ? AND ? AND brand_id=? AND deleted_at IS NULL`).all(start, end, brandId)
    : db.prepare(`SELECT id, title, published_at FROM seo_content_items
                  WHERE published_at IS NOT NULL AND published_at BETWEEN ? AND ? AND deleted_at IS NULL`).all(start, end);
  return { count: (rows as unknown[]).length, items: rows };
}

// ── Keywords ─────────────────────────────────────────────────────────────

function keywordsStats(brandId: string | undefined, start: string, end: string) {
  const db = getSeoDb();
  const rows = (brandId
    ? db.prepare(`SELECT status, COUNT(*) as c FROM seo_keywords WHERE brand_id=? AND deleted_at IS NULL GROUP BY status`).all(brandId)
    : db.prepare(`SELECT status, COUNT(*) as c FROM seo_keywords WHERE deleted_at IS NULL GROUP BY status`).all()
  ) as { status: string; c: number }[];

  const byStatus: Record<string, number> = {};
  let total = 0;
  for (const r of rows) { byStatus[r.status] = r.c; total += r.c; }

  const newInPeriod = brandId
    ? count(`SELECT COUNT(*) as c FROM seo_keywords WHERE created_at BETWEEN ? AND ? AND brand_id=?`, [start, end, brandId])
    : count(`SELECT COUNT(*) as c FROM seo_keywords WHERE created_at BETWEEN ? AND ?`, [start, end]);

  return { total, by_status: byStatus, new_in_period: newInPeriod };
}

// ── Backlinks ────────────────────────────────────────────────────────────

function backlinksStats(brandId: string | undefined, start: string, end: string) {
  const db = getSeoDb();
  const rows = (brandId
    ? db.prepare(`SELECT status, COUNT(*) as c FROM seo_backlinks WHERE brand_id=? GROUP BY status`).all(brandId)
    : db.prepare(`SELECT status, COUNT(*) as c FROM seo_backlinks GROUP BY status`).all()
  ) as { status: string; c: number }[];

  const byStatus: Record<string, number> = {};
  let total = 0;
  for (const r of rows) { byStatus[r.status] = r.c; total += r.c; }

  const newInPeriod = brandId
    ? count(`SELECT COUNT(*) as c FROM seo_backlinks WHERE created_at BETWEEN ? AND ? AND brand_id=?`, [start, end, brandId])
    : count(`SELECT COUNT(*) as c FROM seo_backlinks WHERE created_at BETWEEN ? AND ?`, [start, end]);

  return { total, by_status: byStatus, new_in_period: newInPeriod };
}

// ── Audits ───────────────────────────────────────────────────────────────

function auditsStats(brandId: string | undefined, start: string, end: string) {
  const db = getSeoDb();
  const rows = (brandId
    ? db.prepare(`SELECT audit_type, COUNT(*) as c FROM seo_audits WHERE created_at BETWEEN ? AND ? AND brand_id=? GROUP BY audit_type`).all(start, end, brandId)
    : db.prepare(`SELECT audit_type, COUNT(*) as c FROM seo_audits WHERE created_at BETWEEN ? AND ? GROUP BY audit_type`).all(start, end)
  ) as { audit_type: string; c: number }[];

  const byType: Record<string, number> = {};
  let total = 0;
  for (const r of rows) { byType[r.audit_type] = r.c; total += r.c; }

  return { total_in_period: total, by_type: byType };
}

// ── Rankings / analytics trend (weekly + monthly only) ──────────────────

function rankingsTrend(brandId: string | undefined, start: string, end: string) {
  const db = getSeoDb();
  const rows = (brandId
    ? db.prepare(`SELECT impressions, clicks, position FROM seo_rankings WHERE brand_id=? AND captured_at BETWEEN ? AND ?`).all(brandId, start, end)
    : db.prepare(`SELECT impressions, clicks, position FROM seo_rankings WHERE captured_at BETWEEN ? AND ?`).all(start, end)
  ) as { impressions: number | null; clicks: number | null; position: number | null }[];

  if (rows.length === 0) {
    return { available: false, note: 'No rows in seo_rankings for this period — GSC ranking sync has not populated data yet.' };
  }
  const impressions = rows.reduce((s, r) => s + (r.impressions || 0), 0);
  const clicks = rows.reduce((s, r) => s + (r.clicks || 0), 0);
  const positioned = rows.filter(r => r.position != null);
  const avgPosition = positioned.length
    ? Math.round((positioned.reduce((s, r) => s + (r.position || 0), 0) / positioned.length) * 100) / 100
    : null;

  return { available: true, rows_count: rows.length, total_impressions: impressions, total_clicks: clicks, avg_position: avgPosition };
}

function analyticsTrend(brandId: string | undefined, start: string, end: string) {
  const db = getSeoDb();
  const rows = (brandId
    ? db.prepare(`SELECT metric, SUM(value) as total FROM seo_analytics_daily WHERE brand_id=? AND date BETWEEN ? AND ? GROUP BY metric`).all(brandId, start.slice(0, 10), end.slice(0, 10))
    : db.prepare(`SELECT metric, SUM(value) as total FROM seo_analytics_daily WHERE date BETWEEN ? AND ? GROUP BY metric`).all(start.slice(0, 10), end.slice(0, 10))
  ) as { metric: string; total: number }[];

  if (rows.length === 0) {
    return { available: false, note: 'No rows in seo_analytics_daily for this period — GA4 sync has not populated data yet.' };
  }
  const byMetric: Record<string, number> = {};
  for (const r of rows) byMetric[r.metric] = r.total;
  return { available: true, by_metric: byMetric };
}

// ── Monthly rollup ───────────────────────────────────────────────────────

function rollupStats(brandId: string | undefined, start: string, end: string) {
  const ran = brandId
    ? count(`SELECT COUNT(*) as c FROM seo_actions WHERE status='ran' AND created_at BETWEEN ? AND ? AND brand_id=?`, [start, end, brandId])
    : count(`SELECT COUNT(*) as c FROM seo_actions WHERE status='ran' AND created_at BETWEEN ? AND ?`, [start, end]);
  const blocked = brandId
    ? count(`SELECT COUNT(*) as c FROM seo_actions WHERE status='blocked' AND created_at BETWEEN ? AND ? AND brand_id=?`, [start, end, brandId])
    : count(`SELECT COUNT(*) as c FROM seo_actions WHERE status='blocked' AND created_at BETWEEN ? AND ?`, [start, end]);
  const pendingApproval = brandId
    ? count(`SELECT COUNT(*) as c FROM seo_actions WHERE status='pending' AND created_at BETWEEN ? AND ? AND brand_id=?`, [start, end, brandId])
    : count(`SELECT COUNT(*) as c FROM seo_actions WHERE status='pending' AND created_at BETWEEN ? AND ?`, [start, end]);

  return {
    actions_auto_executed: ran,
    actions_blocked: blocked,
    actions_submitted_for_approval: pendingApproval,
  };
}

// ── Shared stats builder ─────────────────────────────────────────────────

interface ReportStats {
  brand_id: string | null;
  brand_name: string | null;
  period_start: string;
  period_end: string;
  generated_at: string;
  issues: ReturnType<typeof issuesStats>;
  automation: ReturnType<typeof automationStats>;
  approvals_needed: ReturnType<typeof approvalsNeededStats>;
  content_published: ReturnType<typeof contentPublishedStats>;
  keywords: ReturnType<typeof keywordsStats>;
  backlinks: ReturnType<typeof backlinksStats>;
  audits: ReturnType<typeof auditsStats>;
}

function buildBaseStats(brandId: string | undefined, start: string, end: string): ReportStats {
  const brand = brandId ? getBrandById(brandId) : undefined;
  return {
    brand_id: brandId ?? null,
    brand_name: brand?.name ?? (brandId ? brandId : null),
    period_start: start,
    period_end: end,
    generated_at: nowIso(),
    issues: issuesStats(brandId, start, end),
    automation: automationStats(start, end),
    approvals_needed: approvalsNeededStats(),
    content_published: contentPublishedStats(brandId, start, end),
    keywords: keywordsStats(brandId, start, end),
    backlinks: backlinksStats(brandId, start, end),
    audits: auditsStats(brandId, start, end),
  };
}

function persistReport(type: ReportType, brandId: string | undefined, start: string, end: string, content: unknown): string {
  const id = seoId('report');
  getSeoDb().prepare(`
    INSERT INTO seo_reports (id, created_at, brand_id, report_type, period_start, period_end, content)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, nowIso(), brandId ?? null, type, start, end, JSON.stringify(content));
  return id;
}

function whatsappSummary(label: string, brandName: string | null, stats: ReportStats): string {
  const lines = [
    `[SEO] ${label} report — ${brandName ?? 'all brands'}`,
    `Critical issues open: ${stats.issues.critical_open.length}`,
    `Failed automation runs: ${stats.automation.failed_count}`,
    `Approvals needed: ${stats.approvals_needed.count}`,
    `Content published: ${stats.content_published.count}`,
    `New keywords: ${stats.keywords.new_in_period}`,
  ];
  return lines.join('\n');
}

// ── Public API ───────────────────────────────────────────────────────────

export interface GeneratedReport {
  id: string;
  content: Record<string, unknown>;
}

export function generateDailyReport(brandId?: string): GeneratedReport {
  const { start, end } = periodBounds('daily');
  const stats = buildBaseStats(brandId, start, end);
  const content = { report_type: 'daily', ...stats };
  const id = persistReport('daily', brandId, start, end, content);
  queueToCeo(whatsappSummary('Daily', stats.brand_name, stats));
  return { id, content };
}

export function generateWeeklyReport(brandId?: string): GeneratedReport {
  const { start, end } = periodBounds('weekly');
  const stats = buildBaseStats(brandId, start, end);
  const content = {
    report_type: 'weekly',
    ...stats,
    rankings_trend: rankingsTrend(brandId, start, end),
    analytics_trend: analyticsTrend(brandId, start, end),
  };
  const id = persistReport('weekly', brandId, start, end, content);
  queueToCeo(whatsappSummary('Weekly', stats.brand_name, stats));
  return { id, content };
}

export function generateMonthlyReport(brandId?: string): GeneratedReport {
  const { start, end } = periodBounds('monthly');
  const stats = buildBaseStats(brandId, start, end);
  const content = {
    report_type: 'monthly',
    ...stats,
    rankings_trend: rankingsTrend(brandId, start, end),
    analytics_trend: analyticsTrend(brandId, start, end),
    rollup: rollupStats(brandId, start, end),
  };
  const id = persistReport('monthly', brandId, start, end, content);
  queueToCeo(whatsappSummary('Monthly', stats.brand_name, stats));
  return { id, content };
}
