/**
 * HealthScoreEngine — Executive Health Score 0-100
 *
 * Components:
 *   Sleep        30%  — duration, deep%, REM%, continuity
 *   Recovery     25%  — HRV trend, resting HR trend
 *   Activity     25%  — steps, active cals, workout frequency
 *   Heart Health 15%  — resting HR absolute, SpO2, HR variability
 *   Consistency   5%  — data completeness streak
 *
 * Grade scale: A(90-100), A-(85-89), B+(80-84), B(75-79), B-(70-74),
 *              C+(65-69), C(60-64), C-(55-59), D(<55)
 */

import {
  getRecentDailyHealth, getRecentSleep, getDailyHealth, getSleepByDate,
} from './HealthDatabase.mjs';

// ── Targets & thresholds ─────────────────────────────────────────────────────

const TARGET = {
  steps:          10000,
  sleep_mins:     450,    // 7.5h
  deep_pct:       0.20,
  rem_pct:        0.22,
  resting_hr_low: 55,
  resting_hr_hi:  65,
  hrv_good:       50,     // ms
  hrv_ok:         35,
  spo2_target:    98,
  active_cals:    500,
  workouts_week:  3,
};

// ── Main scoring function ─────────────────────────────────────────────────────

export function computeHealthScore(days = 7) {
  const recentDays = getRecentDailyHealth(days);
  const recentSleep = getRecentSleep(days);

  if (!recentDays.length) return null;

  const sleepScore    = scoreSleep(recentSleep, days);
  const recoveryScore = scoreRecovery(recentDays);
  const activityScore = scoreActivity(recentDays, days);
  const heartScore    = scoreHeartHealth(recentDays);
  const consistency   = scoreConsistency(recentDays, days);

  const total = Math.round(
    sleepScore.score    * 0.30 +
    recoveryScore.score * 0.25 +
    activityScore.score * 0.25 +
    heartScore.score    * 0.15 +
    consistency.score   * 0.05
  );

  const today = new Date().toISOString().split('T')[0];
  const todayData = getDailyHealth(today);
  const prevWeekDays = getRecentDailyHealth(14).slice(7); // prior 7 days
  const prevScore = prevWeekDays.length ? computeScoreFromDays(prevWeekDays, getRecentSleep(14).slice(7)) : null;
  const delta = prevScore ? total - prevScore : null;

  return {
    date: today,
    score: total,
    grade: scoreToGrade(total),
    delta,
    components: {
      sleep:       { score: sleepScore.score,    grade: scoreToGrade(sleepScore.score),    detail: sleepScore.detail },
      recovery:    { score: recoveryScore.score, grade: scoreToGrade(recoveryScore.score), detail: recoveryScore.detail },
      activity:    { score: activityScore.score, grade: scoreToGrade(activityScore.score), detail: activityScore.detail },
      heart_health:{ score: heartScore.score,    grade: scoreToGrade(heartScore.score),    detail: heartScore.detail },
      consistency: { score: consistency.score,   grade: scoreToGrade(consistency.score),   detail: consistency.detail },
    },
    explanation: buildExplanation(total, delta, { sleepScore, recoveryScore, activityScore, heartScore }),
    recommendations: buildRecommendations({ sleepScore, recoveryScore, activityScore, heartScore }),
  };
}

function computeScoreFromDays(days, sleep) {
  if (!days.length) return null;
  const s = scoreSleep(sleep, 7);
  const r = scoreRecovery(days);
  const a = scoreActivity(days, 7);
  const h = scoreHeartHealth(days);
  const c = scoreConsistency(days, 7);
  return Math.round(s.score*0.30 + r.score*0.25 + a.score*0.25 + h.score*0.15 + c.score*0.05);
}

// ── Sleep Score (0-100) ───────────────────────────────────────────────────────

function scoreSleep(sessions, days) {
  if (!sessions.length) return { score: 0, detail: 'Không có dữ liệu giấc ngủ' };

  const avgTotal = sessions.reduce((a, s) => a + s.total_mins, 0) / sessions.length;
  const avgDeepPct = sessions.reduce((a, s) => a + (s.deep_mins / Math.max(s.total_mins, 1)), 0) / sessions.length;
  const avgRemPct  = sessions.reduce((a, s) => a + (s.rem_mins / Math.max(s.total_mins, 1)), 0) / sessions.length;
  const avgQuality = sessions.reduce((a, s) => a + (s.quality_score || 0), 0) / sessions.length;

  const durationPts = Math.min(40, (avgTotal / TARGET.sleep_mins) * 40);
  const deepPts     = Math.min(30, (avgDeepPct / TARGET.deep_pct) * 30);
  const remPts      = Math.min(20, (avgRemPct / TARGET.rem_pct) * 20);
  const qualityPts  = avgQuality * 0.10;

  const score = Math.min(100, Math.round(durationPts + deepPts + remPts + qualityPts));
  const avgH = (avgTotal / 60).toFixed(1);

  return {
    score,
    detail: `Trung bình ${avgH}h/đêm | Deep ${(avgDeepPct*100).toFixed(0)}% | REM ${(avgRemPct*100).toFixed(0)}%`,
  };
}

// ── Recovery Score (0-100) ────────────────────────────────────────────────────

function scoreRecovery(days) {
  const withHRV = days.filter(d => d.hrv_ms != null);
  const withRHR = days.filter(d => d.resting_hr != null);

  if (!withHRV.length && !withRHR.length) {
    return { score: 50, detail: 'Không đủ dữ liệu HRV/resting HR' };
  }

  let score = 0;
  let parts = [];

  if (withHRV.length) {
    const avgHRV = withHRV.reduce((a, d) => a + d.hrv_ms, 0) / withHRV.length;
    const hrvScore = avgHRV >= TARGET.hrv_good ? 100
      : avgHRV >= TARGET.hrv_ok ? 60 + ((avgHRV - TARGET.hrv_ok) / (TARGET.hrv_good - TARGET.hrv_ok)) * 40
      : (avgHRV / TARGET.hrv_ok) * 60;
    score += hrvScore * 0.6;
    parts.push(`HRV ${avgHRV.toFixed(0)}ms`);
  }

  if (withRHR.length) {
    const avgRHR = withRHR.reduce((a, d) => a + d.resting_hr, 0) / withRHR.length;
    const rhrScore = avgRHR <= TARGET.resting_hr_low ? 100
      : avgRHR <= TARGET.resting_hr_hi ? 100 - ((avgRHR - TARGET.resting_hr_low) / (TARGET.resting_hr_hi - TARGET.resting_hr_low)) * 30
      : Math.max(0, 70 - (avgRHR - TARGET.resting_hr_hi) * 3);
    score += rhrScore * 0.4;
    parts.push(`RHR ${avgRHR.toFixed(0)}bpm`);
  }

  return {
    score: Math.min(100, Math.round(score)),
    detail: parts.join(' | '),
  };
}

// ── Activity Score (0-100) ────────────────────────────────────────────────────

function scoreActivity(days, targetDays) {
  const avgSteps = days.reduce((a, d) => a + (d.steps || 0), 0) / days.length;
  const avgCals  = days.reduce((a, d) => a + (d.active_cals || 0), 0) / days.length;

  const stepScore = Math.min(60, (avgSteps / TARGET.steps) * 60);
  const calScore  = Math.min(40, (avgCals / TARGET.active_cals) * 40);

  const score = Math.min(100, Math.round(stepScore + calScore));

  return {
    score,
    detail: `${Math.round(avgSteps).toLocaleString()} bước/ngày | ${Math.round(avgCals)} kcal active`,
  };
}

// ── Heart Health Score (0-100) ────────────────────────────────────────────────

function scoreHeartHealth(days) {
  const withRHR  = days.filter(d => d.resting_hr != null);
  const withSpO2 = days.filter(d => d.spo2_avg != null);

  if (!withRHR.length) return { score: 50, detail: 'Chưa có dữ liệu nhịp tim' };

  const avgRHR  = withRHR.reduce((a, d) => a + d.resting_hr, 0) / withRHR.length;
  const avgSpO2 = withSpO2.length
    ? withSpO2.reduce((a, d) => a + d.spo2_avg, 0) / withSpO2.length
    : null;

  let score = 0;

  // RHR: 40 pts
  score += avgRHR <= 60 ? 40 : avgRHR <= 70 ? 30 : avgRHR <= 80 ? 15 : 5;

  // SpO2: 30 pts
  if (avgSpO2) {
    score += avgSpO2 >= 98 ? 30 : avgSpO2 >= 96 ? 20 : avgSpO2 >= 94 ? 10 : 0;
  } else {
    score += 20; // neutral if missing
  }

  // HR range stability: 30 pts
  const withRange = days.filter(d => d.min_hr && d.max_hr);
  if (withRange.length) {
    const avgRange = withRange.reduce((a, d) => a + (d.max_hr - d.min_hr), 0) / withRange.length;
    score += avgRange < 60 ? 30 : avgRange < 80 ? 20 : 10;
  } else {
    score += 20;
  }

  const parts = [`RHR ${avgRHR.toFixed(0)}bpm`];
  if (avgSpO2) parts.push(`SpO2 ${avgSpO2.toFixed(1)}%`);

  return { score: Math.min(100, score), detail: parts.join(' | ') };
}

// ── Consistency Score (0-100) ─────────────────────────────────────────────────

function scoreConsistency(days, targetDays) {
  const completePct = days.length / targetDays;
  const score = Math.min(100, Math.round(completePct * 100));
  return {
    score,
    detail: `${days.length}/${targetDays} ngày có dữ liệu`,
  };
}

// ── Grade and explanation ─────────────────────────────────────────────────────

export function scoreToGrade(score) {
  if (score >= 90) return 'A';
  if (score >= 85) return 'A-';
  if (score >= 80) return 'B+';
  if (score >= 75) return 'B';
  if (score >= 70) return 'B-';
  if (score >= 65) return 'C+';
  if (score >= 60) return 'C';
  if (score >= 55) return 'C-';
  return 'D';
}

function buildExplanation(total, delta, { sleepScore, recoveryScore, activityScore }) {
  const lines = [];

  if (delta !== null) {
    if (delta > 5) lines.push(`Sức khỏe cải thiện +${delta} điểm so với tuần trước.`);
    else if (delta < -5) lines.push(`Sức khỏe giảm ${Math.abs(delta)} điểm so với tuần trước.`);
    else lines.push('Sức khỏe ổn định so với tuần trước.');
  }

  // Weakest component
  const components = [
    { name: 'Giấc ngủ', score: sleepScore.score },
    { name: 'Hồi phục', score: recoveryScore.score },
    { name: 'Vận động', score: activityScore.score },
  ];
  const weakest = components.sort((a, b) => a.score - b.score)[0];
  if (weakest.score < 70) {
    lines.push(`Điểm yếu nhất: ${weakest.name} (${weakest.score}/100).`);
  }

  return lines.join(' ');
}

function buildRecommendations({ sleepScore, recoveryScore, activityScore, heartScore }) {
  const recs = [];

  if (sleepScore.score < 70) recs.push('Cố ngủ đủ 7-8 tiếng tối nay.');
  if (recoveryScore.score < 65) recs.push('HRV thấp — cân nhắc giảm cường độ hôm nay.');
  if (activityScore.score < 60) recs.push('Tăng vận động: 15 phút đi bộ sau bữa tối.');
  if (heartScore.score < 65) recs.push('Theo dõi nhịp tim nghỉ — nên đo lại buổi sáng.');

  return recs;
}
