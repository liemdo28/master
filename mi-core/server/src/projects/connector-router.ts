/**
 * Connector Router
 * Routes CEO commands to the right project connector.
 * CEO Chat → Mi-Core → Connector Router → Project Connector → Action
 */

import fs from 'fs';
import path from 'path';
import { scanAllProjects, getProjectById, getProjectSummary, ProjectInfo } from './project-scanner';
import { syncRawWebsite, getCachedRawWebsite, getRawWebsiteStatus, runRawQA, listRawPages } from './connectors/raw-website-connector';
import { syncBakudanWebsite, getCachedBakudanWebsite, getBakudanWebsiteStatus, runBakudanQA } from './connectors/bakudan-website-connector';
import { syncDashboardProject, getCachedDashboardProject, getDashboardStatus, runDashboardQA, createTaskDraft } from './connectors/dashboard-connector';
import { syncRemoteProject, getCachedRemote, checkRemoteAgent, getAllRemoteStatuses, runRemoteQA, previewRemoteCommand, executeRemoteAction } from './connectors/remote-proxy-connector';
import { enqueue } from '../approval/gate';

const GLOBAL_DIR = process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global';

// ── Intent detection ──────────────────────────────────────────────────────────
export type ProjectTarget =
  | 'raw-website'
  | 'bakudan-website'
  | 'dashboard'
  | 'integration-system'
  | 'whatsapp-api'
  | 'all'
  | 'unknown';

export function detectProjectTarget(message: string): ProjectTarget {
  const m = message.toLowerCase();
  if (/raw.*sushi|rawsushi|rawwebsite|raw.*web|raw.*site/.test(m))          return 'raw-website';
  if (/bakudan.*web|bakudan.*site|bakudanramen\.com/.test(m))               return 'bakudan-website';
  if (/dashboard|bakudan.*dashboard|task.*maria|create.*task/.test(m))      return 'dashboard';
  if (/integration.?system|integration-system|sync.*system/.test(m))        return 'integration-system';
  if (/whatsapp|zalo.*bot|chat.*bot|whatsapp.*api/.test(m))                 return 'whatsapp-api';
  if (/all.*project|tất cả.*project|scan.*project|show.*project|project.*list/.test(m)) return 'all';
  return 'unknown';
}

export type ActionType = 'status' | 'pull' | 'qa' | 'task' | 'command' | 'execute' | 'scan';

export function detectActionType(message: string): ActionType {
  const m = message.toLowerCase();
  if (/scan|phân tích|detect|tìm project/.test(m))           return 'scan';
  if (/pull.*data|pull data|lấy data|get data|fetch/.test(m)) return 'pull';
  if (/run.*qa|qa.*test|test.*web|kiểm tra chất lượng/.test(m)) return 'qa';
  if (/create.*task|tạo task|task for|giao.*việc/.test(m))   return 'task';
  if (/push|execute|apply|thực thi|deploy/.test(m))          return 'execute';
  return 'status';
}

// ── Main router ───────────────────────────────────────────────────────────────
export interface RouterResult {
  target:   ProjectTarget;
  action:   ActionType;
  data:     unknown;
  summary:  string;
  requires_approval?: boolean;
  approval_id?: string;
  sources:  string[];
}

export async function routeCommand(message: string, options: { approvalId?: string } = {}): Promise<RouterResult> {
  const target = detectProjectTarget(message);
  const action = detectActionType(message);
  const sources: string[] = [];

  // ── ALL PROJECTS / SCAN ──
  if (target === 'all' || action === 'scan') {
    const projects = scanAllProjects(action === 'scan');
    saveProjectRegistry(projects);
    sources.push('project-scanner');
    return {
      target, action: 'scan',
      data: { total: projects.length, projects },
      summary: formatProjectList(projects),
      sources,
    };
  }

  // ── RAW WEBSITE ──
  if (target === 'raw-website') {
    sources.push('raw-website-connector');
    if (action === 'pull') {
      const snap = syncRawWebsite();
      return { target, action, data: snap, summary: snap.summary_text, sources };
    }
    if (action === 'qa') {
      const qa = runRawQA();
      return { target, action, data: qa, summary: formatQA('Raw Website', qa), sources };
    }
    if (action === 'task') {
      // SEO post scheduling — needs approval
      const draft = { title: extractTaskTitle(message), project: 'raw-website', type: 'seo-post' };
      const approval = enqueue({
        risk_level: 2, category: 'content', target: 'raw-website',
        description: `Schedule SEO post for Raw Sushi: "${draft.title}"`,
        rollback_plan: 'Delete drafted post',
      });
      return { target, action, data: draft, summary: `📝 SEO post drafted for Raw Sushi — chờ approval #${approval.id}`, requires_approval: true, approval_id: approval.id, sources };
    }
    // default: status
    const status = getCachedRawWebsite();
    if (!status) { const snap = syncRawWebsite(); return { target, action: 'status', data: snap, summary: snap.summary_text, sources }; }
    return { target, action: 'status', data: status, summary: status.summary_text, sources };
  }

  // ── BAKUDAN WEBSITE ──
  if (target === 'bakudan-website') {
    sources.push('bakudan-website-connector');
    if (action === 'pull') {
      const snap = await syncBakudanWebsite();
      return { target, action, data: snap, summary: snap.summary_text, sources };
    }
    if (action === 'qa') {
      await syncBakudanWebsite();
      const qa = runBakudanQA();
      return { target, action, data: qa, summary: formatQA('Bakudan Website', qa), sources };
    }
    if (action === 'execute') {
      // Price/menu change — needs approval
      const approval = enqueue({
        risk_level: 2, category: 'content', target: 'bakudan-website',
        description: `Website change: ${message.slice(0, 100)}`,
        rollback_plan: 'git revert last commit',
      });
      return { target, action, data: {}, summary: `⚠ Change queued for approval #${approval.id}`, requires_approval: true, approval_id: approval.id, sources };
    }
    const status = getCachedBakudanWebsite() || await syncBakudanWebsite();
    return { target, action: 'status', data: status, summary: status.summary_text, sources };
  }

  // ── DASHBOARD ──
  if (target === 'dashboard') {
    sources.push('dashboard-connector');
    if (action === 'pull') {
      const snap = await syncDashboardProject();
      return { target, action, data: snap, summary: snap.summary_text, sources };
    }
    if (action === 'qa') {
      await syncDashboardProject();
      const qa = runDashboardQA();
      return { target, action, data: qa, summary: formatQA('Dashboard', qa), sources };
    }
    if (action === 'task') {
      const taskTitle = extractTaskTitle(message);
      const assignee  = extractAssignee(message);
      const draft = createTaskDraft({ title: taskTitle, assignee });
      const approval = enqueue({
        risk_level: 2, category: 'task-management', target: 'dashboard',
        description: `Create task: "${taskTitle}"${assignee ? ` → ${assignee}` : ''}`,
        rollback_plan: 'Delete task from dashboard',
      });
      return { target, action, data: draft, summary: `✅ Task draft: "${taskTitle}" — approval #${approval.id} required`, requires_approval: true, approval_id: approval.id, sources };
    }
    const status = getCachedDashboardProject() || await syncDashboardProject();
    return { target, action: 'status', data: status, summary: status.summary_text, sources };
  }

  // ── REMOTE: INTEGRATION-SYSTEM ──
  if (target === 'integration-system') {
    sources.push('remote-proxy-connector');
    if (action === 'pull') {
      const snap = await syncRemoteProject('integration-system');
      return { target, action, data: snap, summary: snap.summary_text, sources };
    }
    if (action === 'qa') {
      const result = await runRemoteQA('integration-system');
      return { target, action, data: result, summary: formatRemoteQA('Integration System', result), sources };
    }
    if (action === 'execute') {
      const approval = enqueue({
        risk_level: 3, category: 'remote-action', target: 'integration-system',
        description: `Remote action on integration-system: ${message.slice(0, 100)}`,
        rollback_plan: 'Revert via remote agent',
      });
      return { target, action, data: {}, summary: `🔒 Remote Level-3 action — approval #${approval.id}`, requires_approval: true, approval_id: approval.id, sources };
    }
    const cached = getCachedRemote('integration-system');
    const status = cached || await syncRemoteProject('integration-system');
    return { target, action: 'status', data: status, summary: status.summary_text, sources };
  }

  // ── REMOTE: WHATSAPP-API ──
  if (target === 'whatsapp-api') {
    sources.push('remote-proxy-connector');
    if (action === 'pull') {
      const snap = await syncRemoteProject('whatsapp-api');
      return { target, action, data: snap, summary: snap.summary_text, sources };
    }
    if (action === 'qa') {
      const result = await runRemoteQA('whatsapp-api');
      return { target, action, data: result, summary: formatRemoteQA('WhatsApp API', result), sources };
    }
    const cached = getCachedRemote('whatsapp-api');
    const status = cached || await syncRemoteProject('whatsapp-api');
    return { target, action: 'status', data: status, summary: status.summary_text, sources };
  }

  // ── UNKNOWN — try project scanner ──
  const project = getProjectById(message.split(' ').find(w => w.length > 3) || '');
  if (project) {
    return { target: 'unknown', action: 'status', data: project, summary: formatSingleProject(project), sources: ['project-scanner'] };
  }

  return {
    target: 'unknown', action: 'status', data: null,
    summary: `Mi không nhận dạng được project trong lệnh: "${message}"\nThử: "Check Raw website", "Check Dashboard", "Scan all projects"`,
    sources: [],
  };
}

// ── Connector Health Board ────────────────────────────────────────────────────
export async function getConnectorHealthBoard(): Promise<string> {
  const [remoteStatuses, rawSnap, bakudanSnap, dashSnap] = await Promise.all([
    getAllRemoteStatuses(),
    Promise.resolve(getCachedRawWebsite()),
    Promise.resolve(getCachedBakudanWebsite()),
    Promise.resolve(getCachedDashboardProject()),
  ]);

  const lines = ['🔌 CONNECTOR HEALTH BOARD', ''];
  lines.push('LOCAL CONNECTORS:');
  lines.push(`  Raw Website:    ${rawSnap    ? (rawSnap.git_dirty ? '⚠ dirty' : '✓ synced') : '○ not synced'}`);
  lines.push(`  Bakudan Web:    ${bakudanSnap ? (bakudanSnap.server_live ? '✓ live' : '⚠ server down') : '○ not synced'}`);
  lines.push(`  Dashboard:      ${dashSnap    ? (dashSnap.api_live ? '✓ API live' : '⚠ API down') : '○ not synced'}`);
  lines.push('');
  lines.push('REMOTE CONNECTORS:');
  for (const rs of remoteStatuses) {
    const icon = rs.reachable ? '✓' : (rs.error?.includes('not configured') ? '○' : '✗');
    lines.push(`  ${rs.name.padEnd(20)} ${icon} ${rs.reachable ? rs.host : (rs.error || 'unreachable')}`);
  }
  return lines.join('\n');
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatProjectList(projects: ProjectInfo[]): string {
  const local  = projects.filter(p => p.location === 'local');
  const remote = projects.filter(p => p.location === 'remote');
  const dirty  = projects.filter(p => p.git_dirty);
  const lines = [`📦 Master Workspace — ${projects.length} projects`];
  lines.push('');
  lines.push('LOCAL:');
  for (const p of local.slice(0, 20)) {
    lines.push(`  ${p.name.padEnd(35)} [${p.framework}] ${p.git_dirty ? '⚠ dirty' : ''}`);
  }
  if (remote.length) {
    lines.push('');
    lines.push('REMOTE:');
    for (const p of remote) lines.push(`  ${p.name.padEnd(35)} [${p.machine}]`);
  }
  if (dirty.length) {
    lines.push('');
    lines.push(`⚠ Uncommitted changes: ${dirty.map(p => p.name).join(', ')}`);
  }
  return lines.join('\n');
}

function formatSingleProject(p: ProjectInfo): string {
  return [
    `📁 ${p.name}`,
    `  Path: ${p.relative_path}`,
    `  Type: ${p.type} | Framework: ${p.framework}`,
    `  Git: ${p.git_branch} ${p.git_dirty ? '(dirty)' : '(clean)'}`,
    `  Start: ${p.start_cmd || 'none'}`,
    `  Location: ${p.location} (${p.machine})`,
  ].join('\n');
}

function formatQA(name: string, qa: { score: number; issues: string[]; passed: string[] }): string {
  const lines = [`🧪 QA: ${name} — Score: ${qa.score}%`];
  if (qa.passed.length) lines.push('  ✓ ' + qa.passed.join('\n  ✓ '));
  if (qa.issues.length) lines.push('  ✗ ' + qa.issues.join('\n  ✗ '));
  return lines.join('\n');
}

function formatRemoteQA(name: string, result: unknown): string {
  if (!result || typeof result !== 'object') return `🧪 QA ${name}: No result`;
  const r = result as Record<string, unknown>;
  if (r.error) return `🧪 QA ${name}: ✗ ${r.error}`;
  return `🧪 QA ${name}: ${r.passed ? '✓ Passed' : '✗ Failed'} — ${r.message || JSON.stringify(r).slice(0, 200)}`;
}

function extractTaskTitle(message: string): string {
  const match = message.match(/task[:\s]+["']?(.+?)["']?$|tạo task[:\s]+(.+?)$/i);
  return (match?.[1] || match?.[2] || message).trim().slice(0, 100);
}

function extractAssignee(message: string): string {
  const match = message.match(/for\s+([A-Za-z]+)|cho\s+([A-Za-z]+)|giao.*cho\s+([A-Za-z]+)/i);
  return match?.[1] || match?.[2] || match?.[3] || '';
}

function saveProjectRegistry(projects: ProjectInfo[]) {
  const registryPath = path.join(GLOBAL_DIR, 'mi-core', 'project-connectors.json');
  const existing: { connectors: unknown[] } = fs.existsSync(registryPath)
    ? JSON.parse(fs.readFileSync(registryPath, 'utf-8'))
    : { connectors: [] };

  // Merge scanned projects with existing connector configs
  const connectors = projects.map(p => ({
    project_id:    p.project_id,
    name:          p.name,
    path:          p.path,
    location_type: p.location,
    machine_name:  p.machine,
    host:          p.location === 'remote' ? '' : 'localhost',
    port:          p.ports[0] || null,
    connector_url: p.health_url,
    auth_status:   'connected',
    read_status:   'enabled',
    write_status:  'requires_approval',
    health_status: 'unknown',
    last_sync:     new Date().toISOString(),
    approval_required: p.location === 'remote' || ['deploy', 'production'].some(k => p.name.includes(k)),
  }));

  const outRegistry = { updated_at: new Date().toISOString(), total: connectors.length, connectors };
  fs.writeFileSync(registryPath, JSON.stringify(outRegistry, null, 2));
}
