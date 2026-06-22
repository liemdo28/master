import fs from 'fs';
import path from 'path';
import { getCachedCalendar } from '../visibility/connectors/google/calendar-connector';
import { getCachedDrive } from '../visibility/connectors/google/drive-connector';
import { getCachedGmail } from '../visibility/connectors/google/gmail-connector';
import { getCachedProjects } from '../visibility/connectors/local-projects';
import { getCachedAccounting } from '../visibility/connectors/accounting-connector';
import { getCachedHealthData, getStressSignal, syncHealthExport } from '../visibility/connectors/health/health-connector';
import { connectorRegistry } from '../visibility/connector-registry';
import { buildSnapshot } from '../task-intelligence/task-data-collector';
import { answerOperationalQuestion } from '../bigdata/ceo-query-service';

const MI_CORE_ROOT = process.env.MI_CORE_ROOT || 'E:/Project/Master/mi-core';
const MASTER_GLOBAL_DIR = process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global';
const CORE_GLOBAL_DIR = path.join(MI_CORE_ROOT, '.local-agent-global');

type Verdict = 'PASS' | 'FAIL';

interface SourceEvidence {
  source: string;
  status: 'verified' | 'missing' | 'error';
  path?: string;
  detail?: string;
  data?: unknown;
}

function readJson<T>(file: string): T | null {
  try {
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch {
    return null;
  }
}

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function healthFiles() {
  return [
    path.join(MASTER_GLOBAL_DIR, 'visibility', 'health', 'data.json'),
    path.join(CORE_GLOBAL_DIR, 'visibility', 'health', 'data.json'),
    path.join(CORE_GLOBAL_DIR, 'health-export', 'health.json'),
  ];
}

export function getVerifiedHealthData(): { data: any | null; source_path: string | null } {
  const synced = syncHealthExport();
  if (synced.ok) {
    connectorRegistry.update('health-export', { auth_status: 'connected', status: 'active' });
    connectorRegistry.markSynced('health-export');
  }
  const cached = getCachedHealthData();
  if (cached) return { data: cached, source_path: cached.source?.source_path || path.join(MASTER_GLOBAL_DIR, 'visibility', 'health', 'data.json') };
  for (const file of healthFiles()) {
    const data = readJson<any>(file);
    if (data) return { data, source_path: file };
  }
  return { data: null, source_path: null };
}

function minutesToHoursText(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h${String(m).padStart(2, '0')}`;
}

export function importHealthDataFromFile(sourcePath: string) {
  const resolved = path.resolve(sourcePath);
  if (!fs.existsSync(resolved)) {
    return { ok: false, error: 'source_path not found', source_path: resolved };
  }
  const ext = path.extname(resolved).toLowerCase();
  if (!['.json', '.csv', '.xml'].includes(ext)) {
    return { ok: false, error: 'Only .json, .csv, and .xml health exports are supported', source_path: resolved };
  }

  const targetDir = path.join(MASTER_GLOBAL_DIR, 'visibility', 'health', 'export');
  ensureDir(targetDir);
  const target = path.join(targetDir, `${Date.now()}-${path.basename(resolved)}`);
  fs.copyFileSync(resolved, target);
  let promoted_to_cache: string | null = null;

  if (ext === '.json') {
    const parsed = readJson<any>(resolved);
    if (parsed) {
      const cacheDir = path.join(MASTER_GLOBAL_DIR, 'visibility', 'health');
      ensureDir(cacheDir);
      promoted_to_cache = path.join(cacheDir, 'data.json');
      fs.writeFileSync(promoted_to_cache, JSON.stringify(parsed, null, 2));
      fs.writeFileSync(
        path.join(cacheDir, 'last_sync.json'),
        JSON.stringify({ synced_at: new Date().toISOString(), source_path: resolved }, null, 2)
      );
    }
  }

  return {
    ok: true,
    source_path: resolved,
    imported_to: target,
    promoted_to_cache,
    note: 'Imported a real local health export file. No mock data generated.',
  };
}

function sleepText(minutes: number): string {
  return minutesToHoursText(minutes);
}

function latestSleepMinutes(data: any): number {
  return Number(data.weekly?.avg_sleep_mins || data.today?.sleep_mins || 0);
}

export function answerHealthQuestion(question: string) {
  const { data, source_path } = getVerifiedHealthData();
  const evidence: SourceEvidence[] = [{
    source: 'Health Intelligence',
    status: data ? 'verified' : 'missing',
    path: source_path || undefined,
    detail: data ? 'Verified health cache/export found' : 'No Apple/Huawei health export or cache found',
  }];

  if (!data) {
    return {
      question,
      answer: 'Chưa có dữ liệu sức khỏe thật để trả lời. Cần import Apple Health hoặc Huawei Health export trước.',
      verdict: 'FAIL' as Verdict,
      target: 'HEALTH_INTELLIGENCE_READY',
      evidence,
      gaps: ['Missing verified health data export/cache'],
      no_mock_data: true,
    };
  }

  const q = question.toLowerCase();
  const weekly = data.weekly || {};
  const score = data.health_score || {};
  const today = data.today || {};
  const stressSignal = getStressSignal(data);
  let answer = '';

  if (/ngủ|sleep|hom qua|hôm qua|yesterday/.test(q)) {
    const mins = latestSleepMinutes(data);
    answer = mins > 0
      ? `Hôm qua/chu kỳ gần nhất anh ngủ khoảng ${sleepText(mins)} theo Huawei health export/cache thật. Điểm sleep: ${score.components?.sleep?.grade || 'unknown'} (${score.components?.sleep?.detail || 'không có chi tiết'}).`
      : 'Có dữ liệu health nhưng không thấy trường sleep_minutes/sleep_hours đủ để trả lời chính xác.';
  } else if (/hrv/.test(q)) {
    answer = `HRV tuần này trung bình ${weekly.avg_hrv || today.hrv_ms || 'unknown'}ms. Recovery component: ${score.components?.recovery?.grade || 'unknown'} — ${score.components?.recovery?.detail || 'không có chi tiết'}.`;
  } else if (/stress|quá tải|qua tai|overload|dấu hiệu/.test(q)) {
    answer = `Stress signal hiện tại: ${stressSignal}. Evidence: HRV ${weekly.avg_hrv || today.hrv_ms || 'unknown'}ms, sleep ${sleepText(latestSleepMinutes(data))}, resting HR ${weekly.avg_resting_hr || today.resting_hr || 'unknown'}bpm.`;
  } else if (/workload|giảm workload|giam workload|hôm nay.*đáng chú ý|hom nay.*dang chu y/.test(q)) {
    const calendar = getCachedCalendar();
    const operational = buildSnapshot();
    const events = calendar?.events_today?.length || 0;
    const approvals = operational.pending_approvals?.length || 0;
    const workOrders = operational.open_work_orders?.length || 0;
    const sleepMins = latestSleepMinutes(data);
    const healthPressure = stressSignal === 'HIGH' || sleepMins < 390 || Number(weekly.avg_hrv || today.hrv_ms || 0) < 35;
    const workloadPressure = events >= 4 || approvals + workOrders >= 5;
    answer = healthPressure || workloadPressure
      ? `Nên giảm workload hoặc giữ việc quan trọng nhất thôi. Health: stress ${stressSignal}, sleep ${sleepText(sleepMins)}, HRV ${weekly.avg_hrv || today.hrv_ms || 'unknown'}ms. Workload: ${events} calendar events, ${approvals} approvals, ${workOrders} open work orders.`
      : `Chưa thấy cần giảm workload mạnh. Health: stress ${stressSignal}, sleep ${sleepText(sleepMins)}, HRV ${weekly.avg_hrv || today.hrv_ms || 'unknown'}ms. Workload: ${events} events, ${approvals} approvals, ${workOrders} open work orders.`;
  } else {
    const notes = [
      `Health score: ${score.score || 'unknown'} (${score.grade || 'unknown'})`,
      `Sleep: ${score.components?.sleep?.detail || 'no sleep detail'}`,
      `Recovery: ${score.components?.recovery?.detail || 'no recovery detail'}`,
      `Activity: ${score.components?.activity?.detail || 'no activity detail'}`,
    ];
    answer = `Điểm đáng chú ý: ${notes.join(' | ')}.`;
  }

  return {
    question,
    answer,
    verdict: 'PASS' as Verdict,
    target: 'HEALTH_INTELLIGENCE_READY',
    evidence: [{ ...evidence[0], data: { today, weekly, health_score: score, trends: data.trends || [], entities: data.entities || [], relationships: data.relationships || [] } }],
    gaps: [],
    disclaimer: 'Mi chỉ tóm tắt dữ liệu sức khỏe, không phải tư vấn y tế.',
    no_mock_data: true,
  };
}

export function certifyHealthRuntime() {
  const questions = [
    'Hôm qua anh ngủ mấy tiếng?',
    'HRV tuần này thế nào?',
    'Có gì đáng chú ý về sức khỏe không?',
  ];
  const answers = questions.map(answerHealthQuestion);
  const pass = answers.every(a => a.verdict === 'PASS');
  return {
    status: pass ? 'HEALTH_INTELLIGENCE_READY' : 'HEALTH_INTELLIGENCE_NOT_READY',
    pass,
    no_mock_data: true,
    answers,
  };
}

function sourceStatus(name: string, data: unknown, detail?: string): SourceEvidence {
  return {
    source: name,
    status: data ? 'verified' : 'missing',
    detail,
    data,
  };
}

export async function answerUniversalConnectorQuestion(question: string) {
  const calendar = getCachedCalendar();
  const gmail = getCachedGmail();
  const drive = getCachedDrive();
  const projects = getCachedProjects();
  const accounting = getCachedAccounting();
  const operational = buildSnapshot();

  let finance: unknown = null;
  let financeError = '';
  try {
    finance = await answerOperationalQuestion('QB ngày nào thiếu activity?');
  } catch (e) {
    financeError = e instanceof Error ? e.message : String(e);
  }

  const sources: SourceEvidence[] = [
    sourceStatus('Calendar', calendar, calendar ? `${calendar.events_today.length} events today` : 'Google Calendar has no verified cache'),
    sourceStatus('Approvals', operational.pending_approvals, `${operational.pending_approvals.length} pending approvals`),
    sourceStatus('Email', gmail, gmail ? `${gmail.unread_count} unread, ${gmail.important_count} important` : 'Gmail has no verified cache'),
    sourceStatus('Projects', projects.length ? projects : null, projects.length ? `${projects.length} local projects in visibility cache` : 'Local project visibility cache missing'),
    sourceStatus('Work Orders', operational.open_work_orders, `${operational.open_work_orders.length} open work orders`),
    sourceStatus('Drive', drive, drive ? `${drive.total_found} recent files` : 'Google Drive has no verified cache'),
    sourceStatus(
      'QuickBooks',
      finance || accounting,
      finance
        ? 'QuickBooks/finance BigData query verified'
        : accounting
          ? accounting.summary_text
          : financeError || 'QuickBooks/accounting cache missing'
    ),
  ];

  const missing = sources.filter(s => s.status !== 'verified').map(s => s.source);
  const isVerified = (name: string) => sources.some(s => s.source === name && s.status === 'verified');
  const actionItems: string[] = [];
  if (calendar?.events_today?.length) actionItems.push(`${calendar.events_today.length} calendar events today`);
  if (operational.pending_approvals.length) actionItems.push(`${operational.pending_approvals.length} approvals pending`);
  if (gmail?.unread_count) actionItems.push(`${gmail.unread_count} unread emails`);
  if (projects.length) actionItems.push(`${projects.length} projects indexed`);
  if (operational.open_work_orders.length) actionItems.push(`${operational.open_work_orders.length} open work orders`);
  if ((finance as any)?.answer) actionItems.push(`Finance: ${(finance as any).answer}`);
  if (accounting?.summary_text) actionItems.push(`Accounting: ${accounting.summary_text.replace(/\s+/g, ' ').trim()}`);

  const q = question.toLowerCase();
  let answer = actionItems.length
    ? `Hôm nay anh cần xử lý: ${actionItems.join(' | ')}.`
    : 'Không có action item verified đủ rộng từ connector cache hiện tại.';
  let pass = ['Calendar', 'Email', 'Approvals', 'Projects'].every(isVerified);
  let acceptance = 'cross_source_daily_actions';

  if (/email|gmail|important|quan trọng/.test(q)) {
    const important = gmail?.emails?.filter(e => e.is_important || e.is_unread).slice(0, 10) || [];
    answer = important.length
      ? `Email quan trọng/chưa đọc: ${important.map(e => `${e.subject} (${e.from})`).join(' | ')}.`
      : gmail
        ? 'Gmail đã sync thật, hiện không thấy email important/unread trong cache gần nhất.'
        : 'Chưa có Gmail cache thật để trả lời.';
    pass = !!gmail;
    acceptance = 'important_email';
  } else if (/file|drive|tệp|tai lieu|tài liệu/.test(q)) {
    const files = drive?.recent_files?.slice(0, 10) || [];
    answer = files.length
      ? `File gần đây cần xem: ${files.map(f => `${f.name} (${f.modified_at})`).join(' | ')}.`
      : drive
        ? 'Google Drive đã sync thật, hiện không thấy file gần đây trong cache.'
        : 'Chưa có Google Drive cache thật để trả lời.';
    pass = !!drive;
    acceptance = 'drive_files';
  }

  return {
    question,
    answer,
    target: 'UNIVERSAL_CONNECTOR_CERTIFIED',
    status: pass ? 'UNIVERSAL_CONNECTOR_CERTIFIED' : 'UNIVERSAL_CONNECTOR_NOT_CERTIFIED',
    pass,
    acceptance,
    required_sources: ['Calendar', 'Approvals', 'Email', 'Projects', 'Work Orders', 'Drive', 'QuickBooks'],
    sources,
    gaps: missing.map(s => `${s} missing verified data/cache`),
    no_mock_data: true,
  };
}

export async function certifyUniversalConnectorProof() {
  return answerUniversalConnectorQuestion('Hôm nay anh có gì cần xử lý?');
}

export async function certifyGoogleConnectorRuntime() {
  const questions = [
    'Hôm nay anh có gì cần xử lý?',
    'Có email nào quan trọng?',
    'Có file nào cần xử lý?',
  ];
  const answers = await Promise.all(questions.map(answerUniversalConnectorQuestion));
  const pass = answers.every(a => a.pass);
  return {
    status: pass ? 'UNIVERSAL_CONNECTOR_CERTIFIED' : 'UNIVERSAL_CONNECTOR_NOT_CERTIFIED',
    pass,
    target: 'ENTERPRISE_BRAIN_V4_CERTIFIED',
    answers,
    gaps: [...new Set(answers.flatMap(a => a.gaps || []))],
    no_mock_data: true,
  };
}

export async function finalEnterpriseBrainV4Certification() {
  const health = certifyHealthRuntime();
  const connector = await certifyGoogleConnectorRuntime();
  const pass = health.pass && connector.pass;
  return {
    status: pass ? 'ENTERPRISE_BRAIN_V4_CERTIFIED' : 'ENTERPRISE_BRAIN_V4_NOT_CERTIFIED',
    pass,
    health,
    connector,
    no_mock_data: true,
  };
}
