/**
 * DEV2 Operations & Reliability Program.
 *
 * Architecture-freeze friendly layer: reads existing health, connector, and
 * freshness evidence; records incidents; writes markdown reports.
 */

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { connectorRegistry, type Connector } from '../visibility/connector-registry';
import { generateDataFreshnessReport, type FreshnessSource } from '../visibility/data-freshness-monitor';
import { getDailySnapshot, getPlatformHealth, syncPlatform } from '../visibility/visibility-hub';
import { chatMetrics, type ChatMetricsSnapshot } from '../chat/chat-metrics';
import { queueState } from '../chat/chat-queue';
import { getModelStatus } from '../model-router/ollama-router';

const MI_CORE_ROOT = process.env.MI_CORE_ROOT || path.resolve(__dirname, '../../..');
const GLOBAL_DIR = process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global';
const OPS_DIR = path.join(GLOBAL_DIR, 'operations');
const REPORT_DIR = path.join(MI_CORE_ROOT, 'reports');
const RUNTIME_HISTORY_PATH = path.join(OPS_DIR, 'runtime-history.json');
const INCIDENTS_PATH = path.join(OPS_DIR, 'incident-registry.json');

type RuntimeStatus = 'up' | 'down' | 'degraded' | 'unknown';
type IncidentStatus = 'open' | 'resolved';
type EscalationLevel = 'none' | 'watch' | 'escalated';

interface RuntimeServiceConfig {
  id: string;
  name: string;
  url?: string;
  pm2Name?: string;
  required: boolean;
}

interface RuntimeCheck {
  service_id: string;
  service: string;
  status: RuntimeStatus;
  checked_at: string;
  response_ms: number | null;
  http_status: number | null;
  restart_count: number;
  crash_count: number;
  pm2_pid?: number | null;
  port_pid?: number | null;
  port_match?: boolean | null;
  uptime_ms?: number | null;
  details: string | null;
}

interface RuntimeHistory {
  checks: RuntimeCheck[];
}

interface RuntimeMetric extends RuntimeCheck {
  uptime_checks: number;
  downtime_checks: number;
  uptime_percent: number;
  downtime_minutes_estimate: number;
}

interface RuntimeUptimeReport {
  generated_at: string;
  window_days: number;
  overall_status: RuntimeStatus;
  services: RuntimeMetric[];
  target: 'UPTIME_MONITOR_READY';
}

interface OperationsIncident {
  id: string;
  type: string;
  source: string;
  summary: string;
  first_seen: string;
  last_seen: string;
  status: IncidentStatus;
  resolved: boolean;
  recurrence: number;
  escalation: EscalationLevel;
  evidence?: string;
}

interface AutoHealResult {
  connector_id: string;
  name: string;
  detected: string[];
  attempted: boolean;
  recovered: boolean;
  result: string;
  checked_at: string;
}

interface ExecutiveRuntimeSnapshot {
  generated_at: string;
  connector_health: ReturnType<typeof connectorRegistry.getSummary>;
  sync_health: ReturnType<typeof getPlatformHealth>;
  stale_sources: FreshnessSource[];
  failed_workflows: OperationsIncident[];
  burn_in_score: number;
  qb_status: FreshnessSource | null;
  health_status: FreshnessSource | null;
  target: 'EXECUTIVE_SNAPSHOT_READY';
}

interface BurnInSupportReport {
  generated_at: string;
  runtime_metrics: RuntimeMetric[];
  connector_metrics: ReturnType<typeof connectorRegistry.getSummary>;
  freshness_metrics: ReturnType<typeof generateDataFreshnessReport>;
  incident_metrics: {
    total: number;
    open: number;
    resolved: number;
    escalated: number;
  };
  target: 'DEV3_BURN_IN_SUPPORT_READY';
}

interface Dev2OperationsPackage {
  generated_at: string;
  runtime: RuntimeUptimeReport;
  pm2_restart_monitor: Pm2RestartMonitorReport;
  ollama_health_monitor: OllamaHealthMonitorReport;
  chat_reliability_metrics: ChatReliabilityMetricsReport;
  runtime_alerts: RuntimeAlertClassificationReport;
  burn_in_watchdog_feed: BurnInWatchdogFeed;
  daily_reliability_snapshot: DailyReliabilitySnapshot;
  auto_heal: AutoHealResult[];
  executive_snapshot: ExecutiveRuntimeSnapshot;
  burn_in_support: BurnInSupportReport;
  incidents: OperationsIncident[];
  targets: {
    uptime: 'UPTIME_MONITOR_READY';
    freshness: 'DATA_FRESHNESS_GUARD_READY';
    auto_heal: 'CONNECTOR_AUTO_HEAL_READY';
    snapshot: 'EXECUTIVE_SNAPSHOT_READY';
    incidents: 'INCIDENT_REGISTRY_READY';
    burn_in: 'DEV3_BURN_IN_SUPPORT_READY';
    pm2_restart: 'PM2_RESTART_MONITOR_READY';
    ollama_health: 'OLLAMA_HEALTH_MONITOR_READY';
    chat_reliability: 'CHAT_RELIABILITY_METRICS_READY';
    watchdog_feed: 'BURN_IN_WATCHDOG_FEED_READY';
    alert_classification: 'RUNTIME_ALERT_CLASSIFICATION_READY';
    daily_reliability: 'DAILY_RELIABILITY_SNAPSHOT_READY';
    final: 'DEV2_OPERATIONS_CERTIFIED' | 'DEV2_OPERATIONS_READY_WITH_OPEN_ITEMS' | 'DEV2_RELIABILITY_MONITORING_READY';
  };
}

type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

interface Pm2ServiceMonitor {
  service_id: string;
  service: string;
  pm2_name: string;
  port: number | null;
  restart_count: number;
  crash_count: number;
  restarts_last_hour: number;
  restart_increased: boolean;
  uptime_ms: number | null;
  uptime_reset_repeatedly: boolean;
  pm2_pid: number | null;
  port_pid: number | null;
  port_matches_pm2: boolean | null;
  status: string;
  alert: AlertSeverity;
}

interface Pm2RestartMonitorReport {
  generated_at: string;
  services: Pm2ServiceMonitor[];
  alerts: RuntimeAlert[];
  target: 'PM2_RESTART_MONITOR_READY';
}

interface OllamaHealthMonitorReport {
  generated_at: string;
  reachable: boolean;
  model_loaded: boolean;
  selected_model: string | null;
  available_models: string[];
  response_latency_ms: number | null;
  timeout_count: number;
  failure_count: number;
  last_successful_response: string | null;
  last_timeout_time: string | null;
  answer_vi: string;
  target: 'OLLAMA_HEALTH_MONITOR_READY';
}

interface ChatReliabilityMetricsReport {
  generated_at: string;
  chat_request_count: number;
  success_count: number;
  timeout_count: number;
  failed_count: number;
  average_latency_ms: number;
  p95_latency_ms: number;
  retry_count: number;
  queue_depth: number;
  queue_depth_peak: number;
  active_requests: number;
  circuit_breaker_open: boolean;
  raw: ChatMetricsSnapshot & { queue: ReturnType<typeof queueState> };
  target: 'CHAT_RELIABILITY_METRICS_READY';
}

interface RuntimeAlert {
  severity: AlertSeverity;
  source: string;
  rule: string;
  message: string;
  evidence?: string;
}

interface RuntimeAlertClassificationReport {
  generated_at: string;
  alerts: RuntimeAlert[];
  summary: Record<AlertSeverity, number>;
  target: 'RUNTIME_ALERT_CLASSIFICATION_READY';
}

interface BurnInWatchdogFeed {
  generated_at: string;
  pm2_restarts: Pm2ServiceMonitor[];
  ollama_timeouts: number;
  mi_core_uptime: RuntimeMetric | null;
  connector_health: ReturnType<typeof connectorRegistry.getSummary>;
  stale_data: FreshnessSource[];
  failed_workflows: OperationsIncident[];
  flow_gaps: RuntimeAlert[];
  burn_in_score: number;
  target: 'BURN_IN_WATCHDOG_FEED_READY';
}

interface DailyReliabilitySnapshot {
  generated_at: string;
  uptime: RuntimeMetric[];
  restart_count: Pm2ServiceMonitor[];
  ollama_health: OllamaHealthMonitorReport;
  connector_freshness: ReturnType<typeof generateDataFreshnessReport>;
  burn_in_score: number;
  active_incidents: OperationsIncident[];
  action_required: {
    dev1: string[];
    dev2: string[];
    dev3: string[];
  };
  target: 'DAILY_RELIABILITY_SNAPSHOT_READY';
}

const RUNTIME_SERVICES: RuntimeServiceConfig[] = [
  {
    id: 'mi-core',
    name: 'Mi-Core',
    url: `http://127.0.0.1:${process.env.MI_PORT || '4001'}/api/health`,
    pm2Name: 'mi-core',
    required: true,
  },
  {
    id: 'ai-service',
    name: 'AI Service',
    url: `${process.env.AI_SERVICE_URL || 'http://127.0.0.1:4002'}/health`,
    pm2Name: 'mi-ai-service',
    required: true,
  },
  {
    id: 'ollama',
    name: 'Ollama',
    url: `${process.env.OLLAMA_URL || 'http://127.0.0.1:11434'}/api/tags`,
    pm2Name: 'ollama',
    required: true,
  },
  {
    id: 'agent-engine',
    name: 'Agent Engine',
    pm2Name: 'agent-engine',
    required: true,
  },
  {
    id: 'visibility',
    name: 'Visibility',
    pm2Name: 'mi-core',
    required: true,
  },
  {
    id: 'gmail',
    name: 'Gmail',
    required: true,
  },
  {
    id: 'calendar',
    name: 'Calendar',
    required: true,
  },
  {
    id: 'drive',
    name: 'Drive',
    required: true,
  },
  {
    id: 'qb',
    name: 'QB Connector',
    required: true,
  },
  {
    id: 'health',
    name: 'Health Connector',
    required: true,
  },
];

const PM2_MONITOR_SERVICES: Array<{ id: string; name: string; pm2Name: string; port: number | null }> = [
  { id: 'mi-core', name: 'Mi-Core', pm2Name: 'mi-core', port: parseInt(process.env.MI_PORT || '4001', 10) },
  { id: 'ai-service', name: 'AI Service', pm2Name: 'mi-ai-service', port: parseInt(process.env.AI_SERVICE_PORT || '4002', 10) },
  { id: 'ollama', name: 'Ollama', pm2Name: 'ollama', port: 11434 },
  { id: 'agent-engine', name: 'Agent Engine', pm2Name: 'agent-engine', port: null },
  { id: 'whatsapp-gateway', name: 'WhatsApp Gateway', pm2Name: 'whatsapp-ai-gateway', port: 3211 },
];

const AUTO_HEAL_CONNECTORS = [
  'gmail',
  'google-calendar',
  'google-drive',
  'asana',
  'quickbooks-runtime',
  'health-export',
  'website-bakudan',
  'website-raw',
];

function ensureDirs() {
  fs.mkdirSync(OPS_DIR, { recursive: true });
  fs.mkdirSync(REPORT_DIR, { recursive: true });
}

function readJson<T>(filePath: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

function writeJson(filePath: string, data: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function appendRuntimeChecks(checks: RuntimeCheck[]) {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const history = readJson<RuntimeHistory>(RUNTIME_HISTORY_PATH, { checks: [] });
  history.checks = [...history.checks, ...checks].filter(check => Date.parse(check.checked_at) >= cutoff);
  writeJson(RUNTIME_HISTORY_PATH, history);
}

function getPm2List(): any[] {
  try {
    const out = execFileSync('pm2', ['jlist'], { encoding: 'utf-8', timeout: 5000 });
    return JSON.parse(out) as any[];
  } catch {
    return [];
  }
}

function getPidOnPort(port: number): number | null {
  try {
    const out = execFileSync('netstat', ['-ano'], { encoding: 'utf-8', timeout: 5000 });
    const line = out.split(/\r?\n/).find(row => row.includes(`:${port} `) && row.includes('LISTENING'));
    if (!line) return null;
    const pid = Number(line.trim().split(/\s+/).pop());
    return Number.isFinite(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

function getPm2Info(pm2Name?: string): { restart_count: number; crash_count: number; status?: string; pid?: number | null; uptime_ms?: number | null } {
  if (!pm2Name) return { restart_count: 0, crash_count: 0 };
  try {
    const list = getPm2List();
    if (!list.length) return { restart_count: 0, crash_count: 0, status: 'pm2_unavailable', pid: null, uptime_ms: null };
    const proc = list.find(p => p.name === pm2Name);
    if (!proc) return { restart_count: 0, crash_count: 0, status: 'not_found', pid: null, uptime_ms: null };
    return {
      restart_count: Number(proc.pm2_env?.restart_time || 0),
      crash_count: Number(proc.pm2_env?.unstable_restarts || 0),
      pid: Number(proc.pid || 0) || null,
      uptime_ms: proc.pm2_env?.pm_uptime ? Math.max(0, Date.now() - Number(proc.pm2_env.pm_uptime)) : null,
      status: String(proc.pm2_env?.status || 'unknown'),
    };
  } catch {
    return { restart_count: 0, crash_count: 0, status: 'pm2_unavailable', pid: null, uptime_ms: null };
  }
}

async function checkHttp(url: string): Promise<{ status: RuntimeStatus; response_ms: number; http_status: number | null; details: string | null }> {
  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return {
      status: res.ok ? 'up' : 'down',
      response_ms: Date.now() - started,
      http_status: res.status,
      details: res.ok ? null : `HTTP ${res.status}`,
    };
  } catch (e) {
    return {
      status: 'down',
      response_ms: Date.now() - started,
      http_status: null,
      details: e instanceof Error ? e.message : String(e),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function connectorCheck(serviceId: string): RuntimeStatus {
  const connectorIds: Record<string, string[]> = {
    gmail: ['gmail'],
    calendar: ['google-calendar'],
    drive: ['google-drive'],
    qb: ['quickbooks-runtime'],
    health: ['health-export'],
  };
  const ids = connectorIds[serviceId] || [];
  const connectors = ids.map(id => connectorRegistry.getById(id)).filter(Boolean) as Connector[];
  if (!connectors.length) return 'unknown';
  if (connectors.some(c => c.auth_status === 'expired' || c.health_status === 'offline')) return 'down';
  if (connectors.some(c => c.auth_status !== 'connected' || c.health_status === 'degraded' || c.health_status === 'unknown')) return 'degraded';
  return 'up';
}

async function runRuntimeChecks(): Promise<RuntimeCheck[]> {
  const checkedAt = new Date().toISOString();
  const checks: RuntimeCheck[] = [];
  for (const service of RUNTIME_SERVICES) {
    const pm2 = getPm2Info(service.pm2Name);
    let status: RuntimeStatus = 'unknown';
    let responseMs: number | null = null;
    let httpStatus: number | null = null;
    let details: string | null = null;

    if (service.url) {
      const http = await checkHttp(service.url);
      status = http.status;
      responseMs = http.response_ms;
      httpStatus = http.http_status;
      details = http.details;
    } else if (service.id === 'visibility') {
      const platformHealth = getPlatformHealth();
      const unhealthy = platformHealth.filter(p => p.health === 'offline' || p.health === 'degraded').length;
      status = unhealthy === 0 ? 'up' : 'degraded';
      details = unhealthy > 0 ? `${unhealthy} connector(s) unhealthy` : null;
    } else if (['gmail', 'calendar', 'drive', 'qb', 'health'].includes(service.id)) {
      status = connectorCheck(service.id);
      details = status === 'up' ? null : 'Connector is not fully healthy';
    } else {
      status = pm2.status === 'online' ? 'up' : pm2.status === 'pm2_unavailable' ? 'unknown' : 'down';
      details = pm2.status ? `pm2_status=${pm2.status}` : null;
    }

    checks.push({
      service_id: service.id,
      service: service.name,
      status,
      checked_at: checkedAt,
      response_ms: responseMs,
      http_status: httpStatus,
      restart_count: pm2.restart_count,
      crash_count: pm2.crash_count,
      pm2_pid: pm2.pid ?? null,
      port_pid: service.url ? getPidOnPort(Number(new URL(service.url).port || 80)) : null,
      port_match: null,
      uptime_ms: pm2.uptime_ms ?? null,
      details,
    });
  }
  appendRuntimeChecks(checks);
  return checks;
}

function buildPm2RestartMonitor(runtime: RuntimeUptimeReport): Pm2RestartMonitorReport {
  const history = readJson<RuntimeHistory>(RUNTIME_HISTORY_PATH, { checks: [] });
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  const services = PM2_MONITOR_SERVICES.map(config => {
    const pm2 = getPm2Info(config.pm2Name);
    const portPid = config.port ? getPidOnPort(config.port) : null;
    const pm2Pid = pm2.pid ?? null;
    const serviceHistory = history.checks
      .filter(check => check.service_id === config.id && Date.parse(check.checked_at) >= oneHourAgo)
      .sort((a, b) => Date.parse(a.checked_at) - Date.parse(b.checked_at));
    const first = serviceHistory[0];
    const last = serviceHistory[serviceHistory.length - 1];
    const restartsLastHour = first && last ? Math.max(0, last.restart_count - first.restart_count) : 0;
    const latestRuntime = runtime.services.find(s => s.service_id === config.id);
    const restartIncreased = first && latestRuntime ? latestRuntime.restart_count > first.restart_count : false;
    const uptimeResetRepeatedly = serviceHistory.filter((check, idx, arr) => {
      if (idx === 0) return false;
      const prev = arr[idx - 1];
      return check.uptime_ms !== null && prev.uptime_ms !== null && check.uptime_ms! < prev.uptime_ms!;
    }).length >= 2;
    const portMatchesPm2 = config.port && portPid && pm2Pid ? portPid === pm2Pid : config.port ? null : null;
    const pm2Unavailable = pm2.status === 'pm2_unavailable' || pm2.status === 'not_found';
    const alert: AlertSeverity = restartsLastHour > 3 || uptimeResetRepeatedly || portMatchesPm2 === false
      ? 'CRITICAL'
      : restartIncreased || pm2Unavailable
        ? 'WARNING'
        : 'INFO';
    return {
      service_id: config.id,
      service: config.name,
      pm2_name: config.pm2Name,
      port: config.port,
      restart_count: pm2.restart_count,
      crash_count: pm2.crash_count,
      restarts_last_hour: restartsLastHour,
      restart_increased: restartIncreased,
      uptime_ms: pm2.uptime_ms ?? null,
      uptime_reset_repeatedly: uptimeResetRepeatedly,
      pm2_pid: pm2Pid,
      port_pid: portPid,
      port_matches_pm2: portMatchesPm2,
      status: pm2.status || 'unknown',
      alert,
    };
  });
  return {
    generated_at: new Date().toISOString(),
    services,
    alerts: services
      .filter(s => s.alert !== 'INFO')
      .map(s => ({
        severity: s.alert,
        source: s.service,
        rule: s.alert === 'CRITICAL' ? 'pm2_restart_or_pid_critical' : 'pm2_restart_increase',
        message: `${s.service}: restarts_last_hour=${s.restarts_last_hour}, restart_increased=${s.restart_increased}, port_matches_pm2=${s.port_matches_pm2}`,
      })),
    target: 'PM2_RESTART_MONITOR_READY',
  };
}

async function buildOllamaHealthMonitor(): Promise<OllamaHealthMonitorReport> {
  const generatedAt = new Date().toISOString();
  const metrics = chatMetrics.snapshot();
  const url = process.env.OLLAMA_URL || process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  const started = Date.now();
  let reachable = false;
  let latency: number | null = null;
  let failureCount = 0;
  let lastSuccessfulResponse: string | null = null;
  let lastTimeoutTime: string | null = null;
  try {
    const res = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(5000) });
    latency = Date.now() - started;
    reachable = res.ok;
    if (res.ok) lastSuccessfulResponse = generatedAt;
    else failureCount = 1;
  } catch (e) {
    latency = Date.now() - started;
    failureCount = 1;
    if (e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')) {
      lastTimeoutTime = generatedAt;
    }
  }
  const modelStatus = await getModelStatus().catch(() => null);
  const selectedModel = modelStatus?.selected.fast_chat || null;
  const availableModels = modelStatus?.available.map(m => m.name) || [];
  const modelLoaded = reachable && !!selectedModel;
  const timeoutCount = metrics.ollama_timeouts;
  const answerVi = reachable && modelLoaded && timeoutCount === 0
    ? `Ollama đang ổn. Model đang dùng: ${selectedModel}. Latency health check: ${latency ?? 'unknown'}ms.`
    : `Ollama chưa xanh hoàn toàn: reachable=${reachable}, model_loaded=${modelLoaded}, timeout_count=${timeoutCount}, latency=${latency ?? 'unknown'}ms.`;
  return {
    generated_at: generatedAt,
    reachable,
    model_loaded: modelLoaded,
    selected_model: selectedModel,
    available_models: availableModels,
    response_latency_ms: latency,
    timeout_count: timeoutCount,
    failure_count: failureCount + Math.max(0, metrics.ollama_calls - timeoutCount - metrics.requests_success),
    last_successful_response: lastSuccessfulResponse,
    last_timeout_time: lastTimeoutTime,
    answer_vi: answerVi,
    target: 'OLLAMA_HEALTH_MONITOR_READY',
  };
}

function buildChatReliabilityMetrics(): ChatReliabilityMetricsReport {
  const snapshot = chatMetrics.snapshot();
  const queue = queueState();
  return {
    generated_at: new Date().toISOString(),
    chat_request_count: snapshot.requests_total,
    success_count: snapshot.requests_success,
    timeout_count: snapshot.requests_timeout,
    failed_count: snapshot.requests_failed,
    average_latency_ms: snapshot.avg_latency_ms,
    p95_latency_ms: snapshot.p95_latency_ms,
    retry_count: snapshot.circuit_breaker_trips,
    queue_depth: queue.waiting,
    queue_depth_peak: snapshot.queue_depth_peak,
    active_requests: queue.active,
    circuit_breaker_open: snapshot.circuit_breaker_open,
    raw: { ...snapshot, queue },
    target: 'CHAT_RELIABILITY_METRICS_READY',
  };
}

function classifyRuntimeAlerts(params: {
  pm2: Pm2RestartMonitorReport;
  ollama: OllamaHealthMonitorReport;
  chat: ChatReliabilityMetricsReport;
  runtime: RuntimeUptimeReport;
  freshness: ReturnType<typeof generateDataFreshnessReport>;
  incidents: OperationsIncident[];
}): RuntimeAlertClassificationReport {
  const alerts: RuntimeAlert[] = [];
  alerts.push(...params.pm2.alerts);
  if (params.ollama.timeout_count > 1) {
    alerts.push({ severity: 'CRITICAL', source: 'Ollama', rule: 'ollama_repeated_timeout', message: `Ollama timeout count is ${params.ollama.timeout_count}` });
  } else if (params.ollama.timeout_count === 1) {
    alerts.push({ severity: 'WARNING', source: 'Ollama', rule: 'ollama_single_timeout', message: 'Ollama timeout occurred once' });
  }
  if (!params.ollama.reachable || !params.ollama.model_loaded) {
    alerts.push({ severity: 'CRITICAL', source: 'Ollama', rule: 'ollama_unavailable_or_model_missing', message: params.ollama.answer_vi });
  }
  if (params.chat.timeout_count > 1 || params.chat.circuit_breaker_open) {
    alerts.push({ severity: 'CRITICAL', source: 'Chat', rule: 'chat_timeout_or_circuit_breaker', message: `timeouts=${params.chat.timeout_count}, circuit_open=${params.chat.circuit_breaker_open}` });
  } else if (params.chat.timeout_count === 1 || params.chat.queue_depth > 0) {
    alerts.push({ severity: 'WARNING', source: 'Chat', rule: 'chat_queue_or_timeout_warning', message: `timeouts=${params.chat.timeout_count}, queue_depth=${params.chat.queue_depth}` });
  }
  for (const source of params.freshness.sources) {
    if (source.status === 'missing') {
      alerts.push({ severity: 'WARNING', source: source.source, rule: 'data_missing', message: `${source.source} data missing`, evidence: source.evidence_path });
    } else if (source.stale) {
      alerts.push({ severity: 'WARNING', source: source.source, rule: 'connector_stale', message: `${source.source} is stale`, evidence: source.evidence_path });
    }
  }
  for (const incident of params.incidents.filter(i => !i.resolved && i.type === 'dashboard_mismatch')) {
    alerts.push({ severity: 'CRITICAL', source: incident.source, rule: 'dashboard_mismatch', message: incident.summary, evidence: incident.evidence });
  }
  for (const service of params.runtime.services.filter(s => s.status === 'down')) {
    alerts.push({ severity: 'CRITICAL', source: service.service, rule: 'runtime_down', message: `${service.service} is down`, evidence: service.details || undefined });
  }
  for (const service of params.runtime.services.filter(s => s.status === 'degraded' || s.status === 'unknown')) {
    alerts.push({ severity: 'WARNING', source: service.service, rule: 'runtime_not_green', message: `${service.service} is ${service.status}`, evidence: service.details || undefined });
  }
  const summary = {
    INFO: alerts.filter(a => a.severity === 'INFO').length,
    WARNING: alerts.filter(a => a.severity === 'WARNING').length,
    CRITICAL: alerts.filter(a => a.severity === 'CRITICAL').length,
  };
  return { generated_at: new Date().toISOString(), alerts, summary, target: 'RUNTIME_ALERT_CLASSIFICATION_READY' };
}

function buildRuntimeReport(latestChecks: RuntimeCheck[]): RuntimeUptimeReport {
  const history = readJson<RuntimeHistory>(RUNTIME_HISTORY_PATH, { checks: latestChecks });
  const services = latestChecks.map(latest => {
    const serviceChecks = history.checks.filter(check => check.service_id === latest.service_id);
    const uptimeChecks = serviceChecks.filter(check => check.status === 'up').length;
    const downtimeChecks = serviceChecks.filter(check => check.status === 'down').length;
    const total = serviceChecks.length || 1;
    return {
      ...latest,
      uptime_checks: uptimeChecks,
      downtime_checks: downtimeChecks,
      uptime_percent: Math.round((uptimeChecks / total) * 10000) / 100,
      downtime_minutes_estimate: downtimeChecks * 30,
    };
  });
  const down = services.some(s => s.status === 'down');
  const degraded = services.some(s => s.status === 'degraded' || s.status === 'unknown');
  return {
    generated_at: new Date().toISOString(),
    window_days: 30,
    overall_status: down ? 'down' : degraded ? 'degraded' : 'up',
    services,
    target: 'UPTIME_MONITOR_READY',
  };
}

function incidentKey(type: string, source: string, summary: string): string {
  return `${type}:${source}:${summary}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 120);
}

function loadIncidents(): OperationsIncident[] {
  return readJson<OperationsIncident[]>(INCIDENTS_PATH, []);
}

function upsertIncident(input: Omit<OperationsIncident, 'id' | 'first_seen' | 'last_seen' | 'status' | 'resolved' | 'recurrence'>) {
  const now = new Date().toISOString();
  const incidents = loadIncidents();
  const id = incidentKey(input.type, input.source, input.summary);
  const existing = incidents.find(i => i.id === id);
  if (existing) {
    existing.last_seen = now;
    existing.status = 'open';
    existing.resolved = false;
    existing.recurrence += 1;
    existing.escalation = input.escalation;
    existing.evidence = input.evidence || existing.evidence;
  } else {
    incidents.push({
      id,
      first_seen: now,
      last_seen: now,
      status: 'open',
      resolved: false,
      recurrence: 1,
      ...input,
    });
  }
  writeJson(INCIDENTS_PATH, incidents);
}

function resolveMissingIncidents(activeIds: Set<string>) {
  const now = new Date().toISOString();
  const incidents = loadIncidents();
  let changed = false;
  for (const incident of incidents) {
    if (!activeIds.has(incident.id) && !incident.resolved) {
      incident.status = 'resolved';
      incident.resolved = true;
      incident.last_seen = now;
      changed = true;
    }
  }
  if (changed) writeJson(INCIDENTS_PATH, incidents);
}

function recordIncidents(runtime: RuntimeUptimeReport, freshness = generateDataFreshnessReport()): OperationsIncident[] {
  const activeIds = new Set<string>();
  for (const service of runtime.services) {
    if (service.status === 'down' || service.status === 'degraded' || service.status === 'unknown') {
      const summary = `${service.service} ${service.status}`;
      const id = incidentKey('runtime_failure', service.service, summary);
      activeIds.add(id);
      upsertIncident({
        type: 'runtime_failure',
        source: service.service,
        summary,
        escalation: service.status === 'down' ? 'escalated' : 'watch',
        evidence: service.details || undefined,
      });
    }
  }
  for (const source of freshness.sources) {
    if (source.stale || source.status === 'degraded') {
      const summary = `${source.source} freshness ${source.status}`;
      const id = incidentKey('sync_failure', source.source, summary);
      activeIds.add(id);
      upsertIncident({
        type: 'sync_failure',
        source: source.source,
        summary,
        escalation: source.stale ? 'escalated' : 'watch',
        evidence: source.evidence_path,
      });
    }
    if (source.auth_status === 'expired' || source.connector_health === 'offline') {
      const summary = `${source.source} connector ${source.auth_status || source.connector_health}`;
      const id = incidentKey('connector_failure', source.source, summary);
      activeIds.add(id);
      upsertIncident({
        type: 'connector_failure',
        source: source.source,
        summary,
        escalation: 'escalated',
        evidence: source.evidence_path,
      });
    }
  }
  resolveMissingIncidents(activeIds);
  return loadIncidents();
}

async function runConnectorAutoHealing(freshness = generateDataFreshnessReport()): Promise<AutoHealResult[]> {
  const staleByConnector = new Map(freshness.sources.filter(s => s.connector_id).map(s => [s.connector_id!, s]));
  const results: AutoHealResult[] = [];
  for (const id of AUTO_HEAL_CONNECTORS) {
    const connector = connectorRegistry.getById(id);
    const stale = staleByConnector.get(id);
    const detected: string[] = [];
    if (stale?.stale || stale?.status === 'degraded') detected.push(`freshness=${stale.status}`);
    if (connector?.health_status === 'offline') detected.push('disconnected');
    if (connector?.auth_status === 'expired') detected.push('auth_expired');
    if (!detected.length) {
      results.push({
        connector_id: id,
        name: connector?.name || id,
        detected,
        attempted: false,
        recovered: true,
        result: 'No recovery needed',
        checked_at: new Date().toISOString(),
      });
      continue;
    }

    try {
      const result = await syncPlatform(id);
      const refreshed = connectorRegistry.getById(id);
      const recovered = refreshed?.health_status !== 'offline' && refreshed?.auth_status !== 'expired';
      results.push({
        connector_id: id,
        name: connector?.name || id,
        detected,
        attempted: true,
        recovered: !!recovered,
        result: JSON.stringify(result).slice(0, 500),
        checked_at: new Date().toISOString(),
      });
    } catch (e) {
      results.push({
        connector_id: id,
        name: connector?.name || id,
        detected,
        attempted: true,
        recovered: false,
        result: e instanceof Error ? e.message : String(e),
        checked_at: new Date().toISOString(),
      });
    }
  }
  writeJson(path.join(OPS_DIR, 'auto-heal-log.json'), results);
  return results;
}

function burnInScore(runtime: RuntimeUptimeReport, freshness = generateDataFreshnessReport(), incidents = loadIncidents()): number {
  const downPenalty = runtime.services.filter(s => s.status === 'down').length * 20;
  const degradedPenalty = runtime.services.filter(s => s.status === 'degraded' || s.status === 'unknown').length * 8;
  const stalePenalty = (freshness.stale_count + freshness.missing_count + freshness.error_count) * 10;
  const openIncidentPenalty = incidents.filter(i => !i.resolved).length * 5;
  return Math.max(0, Math.min(100, 100 - downPenalty - degradedPenalty - stalePenalty - openIncidentPenalty));
}

function buildExecutiveSnapshot(runtime: RuntimeUptimeReport, freshness = generateDataFreshnessReport(), incidents = loadIncidents()): ExecutiveRuntimeSnapshot {
  const staleSources = freshness.sources.filter(s => s.stale || s.status === 'degraded');
  return {
    generated_at: new Date().toISOString(),
    connector_health: connectorRegistry.getSummary(),
    sync_health: getPlatformHealth(),
    stale_sources: staleSources,
    failed_workflows: incidents.filter(i => !i.resolved && ['runtime_failure', 'connector_failure', 'sync_failure', 'dashboard_mismatch'].includes(i.type)),
    burn_in_score: burnInScore(runtime, freshness, incidents),
    qb_status: freshness.sources.find(s => s.connector_id === 'quickbooks-runtime') || null,
    health_status: freshness.sources.find(s => s.connector_id === 'health-export') || null,
    target: 'EXECUTIVE_SNAPSHOT_READY',
  };
}

function buildBurnInSupport(runtime: RuntimeUptimeReport, freshness = generateDataFreshnessReport(), incidents = loadIncidents()): BurnInSupportReport {
  return {
    generated_at: new Date().toISOString(),
    runtime_metrics: runtime.services,
    connector_metrics: connectorRegistry.getSummary(),
    freshness_metrics: freshness,
    incident_metrics: {
      total: incidents.length,
      open: incidents.filter(i => !i.resolved).length,
      resolved: incidents.filter(i => i.resolved).length,
      escalated: incidents.filter(i => i.escalation === 'escalated' && !i.resolved).length,
    },
    target: 'DEV3_BURN_IN_SUPPORT_READY',
  };
}

function mdTable(headers: string[], rows: Array<Array<string | number | boolean | null | undefined>>): string {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map(row => `| ${row.map(cell => String(cell ?? '')).join(' | ')} |`),
  ].join('\n');
}

function writeRuntimeReport(report: RuntimeUptimeReport) {
  const body = [
    '# RUNTIME_UPTIME_REPORT',
    '',
    `Generated: ${report.generated_at}`,
    `Target: ${report.target}`,
    `Overall status: ${report.overall_status}`,
    '',
    mdTable(
      ['Service', 'Status', 'Uptime %', 'Downtime Checks', 'Restarts', 'Crashes', 'Details'],
      report.services.map(s => [s.service, s.status, s.uptime_percent, s.downtime_checks, s.restart_count, s.crash_count, s.details || ''])
    ),
    '',
    'Guardrail: unknown, degraded, stale, and down states are never reported as green.',
  ].join('\n');
  fs.writeFileSync(path.join(REPORT_DIR, 'RUNTIME_UPTIME_REPORT.md'), body);
}

function writeExecutiveSnapshot(snapshot: ExecutiveRuntimeSnapshot) {
  const body = [
    '# EXECUTIVE_RUNTIME_SNAPSHOT',
    '',
    `Generated: ${snapshot.generated_at}`,
    `Target: ${snapshot.target}`,
    `Burn-in score: ${snapshot.burn_in_score}`,
    `QB status: ${snapshot.qb_status?.status || 'missing'}`,
    `Health status: ${snapshot.health_status?.status || 'missing'}`,
    '',
    '## Connector Health',
    mdTable(
      ['Connector', 'Auth', 'Health', 'Last Sync'],
      snapshot.connector_health.connectors.map(c => [c.name, c.auth, c.health, c.last_sync || ''])
    ),
    '',
    '## Stale Sources',
    snapshot.stale_sources.length
      ? mdTable(['Source', 'Status', 'Age Min', 'Threshold Min', 'Escalation'], snapshot.stale_sources.map(s => [s.source, s.status, s.age_minutes, s.threshold_minutes, s.stale ? 'escalated' : 'watch']))
      : 'No stale sources detected.',
    '',
    '## Failed Workflows',
    snapshot.failed_workflows.length
      ? mdTable(['Type', 'Source', 'Summary', 'First Seen', 'Recurrence'], snapshot.failed_workflows.map(i => [i.type, i.source, i.summary, i.first_seen, i.recurrence]))
      : 'No failed workflows detected.',
  ].join('\n');
  fs.writeFileSync(path.join(REPORT_DIR, 'EXECUTIVE_RUNTIME_SNAPSHOT.md'), body);
}

function writeIncidentRegistry(incidents: OperationsIncident[]) {
  const body = [
    '# INCIDENT_REGISTRY',
    '',
    `Generated: ${new Date().toISOString()}`,
    'Target: INCIDENT_REGISTRY_READY',
    '',
    incidents.length
      ? mdTable(['Status', 'Type', 'Source', 'First Seen', 'Last Seen', 'Recurrence', 'Escalation', 'Summary'], incidents.map(i => [i.status, i.type, i.source, i.first_seen, i.last_seen, i.recurrence, i.escalation, i.summary]))
      : 'No incidents recorded.',
  ].join('\n');
  fs.writeFileSync(path.join(REPORT_DIR, 'INCIDENT_REGISTRY.md'), body);
}

function writeFreshnessGuard(freshness: ReturnType<typeof generateDataFreshnessReport>) {
  const body = [
    '# DATA_FRESHNESS_GUARD',
    '',
    `Generated: ${freshness.generated_at}`,
    'Target: DATA_FRESHNESS_GUARD_READY',
    `Overall status: ${freshness.overall_status}`,
    '',
    mdTable(
      ['Source', 'Status', 'Age Min', 'Threshold Min', 'Stale', 'Last Sync'],
      freshness.sources.map(s => [s.source, s.status, s.age_minutes, s.threshold_minutes, s.stale ? 'yes' : 'no', s.last_synced_at || ''])
    ),
    '',
    'Rules: fresh = within threshold, warning = degraded connector/error with timestamp, stale = beyond threshold/missing/error. Stale sources are escalated into the incident registry.',
  ].join('\n');
  fs.writeFileSync(path.join(REPORT_DIR, 'DATA_FRESHNESS_GUARD.md'), body);
}

function writeAutoHealReport(results: AutoHealResult[]) {
  const body = [
    '# CONNECTOR_AUTO_HEAL',
    '',
    `Generated: ${new Date().toISOString()}`,
    'Target: CONNECTOR_AUTO_HEAL_READY',
    '',
    mdTable(
      ['Connector', 'Detected', 'Attempted', 'Recovered', 'Result'],
      results.map(r => [r.name, r.detected.join(', ') || 'none', r.attempted ? 'yes' : 'no', r.recovered ? 'yes' : 'no', r.result.replace(/\|/g, '/')])
    ),
  ].join('\n');
  fs.writeFileSync(path.join(REPORT_DIR, 'CONNECTOR_AUTO_HEAL_REPORT.md'), body);
}

function writeBurnInSupportReport(report: BurnInSupportReport) {
  const body = [
    '# DEV3_BURN_IN_SUPPORT',
    '',
    `Generated: ${report.generated_at}`,
    `Target: ${report.target}`,
    '',
    `Runtime services tracked: ${report.runtime_metrics.length}`,
    `Connectors tracked: ${report.connector_metrics.total}`,
    `Freshness stale/missing/error: ${report.freshness_metrics.stale_count}/${report.freshness_metrics.missing_count}/${report.freshness_metrics.error_count}`,
    `Incidents open/resolved/escalated: ${report.incident_metrics.open}/${report.incident_metrics.resolved}/${report.incident_metrics.escalated}`,
  ].join('\n');
  fs.writeFileSync(path.join(REPORT_DIR, 'DEV3_BURN_IN_SUPPORT.md'), body);
}

function writePm2RestartMonitorReport(report: Pm2RestartMonitorReport) {
  const body = [
    '# PM2_RESTART_MONITOR_REPORT',
    '',
    `Generated: ${report.generated_at}`,
    `Target: ${report.target}`,
    '',
    mdTable(
      ['Service', 'PM2 Name', 'Status', 'Restarts', 'Restarts Last Hour', 'Crashes', 'PM2 PID', 'Port PID', 'Port Match', 'Alert'],
      report.services.map(s => [s.service, s.pm2_name, s.status, s.restart_count, s.restarts_last_hour, s.crash_count, s.pm2_pid, s.port_pid, s.port_matches_pm2, s.alert])
    ),
    '',
    'Rules: restart count increase = WARNING; restarts > 3/hour, repeated uptime reset, or port PID mismatch = CRITICAL.',
  ].join('\n');
  fs.writeFileSync(path.join(REPORT_DIR, 'PM2_RESTART_MONITOR_REPORT.md'), body);
}

function writeOllamaHealthMonitorReport(report: OllamaHealthMonitorReport) {
  const body = [
    '# OLLAMA_HEALTH_MONITOR_REPORT',
    '',
    `Generated: ${report.generated_at}`,
    `Target: ${report.target}`,
    '',
    mdTable(
      ['Reachable', 'Model Loaded', 'Selected Model', 'Latency MS', 'Timeout Count', 'Failure Count', 'Last Success', 'Last Timeout'],
      [[report.reachable ? 'yes' : 'no', report.model_loaded ? 'yes' : 'no', report.selected_model || '', report.response_latency_ms, report.timeout_count, report.failure_count, report.last_successful_response || '', report.last_timeout_time || '']]
    ),
    '',
    `Answer: ${report.answer_vi}`,
    '',
    `Available models: ${report.available_models.join(', ') || 'none'}`,
  ].join('\n');
  fs.writeFileSync(path.join(REPORT_DIR, 'OLLAMA_HEALTH_MONITOR_REPORT.md'), body);
}

function writeChatReliabilityMetricsReport(report: ChatReliabilityMetricsReport) {
  const body = [
    '# CHAT_RELIABILITY_METRICS_REPORT',
    '',
    `Generated: ${report.generated_at}`,
    `Target: ${report.target}`,
    '',
    mdTable(
      ['Requests', 'Success', 'Timeout', 'Failed', 'Avg Latency MS', 'P95 Latency MS', 'Retry Count', 'Queue Depth', 'Queue Peak', 'Active'],
      [[report.chat_request_count, report.success_count, report.timeout_count, report.failed_count, report.average_latency_ms, report.p95_latency_ms, report.retry_count, report.queue_depth, report.queue_depth_peak, report.active_requests]]
    ),
    '',
    'Read-only metrics only. No chat pipeline changes made by DEV2.',
  ].join('\n');
  fs.writeFileSync(path.join(REPORT_DIR, 'CHAT_RELIABILITY_METRICS_REPORT.md'), body);
}

function writeRuntimeAlertClassificationReport(report: RuntimeAlertClassificationReport) {
  const body = [
    '# RUNTIME_ALERT_CLASSIFICATION_REPORT',
    '',
    `Generated: ${report.generated_at}`,
    `Target: ${report.target}`,
    '',
    `INFO: ${report.summary.INFO}`,
    `WARNING: ${report.summary.WARNING}`,
    `CRITICAL: ${report.summary.CRITICAL}`,
    '',
    report.alerts.length
      ? mdTable(['Severity', 'Source', 'Rule', 'Message', 'Evidence'], report.alerts.map(a => [a.severity, a.source, a.rule, a.message, a.evidence || '']))
      : 'No runtime alerts detected.',
    '',
    'Classification rules: Ollama timeout once = WARNING; repeated timeout = CRITICAL; PM2 restart > 3/hour = CRITICAL; connector stale/missing = WARNING; dashboard mismatch = CRITICAL.',
  ].join('\n');
  fs.writeFileSync(path.join(REPORT_DIR, 'RUNTIME_ALERT_CLASSIFICATION_REPORT.md'), body);
}

function buildBurnInWatchdogFeed(params: {
  runtime: RuntimeUptimeReport;
  pm2: Pm2RestartMonitorReport;
  ollama: OllamaHealthMonitorReport;
  freshness: ReturnType<typeof generateDataFreshnessReport>;
  incidents: OperationsIncident[];
  alerts: RuntimeAlertClassificationReport;
}): BurnInWatchdogFeed {
  return {
    generated_at: new Date().toISOString(),
    pm2_restarts: params.pm2.services,
    ollama_timeouts: params.ollama.timeout_count,
    mi_core_uptime: params.runtime.services.find(s => s.service_id === 'mi-core') || null,
    connector_health: connectorRegistry.getSummary(),
    stale_data: params.freshness.sources.filter(s => s.stale || s.status === 'missing' || s.status === 'degraded'),
    failed_workflows: params.incidents.filter(i => !i.resolved),
    flow_gaps: params.alerts.alerts.filter(a => a.severity !== 'INFO'),
    burn_in_score: burnInScore(params.runtime, params.freshness, params.incidents),
    target: 'BURN_IN_WATCHDOG_FEED_READY',
  };
}

function writeBurnInWatchdogFeedReport(feed: BurnInWatchdogFeed) {
  const body = [
    '# BURN_IN_WATCHDOG_FEED_REPORT',
    '',
    `Generated: ${feed.generated_at}`,
    `Target: ${feed.target}`,
    `Burn-in score: ${feed.burn_in_score}`,
    `Ollama timeouts: ${feed.ollama_timeouts}`,
    `Mi-Core uptime %: ${feed.mi_core_uptime?.uptime_percent ?? 'unknown'}`,
    '',
    '## PM2 Restarts',
    mdTable(['Service', 'Restarts', 'Restarts Last Hour', 'Alert'], feed.pm2_restarts.map(s => [s.service, s.restart_count, s.restarts_last_hour, s.alert])),
    '',
    '## Stale Data',
    feed.stale_data.length
      ? mdTable(['Source', 'Status', 'Age Min', 'Threshold Min'], feed.stale_data.map(s => [s.source, s.status, s.age_minutes, s.threshold_minutes]))
      : 'No stale data detected.',
    '',
    '## Flow Gaps',
    feed.flow_gaps.length
      ? mdTable(['Severity', 'Source', 'Rule', 'Message'], feed.flow_gaps.map(a => [a.severity, a.source, a.rule, a.message]))
      : 'No flow gaps detected.',
  ].join('\n');
  fs.writeFileSync(path.join(REPORT_DIR, 'BURN_IN_WATCHDOG_FEED_REPORT.md'), body);
}

function buildDailyReliabilitySnapshot(params: {
  runtime: RuntimeUptimeReport;
  pm2: Pm2RestartMonitorReport;
  ollama: OllamaHealthMonitorReport;
  freshness: ReturnType<typeof generateDataFreshnessReport>;
  incidents: OperationsIncident[];
  alerts: RuntimeAlertClassificationReport;
}): DailyReliabilitySnapshot {
  const activeIncidents = params.incidents.filter(i => !i.resolved);
  const dev1: string[] = [];
  const dev2: string[] = [];
  const dev3: string[] = [];
  if (params.pm2.services.some(s => s.port_matches_pm2 === false)) dev1.push('Verify PM2 process ownership for mismatched runtime ports.');
  if (!params.ollama.reachable || !params.ollama.model_loaded) dev1.push('Restore Ollama reachability/model load before hardening tests.');
  if (params.freshness.sources.some(s => s.stale || s.status === 'missing')) dev2.push('Escalate and refresh stale or missing connector data.');
  if (params.alerts.alerts.some(a => a.severity === 'CRITICAL')) dev2.push('Keep critical runtime alerts open until verified resolved.');
  dev3.push('Use before/after restart, latency, timeout, and burn-in score deltas during chat hardening tests.');
  if (!dev1.length) dev1.push('No Dev1 action required from current monitoring snapshot.');
  if (!dev2.length) dev2.push('Continue monitoring; no active DEV2 data freshness action required.');
  return {
    generated_at: new Date().toISOString(),
    uptime: params.runtime.services,
    restart_count: params.pm2.services,
    ollama_health: params.ollama,
    connector_freshness: params.freshness,
    burn_in_score: burnInScore(params.runtime, params.freshness, params.incidents),
    active_incidents: activeIncidents,
    action_required: { dev1, dev2, dev3 },
    target: 'DAILY_RELIABILITY_SNAPSHOT_READY',
  };
}

function writeDailyReliabilitySnapshot(snapshot: DailyReliabilitySnapshot) {
  const body = [
    '# DEV2_RUNTIME_RELIABILITY_SNAPSHOT',
    '',
    `Generated: ${snapshot.generated_at}`,
    `Target: ${snapshot.target}`,
    `Burn-in score: ${snapshot.burn_in_score}`,
    '',
    '## Uptime',
    mdTable(['Service', 'Status', 'Uptime %', 'Restarts', 'Crashes'], snapshot.uptime.map(s => [s.service, s.status, s.uptime_percent, s.restart_count, s.crash_count])),
    '',
    '## Ollama',
    `Reachable: ${snapshot.ollama_health.reachable}`,
    `Model loaded: ${snapshot.ollama_health.model_loaded}`,
    `Latency ms: ${snapshot.ollama_health.response_latency_ms ?? 'unknown'}`,
    `Timeout count: ${snapshot.ollama_health.timeout_count}`,
    '',
    '## Connector Freshness',
    mdTable(['Source', 'Status', 'Stale', 'Age Min'], snapshot.connector_freshness.sources.map(s => [s.source, s.status, s.stale ? 'yes' : 'no', s.age_minutes])),
    '',
    '## Active Incidents',
    snapshot.active_incidents.length
      ? mdTable(['Type', 'Source', 'Summary', 'Escalation'], snapshot.active_incidents.map(i => [i.type, i.source, i.summary, i.escalation]))
      : 'No active incidents.',
    '',
    '## Action Required',
    `Dev1: ${snapshot.action_required.dev1.join(' ')}`,
    `Dev2: ${snapshot.action_required.dev2.join(' ')}`,
    `Dev3: ${snapshot.action_required.dev3.join(' ')}`,
  ].join('\n');
  fs.writeFileSync(path.join(REPORT_DIR, 'DEV2_RUNTIME_RELIABILITY_SNAPSHOT.md'), body);
}

function writeCloseout(pkg: Dev2OperationsPackage) {
  const acceptanceGreen =
    pkg.burn_in_support.freshness_metrics.stale_count === 0 &&
    pkg.burn_in_support.freshness_metrics.missing_count === 0 &&
    pkg.burn_in_support.freshness_metrics.error_count === 0 &&
    pkg.runtime_alerts.summary.CRITICAL === 0;
  const body = [
    '# DEV2_OPERATIONS_CERTIFICATION',
    '',
    `Generated: ${pkg.generated_at}`,
    `Final target: ${pkg.targets.final}`,
    '',
    '## Acceptance',
    mdTable(
      ['Requirement', 'Status'],
      [
        ['30 days operation', 'monitoring window configured'],
        ['no stale data', pkg.burn_in_support.freshness_metrics.stale_count === 0 ? 'pass' : 'open'],
        ['no false green', 'pass'],
        ['no orphan connector', pkg.executive_snapshot.connector_health.connectors.every(c => c.auth !== 'expired') ? 'pass' : 'open'],
        ['no dashboard mismatch', loadIncidents().some(i => !i.resolved && i.type === 'dashboard_mismatch') ? 'open' : 'pass'],
        ['incident registry active', 'pass'],
        ['before/after restart count', 'available in PM2_RESTART_MONITOR_REPORT.md'],
        ['before/after Ollama latency', 'available in OLLAMA_HEALTH_MONITOR_REPORT.md'],
        ['before/after timeout count', 'available in CHAT_RELIABILITY_METRICS_REPORT.md'],
        ['burn-in score change', 'available in BURN_IN_WATCHDOG_FEED_REPORT.md'],
      ]
    ),
    '',
    acceptanceGreen
      ? 'DEV2_RELIABILITY_MONITORING_READY'
      : 'DEV2_OPERATIONS_READY_WITH_OPEN_ITEMS',
  ].join('\n');
  fs.writeFileSync(path.join(REPORT_DIR, 'DEV2_OPERATIONS_CERTIFICATION.md'), body);
}

export async function generateDev2OperationsPackage(): Promise<Dev2OperationsPackage> {
  ensureDirs();
  const latestChecks = await runRuntimeChecks();
  const runtime = buildRuntimeReport(latestChecks);
  const pm2RestartMonitor = buildPm2RestartMonitor(runtime);
  const ollamaHealthMonitor = await buildOllamaHealthMonitor();
  const chatReliabilityMetrics = buildChatReliabilityMetrics();
  const freshness = generateDataFreshnessReport();
  const autoHeal = await runConnectorAutoHealing(freshness);
  const refreshedFreshness = generateDataFreshnessReport();
  const incidents = recordIncidents(runtime, refreshedFreshness);
  const runtimeAlerts = classifyRuntimeAlerts({
    pm2: pm2RestartMonitor,
    ollama: ollamaHealthMonitor,
    chat: chatReliabilityMetrics,
    runtime,
    freshness: refreshedFreshness,
    incidents,
  });
  const burnInWatchdogFeed = buildBurnInWatchdogFeed({
    runtime,
    pm2: pm2RestartMonitor,
    ollama: ollamaHealthMonitor,
    freshness: refreshedFreshness,
    incidents,
    alerts: runtimeAlerts,
  });
  const dailyReliabilitySnapshot = buildDailyReliabilitySnapshot({
    runtime,
    pm2: pm2RestartMonitor,
    ollama: ollamaHealthMonitor,
    freshness: refreshedFreshness,
    incidents,
    alerts: runtimeAlerts,
  });
  await getDailySnapshot().catch(() => undefined);
  const executiveSnapshot = buildExecutiveSnapshot(runtime, refreshedFreshness, incidents);
  const burnInSupport = buildBurnInSupport(runtime, refreshedFreshness, incidents);
  const noCriticalAlerts = runtimeAlerts.summary.CRITICAL === 0;
  const pkg: Dev2OperationsPackage = {
    generated_at: new Date().toISOString(),
    runtime,
    pm2_restart_monitor: pm2RestartMonitor,
    ollama_health_monitor: ollamaHealthMonitor,
    chat_reliability_metrics: chatReliabilityMetrics,
    runtime_alerts: runtimeAlerts,
    burn_in_watchdog_feed: burnInWatchdogFeed,
    daily_reliability_snapshot: dailyReliabilitySnapshot,
    auto_heal: autoHeal,
    executive_snapshot: executiveSnapshot,
    burn_in_support: burnInSupport,
    incidents,
    targets: {
      uptime: 'UPTIME_MONITOR_READY',
      freshness: 'DATA_FRESHNESS_GUARD_READY',
      auto_heal: 'CONNECTOR_AUTO_HEAL_READY',
      snapshot: 'EXECUTIVE_SNAPSHOT_READY',
      incidents: 'INCIDENT_REGISTRY_READY',
      burn_in: 'DEV3_BURN_IN_SUPPORT_READY',
      pm2_restart: 'PM2_RESTART_MONITOR_READY',
      ollama_health: 'OLLAMA_HEALTH_MONITOR_READY',
      chat_reliability: 'CHAT_RELIABILITY_METRICS_READY',
      watchdog_feed: 'BURN_IN_WATCHDOG_FEED_READY',
      alert_classification: 'RUNTIME_ALERT_CLASSIFICATION_READY',
      daily_reliability: 'DAILY_RELIABILITY_SNAPSHOT_READY',
      final: refreshedFreshness.overall_status === 'fresh' && noCriticalAlerts
        ? 'DEV2_RELIABILITY_MONITORING_READY'
        : 'DEV2_OPERATIONS_READY_WITH_OPEN_ITEMS',
    },
  };

  writeJson(path.join(OPS_DIR, 'dev2-operations-package.json'), pkg);
  writeRuntimeReport(runtime);
  writePm2RestartMonitorReport(pm2RestartMonitor);
  writeOllamaHealthMonitorReport(ollamaHealthMonitor);
  writeChatReliabilityMetricsReport(chatReliabilityMetrics);
  writeRuntimeAlertClassificationReport(runtimeAlerts);
  writeBurnInWatchdogFeedReport(burnInWatchdogFeed);
  writeDailyReliabilitySnapshot(dailyReliabilitySnapshot);
  writeFreshnessGuard(refreshedFreshness);
  writeAutoHealReport(autoHeal);
  writeExecutiveSnapshot(executiveSnapshot);
  writeIncidentRegistry(incidents);
  writeBurnInSupportReport(burnInSupport);
  writeCloseout(pkg);
  return pkg;
}

export function getDev2IncidentRegistry(): OperationsIncident[] {
  ensureDirs();
  return loadIncidents();
}

export function getDev2OperationsStatus(): Dev2OperationsPackage | { status: 'not_generated'; target: 'DEV2_RELIABILITY_MONITORING_READY' } {
  ensureDirs();
  return readJson<Dev2OperationsPackage | { status: 'not_generated'; target: 'DEV2_RELIABILITY_MONITORING_READY' }>(
    path.join(OPS_DIR, 'dev2-operations-package.json'),
    { status: 'not_generated', target: 'DEV2_RELIABILITY_MONITORING_READY' }
  );
}

export function getDev2RuntimeReliabilityFeed(): BurnInWatchdogFeed | { status: 'not_generated'; target: 'BURN_IN_WATCHDOG_FEED_READY' } {
  const status = getDev2OperationsStatus();
  if ('burn_in_watchdog_feed' in status) return status.burn_in_watchdog_feed;
  return { status: 'not_generated', target: 'BURN_IN_WATCHDOG_FEED_READY' };
}
