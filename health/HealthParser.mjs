/**
 * HealthParser — parses Apple Health export files from iOS Shortcuts
 *
 * Supports:
 *  1. Individual metric files (primary — from Shortcuts native output)
 *     steps.json, rhr.json, hr.json, hrv.json, spo2.json,
 *     sleep.json, calories.json, workouts.json
 *  2. Combined JSON export (mi-health-export.json — legacy)
 *  3. Apple Health XML export (export.xml — fallback)
 */

import fs from 'fs';
import path from 'path';
import { createInterface } from 'readline';

// ── Individual files parser (primary format) ─────────────────────────────────

/**
 * Parse individual metric files saved by iOS Shortcuts.
 * Shortcuts serializes health samples as text like:
 *   "8,432 steps\n7,842 steps\n..."  OR  JSON array
 * We handle both.
 */
export function parseIndividualFiles(exportDir, lastSyncAt = null) {
  const cutoff = lastSyncAt ? new Date(lastSyncAt) : new Date(0);

  const result = {
    exportDate: new Date().toISOString(),
    dailyHealth: {},
    sleepSessions: [],
    hrSamples: [],
    workouts: [],
  };

  const read = (filename) => {
    const p = path.join(exportDir, filename);
    if (!fs.existsSync(p)) return null;
    try { return fs.readFileSync(p, 'utf-8').trim(); } catch { return null; }
  };

  // ── Steps ──────────────────────────────────────────────────────────────────
  const stepsRaw = read('steps.json');
  if (stepsRaw) {
    const samples = parseShortcutsSamples(stepsRaw);
    for (const s of samples) {
      if (!s.date || new Date(s.date) < cutoff) continue;
      _ensureDay(result.dailyHealth, s.date);
      result.dailyHealth[s.date].steps = s.value;
    }
  }

  // ── Resting Heart Rate ─────────────────────────────────────────────────────
  const rhrRaw = read('rhr.json');
  if (rhrRaw) {
    const samples = parseShortcutsSamples(rhrRaw);
    for (const s of samples) {
      if (!s.date || new Date(s.date) < cutoff) continue;
      _ensureDay(result.dailyHealth, s.date);
      result.dailyHealth[s.date].resting_hr = s.value;
    }
  }

  // ── HRV ───────────────────────────────────────────────────────────────────
  const hrvRaw = read('hrv.json');
  if (hrvRaw) {
    const samples = parseShortcutsSamples(hrvRaw);
    for (const s of samples) {
      if (!s.date || new Date(s.date) < cutoff) continue;
      _ensureDay(result.dailyHealth, s.date);
      result.dailyHealth[s.date].hrv_ms = s.value;
    }
  }

  // ── SpO2 ──────────────────────────────────────────────────────────────────
  const spo2Raw = read('spo2.json');
  if (spo2Raw) {
    const samples = parseShortcutsSamples(spo2Raw);
    const byDay = {};
    for (const s of samples) {
      if (new Date(s.date) < cutoff) continue;
      if (!byDay[s.date]) byDay[s.date] = [];
      // Shortcuts may output as 0.972 (fraction) or 97.2 (percent)
      const pct = s.value <= 1 ? s.value * 100 : s.value;
      byDay[s.date].push(pct);
    }
    for (const [date, vals] of Object.entries(byDay)) {
      _ensureDay(result.dailyHealth, date);
      result.dailyHealth[date].spo2_avg = +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
      result.dailyHealth[date].spo2_min = +Math.min(...vals).toFixed(1);
    }
  }

  // ── Calories ──────────────────────────────────────────────────────────────
  const calsRaw = read('calories.json');
  if (calsRaw) {
    const samples = parseShortcutsSamples(calsRaw);
    const byDay = {};
    for (const s of samples) {
      if (new Date(s.date) < cutoff) continue;
      if (!byDay[s.date]) byDay[s.date] = 0;
      byDay[s.date] += s.value;
    }
    for (const [date, total] of Object.entries(byDay)) {
      _ensureDay(result.dailyHealth, date);
      result.dailyHealth[date].active_cals = +total.toFixed(1);
    }
  }

  // ── Heart Rate samples ─────────────────────────────────────────────────────
  const hrRaw = read('hr.json');
  if (hrRaw) {
    const samples = parseShortcutsSamples(hrRaw, true); // include timestamp
    for (const s of samples) {
      if (new Date(s.timestamp || s.date) < cutoff) continue;
      result.hrSamples.push({
        recorded_at: s.timestamp || s.date + 'T12:00:00Z',
        value: s.value,
        context: s.value > 100 ? 'workout' : 'normal',
      });
      _ensureDay(result.dailyHealth, s.date);
      if (!result.dailyHealth[s.date]._hr) result.dailyHealth[s.date]._hr = [];
      result.dailyHealth[s.date]._hr.push(s.value);
    }
    for (const [, day] of Object.entries(result.dailyHealth)) {
      if (day._hr?.length) {
        day.avg_hr = +(day._hr.reduce((a, b) => a + b, 0) / day._hr.length).toFixed(1);
        day.min_hr = Math.min(...day._hr);
        day.max_hr = Math.max(...day._hr);
        delete day._hr;
      }
    }
  }

  // ── Sleep ─────────────────────────────────────────────────────────────────
  const sleepRaw = read('sleep.json');
  if (sleepRaw) {
    const sessions = parseShortcutsSleep(sleepRaw, cutoff);
    result.sleepSessions.push(...sessions);
    for (const s of sessions) {
      _ensureDay(result.dailyHealth, s.date);
      result.dailyHealth[s.date].recovery_score = s.quality_score;
    }
  }

  // ── Workouts ──────────────────────────────────────────────────────────────
  const woRaw = read('workouts.json');
  if (woRaw) {
    const wos = parseShortcutsWorkouts(woRaw, cutoff);
    result.workouts.push(...wos);
  }

  return result;
}

// ── Shortcuts sample parser ───────────────────────────────────────────────────

/**
 * Parse Shortcuts health sample output.
 * Shortcuts can output in multiple formats depending on iOS version:
 *
 * Format A (text list):
 *   "8,432 steps\n7,842 steps\n..."
 *
 * Format B (JSON array from newer iOS):
 *   [{"value":8432,"startDate":"2026-06-13 00:00:00 +0700","endDate":"...","unit":"count"}]
 *
 * Format C (single value per line with date):
 *   "Jun 13, 2026: 8,432\nJun 12, 2026: 7,842\n..."
 */
function parseShortcutsSamples(raw, includeTimestamp = false) {
  const results = [];

  // Try JSON array first (Format B — most reliable)
  if (raw.trim().startsWith('[') || raw.trim().startsWith('{')) {
    try {
      let arr = JSON.parse(raw);
      if (!Array.isArray(arr)) arr = [arr];

      for (const item of arr) {
        // Shortcuts JSON format variations
        const value = item.value ?? item.Value ?? item.quantity ?? parseFloat(item.toString());
        const dateStr = item.startDate ?? item.StartDate ?? item.date ?? item.Date ?? item.timestamp;
        if (value == null || !dateStr) continue;

        const date = normalizeDate(dateStr);
        if (!date) continue;

        const entry = { date, value: parseFloat(value) };
        if (includeTimestamp) entry.timestamp = normalizeDateISO(dateStr);
        results.push(entry);
      }
      return results;
    } catch { /* fall through to text parsing */ }
  }

  // Text format parsing (Format A/C)
  const lines = raw.split('\n').filter(l => l.trim());
  for (const line of lines) {
    const entry = parseTextSampleLine(line, includeTimestamp);
    if (entry) results.push(entry);
  }

  return results;
}

function parseTextSampleLine(line, includeTimestamp = false) {
  // Remove commas from numbers: "8,432" → "8432"
  const cleaned = line.replace(/(\d),(\d)/g, '$1$2');

  // Pattern: "Jun 13, 2026 at 7:00 AM: 8432 steps"
  // Pattern: "8432 steps on Jun 13, 2026"
  // Pattern: "8432 count (Jun 13, 2026)"
  // Pattern: "8432" (just a number — use today's date)
  // Pattern: "Jun 13, 2026: 8432"

  const datePatterns = [
    /(\w{3}\s+\d{1,2},\s+\d{4})\s+at\s+([\d:]+\s*[AP]M)/i,
    /(\w{3}\s+\d{1,2},\s+\d{4})/i,
    /(\d{4}-\d{2}-\d{2})/,
    /(\d{1,2}\/\d{1,2}\/\d{4})/,
  ];

  const numMatch = cleaned.match(/[\d.]+/);
  if (!numMatch) return null;
  const value = parseFloat(numMatch[0]);
  if (isNaN(value)) return null;

  for (const pat of datePatterns) {
    const m = line.match(pat);
    if (m) {
      const date = normalizeDate(m[0]);
      if (date) {
        const entry = { date, value };
        if (includeTimestamp) {
          entry.timestamp = normalizeDateISO(m[1] + (m[2] ? ' ' + m[2] : ''));
        }
        return entry;
      }
    }
  }

  // No date found — use today
  const today = new Date().toISOString().split('T')[0];
  return { date: today, value };
}

// ── Sleep parser ──────────────────────────────────────────────────────────────

function parseShortcutsSleep(raw, cutoff) {
  const sessions = [];

  // Try JSON array
  if (raw.trim().startsWith('[') || raw.trim().startsWith('{')) {
    try {
      let arr = JSON.parse(raw);
      if (!Array.isArray(arr)) arr = [arr];

      // Group by night — Shortcuts exports individual sleep stage segments
      const byNight = {};
      for (const item of arr) {
        const startStr = item.startDate ?? item.StartDate ?? item.start ?? item.date;
        const endStr   = item.endDate   ?? item.EndDate   ?? item.end;
        const value    = item.value ?? item.Value ?? item.category ?? '';

        if (!startStr || !endStr) continue;
        const start = new Date(normalizeDateISO(startStr));
        const end   = new Date(normalizeDateISO(endStr));
        if (start < cutoff) continue;

        // Night = the morning date
        const nightDate = end.toISOString().split('T')[0];
        if (!byNight[nightDate]) {
          byNight[nightDate] = { bedtime: start, wake_time: end, total_mins: 0, deep_mins: 0, light_mins: 0, rem_mins: 0, awake_mins: 0 };
        }

        const mins = Math.round((end - start) / 60000);
        const n = byNight[nightDate];

        // Update bedtime/wake
        if (start < n.bedtime) n.bedtime = start;
        if (end > n.wake_time) n.wake_time = end;

        const v = String(value).toLowerCase();
        if (v.includes('deep') || v === '3') n.deep_mins += mins;
        else if (v.includes('rem') || v === '5') n.rem_mins += mins;
        else if (v.includes('awake') || v === '2') n.awake_mins += mins;
        else n.light_mins += mins; // inBed, asleep, core → light
        n.total_mins += mins;
      }

      for (const [date, n] of Object.entries(byNight)) {
        const quality = computeSleepQuality(n);
        sessions.push({
          date,
          source: 'apple-health',
          bedtime: n.bedtime.toISOString(),
          wake_time: n.wake_time.toISOString(),
          total_mins: n.total_mins,
          deep_mins: n.deep_mins,
          light_mins: n.light_mins,
          rem_mins: n.rem_mins,
          awake_mins: n.awake_mins,
          quality_score: quality,
        });
      }
      return sessions;
    } catch { /* fall through */ }
  }

  // Text format — simpler: one line per night "Jun 13, 2026: 7h 12m"
  const lines = raw.split('\n').filter(l => l.trim());
  for (const line of lines) {
    const dateMatch = line.match(/(\w{3}\s+\d{1,2},\s+\d{4})|(\d{4}-\d{2}-\d{2})/);
    const hourMatch = line.match(/(\d+)h\s*(\d*)m?/);
    if (!dateMatch || !hourMatch) continue;

    const date = normalizeDate(dateMatch[0]);
    if (!date || new Date(date) < cutoff) continue;

    const total_mins = parseInt(hourMatch[1]) * 60 + (parseInt(hourMatch[2]) || 0);
    const quality = computeSleepQuality({ total_mins, deep_mins: 0, rem_mins: 0, awake_mins: 0 });

    sessions.push({
      date, source: 'apple-health',
      bedtime: null, wake_time: null,
      total_mins, deep_mins: 0, light_mins: total_mins, rem_mins: 0, awake_mins: 0,
      quality_score: quality,
    });
  }

  return sessions;
}

// ── Workouts parser ───────────────────────────────────────────────────────────

function parseShortcutsWorkouts(raw, cutoff) {
  const workouts = [];

  if (raw.trim().startsWith('[') || raw.trim().startsWith('{')) {
    try {
      let arr = JSON.parse(raw);
      if (!Array.isArray(arr)) arr = [arr];

      for (const w of arr) {
        const startStr = w.startDate ?? w.StartDate ?? w.start;
        if (!startStr) continue;
        const start = new Date(normalizeDateISO(startStr));
        if (start < cutoff) continue;

        const endStr = w.endDate ?? w.EndDate ?? w.end;
        const end = endStr ? new Date(normalizeDateISO(endStr)) : null;
        const dur = end ? Math.round((end - start) / 60000) : (w.duration ?? 0);

        workouts.push({
          started_at: start.toISOString(),
          date: start.toISOString().split('T')[0],
          type: normalizeWorkoutType(String(w.workoutActivityType ?? w.type ?? w.Type ?? 'Other')),
          duration_mins: dur,
          distance_km: parseFloat(w.totalDistance ?? w.distance ?? 0) || 0,
          active_cals: parseFloat(w.totalEnergyBurned ?? w.calories ?? w.activeCalories ?? 0) || 0,
          avg_hr: w.averageHeartRate ?? null,
          max_hr: w.maximumHeartRate ?? null,
          elevation_m: w.totalFlightsClimbed ?? null,
        });
      }
      return workouts;
    } catch { /* fall through */ }
  }

  return workouts;
}

// ── Combined JSON export (legacy) ─────────────────────────────────────────────

export function parseJSONExport(filePath, lastSyncAt = null) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(raw);
  const cutoff = lastSyncAt ? new Date(lastSyncAt) : new Date(0);

  const result = { exportDate: data.exportDate, dailyHealth: {}, sleepSessions: [], hrSamples: [], workouts: [] };

  for (const s of (data.steps || [])) {
    if (new Date(s.date) < cutoff) continue;
    _ensureDay(result.dailyHealth, s.date);
    result.dailyHealth[s.date].steps = s.value;
  }
  for (const r of (data.restingHeartRate || [])) {
    if (new Date(r.date) < cutoff) continue;
    _ensureDay(result.dailyHealth, r.date);
    result.dailyHealth[r.date].resting_hr = r.value;
  }
  for (const r of (data.hrv || [])) {
    if (new Date(r.date) < cutoff) continue;
    _ensureDay(result.dailyHealth, r.date);
    result.dailyHealth[r.date].hrv_ms = r.value;
  }
  for (const c of (data.calories || [])) {
    if (new Date(c.date) < cutoff) continue;
    _ensureDay(result.dailyHealth, c.date);
    result.dailyHealth[c.date].active_cals = c.activeCals;
    result.dailyHealth[c.date].total_cals  = c.totalCals;
  }
  const spo2ByDay = {};
  for (const s of (data.spo2 || [])) {
    const ts = new Date(s.timestamp);
    if (ts < cutoff) continue;
    const date = ts.toISOString().split('T')[0];
    if (!spo2ByDay[date]) spo2ByDay[date] = [];
    spo2ByDay[date].push(s.value);
  }
  for (const [date, vals] of Object.entries(spo2ByDay)) {
    _ensureDay(result.dailyHealth, date);
    result.dailyHealth[date].spo2_avg = +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
    result.dailyHealth[date].spo2_min = +Math.min(...vals).toFixed(1);
  }
  for (const hr of (data.heartRate || [])) {
    const ts = new Date(hr.timestamp);
    if (ts < cutoff) continue;
    result.hrSamples.push({ recorded_at: hr.timestamp, value: hr.value, context: hr.context || 'normal' });
    const date = ts.toISOString().split('T')[0];
    _ensureDay(result.dailyHealth, date);
    if (!result.dailyHealth[date]._hr) result.dailyHealth[date]._hr = [];
    result.dailyHealth[date]._hr.push(hr.value);
  }
  for (const [, day] of Object.entries(result.dailyHealth)) {
    if (day._hr?.length) {
      day.avg_hr = +(day._hr.reduce((a, b) => a + b, 0) / day._hr.length).toFixed(1);
      day.min_hr = Math.min(...day._hr);
      day.max_hr = Math.max(...day._hr);
      delete day._hr;
    }
  }
  for (const s of (data.sleep || [])) {
    if (new Date(s.date) < cutoff) continue;
    result.sleepSessions.push({ date: s.date, source: 'apple-health', bedtime: s.bedtime, wake_time: s.wakeTime, total_mins: s.totalMins, deep_mins: s.deepMins||0, light_mins: s.lightMins||0, rem_mins: s.remMins||0, awake_mins: s.awakeMins||0, quality_score: computeSleepQuality(s) });
    _ensureDay(result.dailyHealth, s.date);
    result.dailyHealth[s.date].recovery_score = computeSleepQuality(s);
  }
  for (const w of (data.workouts || [])) {
    const ts = new Date(w.startedAt);
    if (ts < cutoff) continue;
    result.workouts.push({ started_at: w.startedAt, date: ts.toISOString().split('T')[0], type: w.type||'Other', duration_mins: w.durationMins||0, distance_km: w.distanceKm||0, active_cals: w.activeCals||0, avg_hr: w.avgHR||null, max_hr: w.maxHR||null, elevation_m: w.elevationM||null });
  }
  return result;
}

// ── XML export parser ─────────────────────────────────────────────────────────

export async function parseXMLExport(filePath, lastSyncAt = null) {
  const cutoff = lastSyncAt ? new Date(lastSyncAt) : new Date(0);
  const result = { dailyHealth: {}, sleepSessions: [], hrSamples: [], workouts: [] };

  const rl = createInterface({ input: fs.createReadStream(filePath, { encoding: 'utf-8' }), crlfDelay: Infinity });

  const typeMap = {
    'HKQuantityTypeIdentifierStepCount': 'steps',
    'HKQuantityTypeIdentifierRestingHeartRate': 'resting_hr',
    'HKQuantityTypeIdentifierHeartRateVariabilitySDNN': 'hrv_ms',
    'HKQuantityTypeIdentifierOxygenSaturation': 'spo2',
    'HKQuantityTypeIdentifierActiveEnergyBurned': 'active_cals',
    'HKQuantityTypeIdentifierHeartRate': 'heart_rate',
    'HKCategoryTypeIdentifierSleepAnalysis': 'sleep',
  };

  for await (const line of rl) {
    const t = line.trim();
    if (t.startsWith('<Record ')) {
      const type = extractAttr(t, 'type');
      const startDate = extractAttr(t, 'startDate');
      const value = parseFloat(extractAttr(t, 'value') || '0');
      if (!startDate || new Date(startDate) < cutoff) continue;
      const date = startDate.split(' ')[0];
      const field = typeMap[type];
      if (!field) continue;
      _ensureDay(result.dailyHealth, date);
      const day = result.dailyHealth[date];
      if (field === 'steps') day.steps = (day.steps||0) + value;
      else if (field === 'resting_hr') day.resting_hr = value;
      else if (field === 'hrv_ms') day.hrv_ms = value;
      else if (field === 'active_cals') day.active_cals = (day.active_cals||0) + value;
      else if (field === 'spo2') { if (!day._spo2) day._spo2=[]; day._spo2.push(value*100); }
      else if (field === 'heart_rate') { result.hrSamples.push({recorded_at:startDate,value,context:'normal'}); if(!day._hr)day._hr=[]; day._hr.push(value); }
    }
  }
  for (const [,day] of Object.entries(result.dailyHealth)) {
    if (day._hr?.length) { day.avg_hr=+(day._hr.reduce((a,b)=>a+b,0)/day._hr.length).toFixed(1); day.min_hr=Math.min(...day._hr); day.max_hr=Math.max(...day._hr); delete day._hr; }
    if (day._spo2?.length) { day.spo2_avg=+(day._spo2.reduce((a,b)=>a+b,0)/day._spo2.length).toFixed(1); day.spo2_min=+Math.min(...day._spo2).toFixed(1); delete day._spo2; }
  }
  return result;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _ensureDay(map, date) { if (!map[date]) map[date] = { date }; }

function extractAttr(str, attr) {
  const m = str.match(new RegExp(`${attr}="([^"]*)"`, 'i'));
  return m ? m[1] : null;
}

function normalizeDate(str) {
  if (!str) return null;
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  try {
    const d = new Date(str);
    if (!isNaN(d)) return d.toISOString().split('T')[0];
  } catch {}
  // "Jun 13, 2026" format
  try {
    const d = new Date(str.replace(/(\w{3})\s+(\d+),\s+(\d{4})/, '$1 $2 $3'));
    if (!isNaN(d)) return d.toISOString().split('T')[0];
  } catch {}
  return null;
}

function normalizeDateISO(str) {
  if (!str) return new Date().toISOString();
  // Shortcuts format: "2026-06-13 07:30:00 +0700"
  try { return new Date(str.replace(' ', 'T')).toISOString(); } catch {}
  try { return new Date(str).toISOString(); } catch {}
  return new Date().toISOString();
}

function normalizeWorkoutType(raw) {
  if (/run/i.test(raw)) return 'Running';
  if (/walk/i.test(raw)) return 'Walking';
  if (/cycl|bike/i.test(raw)) return 'Cycling';
  if (/swim/i.test(raw)) return 'Swimming';
  if (/strength|function/i.test(raw)) return 'Strength';
  if (/hiit|interval|high.?intensity/i.test(raw)) return 'HIIT';
  if (/yoga/i.test(raw)) return 'Yoga';
  return 'Other';
}

export function computeSleepQuality(s) {
  if (!s.total_mins && !s.totalMins) return 0;
  const total = s.total_mins ?? s.totalMins;
  const deep  = s.deep_mins  ?? s.deepMins  ?? 0;
  const rem   = s.rem_mins   ?? s.remMins   ?? 0;
  const awake = s.awake_mins ?? s.awakeMins ?? 0;

  let score = 0;
  score += Math.min(40, (total / 450) * 40);
  if (total) score += Math.min(25, (deep / total / 0.20) * 25);
  if (total) score += Math.min(20, (rem  / total / 0.22) * 20);
  score += Math.max(0, 15 - ((awake / Math.max(total, 1)) * 100));
  return Math.round(Math.min(100, score));
}
