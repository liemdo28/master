/**
 * HealthBriefingIntegration — adds health section to Executive Morning Briefing
 *
 * Called by the existing DailySnapshotBuilder or morning briefing runner.
 * Returns a structured health block that can be appended to any briefing format.
 */

import {
  getDailyHealth, getSleepByDate, getRecentDailyHealth,
} from './HealthDatabase.mjs';
import { computeHealthScore, scoreToGrade } from './HealthScoreEngine.mjs';
import { runAlertCheck, getFormattedAlerts } from './HealthAlertEngine.mjs';

export function buildHealthBriefingBlock(date = null) {
  const today = date || new Date().toISOString().split('T')[0];
  const yesterday = _addDays(today, -1);

  // Run alert check
  runAlertCheck(today);

  const d     = getDailyHealth(today);
  const sleep = getSleepByDate(today) || getSleepByDate(yesterday);
  const score = computeHealthScore(7);
  const alerts = getFormattedAlerts(3);

  // Build structured block
  const block = {
    section: 'Health',
    date: today,
    score: score ? { value: score.score, grade: score.grade } : null,
    metrics: {},
    alerts: [],
    recommendations: [],
  };

  if (sleep) {
    block.metrics.sleep = {
      label: 'Sleep',
      value: _fmtMins(sleep.total_mins),
      grade: scoreToGrade(sleep.quality_score || 0),
      detail: `Deep ${_fmtMins(sleep.deep_mins)} | REM ${_fmtMins(sleep.rem_mins)}`,
    };
  }

  if (d) {
    if (d.steps) block.metrics.steps = { label: 'Steps', value: d.steps.toLocaleString(), goal: '10,000' };
    if (d.resting_hr) block.metrics.resting_hr = { label: 'Resting HR', value: `${d.resting_hr.toFixed(0)} bpm` };
    if (d.hrv_ms)     block.metrics.hrv = { label: 'HRV', value: `${d.hrv_ms.toFixed(1)} ms` };
    if (d.active_cals) block.metrics.active_cals = { label: 'Active Cal', value: `${Math.round(d.active_cals)} kcal` };
  }

  if (score) {
    const rec = score.recommendations;
    if (rec.length) block.recommendations = rec;

    // Compare to yesterday
    const yesterday7 = getRecentDailyHealth(7);
    if (yesterday7.length >= 2) {
      const delta = score.delta;
      if (delta !== null && Math.abs(delta) >= 5) {
        block.score_delta = delta;
        block.score_delta_label = delta > 0 ? `+${delta} vs last week` : `${delta} vs last week`;
      }
    }
  }

  if (alerts?.has_alerts) {
    block.alerts = alerts.alerts.slice(0, 3).map(a => ({
      severity: a.severity,
      message: a.message_vi,
    }));
  }

  return block;
}

/**
 * Format health block as plain text for briefing output
 */
export function formatHealthBriefingText(block) {
  if (!block) return '';

  const lines = [`Health:`];

  if (block.score) {
    lines.push(`  Score: ${block.score.value}/100 (${block.score.grade})${block.score_delta_label ? ' ' + block.score_delta_label : ''}`);
  }

  const m = block.metrics;
  if (m.sleep)      lines.push(`  Sleep: ${m.sleep.value} (${m.sleep.grade})${m.sleep.detail ? ' — ' + m.sleep.detail : ''}`);
  if (m.steps)      lines.push(`  Steps: ${m.steps.value} / ${m.steps.goal}`);
  if (m.resting_hr) lines.push(`  Resting HR: ${m.resting_hr.value}`);
  if (m.hrv)        lines.push(`  HRV: ${m.hrv.value}`);
  if (m.active_cals) lines.push(`  Active Cal: ${m.active_cals.value}`);

  if (block.alerts.length) {
    lines.push('');
    for (const a of block.alerts) {
      const icon = a.severity === 'critical' ? '⚠️' : a.severity === 'warning' ? '📊' : 'ℹ️';
      lines.push(`  ${icon} ${a.message}`);
    }
  }

  if (block.recommendations.length) {
    lines.push('');
    lines.push('  Recommendations:');
    for (const r of block.recommendations) lines.push(`  • ${r}`);
  }

  return lines.join('\n');
}

/**
 * Inject health into an existing briefing object (duck-typed)
 */
export function injectHealthIntoBriefing(briefing, date = null) {
  const block = buildHealthBriefingBlock(date);
  const text  = formatHealthBriefingText(block);

  if (typeof briefing === 'string') {
    return briefing + '\n\n' + text;
  }
  if (typeof briefing === 'object' && briefing !== null) {
    briefing.health = block;
    briefing.health_text = text;
    return briefing;
  }
  return text;
}

function _fmtMins(mins) {
  if (!mins) return 'N/A';
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return `${h}h${m > 0 ? m + 'm' : ''}`;
}

function _addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}
