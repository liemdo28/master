/**
 * SEO Control Center — Automation Scheduler (spec §29).
 * Does NOT use node-cron — uses setInterval, matching cron/sync-scheduler.ts
 * and jarvis/daily-briefing-scheduler.ts conventions in this repo.
 *  - Every 15 min: scan seo_ai_jobs / seo_actions for stuck/failed items.
 *  - Daily/Weekly/Monthly: VN-timezone hour+minute check (like the briefing
 *    scheduler) to trigger report generation for each active brand.
 * Every run is recorded in seo_automation_runs for observability.
 *
 * NOTE: startSeoScheduler() is exported but not called here — index.ts wires
 * it up (see instructions in the PR/handoff notes).
 */

import { getSeoDb, nowIso, seoId } from '../seo-db';
import { getActiveBrands } from '../brand-config';
import { generateDailyReport, generateWeeklyReport, generateMonthlyReport } from '../reporting/report-generator';
import { queueToCeo } from '../../services/whatsapp-sender';
import { disabledReason, isSeoAutomationEnabled } from '../seo-write-guards';

const STUCK_JOB_CHECK_INTERVAL_MS = 15 * 60 * 1000; // 15 min
const HOUR_TICK_INTERVAL_MS = 60 * 1000;             // 1 min tick, matches daily-briefing-scheduler pattern

let stuckJobTimer: ReturnType<typeof setInterval> | null = null;
let hourTickTimer: ReturnType<typeof setInterval> | null = null;

let lastDailyReportDate = '';
let lastWeeklyReportDate = '';
let lastMonthlyReportMonth = '';
let lastStuckJobCheck: Date | null = null;

function vietnamNow(): { hour: number; minute: number; dateStr: string; weekday: number; day: number } {
  const now = new Date();
  const vn = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
  return {
    hour: vn.getHours(),
    minute: vn.getMinutes(),
    dateStr: vn.toISOString().slice(0, 10),
    weekday: vn.getDay(), // 0 = Sunday, 1 = Monday
    day: vn.getDate(),
  };
}

function recordRun(jobId: string, status: 'completed' | 'failed', detail: unknown, startedAt: string): void {
  try {
    getSeoDb().prepare(`
      INSERT INTO seo_automation_runs (id, started_at, completed_at, job_id, status, detail)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(seoId('run'), startedAt, nowIso(), jobId, status, JSON.stringify(detail ?? null));
  } catch (e) {
    console.warn('[SEO Scheduler] failed to record automation run:', e);
  }
}

// ── Job: stuck / failed job scan ────────────────────────────────────────

function checkStuckJobs(): void {
  const startedAt = nowIso();
  try {
    const db = getSeoDb();
    const staleThreshold = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1hr

    const blockedActions = db.prepare(
      `SELECT id, category, brand_id, created_at FROM seo_actions WHERE status='blocked' ORDER BY created_at DESC LIMIT 20`
    ).all();
    const failedAiJobs = db.prepare(
      `SELECT id, provider, brand_id, created_at, error FROM seo_ai_jobs WHERE status='failed' ORDER BY created_at DESC LIMIT 20`
    ).all();
    const stuckRunningAiJobs = db.prepare(
      `SELECT id, provider, brand_id, created_at, status FROM seo_ai_jobs WHERE status IN ('running','waiting_for_login') AND created_at < ? ORDER BY created_at DESC LIMIT 20`
    ).all(staleThreshold);

    const total = (blockedActions as unknown[]).length + (failedAiJobs as unknown[]).length + (stuckRunningAiJobs as unknown[]).length;

    if (total > 0) {
      console.warn(`[SEO Scheduler] health check: ${(blockedActions as unknown[]).length} blocked actions, ${(failedAiJobs as unknown[]).length} failed AI jobs, ${(stuckRunningAiJobs as unknown[]).length} stuck-running AI jobs`);
      queueToCeo(`[SEO] Automation health check: ${(blockedActions as unknown[]).length} blocked actions, ${(failedAiJobs as unknown[]).length} failed AI jobs, ${(stuckRunningAiJobs as unknown[]).length} stuck-running AI jobs.`);
    }

    recordRun('stuck_job_check', 'completed', {
      blocked_actions: (blockedActions as unknown[]).length,
      failed_ai_jobs: (failedAiJobs as unknown[]).length,
      stuck_running_ai_jobs: (stuckRunningAiJobs as unknown[]).length,
    }, startedAt);
    lastStuckJobCheck = new Date();
  } catch (e) {
    console.warn('[SEO Scheduler] stuck job check error:', e);
    recordRun('stuck_job_check', 'failed', { error: (e as Error).message }, startedAt);
  }
}

// ── Jobs: report generation ─────────────────────────────────────────────

function runDailyReports(): void {
  const startedAt = nowIso();
  try {
    const brands = getActiveBrands();
    for (const b of brands) generateDailyReport(b.brand_id);
    recordRun('daily_report', 'completed', { brands: brands.map(b => b.brand_id) }, startedAt);
    console.log(`[SEO Scheduler] daily reports generated for ${brands.length} brand(s)`);
  } catch (e) {
    console.warn('[SEO Scheduler] daily report error:', e);
    recordRun('daily_report', 'failed', { error: (e as Error).message }, startedAt);
  }
}

function runWeeklyReports(): void {
  const startedAt = nowIso();
  try {
    const brands = getActiveBrands();
    for (const b of brands) generateWeeklyReport(b.brand_id);
    recordRun('weekly_report', 'completed', { brands: brands.map(b => b.brand_id) }, startedAt);
    console.log(`[SEO Scheduler] weekly reports generated for ${brands.length} brand(s)`);
  } catch (e) {
    console.warn('[SEO Scheduler] weekly report error:', e);
    recordRun('weekly_report', 'failed', { error: (e as Error).message }, startedAt);
  }
}

function runMonthlyReports(): void {
  const startedAt = nowIso();
  try {
    const brands = getActiveBrands();
    for (const b of brands) generateMonthlyReport(b.brand_id);
    recordRun('monthly_report', 'completed', { brands: brands.map(b => b.brand_id) }, startedAt);
    console.log(`[SEO Scheduler] monthly reports generated for ${brands.length} brand(s)`);
  } catch (e) {
    console.warn('[SEO Scheduler] monthly report error:', e);
    recordRun('monthly_report', 'failed', { error: (e as Error).message }, startedAt);
  }
}

// ── Public API ───────────────────────────────────────────────────────────

export function startSeoScheduler(): void {
  if (stuckJobTimer || hourTickTimer) return; // already running
  if (!isSeoAutomationEnabled()) {
    console.log(`[SEO Scheduler] disabled — ${disabledReason('SEO_AUTOMATION_ENABLED')}`);
    return;
  }

  stuckJobTimer = setInterval(checkStuckJobs, STUCK_JOB_CHECK_INTERVAL_MS);

  hourTickTimer = setInterval(() => {
    try {
      const { hour, minute, dateStr, weekday, day } = vietnamNow();

      // Daily report — once per day at 08:00 VN (after the 07:00 CEO briefing)
      if (hour === 8 && minute === 0 && dateStr !== lastDailyReportDate) {
        lastDailyReportDate = dateStr;
        runDailyReports();
      }

      // Weekly report — Monday 08:15 VN
      if (weekday === 1 && hour === 8 && minute === 15 && dateStr !== lastWeeklyReportDate) {
        lastWeeklyReportDate = dateStr;
        runWeeklyReports();
      }

      // Monthly report — 1st of month, 08:30 VN
      const monthKey = dateStr.slice(0, 7);
      if (day === 1 && hour === 8 && minute === 30 && monthKey !== lastMonthlyReportMonth) {
        lastMonthlyReportMonth = monthKey;
        runMonthlyReports();
      }
    } catch (e) {
      console.warn('[SEO Scheduler] hour-tick error:', e);
    }
  }, HOUR_TICK_INTERVAL_MS);

  // Run an initial stuck-job scan on boot so the dashboard isn't empty for 15 min.
  checkStuckJobs();

  console.log('[SEO Scheduler] started — stuck-job check every 15min, daily report 08:00, weekly Mon 08:15, monthly 1st 08:30 (Asia/Ho_Chi_Minh)');
}

export function stopSeoScheduler(): void {
  if (stuckJobTimer) { clearInterval(stuckJobTimer); stuckJobTimer = null; }
  if (hourTickTimer) { clearInterval(hourTickTimer); hourTickTimer = null; }
}

export function getSeoSchedulerStatus() {
  return {
    running: !!(stuckJobTimer && hourTickTimer),
    stuck_job_check_interval_min: STUCK_JOB_CHECK_INTERVAL_MS / 60000,
    last_stuck_job_check: lastStuckJobCheck?.toISOString() || null,
    last_daily_report_date: lastDailyReportDate || null,
    last_weekly_report_date: lastWeeklyReportDate || null,
    last_monthly_report_month: lastMonthlyReportMonth || null,
    timezone: 'Asia/Ho_Chi_Minh',
    automation_enabled: isSeoAutomationEnabled(),
  };
}
