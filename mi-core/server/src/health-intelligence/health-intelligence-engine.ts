/**
 * Health Intelligence Engine — Phase 23
 * Reads CEO health data from Apple Health / Huawei Health exports.
 * Answers: sleep quality, HRV trends, recovery, stress signals.
 *
 * Data sources: exported JSON/CSV from Apple Health or Huawei Health.
 * Export path: .local-agent-global/health-export/
 */

import fs from 'fs';
import path from 'path';

const HEALTH_DIR = path.join(
  process.env.MI_CORE_ROOT || 'D:/Project/Master/mi-core',
  '.local-agent-global/health-export'
);

export interface HealthMetric {
  date: string;
  value: number;
  unit: string;
}

export interface SleepSession {
  date: string;
  duration_hours: number;
  quality: 'POOR' | 'FAIR' | 'GOOD' | 'EXCELLENT';
  start_time: string;
  end_time: string;
}

export interface HRVReading {
  date: string;
  hrv_ms: number;
  resting_hr: number;
}

export interface HealthSnapshot {
  as_of: string;
  data_source: string;
  last_sleep?: SleepSession;
  avg_sleep_7d: number;          // hours
  sleep_quality_trend: 'IMPROVING' | 'STABLE' | 'DEGRADING' | 'NO_DATA';
  last_hrv?: number;             // ms
  hrv_trend: 'IMPROVING' | 'STABLE' | 'DEGRADING' | 'NO_DATA';
  recovery_score?: number;       // 0-100
  stress_signal: 'LOW' | 'MODERATE' | 'HIGH' | 'UNKNOWN';
  steps_today?: number;
  active_energy_today?: number;  // kcal
  recommendations_vi: string[];
  data_available: boolean;
}

// ── Readers ───────────────────────────────────────────────────────────────────

function readJsonFile<T>(filename: string, def: T): T {
  const fp = path.join(HEALTH_DIR, filename);
  try {
    if (!fs.existsSync(fp)) return def;
    return JSON.parse(fs.readFileSync(fp, 'utf8'));
  } catch { return def; }
}

function parseSleepQuality(hours: number): SleepSession['quality'] {
  if (hours >= 7.5) return 'EXCELLENT';
  if (hours >= 6.5) return 'GOOD';
  if (hours >= 5.5) return 'FAIR';
  return 'POOR';
}

// ── Snapshot builder ──────────────────────────────────────────────────────────

export function buildHealthSnapshot(): HealthSnapshot {
  const hasDir = fs.existsSync(HEALTH_DIR);
  const files = hasDir ? fs.readdirSync(HEALTH_DIR) : [];
  const hasData = files.some(f => f.endsWith('.json') || f.endsWith('.csv'));

  if (!hasData) {
    return {
      as_of: new Date().toISOString(),
      data_source: 'none',
      avg_sleep_7d: 0,
      sleep_quality_trend: 'NO_DATA',
      hrv_trend: 'NO_DATA',
      stress_signal: 'UNKNOWN',
      recommendations_vi: [
        'Chưa có dữ liệu sức khỏe. Để kết nối: export từ Apple Health → Shortcuts → Lưu vào .local-agent-global/health-export/sleep.json',
        'Hoặc export từ Huawei Health → Settings → Data Management → Export Data',
      ],
      data_available: false,
    };
  }

  // Read available data
  const sleepData = readJsonFile<SleepSession[]>('sleep.json', []);
  const hrvData   = readJsonFile<HRVReading[]>('hrv.json', []);
  const stepsData = readJsonFile<HealthMetric[]>('steps.json', []);

  // Sleep analysis
  const recent7d = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
  const recentSleep = sleepData.filter(s => s.date >= recent7d).sort((a, b) => b.date.localeCompare(a.date));
  const avg7d = recentSleep.length > 0
    ? recentSleep.reduce((s, r) => s + r.duration_hours, 0) / recentSleep.length : 0;

  const sleepTrend: HealthSnapshot['sleep_quality_trend'] = recentSleep.length < 3 ? 'NO_DATA'
    : (() => {
      const first3 = recentSleep.slice(-3).reduce((s, r) => s + r.duration_hours, 0) / 3;
      const last3  = recentSleep.slice(0, 3).reduce((s, r) => s + r.duration_hours, 0) / 3;
      return last3 - first3 >= 0.5 ? 'IMPROVING' : last3 - first3 <= -0.5 ? 'DEGRADING' : 'STABLE';
    })();

  // HRV analysis
  const recentHrv = hrvData.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);
  const lastHrv = recentHrv[0]?.hrv_ms;
  const prvHrv  = recentHrv[3]?.hrv_ms;
  const hrvTrend: HealthSnapshot['hrv_trend'] = !lastHrv || !prvHrv ? 'NO_DATA'
    : lastHrv - prvHrv >= 5 ? 'IMPROVING' : lastHrv - prvHrv <= -5 ? 'DEGRADING' : 'STABLE';

  // Recovery & stress
  const recoveryScore = lastHrv ? Math.min(100, Math.round((lastHrv / 60) * 100)) : undefined;
  const stress: HealthSnapshot['stress_signal'] =
    !lastHrv ? 'UNKNOWN'
    : lastHrv < 25 ? 'HIGH'
    : lastHrv < 40 ? 'MODERATE'
    : 'LOW';

  // Steps today
  const today = new Date().toISOString().slice(0, 10);
  const todaySteps = stepsData.find(s => s.date === today)?.value;

  // Recommendations
  const recs: string[] = [];
  if (avg7d < 7) recs.push(`Anh ngủ TB ${avg7d.toFixed(1)}h/đêm — nên tăng lên 7-8h để optimal performance`);
  if (stress === 'HIGH') recs.push('HRV thấp — dấu hiệu stress cao. Cân nhắc giảm workload hoặc nghỉ ngơi thêm');
  if (stress === 'MODERATE') recs.push('HRV ở mức trung bình — theo dõi thêm, tránh tăng workload đột ngột');
  if (hrvTrend === 'DEGRADING') recs.push('HRV đang giảm 3-7 ngày gần đây — kiểm tra chất lượng giấc ngủ');
  if (sleepTrend === 'DEGRADING') recs.push('Chất lượng giấc ngủ đang giảm — xem xét điều chỉnh giờ ngủ');
  if (recs.length === 0) recs.push('Sức khỏe ổn định. Tiếp tục duy trì thói quen hiện tại ✅');

  return {
    as_of: new Date().toISOString(),
    data_source: files.join(', '),
    last_sleep: recentSleep[0],
    avg_sleep_7d: Math.round(avg7d * 10) / 10,
    sleep_quality_trend: sleepTrend,
    last_hrv: lastHrv,
    hrv_trend: hrvTrend,
    recovery_score: recoveryScore,
    stress_signal: stress,
    steps_today: todaySteps,
    recommendations_vi: recs,
    data_available: true,
  };
}

export function formatHealthBriefing(snap: HealthSnapshot): string {
  if (!snap.data_available) {
    return ['❤️ *Health Intelligence*', '', ...snap.recommendations_vi.map(r => `• ${r}`)].join('\n');
  }
  const lines = ['❤️ *Health Intelligence*', ''];
  if (snap.last_sleep) lines.push(`😴 Giấc ngủ tối qua: ${snap.last_sleep.duration_hours}h (${snap.last_sleep.quality})`);
  lines.push(`📊 TB 7 ngày: ${snap.avg_sleep_7d}h | Xu hướng: ${snap.sleep_quality_trend}`);
  if (snap.last_hrv) lines.push(`💓 HRV: ${snap.last_hrv}ms | Recovery: ${snap.recovery_score}/100`);
  lines.push(`⚡ Stress: ${snap.stress_signal} | HRV trend: ${snap.hrv_trend}`);
  if (snap.steps_today) lines.push(`🚶 Steps hôm nay: ${snap.steps_today.toLocaleString()}`);
  lines.push('');
  for (const r of snap.recommendations_vi) lines.push(`💡 ${r}`);
  return lines.join('\n');
}
