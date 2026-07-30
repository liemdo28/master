/**
 * Apple Health / Huawei Health XML → JSON Parser — Phase 23
 * Converts exported health data into Mi's standard format.
 *
 * Apple Health export: Health app → Profile → Export All Health Data
 *   Produces export.zip → unzip → export.xml (~hundreds of MB)
 *
 * Huawei Health export: Health app → Me → Settings → Export Health Data
 *   Produces JSON files directly under health-data/
 *
 * Output to: .local-agent-global/health-export/
 *   sleep.json  — [{ date, hours, quality, source }]
 *   hrv.json    — [{ date, ms, source }]
 *   steps.json  — [{ date, count, source }]
 *
 * Usage (CLI):
 *   node dist/health-intelligence/apple-health-parser.js --input export.xml
 *   node dist/health-intelligence/apple-health-parser.js --huawei /path/to/health-data/
 */

import fs from 'fs';
import path from 'path';

const GLOBAL_DIR  = process.env.MI_CORE_ROOT
  ? path.join(process.env.MI_CORE_ROOT, '.local-agent-global')
  : 'E:/Project/Master/mi-core/.local-agent-global';
const EXPORT_DIR  = path.join(GLOBAL_DIR, 'health-export');

// ── Types ──────────────────────────────────────────────────────────────────

export interface SleepRecord  { date: string; hours: number; quality?: 'deep'|'light'|'rem'|'awake'; source: string; }
export interface HRVRecord    { date: string; ms: number; source: string; }
export interface StepsRecord  { date: string; count: number; source: string; }

export interface ParseResult {
  sleep:  SleepRecord[];
  hrv:    HRVRecord[];
  steps:  StepsRecord[];
  source: 'apple_health' | 'huawei_health' | 'manual';
  parsed_at: string;
  record_counts: { sleep: number; hrv: number; steps: number };
}

// ── Apple Health XML parser ────────────────────────────────────────────────

export function parseAppleHealthXML(xmlPath: string): ParseResult {
  if (!fs.existsSync(xmlPath)) throw new Error(`File not found: ${xmlPath}`);

  const xml   = fs.readFileSync(xmlPath, 'utf8');
  const sleep:  SleepRecord[]  = [];
  const hrv:    HRVRecord[]    = [];
  const steps:  StepsRecord[]  = [];

  // ── Sleep (HKCategoryTypeIdentifierSleepAnalysis) ─────────────────────────
  const sleepByDate = new Map<string, number>();
  const sleepRegex = /type="HKCategoryTypeIdentifierSleepAnalysis"[^>]*startDate="([^"]+)"[^>]*endDate="([^"]+)"[^>]*value="([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = sleepRegex.exec(xml)) !== null) {
    const [, start, end, value] = m;
    // Only count AsleepUnspecified / AsleepCore / AsleepDeep / AsleepREM
    if (value === 'HKCategoryValueSleepAnalysisInBed') continue;
    const date = start.slice(0, 10);
    const durationH = (new Date(end).getTime() - new Date(start).getTime()) / 3_600_000;
    sleepByDate.set(date, (sleepByDate.get(date) || 0) + durationH);
  }
  for (const [date, hours] of sleepByDate) {
    sleep.push({ date, hours: Math.round(hours * 10) / 10, source: 'apple_health' });
  }

  // ── HRV (HKQuantityTypeIdentifierHeartRateVariabilitySDNN) ───────────────
  const hrvRegex = /type="HKQuantityTypeIdentifierHeartRateVariabilitySDNN"[^>]*startDate="([^"]+)"[^>]*value="([^"]+)"/g;
  while ((m = hrvRegex.exec(xml)) !== null) {
    const [, start, value] = m;
    const ms = parseFloat(value) * 1000; // Apple stores in seconds
    if (ms > 0) hrv.push({ date: start.slice(0, 10), ms: Math.round(ms), source: 'apple_health' });
  }

  // ── Steps (HKQuantityTypeIdentifierStepCount) ─────────────────────────────
  const stepsByDate = new Map<string, number>();
  const stepsRegex = /type="HKQuantityTypeIdentifierStepCount"[^>]*startDate="([^"]+)"[^>]*value="([^"]+)"/g;
  while ((m = stepsRegex.exec(xml)) !== null) {
    const [, start, value] = m;
    const date  = start.slice(0, 10);
    const count = parseInt(value);
    if (count > 0) stepsByDate.set(date, (stepsByDate.get(date) || 0) + count);
  }
  for (const [date, count] of stepsByDate) {
    steps.push({ date, count, source: 'apple_health' });
  }

  // Sort all by date desc
  const byDateDesc = (a: {date:string}, b: {date:string}) => b.date.localeCompare(a.date);
  sleep.sort(byDateDesc); hrv.sort(byDateDesc); steps.sort(byDateDesc);

  return { sleep, hrv, steps, source: 'apple_health', parsed_at: new Date().toISOString(), record_counts: { sleep: sleep.length, hrv: hrv.length, steps: steps.length } };
}

// ── Huawei Health JSON parser ─────────────────────────────────────────────

export function parseHuaweiHealthDir(dirPath: string): ParseResult {
  if (!fs.existsSync(dirPath)) throw new Error(`Directory not found: ${dirPath}`);

  const sleep:  SleepRecord[]  = [];
  const hrv:    HRVRecord[]    = [];
  const steps:  StepsRecord[]  = [];

  const files = fs.readdirSync(dirPath);

  for (const file of files) {
    const filePath = path.join(dirPath, file);
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      // Huawei sleep: sleep_stage_data or SleepRecord
      if (file.toLowerCase().includes('sleep')) {
        const records: any[] = Array.isArray(data) ? data : (data.data || data.records || []);
        for (const r of records) {
          const date   = (r.date || r.startTime || r.start_time || '').slice(0, 10);
          const hours  = r.durationMinutes ? r.durationMinutes / 60 : (r.duration ? r.duration / 3600 : 0);
          if (date && hours > 0) sleep.push({ date, hours: Math.round(hours * 10) / 10, source: 'huawei_health' });
        }
      }

      // Huawei HRV: heart_rate_variability or HrvRecord
      if (file.toLowerCase().includes('hrv') || file.toLowerCase().includes('heart_rate_var')) {
        const records: any[] = Array.isArray(data) ? data : (data.data || data.records || []);
        for (const r of records) {
          const date = (r.date || r.time || '').slice(0, 10);
          const ms   = r.hrvSdnn || r.sdnn || r.value || 0;
          if (date && ms > 0) hrv.push({ date, ms: Math.round(ms), source: 'huawei_health' });
        }
      }

      // Huawei steps: step_daily_summary or StepRecord
      if (file.toLowerCase().includes('step')) {
        const records: any[] = Array.isArray(data) ? data : (data.data || data.records || []);
        for (const r of records) {
          const date  = (r.date || r.time || '').slice(0, 10);
          const count = r.count || r.steps || r.stepCount || 0;
          if (date && count > 0) steps.push({ date, count, source: 'huawei_health' });
        }
      }
    } catch { /* skip unreadable files */ }
  }

  const byDateDesc = (a: {date:string}, b: {date:string}) => b.date.localeCompare(a.date);
  sleep.sort(byDateDesc); hrv.sort(byDateDesc); steps.sort(byDateDesc);

  return { sleep, hrv, steps, source: 'huawei_health', parsed_at: new Date().toISOString(), record_counts: { sleep: sleep.length, hrv: hrv.length, steps: steps.length } };
}

// ── Save to health-export dir ─────────────────────────────────────────────

export function saveHealthExport(result: ParseResult): void {
  if (!fs.existsSync(EXPORT_DIR)) fs.mkdirSync(EXPORT_DIR, { recursive: true });
  fs.writeFileSync(path.join(EXPORT_DIR, 'sleep.json'),  JSON.stringify(result.sleep,  null, 2));
  fs.writeFileSync(path.join(EXPORT_DIR, 'hrv.json'),    JSON.stringify(result.hrv,    null, 2));
  fs.writeFileSync(path.join(EXPORT_DIR, 'steps.json'),  JSON.stringify(result.steps,  null, 2));
  fs.writeFileSync(path.join(EXPORT_DIR, 'meta.json'),   JSON.stringify({ source: result.source, parsed_at: result.parsed_at, record_counts: result.record_counts }, null, 2));
  console.log(`[HealthParser] Saved: ${result.record_counts.sleep} sleep, ${result.record_counts.hrv} HRV, ${result.record_counts.steps} steps records → ${EXPORT_DIR}`);
}

// ── CLI entrypoint ─────────────────────────────────────────────────────────

if (require.main === module) {
  const args = process.argv.slice(2);
  const inputIdx = args.indexOf('--input');
  const huaweiIdx = args.indexOf('--huawei');

  if (inputIdx !== -1 && args[inputIdx + 1]) {
    const xmlPath = args[inputIdx + 1];
    console.log(`[HealthParser] Parsing Apple Health XML: ${xmlPath}`);
    const result = parseAppleHealthXML(xmlPath);
    saveHealthExport(result);
    console.log(`[HealthParser] Done. ${JSON.stringify(result.record_counts)}`);
  } else if (huaweiIdx !== -1 && args[huaweiIdx + 1]) {
    const dir = args[huaweiIdx + 1];
    console.log(`[HealthParser] Parsing Huawei Health dir: ${dir}`);
    const result = parseHuaweiHealthDir(dir);
    saveHealthExport(result);
    console.log(`[HealthParser] Done. ${JSON.stringify(result.record_counts)}`);
  } else {
    console.log([
      'Usage:',
      '  node apple-health-parser.js --input /path/to/export.xml',
      '  node apple-health-parser.js --huawei /path/to/huawei-health-data/',
      '',
      'Output: .local-agent-global/health-export/{sleep,hrv,steps}.json',
    ].join('\n'));
  }
}
