/**
 * HealthKnowledgeBuilder — ingest health data into UnifiedKnowledgeDatabase
 *
 * Entity types:
 *   daily_health    — one per calendar day
 *   weekly_health   — one per week
 *   monthly_health  — one per month
 *   sleep_trend     — 7-day rolling window
 *   activity_trend  — 7-day rolling window
 *   recovery_trend  — 7-day rolling window
 *
 * Makes health data searchable alongside project data via FederationSearch.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import {
  getDailyHealth, getWeeklySummary, getMonthSummary,
  getRecentDailyHealth, getRecentSleep,
} from './HealthDatabase.mjs';
import { computeHealthScore, scoreToGrade } from './HealthScoreEngine.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GLOBAL_DIR = process.env.GLOBAL_DIR || path.join(__dirname, '..', '..', '.local-agent-global');
const KB_PATH    = path.join(GLOBAL_DIR, 'knowledge-db', 'knowledge.db');

// We write a JSON sidecar into the visibility cache that FederationSearch can read
const HEALTH_CACHE_DIR = path.join(GLOBAL_DIR, 'visibility', 'health');

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

// ── Build daily entity ────────────────────────────────────────────────────────

export function buildDailyEntity(date) {
  const d = getDailyHealth(date);
  if (!d) return null;

  const { getRecentSleep: _gs } = _syncImportSleep();
  const sleep = _gs ? _gs(1) : null;

  const score = computeHealthScore(1);
  const content = formatDailyContent(date, d, sleep, score);

  return {
    kind: 'health-daily',
    subtype: 'ceo-health',
    title: `CEO Health — ${date}`,
    path: `health/daily/${date}`,
    content,
    tags: JSON.stringify(['health', 'daily', 'ceo', 'steps', 'sleep', 'heart-rate', date.slice(0, 7)]),
    metadata_json: JSON.stringify({
      date,
      steps: d.steps,
      sleep_mins: sleep?.[0]?.total_mins,
      resting_hr: d.resting_hr,
      hrv_ms: d.hrv_ms,
      spo2_avg: d.spo2_avg,
      health_score: score?.score,
    }),
  };
}

// ── Build weekly entity ────────────────────────────────────────────────────────

export function buildWeeklyEntity(weekStart) {
  const w = getWeeklySummary(weekStart);
  if (!w) return null;

  const score = computeHealthScore(7);
  const content = formatWeeklyContent(w, score);

  return {
    kind: 'health-weekly',
    subtype: 'ceo-health',
    title: `CEO Health Week — ${weekStart}`,
    path: `health/weekly/${weekStart}`,
    content,
    tags: JSON.stringify(['health', 'weekly', 'ceo', weekStart.slice(0, 7)]),
    metadata_json: JSON.stringify({ week_start: weekStart, ...w, health_score: score?.score }),
  };
}

// ── Build monthly entity ──────────────────────────────────────────────────────

export function buildMonthlyEntity(yearMonth) {
  const m = getMonthSummary(yearMonth);
  if (!m) return null;

  const content = formatMonthlyContent(m);

  return {
    kind: 'health-monthly',
    subtype: 'ceo-health',
    title: `CEO Health Month — ${yearMonth}`,
    path: `health/monthly/${yearMonth}`,
    content,
    tags: JSON.stringify(['health', 'monthly', 'ceo', yearMonth]),
    metadata_json: JSON.stringify({ month: yearMonth, ...m }),
  };
}

// ── Build trend entities ──────────────────────────────────────────────────────

export function buildTrendEntities() {
  const days  = getRecentDailyHealth(7);
  const sleep = getRecentSleep(7);
  if (!days.length) return [];

  const score = computeHealthScore(7);
  const entities = [];
  const today = new Date().toISOString().split('T')[0];

  // Sleep trend
  if (sleep.length) {
    const avgSleep = sleep.reduce((a, s) => a + s.total_mins, 0) / sleep.length;
    const avgDeep  = sleep.reduce((a, s) => a + (s.deep_mins || 0), 0) / sleep.length;
    entities.push({
      kind: 'health-trend',
      subtype: 'sleep-trend',
      title: `CEO Sleep Trend — ${today}`,
      path: `health/trends/sleep/${today}`,
      content: `7-day sleep trend ending ${today}:\nAvg sleep: ${_fmtMins(avgSleep)}\nAvg deep: ${_fmtMins(avgDeep)}\nGrade: ${score?.components?.sleep?.grade || 'N/A'}\n${score?.components?.sleep?.detail || ''}`,
      tags: JSON.stringify(['health', 'sleep', 'trend', 'ceo']),
      metadata_json: JSON.stringify({ type: 'sleep_trend', avg_sleep_mins: avgSleep, avg_deep_mins: avgDeep }),
    });
  }

  // Activity trend
  const avgSteps = days.reduce((a, d) => a + (d.steps || 0), 0) / days.length;
  entities.push({
    kind: 'health-trend',
    subtype: 'activity-trend',
    title: `CEO Activity Trend — ${today}`,
    path: `health/trends/activity/${today}`,
    content: `7-day activity trend ending ${today}:\nAvg steps: ${Math.round(avgSteps).toLocaleString()}/day\nGrade: ${score?.components?.activity?.grade || 'N/A'}\n${score?.components?.activity?.detail || ''}`,
    tags: JSON.stringify(['health', 'activity', 'steps', 'trend', 'ceo']),
    metadata_json: JSON.stringify({ type: 'activity_trend', avg_steps: avgSteps }),
  });

  // Recovery trend
  const withHRV = days.filter(d => d.hrv_ms);
  if (withHRV.length) {
    const avgHRV = withHRV.reduce((a, d) => a + d.hrv_ms, 0) / withHRV.length;
    entities.push({
      kind: 'health-trend',
      subtype: 'recovery-trend',
      title: `CEO Recovery Trend — ${today}`,
      path: `health/trends/recovery/${today}`,
      content: `7-day recovery trend ending ${today}:\nAvg HRV: ${avgHRV.toFixed(1)}ms\nGrade: ${score?.components?.recovery?.grade || 'N/A'}\n${score?.components?.recovery?.detail || ''}`,
      tags: JSON.stringify(['health', 'recovery', 'hrv', 'trend', 'ceo']),
      metadata_json: JSON.stringify({ type: 'recovery_trend', avg_hrv: avgHRV }),
    });
  }

  return entities;
}

// ── Write to visibility cache (used by FederationSearch) ────────────────────

export function saveToVisibilityCache() {
  ensureDir(HEALTH_CACHE_DIR);
  const today = new Date().toISOString().split('T')[0];

  const daily   = getDailyHealth(today);
  const weekly  = getWeeklySummary(_weekStart());
  const monthly = getMonthSummary(today.slice(0, 7));
  const score   = computeHealthScore(7);
  const trends  = buildTrendEntities();

  const cache = {
    last_updated: new Date().toISOString(),
    today: daily,
    weekly,
    monthly,
    health_score: score,
    trends: trends.map(t => ({ kind: t.subtype, content: t.content })),
  };

  fs.writeFileSync(
    path.join(HEALTH_CACHE_DIR, 'data.json'),
    JSON.stringify(cache, null, 2)
  );
  fs.writeFileSync(
    path.join(HEALTH_CACHE_DIR, 'last_sync.json'),
    JSON.stringify({ last_sync: new Date().toISOString() })
  );

  return cache;
}

// ── Formatters ────────────────────────────────────────────────────────────────

function formatDailyContent(date, d, sleep, score) {
  const sleepRow = sleep?.[0];
  const lines = [
    `CEO Health Summary — ${date}`,
    `Steps: ${(d.steps || 0).toLocaleString()} (Goal: 10,000 — ${Math.round(((d.steps||0)/10000)*100)}%)`,
    sleepRow ? `Sleep: ${_fmtMins(sleepRow.total_mins)} | Deep: ${_fmtMins(sleepRow.deep_mins)} | REM: ${_fmtMins(sleepRow.rem_mins)}` : 'Sleep: No data',
    d.resting_hr ? `Resting HR: ${d.resting_hr.toFixed(0)} bpm` : '',
    d.hrv_ms     ? `HRV: ${d.hrv_ms.toFixed(1)} ms` : '',
    d.spo2_avg   ? `SpO2: ${d.spo2_avg.toFixed(1)}%` : '',
    d.active_cals ? `Active calories: ${Math.round(d.active_cals)} kcal` : '',
    score ? `Health Score: ${score.score}/100 (${score.grade})` : '',
  ].filter(Boolean);
  return lines.join('\n');
}

function formatWeeklyContent(w, score) {
  const sleepH = w.avg_sleep_mins ? _fmtMins(w.avg_sleep_mins) : 'N/A';
  return [
    `CEO Weekly Health — ${w.week_start} to ${w.week_end}`,
    `Days with data: ${w.days_with_data}/7`,
    `Avg steps: ${(w.avg_steps||0).toLocaleString()}/day | Total: ${(w.total_steps||0).toLocaleString()}`,
    `Avg sleep: ${sleepH}/night | Deep: ${w.avg_deep_mins ? _fmtMins(w.avg_deep_mins) : 'N/A'}`,
    w.avg_resting_hr ? `Avg resting HR: ${w.avg_resting_hr} bpm` : '',
    w.avg_hrv ? `Avg HRV: ${w.avg_hrv} ms` : '',
    `Workouts: ${w.workouts}`,
    score ? `Health Score: ${score.score}/100 (${score.grade})` : '',
    score ? `Sleep: ${score.components.sleep.grade} | Recovery: ${score.components.recovery.grade} | Activity: ${score.components.activity.grade}` : '',
  ].filter(Boolean).join('\n');
}

function formatMonthlyContent(m) {
  return [
    `CEO Monthly Health — ${m.month}`,
    `Days with data: ${m.days_with_data}`,
    `Avg steps: ${(m.avg_steps||0).toLocaleString()}/day | Total: ${(m.total_steps||0).toLocaleString()}`,
    m.avg_sleep_mins ? `Avg sleep: ${_fmtMins(m.avg_sleep_mins)}/night` : '',
    m.avg_resting_hr ? `Avg resting HR: ${m.avg_resting_hr} bpm` : '',
    m.avg_hrv ? `Avg HRV: ${m.avg_hrv} ms` : '',
    `Workouts: ${m.workouts}`,
  ].filter(Boolean).join('\n');
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _fmtMins(mins) {
  if (!mins) return 'N/A';
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return `${h}h${m > 0 ? m + 'm' : ''}`;
}

function _weekStart() {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay() + 1);
  return d.toISOString().split('T')[0];
}

// Sync import helper — HealthDatabase is already imported at top level
function _syncImportSleep() {
  // getRecentSleep is already imported at the top of this file
  return { getRecentSleep };
}
