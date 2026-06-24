/**
 * HealthAlertEngine — anomaly detection for CEO health data
 *
 * Monitors:
 *   - Sleep drop >20% vs 7-day baseline
 *   - HRV drop >20% vs 7-day baseline
 *   - Resting HR increase >15% vs 7-day baseline
 *   - Activity reduction >30% vs 7-day baseline
 *   - Consecutive low-sleep nights (≥3)
 *   - SpO2 below 95%
 *
 * Alert style: empathetic, non-medical, executive.
 * Never makes medical diagnoses or claims.
 */

import {
  getRecentDailyHealth, getRecentSleep, getDailyHealth, getSleepByDate,
  insertAlert, getActiveAlerts,
} from './HealthDatabase.mjs';

// ── Thresholds ────────────────────────────────────────────────────────────────

const THRESHOLDS = {
  sleep_drop_pct:    0.20,   // 20% below baseline
  hrv_drop_pct:      0.20,
  rhr_spike_pct:     0.15,
  activity_drop_pct: 0.30,
  sleep_min_mins:    300,    // 5h
  spo2_critical:     95,
  consecutive_bad_sleep: 3,
};

// ── Main check function ───────────────────────────────────────────────────────

export function runAlertCheck(date = null) {
  const today = date || new Date().toISOString().split('T')[0];
  const alerts = [];

  // Need at least 7 days of baseline
  const baseline = getRecentDailyHealth(14);
  const baselineSleep = getRecentSleep(14);

  if (baseline.length < 3) return alerts; // Not enough data yet

  // Split baseline vs recent
  const baselineDays   = baseline.slice(7);   // older 7 days
  const recentDays     = baseline.slice(0, 7); // newest 7 days
  const baselineSleepSessions = baselineSleep.slice(7);
  const recentSleepSessions   = baselineSleep.slice(0, 7);

  const todayData  = getDailyHealth(today);
  const todaySleep = getSleepByDate(today);

  // ── Sleep alerts ────────────────────────────────────────────────────────────

  if (baselineSleepSessions.length && recentSleepSessions.length) {
    const baselineAvg = avg(baselineSleepSessions, 'total_mins');
    const recentAvg   = avg(recentSleepSessions, 'total_mins');
    const drop = (baselineAvg - recentAvg) / baselineAvg;

    if (drop >= THRESHOLDS.sleep_drop_pct) {
      alerts.push(createAlert({
        date: today,
        alert_type: 'sleep_drop',
        severity: drop >= 0.35 ? 'critical' : 'warning',
        metric: 'sleep_duration_mins',
        value: recentAvg,
        baseline: baselineAvg,
        change_pct: -drop * 100,
        message_vi: `Em thấy giấc ngủ của Anh giảm ${(drop*100).toFixed(0)}% trong 7 ngày qua so với tuần trước (${_fmtMins(recentAvg)} vs ${_fmtMins(baselineAvg)}). Em đề xuất Anh ưu tiên nghỉ sớm tối nay.`,
      }));
    }
  }

  // Consecutive short sleep nights
  const shortNights = recentSleepSessions.filter(s => s.total_mins < THRESHOLDS.sleep_min_mins);
  if (shortNights.length >= THRESHOLDS.consecutive_bad_sleep) {
    const consecutive = countConsecutiveShortSleep(recentSleepSessions);
    if (consecutive >= THRESHOLDS.consecutive_bad_sleep) {
      alerts.push(createAlert({
        date: today,
        alert_type: 'consecutive_short_sleep',
        severity: 'warning',
        metric: 'sleep_duration_mins',
        value: consecutive,
        baseline: THRESHOLDS.sleep_min_mins,
        change_pct: null,
        message_vi: `Em thấy có dấu hiệu thiếu ngủ trong ${consecutive} đêm liên tiếp. Em đề xuất Anh giảm cường độ làm việc tối nay và ngủ trước 11 giờ.`,
      }));
    }
  }

  // ── HRV alerts ──────────────────────────────────────────────────────────────

  const baselineHRV = baselineDays.filter(d => d.hrv_ms);
  const recentHRV   = recentDays.filter(d => d.hrv_ms);

  if (baselineHRV.length && recentHRV.length) {
    const bAvg = avg(baselineHRV, 'hrv_ms');
    const rAvg = avg(recentHRV, 'hrv_ms');
    const drop = (bAvg - rAvg) / bAvg;

    if (drop >= THRESHOLDS.hrv_drop_pct) {
      alerts.push(createAlert({
        date: today,
        alert_type: 'hrv_drop',
        severity: drop >= 0.30 ? 'critical' : 'warning',
        metric: 'hrv_ms',
        value: rAvg,
        baseline: bAvg,
        change_pct: -drop * 100,
        message_vi: `Em thấy có dấu hiệu giảm hồi phục trong ${recentHRV.length} ngày liên tiếp (HRV giảm ${(drop*100).toFixed(0)}%). Em đề xuất giảm cường độ làm việc và vận động hôm nay.`,
      }));
    }
  }

  // ── Resting HR spike ────────────────────────────────────────────────────────

  const baselineRHR = baselineDays.filter(d => d.resting_hr);
  const recentRHR   = recentDays.filter(d => d.resting_hr);

  if (baselineRHR.length && recentRHR.length) {
    const bAvg = avg(baselineRHR, 'resting_hr');
    const rAvg = avg(recentRHR, 'resting_hr');
    const rise = (rAvg - bAvg) / bAvg;

    if (rise >= THRESHOLDS.rhr_spike_pct) {
      alerts.push(createAlert({
        date: today,
        alert_type: 'rhr_spike',
        severity: rise >= 0.25 ? 'critical' : 'warning',
        metric: 'resting_hr',
        value: rAvg,
        baseline: bAvg,
        change_pct: rise * 100,
        message_vi: `Em thấy nhịp tim nghỉ ngơi của Anh tăng ${(rise*100).toFixed(0)}% so với baseline (${rAvg.toFixed(0)} vs ${bAvg.toFixed(0)} bpm). Đây thường là dấu hiệu cơ thể cần nghỉ ngơi thêm.`,
      }));
    }
  }

  // ── Activity drop ────────────────────────────────────────────────────────────

  const baselineSteps = baselineDays.filter(d => d.steps);
  const recentSteps   = recentDays.filter(d => d.steps);

  if (baselineSteps.length && recentSteps.length) {
    const bAvg = avg(baselineSteps, 'steps');
    const rAvg = avg(recentSteps, 'steps');
    const drop = (bAvg - rAvg) / bAvg;

    if (drop >= THRESHOLDS.activity_drop_pct) {
      alerts.push(createAlert({
        date: today,
        alert_type: 'activity_drop',
        severity: 'info',
        metric: 'steps',
        value: rAvg,
        baseline: bAvg,
        change_pct: -drop * 100,
        message_vi: `Em nhận thấy vận động của Anh giảm ${(drop*100).toFixed(0)}% so với tuần trước (${Math.round(rAvg).toLocaleString()} vs ${Math.round(bAvg).toLocaleString()} bước). Nếu bận việc, chỉ cần 10 phút đi bộ sau bữa ăn sẽ giúp ích nhiều.`,
      }));
    }
  }

  // ── SpO2 critical ─────────────────────────────────────────────────────────────

  if (todayData?.spo2_min && todayData.spo2_min < THRESHOLDS.spo2_critical) {
    alerts.push(createAlert({
      date: today,
      alert_type: 'spo2_low',
      severity: 'critical',
      metric: 'spo2_min',
      value: todayData.spo2_min,
      baseline: 98,
      change_pct: null,
      message_vi: `Em thấy SpO2 thấp nhất hôm nay là ${todayData.spo2_min}% — thấp hơn ngưỡng bình thường. Em đề xuất Anh thư giãn, hít thở sâu, và kiểm tra lại.`,
    }));
  }

  // Save all new alerts to DB
  for (const alert of alerts) {
    try { insertAlert(alert); } catch { /* skip duplicate */ }
  }

  return alerts;
}

// ── Get formatted alerts for Jarvis ──────────────────────────────────────────

export function getFormattedAlerts(days = 7) {
  const alerts = getActiveAlerts(days);
  if (!alerts.length) return null;

  const critical = alerts.filter(a => a.severity === 'critical');
  const warnings = alerts.filter(a => a.severity === 'warning');
  const infos    = alerts.filter(a => a.severity === 'info');

  return {
    has_alerts: true,
    critical_count: critical.length,
    warning_count: warnings.length,
    info_count: infos.length,
    alerts,
    summary_vi: buildAlertSummary(critical, warnings, infos),
  };
}

function buildAlertSummary(critical, warnings, infos) {
  if (!critical.length && !warnings.length && !infos.length) {
    return 'Không có dấu hiệu bất thường đáng lo ngại.';
  }

  const lines = [];
  if (critical.length) {
    lines.push(`⚠️ ${critical.length} cảnh báo quan trọng cần chú ý:`);
    for (const a of critical) lines.push(`  • ${a.message_vi}`);
  }
  if (warnings.length) {
    lines.push(`📊 ${warnings.length} xu hướng cần theo dõi:`);
    for (const a of warnings) lines.push(`  • ${a.message_vi}`);
  }
  if (infos.length && !critical.length) {
    lines.push(`ℹ️ ${infos.length} thông tin lưu ý:`);
    for (const a of infos.slice(0, 2)) lines.push(`  • ${a.message_vi}`);
  }

  return lines.join('\n');
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function avg(arr, key) {
  const vals = arr.map(r => r[key]).filter(v => v != null);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
}

function createAlert(params) {
  return {
    date:        params.date,
    alert_type:  params.alert_type,
    severity:    params.severity,
    metric:      params.metric,
    value:       params.value,
    baseline:    params.baseline,
    change_pct:  params.change_pct,
    message_vi:  params.message_vi,
  };
}

function countConsecutiveShortSleep(sessions) {
  let count = 0;
  for (const s of sessions.slice().sort((a, b) => b.date.localeCompare(a.date))) {
    if (s.total_mins < THRESHOLDS.sleep_min_mins) count++;
    else break;
  }
  return count;
}

function _fmtMins(mins) {
  if (!mins) return 'N/A';
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return `${h}h${m > 0 ? m + 'm' : ''}`;
}
