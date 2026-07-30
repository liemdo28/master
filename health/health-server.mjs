/**
 * health-server.mjs — Local HTTP server for iOS Shortcuts health data ingestion
 * Listens on port 4010, accepts POST from iPhone Shortcut over local WiFi.
 *
 * Usage: node health-server.mjs
 */

import http from 'http';
import { upsertDailyHealth, upsertSleepSession, bulkInsertHRSamples, upsertWorkout, setSyncState } from './HealthDatabase.mjs';
import { saveToVisibilityCache } from './HealthKnowledgeBuilder.mjs';

const PORT = 4010;
const TOKEN = 'mi-health-2026'; // simple auth token

const server = http.createServer(async (req, res) => {
  // CORS for Shortcuts
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  // Health check
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, message: 'Mi Health Server running', time: new Date().toISOString() }));
    return;
  }

  // Auth check
  const auth = req.headers['authorization'] || req.headers['x-token'] || '';
  if (!auth.includes(TOKEN)) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'Unauthorized' }));
    return;
  }

  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const url = req.url;
        let result = {};

        if (url === '/health/steps') {
          result = ingestSteps(data);
        } else if (url === '/health/rhr') {
          result = ingestRHR(data);
        } else if (url === '/health/hr') {
          result = ingestHR(data);
        } else if (url === '/health/hrv') {
          result = ingestHRV(data);
        } else if (url === '/health/spo2') {
          result = ingestSpO2(data);
        } else if (url === '/health/sleep') {
          result = ingestSleep(data);
        } else if (url === '/health/calories') {
          result = ingestCalories(data);
        } else if (url === '/health/workouts') {
          result = ingestWorkouts(data);
        } else if (url === '/health/sync-complete') {
          setSyncState('last_sync', new Date().toISOString());
          saveToVisibilityCache();
          result = { synced: true, time: new Date().toISOString() };
          console.log('✅ Full sync complete — knowledge cache updated');
        } else {
          res.writeHead(404); res.end(JSON.stringify({ error: 'Unknown endpoint' })); return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, ...result }));
        console.log(`📥 ${url} — ${JSON.stringify(result)}`);
      } catch (e) {
        console.error('Parse error:', e.message, 'Body:', body.slice(0, 200));
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }

  res.writeHead(404); res.end();
});

// ── Ingest handlers ───────────────────────────────────────────────────────────

function ingestSteps(data) {
  // data: { date: "YYYY-MM-DD", value: 8432 }
  // or array: [{ date, value }, ...]
  const items = Array.isArray(data) ? data : [data];
  let count = 0;
  for (const item of items) {
    const date = normalizeDate(item.date || item.startDate || item.Date);
    const value = parseInt(item.value || item.Value || item.quantity || 0);
    if (!date || !value) continue;
    upsertDailyHealth({ date, steps: value });
    count++;
  }
  return { metric: 'steps', count };
}

function ingestRHR(data) {
  const items = Array.isArray(data) ? data : [data];
  let count = 0;
  for (const item of items) {
    const date = normalizeDate(item.date || item.startDate || item.Date);
    const value = parseFloat(item.value || item.Value || 0);
    if (!date || !value) continue;
    upsertDailyHealth({ date, resting_hr: value });
    count++;
  }
  return { metric: 'rhr', count };
}

function ingestHR(data) {
  const items = Array.isArray(data) ? data : [data];
  const samples = [];
  const byDay = {};
  for (const item of items) {
    const ts = item.startDate || item.timestamp || item.date;
    const value = parseFloat(item.value || item.Value || 0);
    if (!ts || !value) continue;
    const isoTs = normalizeDateISO(ts);
    const date = isoTs.split('T')[0];
    samples.push({ recorded_at: isoTs, value, context: value > 100 ? 'workout' : 'normal' });
    if (!byDay[date]) byDay[date] = [];
    byDay[date].push(value);
  }
  if (samples.length) bulkInsertHRSamples(samples);
  for (const [date, vals] of Object.entries(byDay)) {
    upsertDailyHealth({
      date,
      avg_hr: +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1),
      min_hr: Math.min(...vals),
      max_hr: Math.max(...vals),
    });
  }
  return { metric: 'hr', count: samples.length };
}

function ingestHRV(data) {
  const items = Array.isArray(data) ? data : [data];
  let count = 0;
  for (const item of items) {
    const date = normalizeDate(item.date || item.startDate || item.Date);
    const value = parseFloat(item.value || item.Value || 0);
    if (!date || !value) continue;
    upsertDailyHealth({ date, hrv_ms: value });
    count++;
  }
  return { metric: 'hrv', count };
}

function ingestSpO2(data) {
  const items = Array.isArray(data) ? data : [data];
  const byDay = {};
  for (const item of items) {
    const date = normalizeDate(item.date || item.startDate || item.Date);
    let value = parseFloat(item.value || item.Value || 0);
    if (!date || !value) continue;
    if (value <= 1) value *= 100; // fraction → percent
    if (!byDay[date]) byDay[date] = [];
    byDay[date].push(value);
  }
  for (const [date, vals] of Object.entries(byDay)) {
    upsertDailyHealth({
      date,
      spo2_avg: +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1),
      spo2_min: +Math.min(...vals).toFixed(1),
    });
  }
  return { metric: 'spo2', count: Object.keys(byDay).length };
}

function ingestSleep(data) {
  const items = Array.isArray(data) ? data : [data];
  // Group sleep segments by night
  const byNight = {};
  for (const item of items) {
    const startStr = item.startDate || item.start || item.date;
    const endStr   = item.endDate   || item.end;
    const value    = String(item.value || item.Value || item.category || '');
    if (!startStr) continue;

    const start = new Date(normalizeDateISO(startStr));
    const end   = endStr ? new Date(normalizeDateISO(endStr)) : new Date(start.getTime() + 60000 * (item.durationMins || 60));
    const night = end.toISOString().split('T')[0];

    if (!byNight[night]) byNight[night] = { bedtime: start, wake: end, total: 0, deep: 0, light: 0, rem: 0, awake: 0 };
    const n = byNight[night];
    const mins = Math.round((end - start) / 60000);
    if (start < n.bedtime) n.bedtime = start;
    if (end > n.wake) n.wake = end;

    const v = value.toLowerCase();
    if (v.includes('deep') || v === '3') n.deep += mins;
    else if (v.includes('rem') || v === '5') n.rem += mins;
    else if (v.includes('awake') || v === '2') n.awake += mins;
    else n.light += mins;
    n.total += mins;
  }

  let count = 0;
  for (const [date, n] of Object.entries(byNight)) {
    const quality = computeQuality(n.total, n.deep, n.rem, n.awake);
    upsertSleepSession({
      date, source: 'apple-health',
      bedtime: n.bedtime.toISOString(),
      wake_time: n.wake.toISOString(),
      total_mins: n.total, deep_mins: n.deep,
      light_mins: n.light, rem_mins: n.rem,
      awake_mins: n.awake, quality_score: quality,
    });
    upsertDailyHealth({ date, recovery_score: quality });
    count++;
  }
  return { metric: 'sleep', count };
}

function ingestCalories(data) {
  const items = Array.isArray(data) ? data : [data];
  const byDay = {};
  for (const item of items) {
    const date = normalizeDate(item.date || item.startDate || item.Date);
    const value = parseFloat(item.value || item.Value || 0);
    if (!date || !value) continue;
    if (!byDay[date]) byDay[date] = 0;
    byDay[date] += value;
  }
  for (const [date, total] of Object.entries(byDay)) {
    upsertDailyHealth({ date, active_cals: +total.toFixed(1) });
  }
  return { metric: 'calories', count: Object.keys(byDay).length };
}

function ingestWorkouts(data) {
  const items = Array.isArray(data) ? data : [data];
  let count = 0;
  for (const w of items) {
    const startStr = w.startDate || w.start || w.date;
    if (!startStr) continue;
    const start = new Date(normalizeDateISO(startStr));
    const endStr = w.endDate || w.end;
    const end = endStr ? new Date(normalizeDateISO(endStr)) : null;
    const dur = end ? Math.round((end - start) / 60000) : (w.durationMins || w.duration || 0);

    upsertWorkout({
      started_at: start.toISOString(),
      date: start.toISOString().split('T')[0],
      type: normalizeType(String(w.workoutActivityType || w.type || 'Other')),
      duration_mins: dur,
      distance_km: parseFloat(w.totalDistance || w.distance || 0) || 0,
      active_cals: parseFloat(w.totalEnergyBurned || w.calories || 0) || 0,
      avg_hr: w.averageHeartRate || null,
      max_hr: w.maximumHeartRate || null,
      elevation_m: null,
    });
    count++;
  }
  return { metric: 'workouts', count };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeDate(s) {
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  try { return new Date(s).toISOString().split('T')[0]; } catch { return null; }
}

function normalizeDateISO(s) {
  if (!s) return new Date().toISOString();
  try { return new Date(s.replace(' ', 'T')).toISOString(); } catch { return new Date().toISOString(); }
}

function normalizeType(raw) {
  if (/run/i.test(raw)) return 'Running';
  if (/walk/i.test(raw)) return 'Walking';
  if (/cycl/i.test(raw)) return 'Cycling';
  if (/swim/i.test(raw)) return 'Swimming';
  if (/strength|functional/i.test(raw)) return 'Strength';
  if (/hiit|interval/i.test(raw)) return 'HIIT';
  if (/yoga/i.test(raw)) return 'Yoga';
  return 'Other';
}

function computeQuality(total, deep, rem, awake) {
  if (!total) return 0;
  let s = Math.min(40, (total / 450) * 40);
  s += Math.min(25, (deep / total / 0.20) * 25);
  s += Math.min(20, (rem  / total / 0.22) * 20);
  s += Math.max(0, 15 - ((awake / total) * 100));
  return Math.round(Math.min(100, s));
}

// ── Start ─────────────────────────────────────────────────────────────────────

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🏥 Mi Health Server running on port ${PORT}`);
  console.log(`   Local:   http://localhost:${PORT}/health`);
  console.log(`   iPhone:  http://192.168.0.57:${PORT}/health`);
  console.log(`   Token:   ${TOKEN}\n`);
});
