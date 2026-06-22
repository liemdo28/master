/**
 * HealthQueryHandler — Jarvis health query router and response formatter
 *
 * Handles natural language queries in Vietnamese and English.
 * Produces Executive Assistant responses: specific, data-grounded, actionable.
 *
 * Tone rules:
 *   - Open with "Dạ thưa Anh, em vừa kiểm tra..."
 *   - Give concrete numbers, not generalities
 *   - Compare to baseline / goal / last week
 *   - End with 1-sentence recommendation if relevant
 *   - Never alarm unnecessarily, never downplay real issues
 *   - No medical diagnoses
 */

import {
  getDailyHealth, getSleepByDate, getRecentDailyHealth, getRecentSleep,
  getWeeklySummary, getMonthSummary, getRecentWorkouts,
} from './HealthDatabase.mjs';
import { computeHealthScore, scoreToGrade } from './HealthScoreEngine.mjs';
import { getFormattedAlerts, runAlertCheck } from './HealthAlertEngine.mjs';

// ── Query detection ───────────────────────────────────────────────────────────

const HEALTH_KEYWORDS = [
  'bước', 'steps', 'ngủ', 'sleep', 'tim', 'heart', 'sức khỏe', 'health',
  'calories', 'workout', 'tập', 'hrv', 'nhịp', 'hồi phục', 'recovery',
  'spo2', 'oxy', 'đáng lo', 'cảnh báo', 'alert', 'điểm sức khỏe', 'health score',
  'tháng này', 'tuần này', 'hôm nay', 'mệt', 'năng lượng', 'energy',
];

export function isHealthQuery(text) {
  const q = text.toLowerCase();
  return HEALTH_KEYWORDS.some(k => q.includes(k));
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function handleHealthQuery(query, options = {}) {
  const q = query.toLowerCase();
  const today = new Date().toISOString().split('T')[0];

  // Run alert check on every health query
  const freshAlerts = runAlertCheck(today);

  // Route to specific handler
  if (/hôm nay.*bước|bước.*hôm nay|steps.*today|today.*steps/.test(q)) {
    return respondStepsToday(today, freshAlerts);
  }
  if (/tuần này.*sức khỏe|sức khỏe.*tuần|health.*week|week.*health/.test(q)) {
    return respondWeeklySummary(today, freshAlerts);
  }
  if (/tháng này.*ngủ|ngủ.*tháng|sleep.*month|month.*sleep/.test(q)) {
    return respondMonthlySleep(today);
  }
  if (/tháng này.*sức khỏe|sức khỏe.*tháng|health.*month/.test(q)) {
    return respondMonthlySummary(today);
  }
  if (/đáng lo|cảnh báo|alert|vấn đề|issue|lo ngại/.test(q)) {
    return respondAlerts(today, freshAlerts);
  }
  if (/điểm sức khỏe|health score|score/.test(q)) {
    return respondHealthScore(today);
  }
  if (/ngủ.*hôm|hôm.*ngủ|sleep.*last night|last night.*sleep/.test(q)) {
    return respondSleepLastNight(today);
  }
  if (/bước|steps/.test(q)) {
    return respondStepsToday(today, freshAlerts);
  }
  if (/ngủ|sleep/.test(q)) {
    return respondSleepLastNight(today);
  }
  if (/hồi phục|recovery|hrv/.test(q)) {
    return respondRecovery(today);
  }

  // Default: full today summary
  return respondTodaySummary(today, freshAlerts);
}

// ── Response builders ─────────────────────────────────────────────────────────

function respondStepsToday(today, alerts) {
  const d = getDailyHealth(today);
  const goal = 10000;

  if (!d?.steps) {
    return `Dạ thưa Anh, em chưa có dữ liệu bước chân hôm nay (${_fmtDate(today)}). Có thể đồng hồ chưa sync hoặc file export chưa cập nhật. Anh thử chạy Shortcut "Mi Health Export" là em sẽ có ngay ạ.`;
  }

  const pct   = Math.round((d.steps / goal) * 100);
  const left  = Math.max(0, goal - d.steps);
  const leftMins = Math.round(left / 100); // ~100 steps/min walking

  let response = `Dạ thưa Anh, em vừa kiểm tra dữ liệu hôm nay (${_fmtDate(today)}).\n\n`;
  response += `👟 Bước chân: **${d.steps.toLocaleString()} bước** — đạt ${pct}% mục tiêu 10,000 bước.\n`;

  if (d.steps >= goal) {
    response += `\n✅ Anh đã hoàn thành mục tiêu hôm nay! Rất tốt ạ.`;
  } else {
    response += `\nCòn cách mục tiêu **${left.toLocaleString()} bước** (~${leftMins} phút đi bộ).`;
    if (leftMins <= 20) {
      response += ` Em đề xuất Anh đi bộ thêm một vòng nhỏ sau bữa tối là xong ạ.`;
    }
  }

  const alertMsgs = alerts.filter(a => a.alert_type === 'activity_drop');
  if (alertMsgs.length) {
    response += `\n\n⚠️ ${alertMsgs[0].message_vi}`;
  }

  return response;
}

function respondSleepLastNight(today) {
  const yesterday = _addDays(today, -1);
  const sleep = getSleepByDate(today) || getSleepByDate(yesterday);

  if (!sleep) {
    return `Dạ thưa Anh, em chưa tìm thấy dữ liệu giấc ngủ đêm qua. Có thể đồng hồ chưa đồng bộ ạ. Anh chạy Shortcut "Mi Health Export" để cập nhật nhé.`;
  }

  const h = Math.floor(sleep.total_mins / 60);
  const m = sleep.total_mins % 60;
  const deepPct = sleep.total_mins ? Math.round((sleep.deep_mins / sleep.total_mins) * 100) : 0;
  const remPct  = sleep.total_mins ? Math.round((sleep.rem_mins  / sleep.total_mins) * 100) : 0;
  const grade   = scoreToGrade(sleep.quality_score || 0);

  let response = `Dạ thưa Anh, em vừa xem dữ liệu giấc ngủ đêm ${_fmtDate(sleep.date)}.\n\n`;
  response += `🌙 Tổng thời gian ngủ: **${h}h${m > 0 ? m + 'm' : ''}** (chất lượng: ${grade})\n`;
  response += `  • Deep sleep: ${_fmtMins(sleep.deep_mins)} (${deepPct}%)\n`;
  response += `  • REM: ${_fmtMins(sleep.rem_mins)} (${remPct}%)\n`;
  if (sleep.awake_mins) response += `  • Thức giữa đêm: ${sleep.awake_mins} phút\n`;

  if (sleep.total_mins < 300) {
    response += `\n⚠️ Giấc ngủ hơi ngắn. Em đề xuất Anh cố ngủ sớm hơn tối nay để hồi phục tốt hơn.`;
  } else if (sleep.total_mins >= 420 && deepPct >= 18) {
    response += `\n✅ Giấc ngủ tốt! Anh có đủ deep sleep và REM ạ.`;
  } else if (deepPct < 15) {
    response += `\n📊 Deep sleep hơi thấp (${deepPct}%). Điều này có thể ảnh hưởng đến hồi phục. Thử tắt màn hình sớm hơn 30 phút trước khi ngủ ạ.`;
  }

  return response;
}

function respondWeeklySummary(today, alerts) {
  const d = new Date(today);
  d.setDate(d.getDate() - d.getDay() + 1);
  const weekStart = d.toISOString().split('T')[0];
  const w = getWeeklySummary(weekStart);
  const score = computeHealthScore(7);

  if (!w) {
    return `Dạ thưa Anh, em chưa đủ dữ liệu tuần này. Anh chạy sync để cập nhật nhé ạ.`;
  }

  const sleepH = w.avg_sleep_mins ? _fmtMins(w.avg_sleep_mins) : 'N/A';

  let response = `Dạ thưa Anh, đây là tổng quan sức khỏe tuần này (${_fmtDate(weekStart)} – ${_fmtDate(w.week_end)}):\n\n`;

  if (score) {
    response += `🏆 **Health Score: ${score.score}/100 (${score.grade})**\n`;
    response += `  Sleep: ${score.components.sleep.grade} | Recovery: ${score.components.recovery.grade} | Activity: ${score.components.activity.grade} | Heart: ${score.components.heart_health.grade}\n\n`;
  }

  response += `👟 Vận động: Trung bình **${(w.avg_steps||0).toLocaleString()} bước/ngày**`;
  response += w.avg_steps >= 10000 ? ' ✅ (đạt mục tiêu)\n' : ` (mục tiêu 10,000 bước)\n`;

  response += `🌙 Giấc ngủ: Trung bình **${sleepH}/đêm**`;
  if (w.avg_sleep_mins >= 420) response += ' ✅\n';
  else if (w.avg_sleep_mins < 360) response += ' ⚠️ (cần ngủ thêm)\n';
  else response += '\n';

  if (w.avg_resting_hr) {
    response += `❤️ Nhịp tim nghỉ: **${w.avg_resting_hr} bpm**`;
    response += parseFloat(w.avg_resting_hr) <= 65 ? ' ✅\n' : '\n';
  }
  if (w.avg_hrv) {
    response += `📊 HRV: **${w.avg_hrv} ms**`;
    response += parseFloat(w.avg_hrv) >= 40 ? ' ✅ (hồi phục tốt)\n' : ' (theo dõi thêm)\n';
  }
  if (w.workouts) response += `🏋️ Tập luyện: **${w.workouts} buổi** trong tuần\n`;

  if (alerts?.length) {
    response += `\n⚠️ **Lưu ý:** ${alerts[0].message_vi}`;
  } else if (score?.recommendations?.length) {
    response += `\n💡 Em đề xuất: ${score.recommendations[0]}`;
  }

  return response;
}

function respondMonthlySleep(today) {
  const ym = today.slice(0, 7);
  const m  = getMonthSummary(ym);

  if (!m?.avg_sleep_mins) {
    return `Dạ thưa Anh, em chưa đủ dữ liệu tháng ${ym}. Anh cần sync thêm dữ liệu nhé ạ.`;
  }

  return [
    `Dạ thưa Anh, đây là tổng quan giấc ngủ tháng ${ym}:`,
    ``,
    `🌙 Trung bình: **${_fmtMins(m.avg_sleep_mins)}/đêm** (${m.days_with_data} ngày có dữ liệu)`,
    m.avg_sleep_mins >= 420
      ? `✅ Nhìn chung tháng này Anh ngủ đủ giấc.`
      : `⚠️ Trung bình chưa đạt 7h/đêm. Em đề xuất Anh chú ý thời gian đi ngủ tháng tới.`,
  ].join('\n');
}

function respondMonthlySummary(today) {
  const ym = today.slice(0, 7);
  const m  = getMonthSummary(ym);

  if (!m) return `Dạ thưa Anh, em chưa đủ dữ liệu tháng ${ym}. Anh sync thêm nhé ạ.`;

  return [
    `Dạ thưa Anh, đây là tổng quan sức khỏe tháng ${ym}:`,
    ``,
    `📅 Số ngày có dữ liệu: **${m.days_with_data}**`,
    `👟 Bước chân: TB **${(m.avg_steps||0).toLocaleString()} bước/ngày** | Tổng ${(m.total_steps||0).toLocaleString()}`,
    m.avg_sleep_mins ? `🌙 Giấc ngủ: TB **${_fmtMins(m.avg_sleep_mins)}/đêm**` : '',
    m.avg_resting_hr ? `❤️ Nhịp tim nghỉ: **${m.avg_resting_hr} bpm**` : '',
    m.avg_hrv ? `📊 HRV: **${m.avg_hrv} ms**` : '',
    `🏋️ Tập luyện: **${m.workouts} buổi** trong tháng`,
  ].filter(Boolean).join('\n');
}

function respondAlerts(today, freshAlerts) {
  const storedAlerts = getFormattedAlerts(7);

  if (!freshAlerts?.length && !storedAlerts?.has_alerts) {
    return [
      `Dạ thưa Anh, em vừa kiểm tra toàn bộ chỉ số sức khỏe 7 ngày qua.`,
      ``,
      `✅ Không phát hiện dấu hiệu bất thường đáng lo ngại:`,
      `  • Nhịp tim nghỉ: trong ngưỡng bình thường`,
      `  • HRV: ổn định`,
      `  • Giấc ngủ: không có đêm nào dưới 5 tiếng`,
      `  • Vận động: không giảm bất thường`,
      ``,
      `Sức khỏe tổng thể ổn định ạ.`,
    ].join('\n');
  }

  const all = [...(freshAlerts || [])];
  const critical = all.filter(a => a.severity === 'critical');
  const warnings = all.filter(a => a.severity === 'warning');
  const infos    = all.filter(a => a.severity === 'info');

  let response = `Dạ thưa Anh, em vừa kiểm tra xong. Có một số điểm cần lưu ý:\n\n`;

  if (critical.length) {
    response += `🔴 **Quan trọng:**\n`;
    for (const a of critical) response += `  • ${a.message_vi}\n`;
  }
  if (warnings.length) {
    response += `\n🟡 **Cần theo dõi:**\n`;
    for (const a of warnings) response += `  • ${a.message_vi}\n`;
  }
  if (infos.length) {
    response += `\nℹ️ **Lưu ý nhỏ:**\n`;
    for (const a of infos.slice(0, 2)) response += `  • ${a.message_vi}\n`;
  }

  return response;
}

function respondHealthScore(today) {
  const score = computeHealthScore(7);
  if (!score) return `Dạ thưa Anh, em chưa đủ dữ liệu để tính điểm sức khỏe. Anh sync thêm nhé ạ.`;

  const delta = score.delta;
  const deltaStr = delta !== null
    ? (delta > 0 ? ` (+${delta} so với tuần trước)` : ` (${delta} so với tuần trước)`)
    : '';

  let response = `Dạ thưa Anh, em vừa tính điểm sức khỏe 7 ngày qua:\n\n`;
  response += `🏆 **Health Score: ${score.score}/100 (${score.grade})**${deltaStr}\n\n`;
  response += `Phân tích theo thành phần:\n`;
  response += `  🌙 Sleep:       **${score.components.sleep.grade}** (${score.components.sleep.score}/100) — ${score.components.sleep.detail}\n`;
  response += `  💪 Recovery:    **${score.components.recovery.grade}** (${score.components.recovery.score}/100) — ${score.components.recovery.detail}\n`;
  response += `  👟 Activity:    **${score.components.activity.grade}** (${score.components.activity.score}/100) — ${score.components.activity.detail}\n`;
  response += `  ❤️  Heart:       **${score.components.heart_health.grade}** (${score.components.heart_health.score}/100) — ${score.components.heart_health.detail}\n`;
  response += `  📅 Consistency: **${score.components.consistency.grade}** (${score.components.consistency.score}/100) — ${score.components.consistency.detail}\n`;

  if (score.explanation) response += `\n📝 ${score.explanation}`;
  if (score.recommendations.length) {
    response += `\n\n💡 Em đề xuất:\n`;
    for (const r of score.recommendations) response += `  • ${r}\n`;
  }

  return response;
}

function respondRecovery(today) {
  const days = getRecentDailyHealth(7);
  const withHRV = days.filter(d => d.hrv_ms);
  const withRHR = days.filter(d => d.resting_hr);

  if (!withHRV.length && !withRHR.length) {
    return `Dạ thưa Anh, em chưa có đủ dữ liệu HRV và nhịp tim nghỉ để đánh giá hồi phục. Đồng hồ cần đo HRV ít nhất vài ngày ạ.`;
  }

  const avgHRV = withHRV.length ? withHRV.reduce((a, d) => a + d.hrv_ms, 0) / withHRV.length : null;
  const avgRHR = withRHR.length ? withRHR.reduce((a, d) => a + d.resting_hr, 0) / withRHR.length : null;

  let response = `Dạ thưa Anh, đây là tình trạng hồi phục 7 ngày qua:\n\n`;

  if (avgHRV) {
    const grade = avgHRV >= 50 ? '✅ Tốt' : avgHRV >= 35 ? '🟡 Trung bình' : '🔴 Thấp';
    response += `📊 HRV trung bình: **${avgHRV.toFixed(1)} ms** — ${grade}\n`;
  }
  if (avgRHR) {
    const grade = avgRHR <= 60 ? '✅ Tốt' : avgRHR <= 70 ? '🟡 Bình thường' : '🔴 Cao';
    response += `❤️  Nhịp tim nghỉ TB: **${avgRHR.toFixed(0)} bpm** — ${grade}\n`;
  }

  const score = computeHealthScore(7);
  if (score?.components?.recovery) {
    const r = score.components.recovery;
    response += `\n💪 Recovery grade: **${r.grade}** (${r.score}/100)`;
    if (score.recommendations.some(r => r.includes('HRV') || r.includes('hồi phục'))) {
      response += `\n💡 Em đề xuất: ${score.recommendations.find(r => r.includes('HRV') || r.includes('hồi phục'))}`;
    }
  }

  return response;
}

function respondTodaySummary(today, alerts) {
  const d     = getDailyHealth(today);
  const sleep = getSleepByDate(today) || getSleepByDate(_addDays(today, -1));
  const score = computeHealthScore(7);

  if (!d && !sleep) {
    return `Dạ thưa Anh, em chưa có dữ liệu sức khỏe hôm nay (${_fmtDate(today)}). Anh thử chạy Shortcut "Mi Health Export" để sync dữ liệu nhé ạ.`;
  }

  let response = `Dạ thưa Anh, đây là tóm tắt sức khỏe hôm nay (${_fmtDate(today)}):\n\n`;

  if (score) response += `🏆 Health Score: **${score.score}/100 (${score.grade})**\n\n`;
  if (d?.steps)      response += `👟 Bước chân: **${d.steps.toLocaleString()}** / 10,000\n`;
  if (sleep)         response += `🌙 Giấc ngủ: **${_fmtMins(sleep.total_mins)}** (${scoreToGrade(sleep.quality_score||0)})\n`;
  if (d?.resting_hr) response += `❤️  Nhịp tim nghỉ: **${d.resting_hr.toFixed(0)} bpm**\n`;
  if (d?.hrv_ms)     response += `📊 HRV: **${d.hrv_ms.toFixed(1)} ms**\n`;

  if (alerts?.length) {
    response += `\n⚠️ **Lưu ý:** ${alerts[0].message_vi}`;
  } else if (score?.recommendations?.length) {
    response += `\n💡 ${score.recommendations[0]}`;
  }

  return response;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _fmtDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric' });
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
