import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { getDailySnapshot, getHealthSnapshot, getProjectSnapshot, getQuickBooksSnapshot } from '../visibility/visibility-hub';
import { generateDataFreshnessReport, FreshnessReport, FreshnessSource, FreshnessState } from '../visibility/data-freshness-monitor';
import { connectorRegistry } from '../visibility/connector-registry';
import { getCachedGmail } from '../visibility/connectors/google/gmail-connector';
import { getCachedCalendar } from '../visibility/connectors/google/calendar-connector';
import { getCachedDrive } from '../visibility/connectors/google/drive-connector';
import { getCachedDashboard } from '../visibility/connectors/dashboard';
import { getCachedWebsiteSource } from '../visibility/connectors/website-source-connector';
import { buildSnapshot as buildOperationalSnapshot, OperationalSnapshot } from '../task-intelligence/task-data-collector';
import { getPending } from '../approval/gate';

const GLOBAL_DIR = process.env.GLOBAL_DIR || 'D:/Project/Master/.local-agent-global';

export type ExecutiveOwner = 'Dev1' | 'Dev2' | 'Dev3';
export type ExecutiveIntentLabel =
  | 'graph_lookup'
  | 'operational_status'
  | 'action_request'
  | 'marketing_request'
  | 'finance_request'
  | 'connector_check';

export interface ExecutiveSection<T = unknown> {
  source: string;
  last_synced_at: string | null;
  freshness: FreshnessState;
  stale: boolean;
  confidence: number;
  error: string | null;
  owner: ExecutiveOwner;
  evidence_links: string[];
  last_updated_at: string | null;
  data: T;
}

export interface ConnectorTruthState {
  connector_id: string;
  name: string;
  owner: ExecutiveOwner;
  auth: string;
  health: string;
  api_available: boolean | null;
  data_freshness: FreshnessState;
  stale: boolean;
  last_successful_sync: string | null;
  error_count: number;
  action_required: boolean;
  setup_hint?: string;
  evidence_links: string[];
}

export interface ExecutiveSnapshot {
  generated_at: string;
  target: 'WHATSAPP_DATA_SOURCE_CERTIFIED';
  today_summary: ExecutiveSection;
  tasks: ExecutiveSection;
  approvals: ExecutiveSection;
  work_orders: ExecutiveSection;
  blockers: ExecutiveSection;
  projects: ExecutiveSection;
  gmail: ExecutiveSection;
  calendar: ExecutiveSection;
  drive: ExecutiveSection;
  health: ExecutiveSection;
  finance_qb: ExecutiveSection;
  websites: ExecutiveSection;
  dashboard: ExecutiveSection;
  connectors: ExecutiveSection<{ summary: unknown; truth: ConnectorTruthState[]; freshness: unknown }>;
  burn_in: ExecutiveSection;
  graph: ExecutiveSection;
  memory: ExecutiveSection;
  action_required: Array<{ section: string; reason: string; owner: ExecutiveOwner }>;
  source_map: Record<string, string>;
}

function confidenceFor(status: FreshnessState, hasData: boolean): number {
  if (status === 'fresh' && hasData) return 95;
  if (status === 'degraded' && hasData) return 70;
  if (status === 'stale' && hasData) return 60;
  if (status === 'missing') return 25;
  if (status === 'error') return 15;
  return hasData ? 55 : 25;
}

function section<T>(
  source: string,
  data: T,
  opts: {
    owner?: ExecutiveOwner;
    freshness?: FreshnessState;
    last_synced_at?: string | null;
    error?: string | null;
    evidence_links?: string[];
  } = {},
): ExecutiveSection<T> {
  const hasData = data !== null && data !== undefined && !(Array.isArray(data) && data.length === 0);
  const freshness = opts.freshness || (opts.error ? 'error' : opts.last_synced_at ? 'fresh' : hasData ? 'degraded' : 'missing');
  const lastSynced = opts.last_synced_at || null;
  return {
    source,
    last_synced_at: lastSynced,
    freshness,
    stale: freshness === 'stale' || freshness === 'missing' || freshness === 'error',
    confidence: confidenceFor(freshness, hasData),
    error: opts.error || null,
    owner: opts.owner || 'Dev2',
    evidence_links: opts.evidence_links || [],
    last_updated_at: lastSynced,
    data,
  };
}

function findFreshness(sources: FreshnessSource[], ...needles: string[]): FreshnessSource | undefined {
  const lower = needles.map(n => n.toLowerCase());
  return sources.find(s => {
    const hay = `${s.source} ${s.connector_id || ''}`.toLowerCase();
    return lower.some(n => hay.includes(n));
  });
}

function metaFromFreshness(source: FreshnessSource | undefined, fallbackLast?: string | null) {
  return {
    freshness: source?.status || (fallbackLast ? 'fresh' as const : 'missing' as const),
    last_synced_at: source?.last_synced_at || fallbackLast || null,
    error: source?.error || null,
    evidence_links: source?.evidence_path ? [source.evidence_path] : [],
  };
}

function safeGenerateFreshnessReport(): FreshnessReport {
  try {
    return generateDataFreshnessReport();
  } catch (e) {
    return {
      generated_at: new Date().toISOString(),
      overall_status: 'degraded',
      sources: [],
      stale_count: 0,
      missing_count: 0,
      error_count: 1,
      no_hallucination_guardrail: `Freshness monitor could not write/read its report: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

function ownerForConnector(id: string): ExecutiveOwner {
  if (id === 'quickbooks-runtime') return 'Dev1';
  if (id.includes('whatsapp')) return 'Dev3';
  return 'Dev2';
}

function buildConnectorTruth(freshnessSources: FreshnessSource[]): ConnectorTruthState[] {
  const summary = connectorRegistry.getSummary();
  return summary.connectors.map(c => {
    const freshness = findFreshness(freshnessSources, c.id, c.name);
    const stale = freshness?.stale ?? (c.health !== 'healthy');
    const errorCount = freshness?.error ? 1 : 0;
    return {
      connector_id: c.id,
      name: c.name,
      owner: ownerForConnector(c.id),
      auth: c.auth,
      health: c.health,
      api_available: c.auth === 'connected' ? c.health !== 'offline' : false,
      data_freshness: freshness?.status || (c.last_sync ? 'degraded' : 'missing'),
      stale,
      last_successful_sync: freshness?.last_synced_at || c.last_sync || null,
      error_count: errorCount,
      action_required: c.auth !== 'connected' || c.health !== 'healthy' || stale,
      setup_hint: c.setup_hint,
      evidence_links: freshness?.evidence_path ? [freshness.evidence_path] : [],
    };
  });
}

function getBurnInStatus() {
  const dbPath = path.join(GLOBAL_DIR, 'coo-v4', 'burn-in.db');
  const metricsDir = path.join(GLOBAL_DIR, 'coo-v4', 'metrics');
  if (!fs.existsSync(dbPath)) {
    return { status: 'missing', error: `Burn-in DB not found: ${dbPath}`, data: null, last_synced_at: null, evidence_links: [dbPath] };
  }
  try {
    const db = new Database(dbPath, { readonly: true });
    const total = db.prepare("SELECT COUNT(*) as n, SUM(CASE WHEN status='success' THEN 1 ELSE 0 END) as ok, SUM(CASE WHEN status='failure' THEN 1 ELSE 0 END) as fail, SUM(CASE WHEN status='retry' THEN 1 ELSE 0 END) as retry, AVG(duration_ms) as avg_ms FROM events").get() as any;
    const meta = db.prepare('SELECT * FROM burn_in_meta').get() as any;
    db.close();
    let latestMetrics: any = null;
    let latestMetricsPath: string | null = null;
    if (fs.existsSync(metricsDir)) {
      const files = fs.readdirSync(metricsDir).filter(f => f.endsWith('.json')).sort();
      if (files.length) {
        latestMetricsPath = path.join(metricsDir, files[files.length - 1]);
        latestMetrics = JSON.parse(fs.readFileSync(latestMetricsPath, 'utf-8'));
      }
    }
    const successRate = total.n > 0 ? total.ok / total.n : 1;
    const data = {
      start_date: meta?.start_date || null,
      total_events: total.n,
      success_rate: successRate,
      failure_rate: total.n > 0 ? total.fail / total.n : 0,
      retry_rate: total.n > 0 ? total.retry / total.n : 0,
      avg_runtime_ms: Math.round(total.avg_ms || 0),
      burn_in_score: latestMetrics?.burn_in_score ?? Math.round(successRate * 100),
      burn_in_status: successRate >= 0.95 ? 'HEALTHY' : successRate >= 0.80 ? 'DEGRADED' : 'CRITICAL',
      flow_gaps: latestMetrics?.flow_gaps ?? 0,
      orphan_workflows: latestMetrics?.orphan_workflows ?? 0,
      missing_evidence: latestMetrics?.missing_evidence ?? 0,
    };
    return {
      status: data.burn_in_status === 'HEALTHY' ? 'fresh' : 'degraded',
      error: null,
      data,
      last_synced_at: latestMetrics?.generated_at || meta?.last_run_at || meta?.start_date || null,
      evidence_links: [dbPath, latestMetricsPath].filter(Boolean) as string[],
    };
  } catch (e) {
    return { status: 'error', error: e instanceof Error ? e.message : String(e), data: null, last_synced_at: null, evidence_links: [dbPath] };
  }
}

export function classifyExecutiveIntent(message: string): ExecutiveIntentLabel {
  const q = message.toLowerCase();
  if (/doanh\s*thu|revenue|sales|qb|quickbooks|finance|checksum|sync sao|kế toán|ke toan/.test(q)) return 'finance_request';
  if (/connector|kết nối|ket noi|health board|status board/.test(q)) return 'connector_check';
  if (/duyệt|approve|approval|cần duyệt|can duyet|tạo|create|giao|assign|action/.test(q)) return 'action_request';
  if (/website|raw sushi|bakudan|domain|seo|marketing|post|campaign/.test(q)) return 'marketing_request';
  if (/graph|node|dependency|quan hệ|quan he|phụ thuộc|phu thuoc/.test(q)) return 'graph_lookup';
  if (/dashboard|hôm nay|hom nay|task|email|calendar|lịch|lich|drive|work order|việc|viec|đáng lo|dang lo|blocker|health/.test(q)) return 'operational_status';
  return 'operational_status';
}

export async function getExecutiveSnapshot(): Promise<ExecutiveSnapshot> {
  const freshness = safeGenerateFreshnessReport();
  const freshnessSources = freshness.sources;
  const daily = await getDailySnapshot();
  const operational: OperationalSnapshot = buildOperationalSnapshot();
  const pending = getPending();
  const gmail = getCachedGmail();
  const calendar = getCachedCalendar();
  const drive = getCachedDrive();
  const dashboard = getCachedDashboard();
  const bakudan = getCachedWebsiteSource('bakudan');
  const raw = getCachedWebsiteSource('raw');
  const projects = getProjectSnapshot();
  const health = getHealthSnapshot();
  const qb = getQuickBooksSnapshot();
  const burnIn = getBurnInStatus();
  const connectorTruth = buildConnectorTruth(freshnessSources);
  const graphFresh = findFreshness(freshnessSources, 'graph');
  const memoryFresh = findFreshness(freshnessSources, 'memory');

  const snapshot: ExecutiveSnapshot = {
    generated_at: new Date().toISOString(),
    target: 'WHATSAPP_DATA_SOURCE_CERTIFIED',
    today_summary: section('/api/executive/snapshot.today_summary', {
      date: daily.date,
      action_items: daily.action_items,
      concerns: operational.concern_items,
      connected_platforms: daily.platforms.connected,
    }, { last_synced_at: daily.generated_at, freshness: freshness.overall_status === 'fresh' ? 'fresh' : 'degraded' }),
    tasks: section('/api/executive/snapshot.tasks', {
      asana: daily.tasks,
      active_reminders: operational.active_reminders,
      certifications_pending: operational.certifications_pending,
    }, metaFromFreshness(findFreshness(freshnessSources, 'asana'), daily.generated_at)),
    approvals: section('/api/approval/pending', {
      count: pending.length,
      items: pending,
    }, { last_synced_at: new Date().toISOString(), freshness: 'fresh' }),
    work_orders: section('task-intelligence.current_work_order_store', {
      count: operational.open_work_orders.length,
      items: operational.open_work_orders,
    }, { ...metaFromFreshness(findFreshness(freshnessSources, 'work orders'), operational.as_of), evidence_links: [path.join(GLOBAL_DIR, 'work-orders')] }),
    blockers: section('task-intelligence.open_blockers', {
      count: operational.open_blockers.length,
      items: operational.open_blockers,
      concerns: operational.concern_items,
    }, metaFromFreshness(memoryFresh, operational.as_of)),
    projects: section('/api/visibility/snapshot.projects', {
      count: projects.length,
      items: projects,
    }, metaFromFreshness(findFreshness(freshnessSources, 'projects'), daily.generated_at)),
    gmail: section('/api/executive/snapshot.gmail', {
      status: gmail ? 'synced' : 'missing',
      unread_count: gmail?.unread_count ?? null,
      important_count: gmail?.important_count ?? null,
      important_emails: gmail?.emails.filter(e => e.is_important || e.is_unread).slice(0, 10) || [],
    }, metaFromFreshness(findFreshness(freshnessSources, 'gmail'), gmail?.synced_at)),
    calendar: section('/api/executive/snapshot.calendar', {
      status: calendar ? 'synced' : 'missing',
      today_count: calendar?.events_today.length ?? null,
      events_today: calendar?.events_today.slice(0, 10) || [],
      upcoming_count: calendar?.events_upcoming.length ?? null,
    }, metaFromFreshness(findFreshness(freshnessSources, 'calendar'), calendar?.synced_at)),
    drive: section('/api/executive/snapshot.drive', {
      status: drive ? 'synced' : 'missing',
      total_found: drive?.total_found ?? null,
      recent_files: drive?.recent_files.slice(0, 10) || [],
      files_needing_action: [],
    }, metaFromFreshness(findFreshness(freshnessSources, 'drive'), drive?.synced_at)),
    health: section('/api/visibility/snapshot.health', health, metaFromFreshness(findFreshness(freshnessSources, 'health'), daily.generated_at)),
    finance_qb: section('/api/visibility/quickbooks', qb, {
      ...metaFromFreshness(findFreshness(freshnessSources, 'quickbooks'), qb.last_sync_timestamp || qb.generated_at),
      owner: 'Dev1',
      error: qb.action_required ? qb.required_dev1_action || 'QuickBooks action required' : null,
      evidence_links: [qb.daily_report_path, qb.handoff_package_path].filter(Boolean) as string[],
    }),
    websites: section('/api/executive/snapshot.websites', {
      bakudanramen_com: bakudan,
      rawsushibar_com: raw,
      dashboard_bakudanramen_com: dashboard ? {
        production_domain: 'https://dashboard.bakudanramen.com',
        local_source_path: dashboard.path,
        last_sync: dashboard.scanned_at,
        status: 'synced',
        publish_capability: dashboard.has_api ? 'api_present' : 'source_read_only',
      } : null,
    }, {
      freshness: [bakudan, raw, dashboard].every(Boolean) ? 'fresh' : 'missing',
      last_synced_at: [bakudan?.synced_at, raw?.synced_at, dashboard?.scanned_at].filter(Boolean).sort().pop() || null,
      evidence_links: [
        findFreshness(freshnessSources, 'website bakudan')?.evidence_path,
        findFreshness(freshnessSources, 'website raw')?.evidence_path,
        path.join(GLOBAL_DIR, 'visibility', 'dashboard', 'data.json'),
      ].filter(Boolean) as string[],
    }),
    dashboard: section('/api/visibility/snapshot.dashboard', dashboard, metaFromFreshness(findFreshness(freshnessSources, 'dashboard'), dashboard?.scanned_at)),
    connectors: section('/api/executive/snapshot.connectors', {
      summary: connectorRegistry.getSummary(),
      truth: connectorTruth,
      freshness,
    }, { last_synced_at: freshness.generated_at, freshness: freshness.overall_status, evidence_links: [path.join(GLOBAL_DIR, 'visibility', 'connector-registry.json'), path.join(GLOBAL_DIR, 'visibility', 'data-freshness.json')] }),
    burn_in: section('/api/coo-v4/burnin', burnIn.data, {
      last_synced_at: burnIn.last_synced_at,
      freshness: burnIn.status as FreshnessState,
      error: burnIn.error,
      evidence_links: burnIn.evidence_links,
    }),
    graph: section('/api/graph + task-intelligence.graph_risks', {
      intent_label: 'graph_lookup',
      graph_risks: operational.graph_risks,
      guardrail: 'Operational questions must use operational_status and executive snapshot, not raw graph node dumps.',
    }, metaFromFreshness(graphFresh, operational.as_of)),
    memory: section('/api/memory + operational-memory', {
      freshness: memoryFresh,
      source: 'operational-memory',
    }, metaFromFreshness(memoryFresh, operational.as_of)),
    action_required: [],
    source_map: {
      tasks: '/api/executive/snapshot.tasks',
      approvals: '/api/executive/snapshot.approvals',
      work_orders: '/api/executive/snapshot.work_orders',
      projects: '/api/executive/snapshot.projects',
      dashboard: '/api/executive/snapshot.dashboard',
      websites: '/api/executive/snapshot.websites',
      gmail: '/api/executive/snapshot.gmail',
      calendar: '/api/executive/snapshot.calendar',
      drive: '/api/executive/snapshot.drive',
      health: '/api/executive/snapshot.health',
      quickbooks: '/api/executive/snapshot.finance_qb',
      asana: '/api/executive/snapshot.tasks.data.asana',
      burn_in: '/api/executive/snapshot.burn_in',
      connectors: '/api/executive/snapshot.connectors',
      graph: '/api/executive/snapshot.graph',
      memory: '/api/executive/snapshot.memory',
    },
  };

  snapshot.action_required = Object.entries(snapshot)
    .filter(([, value]) => value && typeof value === 'object' && 'stale' in value)
    .flatMap(([name, value]) => {
      const s = value as ExecutiveSection;
      if (!s.stale && !s.error) return [];
      return [{ section: name, reason: s.error || `freshness=${s.freshness}`, owner: s.owner }];
    });

  return snapshot;
}

function stalePrefix(sectionData: ExecutiveSection): string {
  if (sectionData.freshness === 'fresh') return '';
  if (sectionData.freshness === 'missing') return 'Dữ liệu này đang missing, em không chốt xanh giả. ';
  if (sectionData.freshness === 'stale') return 'Dữ liệu này đang stale, em báo theo cache gần nhất. ';
  if (sectionData.freshness === 'error') return `Connector lỗi: ${sectionData.error || 'unknown'}. `;
  return 'Dữ liệu đang degraded, em báo thận trọng. ';
}

function pickRevenueValue(data: any): unknown {
  return data?.revenue?.today
    ?? data?.revenue?.total
    ?? data?.sales?.today
    ?? data?.sales?.total
    ?? data?.activity?.today_revenue
    ?? data?.activity?.revenue_today
    ?? data?.activity?.sales_today
    ?? data?.raw_sushi_revenue
    ?? data?.rawSushiRevenue
    ?? null;
}

export async function formatExecutiveSnapshotAnswer(message: string): Promise<{ reply: string; intent: ExecutiveIntentLabel; sources: string[] }> {
  const snapshot = await getExecutiveSnapshot();
  const intent = classifyExecutiveIntent(message);
  const q = message.toLowerCase();

  if (/doanh\s*thu|revenue|sales/.test(q)) {
    const qb = snapshot.finance_qb;
    const data = qb.data as any;
    const revenue = pickRevenueValue(data);
    if (revenue !== null && revenue !== undefined && revenue !== '') {
      return {
        reply: `${stalePrefix(qb)}Doanh thu Raw Sushi: ${revenue}. Source: QuickBooks. Last sync: ${data.last_successful_sync || data.last_sync_timestamp || qb.last_synced_at || 'not verified'}.`,
        intent: 'finance_request',
        sources: [qb.source],
      };
    }
    return {
      reply: `${stalePrefix(qb)}Doanh thu Raw Sushi: missing. Em chưa có live revenue data trong finance/QB source-of-truth, nên không chốt xanh và không đổi sang nguồn khác. Last QB sync: ${data.last_successful_sync || data.last_sync_timestamp || qb.last_synced_at || 'not verified'}. Owner: ${qb.owner}.`,
      intent: 'finance_request',
      sources: [qb.source],
    };
  }

  if (intent === 'finance_request' || /qb|quickbooks/.test(q)) {
    const qb = snapshot.finance_qb;
    const data = qb.data as any;
    const reply = `${stalePrefix(qb)}QB status: ${data.status}. Company: ${data.company_identity?.detected_company_name || 'unknown'}. Last sync: ${data.last_successful_sync || data.last_sync_timestamp || 'not verified'}. Transactions today: ${data.activity?.today_transactions ?? 'not verified'}. Checksum mismatch: ${data.checksum?.mismatch ? 'yes' : 'no'}. Action required: ${data.action_required ? data.required_dev1_action || 'Dev1 action required' : 'none'}. Owner: ${qb.owner}.`;
    return { reply, intent, sources: [qb.source] };
  }

  if (/email|gmail/.test(q)) {
    const gmail = snapshot.gmail;
    const data = gmail.data as any;
    return { reply: `${stalePrefix(gmail)}Gmail: ${data.unread_count ?? 'missing'} unread, ${data.important_count ?? 'missing'} important. Last sync: ${gmail.last_synced_at || 'missing'}.`, intent, sources: [gmail.source] };
  }

  if (/calendar|lịch|lich/.test(q)) {
    const calendar = snapshot.calendar;
    const data = calendar.data as any;
    return { reply: `${stalePrefix(calendar)}Calendar hôm nay: ${data.today_count ?? 'missing'} sự kiện. Last sync: ${calendar.last_synced_at || 'missing'}.`, intent, sources: [calendar.source] };
  }

  if (/raw.*website|raw sushi|rawsushibar/.test(q)) {
    const websites = snapshot.websites;
    const data = websites.data as any;
    const raw = data.rawsushibar_com;
    return { reply: `${stalePrefix(websites)}Raw Sushi website: ${raw?.status || 'missing'}, source ${raw?.local_source_path || 'missing'}, repo ${raw?.github_repository || 'missing'}, last sync ${raw?.synced_at || 'missing'}.`, intent, sources: [websites.source] };
  }

  if (/duyệt|approve|approval|can duyet|cần duyệt/.test(q)) {
    const approvals = snapshot.approvals;
    const data = approvals.data as any;
    return { reply: `${stalePrefix(approvals)}Có ${data.count} action cần duyệt.`, intent, sources: [approvals.source] };
  }

  if (/work order|việc|viec|task/.test(q)) {
    const tasks = snapshot.tasks;
    const workOrders = snapshot.work_orders;
    const wo = workOrders.data as any;
    const taskData = tasks.data as any;
    return { reply: `${stalePrefix(workOrders)}Hiện có ${wo.count} work order mở. Asana: ${taskData.asana?.asana_my_tasks ?? 'missing'} task, ${taskData.asana?.asana_overdue ?? 'missing'} overdue.`, intent, sources: [workOrders.source, tasks.source] };
  }

  if (/connector|kết nối|ket noi|dashboard/.test(q)) {
    const connectors = snapshot.connectors;
    const data = connectors.data;
    const truth = data.truth;
    const actionCount = truth.filter(c => c.action_required).length;
    return { reply: `${stalePrefix(connectors)}Dashboard/connector board: ${truth.length} connectors, ${actionCount} cần action. Freshness overall: ${connectors.freshness}. Last update: ${connectors.last_synced_at || 'missing'}.`, intent, sources: [connectors.source] };
  }

  const concerns = snapshot.blockers.data as any;
  const summary = snapshot.today_summary.data as any;
  return {
    reply: `${stalePrefix(snapshot.today_summary)}Hôm nay: ${summary.action_items?.length || 0} action item, ${concerns.concerns?.length || 0} mục đáng lo, ${snapshot.work_orders.data && (snapshot.work_orders.data as any).count} work order mở, Gmail ${(snapshot.gmail.data as any).important_count ?? 'missing'} important, Calendar ${(snapshot.calendar.data as any).today_count ?? 'missing'} sự kiện.`,
    intent,
    sources: [snapshot.today_summary.source, snapshot.work_orders.source, snapshot.gmail.source, snapshot.calendar.source],
  };
}
