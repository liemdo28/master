/**
 * OpenHuman Intelligence — OSS Wave A adapter.
 *
 * Normalizes OpenHuman-style exports into the existing Health Intelligence
 * cache and Enterprise Brain Graph. It does not replace the current health
 * engine or create a second health database.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { upsertEdge, upsertEntity } from '../graph/graph-db';

const MI_CORE_ROOT = process.env.MI_CORE_ROOT || 'D:/Project/Master/mi-core';
const GLOBAL_DIR = process.env.GLOBAL_DIR || 'D:/Project/Master/.local-agent-global';
const CACHE_DIR = path.join(GLOBAL_DIR, 'visibility', 'health');
const OPENHUMAN_CACHE = path.join(CACHE_DIR, 'openhuman-normalized.json');
const HEALTH_CACHE = path.join(CACHE_DIR, 'data.json');

export interface OpenHumanSummary {
  status: 'OPENHUMAN_READY' | 'OPENHUMAN_DATA_PENDING';
  generated_at: string;
  source: string;
  records: number;
  sleep_avg_hours?: number;
  avg_hrv?: number;
  avg_steps?: number;
  workouts?: number;
  recovery_signal: 'LOW' | 'MODERATE' | 'HIGH' | 'UNKNOWN';
  graph_engine: 'enterprise-brain-graph';
  health_engine: 'health-intelligence';
}

type AnyRecord = Record<string, any>;

function hash(input: string): string {
  return crypto.createHash('sha1').update(input).digest('hex').slice(0, 16);
}

function candidateFiles(): string[] {
  const configured = [
    process.env.OPENHUMAN_EXPORT_PATH,
    process.env.HEALTH_EXPORT_PATH,
    path.join(CACHE_DIR, 'openhuman.json'),
    path.join(MI_CORE_ROOT, '.local-agent-global', 'health-export', 'openhuman.json'),
  ].filter(Boolean) as string[];
  return configured.filter(p => fs.existsSync(p) && fs.statSync(p).isFile());
}

function readJson(file: string): any | null {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function readExistingHealthCache(): { data: any | null; source_path: string | null } {
  const data = fs.existsSync(HEALTH_CACHE) ? readJson(HEALTH_CACHE) : null;
  return { data, source_path: data ? HEALTH_CACHE : null };
}

function asArray(data: any, key: string): AnyRecord[] {
  if (Array.isArray(data?.[key])) return data[key];
  if (Array.isArray(data?.data?.[key])) return data.data[key];
  return [];
}

function num(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function avg(values: Array<number | undefined>): number | undefined {
  const clean = values.filter((v): v is number => Number.isFinite(v));
  return clean.length ? Math.round((clean.reduce((s, v) => s + v, 0) / clean.length) * 10) / 10 : undefined;
}

function normalizeFromOpenHuman(file: string): OpenHumanSummary | null {
  const data = readJson(file);
  if (!data) return null;
  const sleep = asArray(data, 'sleep');
  const hrv = asArray(data, 'hrv');
  const activity = asArray(data, 'activity').concat(asArray(data, 'steps'));
  const workouts = asArray(data, 'workouts').concat(asArray(data, 'exercise'));

  const sleepAvgHours = avg(sleep.map(r => num(r.hours ?? r.sleep_hours ?? (num(r.total_mins) ? Number(r.total_mins) / 60 : undefined))));
  const avgHrv = avg(hrv.map(r => num(r.value ?? r.hrv_ms ?? r.sdnn)));
  const avgSteps = avg(activity.map(r => num(r.steps ?? r.value)));
  const recoverySignal: OpenHumanSummary['recovery_signal'] =
    !avgHrv && !sleepAvgHours ? 'UNKNOWN'
      : (avgHrv || 0) < 30 || (sleepAvgHours || 0) < 6 ? 'HIGH'
        : (avgHrv || 0) < 40 || (sleepAvgHours || 0) < 7 ? 'MODERATE'
          : 'LOW';

  return {
    status: 'OPENHUMAN_READY',
    generated_at: new Date().toISOString(),
    source: file,
    records: sleep.length + hrv.length + activity.length + workouts.length,
    sleep_avg_hours: sleepAvgHours,
    avg_hrv: avgHrv,
    avg_steps: avgSteps,
    workouts: workouts.length,
    recovery_signal: recoverySignal,
    graph_engine: 'enterprise-brain-graph',
    health_engine: 'health-intelligence',
  };
}

function normalizeFromExistingHealth(): OpenHumanSummary | null {
  const { data, source_path } = readExistingHealthCache();
  if (!data) return null;
  const weekly = data.weekly || {};
  const sleepMins = num(weekly.avg_sleep_mins);
  return {
    status: 'OPENHUMAN_READY',
    generated_at: new Date().toISOString(),
    source: source_path || path.join(CACHE_DIR, 'data.json'),
    records: Number(weekly.days_with_data || 0) + Number(weekly.workouts || 0) + Number((data.trends || []).length),
    sleep_avg_hours: sleepMins ? Math.round((sleepMins / 60) * 10) / 10 : undefined,
    avg_hrv: num(weekly.avg_hrv ?? data.today?.hrv_ms),
    avg_steps: num(weekly.avg_steps ?? data.today?.steps),
    workouts: num(weekly.workouts),
    recovery_signal: (data.health_score?.components?.recovery?.score || 0) < 65 ? 'HIGH' : 'LOW',
    graph_engine: 'enterprise-brain-graph',
    health_engine: 'health-intelligence',
  };
}

function writeGraph(summary: OpenHumanSummary) {
  const sourceId = `health_source:${hash(summary.source)}`;
  upsertEntity({
    id: sourceId,
    name: 'OpenHuman Health Source',
    type: 'health_source',
    description: 'OpenHuman-compatible source normalized into Health Intelligence',
    metadata: { source_path: summary.source, source: 'openhuman', records: summary.records },
  });

  const metrics = [
    ['sleep', summary.sleep_avg_hours, 'hours'],
    ['hrv', summary.avg_hrv, 'ms'],
    ['activity', summary.avg_steps, 'steps'],
    ['recovery', summary.recovery_signal, 'signal'],
  ] as const;

  for (const [name, value, unit] of metrics) {
    const metricId = `health_metric:${name}`;
    upsertEntity({
      id: metricId,
      name,
      type: 'health_metric',
      description: `Health metric normalized from OpenHuman source: ${name}`,
      metadata: { value, unit, source: 'openhuman' },
    });
    upsertEdge({ from_id: sourceId, to_id: metricId, relationship: 'provides', weight: 7, metadata: { source: 'openhuman' } });
  }

  upsertEntity({
    id: 'health_trend:weekly_recovery',
    name: 'Weekly Recovery Trend',
    type: 'health_trend',
    description: 'Weekly recovery trend used by Health Intelligence workload guidance',
    metadata: { recovery_signal: summary.recovery_signal, source: 'openhuman' },
  });
  upsertEdge({ from_id: 'health_metric:sleep', to_id: 'health_trend:weekly_recovery', relationship: 'influences', weight: 8, metadata: { source: 'openhuman' } });
  upsertEdge({ from_id: 'health_metric:hrv', to_id: 'health_trend:weekly_recovery', relationship: 'influences', weight: 8, metadata: { source: 'openhuman' } });
}

export function syncOpenHuman(): OpenHumanSummary {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const direct = candidateFiles().map(normalizeFromOpenHuman).find(Boolean) || null;
  const summary = direct || normalizeFromExistingHealth() || {
    status: 'OPENHUMAN_DATA_PENDING' as const,
    generated_at: new Date().toISOString(),
    source: 'none',
    records: 0,
    recovery_signal: 'UNKNOWN' as const,
    graph_engine: 'enterprise-brain-graph' as const,
    health_engine: 'health-intelligence' as const,
  };
  if (summary.status === 'OPENHUMAN_READY') writeGraph(summary);
  fs.writeFileSync(OPENHUMAN_CACHE, JSON.stringify(summary, null, 2));
  return summary;
}

export function answerOpenHumanQuestion(question: string) {
  const summary = syncOpenHuman();
  if (summary.status !== 'OPENHUMAN_READY') {
    return {
      answer: 'Chưa có dữ liệu OpenHuman/health export thật để trả lời workload recovery.',
      evidence: [summary],
      gaps: ['Missing OpenHuman export or existing verified health cache'],
    };
  }
  const overloaded = summary.recovery_signal === 'HIGH';
  const reduce = overloaded || (summary.sleep_avg_hours || 0) < 6.5 || (summary.avg_hrv || 0) < 35;
  return {
    answer: reduce
      ? `Tuần này có dấu hiệu quá tải. Sleep TB ${summary.sleep_avg_hours || 'unknown'}h, HRV ${summary.avg_hrv || 'unknown'}ms, recovery ${summary.recovery_signal}. Nên giảm workload hoặc giữ việc P0/P1.`
      : `Chưa thấy quá tải rõ. Sleep TB ${summary.sleep_avg_hours || 'unknown'}h, HRV ${summary.avg_hrv || 'unknown'}ms, activity ${summary.avg_steps || 'unknown'} steps, recovery ${summary.recovery_signal}.`,
    evidence: [summary],
    gaps: [],
  };
}
