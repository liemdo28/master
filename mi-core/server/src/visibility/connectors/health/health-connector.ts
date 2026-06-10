/**
 * Huawei Health Connector — parses exported JSON/XML from Huawei Health app.
 * Export location: .local-agent-global/visibility/health/export/
 * CONSENT REQUIRED to read health data.
 * Mi does NOT diagnose — only summarizes, reminds, suggests general wellness.
 */

import fs from 'fs';
import path from 'path';

const GLOBAL_DIR = process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global';
const EXPORT_DIR = path.join(GLOBAL_DIR, 'visibility', 'health', 'export');
const CACHE_DIR = path.join(GLOBAL_DIR, 'visibility', 'health');

export interface HealthSummary {
  date: string;
  steps?: number;
  steps_goal?: number;
  distance_km?: number;
  calories?: number;
  sleep_hours?: number;
  sleep_quality?: string;
  heart_rate_avg?: number;
  heart_rate_max?: number;
  active_minutes?: number;
  stress_level?: string;
  source_file: string;
  parsed_at: string;
  disclaimer: string;
}

const DISCLAIMER = 'Mi chỉ tóm tắt dữ liệu sức khỏe. Không phải tư vấn y tế. Anh nên tham khảo bác sĩ cho mọi vấn đề sức khỏe.';

function findLatestExport(): string | null {
  if (!fs.existsSync(EXPORT_DIR)) return null;
  const files = fs.readdirSync(EXPORT_DIR)
    .filter(f => /\.(json|xml|csv)$/i.test(f))
    .map(f => ({ name: f, mtime: fs.statSync(path.join(EXPORT_DIR, f)).mtime }))
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
  return files.length > 0 ? path.join(EXPORT_DIR, files[0].name) : null;
}

function parseHuaweiJson(data: Record<string, unknown>): Partial<HealthSummary> {
  // Huawei Health JSON export format (approximated — varies by app version)
  const today = new Date().toISOString().split('T')[0];

  // Try common Huawei export structures
  const motion = data['motionRecord'] as Record<string, unknown> | undefined;
  const sleep = data['sleepRecord'] as Record<string, unknown> | undefined;
  const heart = data['heartRateRecord'] as Array<Record<string, unknown>> | undefined;

  return {
    date: (data['date'] as string) || today,
    steps: (motion?.['step'] as number) || (data['steps'] as number),
    distance_km: (motion?.['distance'] as number) ? Number(((motion?.['distance'] as number) / 1000).toFixed(2)) : undefined,
    calories: (motion?.['calories'] as number) || (data['calories'] as number),
    sleep_hours: sleep ? Number(((sleep['duration'] as number || 0) / 60).toFixed(1)) : undefined,
    heart_rate_avg: heart ? Math.round(heart.reduce((s, h) => s + (h['heartRate'] as number || 0), 0) / heart.length) : undefined,
  };
}

function parseCsvExport(content: string): Partial<HealthSummary> {
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const lastRow = lines[lines.length - 1].split(',');
  const row: Record<string, string> = {};
  headers.forEach((h, i) => { row[h] = (lastRow[i] || '').trim(); });

  return {
    date: row['date'] || row['day'] || new Date().toISOString().split('T')[0],
    steps: row['steps'] ? parseInt(row['steps']) : undefined,
    sleep_hours: row['sleep'] || row['sleep_hours'] ? parseFloat(row['sleep'] || row['sleep_hours']) : undefined,
    heart_rate_avg: row['heart_rate'] || row['avg_hr'] ? parseInt(row['heart_rate'] || row['avg_hr']) : undefined,
    calories: row['calories'] ? parseInt(row['calories']) : undefined,
  };
}

export function parseHealthExport(): HealthSummary | null {
  const exportFile = findLatestExport();
  if (!exportFile) return null;

  const content = fs.readFileSync(exportFile, 'utf-8');
  const ext = path.extname(exportFile).toLowerCase();
  let parsed: Partial<HealthSummary> = {};

  try {
    if (ext === '.json') {
      const data = JSON.parse(content);
      // Handle array of days
      const record = Array.isArray(data) ? data[data.length - 1] : data;
      parsed = parseHuaweiJson(record as Record<string, unknown>);
    } else if (ext === '.csv') {
      parsed = parseCsvExport(content);
    } else if (ext === '.xml') {
      // Basic XML parsing for Huawei format
      const steps = content.match(/<step[s]?>(\d+)<\/step[s]?>/i);
      const sleep = content.match(/<sleep[^>]*duration="(\d+)"/i);
      parsed = {
        steps: steps ? parseInt(steps[1]) : undefined,
        sleep_hours: sleep ? Number((parseInt(sleep[1]) / 60).toFixed(1)) : undefined,
      };
    }
  } catch (e) {
    console.error('[Health Connector] parse error:', e);
    return null;
  }

  const summary: HealthSummary = {
    date: parsed.date || new Date().toISOString().split('T')[0],
    steps: parsed.steps,
    steps_goal: 10000,
    distance_km: parsed.distance_km,
    calories: parsed.calories,
    sleep_hours: parsed.sleep_hours,
    sleep_quality: parsed.sleep_hours
      ? parsed.sleep_hours >= 7 ? 'good' : parsed.sleep_hours >= 5 ? 'fair' : 'poor'
      : undefined,
    heart_rate_avg: parsed.heart_rate_avg,
    heart_rate_max: parsed.heart_rate_max,
    active_minutes: parsed.active_minutes,
    source_file: path.basename(exportFile),
    parsed_at: new Date().toISOString(),
    disclaimer: DISCLAIMER,
  };

  // Cache (without raw sensitive data)
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(path.join(CACHE_DIR, 'summary.json'), JSON.stringify({
    date: summary.date, steps: summary.steps, sleep_hours: summary.sleep_hours,
    heart_rate_avg: summary.heart_rate_avg, disclaimer: DISCLAIMER,
  }, null, 2));
  fs.writeFileSync(path.join(CACHE_DIR, 'last_sync.json'), JSON.stringify({ synced_at: new Date().toISOString() }));

  return summary;
}

export function getHealthSummaryText(): string {
  const data = parseHealthExport();
  if (!data) return 'Chưa có dữ liệu sức khỏe. Anh export từ Huawei Health app và đặt file vào .local-agent-global/visibility/health/export/';

  const lines: string[] = [`📊 Sức khỏe ${data.date}:`];
  if (data.steps) lines.push(`👟 Bước chân: ${data.steps.toLocaleString()}/${(data.steps_goal || 10000).toLocaleString()}`);
  if (data.sleep_hours) lines.push(`😴 Giấc ngủ: ${data.sleep_hours}h (${data.sleep_quality || '—'})`);
  if (data.heart_rate_avg) lines.push(`❤️ Nhịp tim TB: ${data.heart_rate_avg} bpm`);
  if (data.calories) lines.push(`🔥 Calories: ${data.calories}`);
  if (data.distance_km) lines.push(`📍 Quãng đường: ${data.distance_km} km`);
  lines.push(`\n⚠️ ${data.disclaimer}`);
  return lines.join('\n');
}

export function hasHealthExport(): boolean {
  return !!findLatestExport();
}
