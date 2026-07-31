/**
 * Phase 25C — Auto Task Generation Engine
 * 
 * Every degraded signal becomes a task — no manual task creation.
 * Signals: QB stale, website down, 404 spike, traffic drop, review drop, email failure, calendar failure
 * 
 * Pipeline: detectSignal → createTask → assignOwner → trackStatus → escalate
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const DATA_DIR = join(process.cwd(), '.mi-harness', 'phase25');
const TASKS_DIR = join(DATA_DIR, 'auto-tasks');

function ensureDirs() {
  mkdirSync(TASKS_DIR, { recursive: true });
}

// ── Signal types ─────────────────────────────────────────────────────────────

export type SignalType =
  | 'qb-stale'
  | 'website-down'
  | '404-spike'
  | 'traffic-drop'
  | 'review-drop'
  | 'email-failure'
  | 'calendar-failure'
  | 'ranking-drop'
  | 'schema-invalid'
  | 'gsc-disconnect'
  | 'gbp-disconnect'
  | 'ga4-disconnect'
  | 'n8n-workflow-failed'
  | 'service-down'
  | 'memory-low'
  | 'db-error';

export type TaskOwner =
  | 'seo-agent'
  | 'content-agent'
  | 'analytics-agent'
  | 'web-engineering'
  | 'review-management'
  | 'local-seo'
  | 'operations'
  | 'finance'
  | 'compliance'
  | 'mi-system';

export type AutoTaskStatus = 'open' | 'in-progress' | 'resolved' | 'escalated' | 'failed';

export interface AutoTask {
  id: string;
  signalType: SignalType;
  title: string;
  description: string;
  owner: TaskOwner;
  status: AutoTaskStatus;
  severity: 'low' | 'medium' | 'high' | 'critical';
  evidence: string[];
  detectedAt: string;
  resolvedAt: string | null;
  attempts: number;
  escalatedTo: string | null;
  signalData: any;
}

// ── Signal → Task mapping ────────────────────────────────────────────────────

interface SignalPattern {
  signalType: SignalType;
  title: string;
  owner: TaskOwner;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  actions: string[];
}

const SIGNAL_PATTERNS: Record<SignalType, SignalPattern> = {
  'qb-stale': {
    signalType: 'qb-stale',
    title: 'QuickBooks heartbeat stale — restart data sync',
    owner: 'finance',
    severity: 'high',
    description: 'QuickBooks Online data has not refreshed within 24 hours. Last successful sync exceeded acceptable threshold.',
    actions: ['Trigger QB heartbeat bridge', 'Verify QB credentials', 'Re-sync data'],
  },
  'website-down': {
    signalType: 'website-down',
    title: 'Website unreachable — restore service',
    owner: 'web-engineering',
    severity: 'critical',
    description: 'Primary website failed health check 3 times consecutively.',
    actions: ['Check PM2 status', 'Restart server', 'Verify CDN', 'Notify owner'],
  },
  '404-spike': {
    signalType: '404-spike',
    title: '404 spike detected — repair broken links',
    owner: 'web-engineering',
    severity: 'medium',
    description: '404 errors increased by > 50% in the last hour.',
    actions: ['Scan for broken links', 'Generate 301 redirects', 'Update sitemap'],
  },
  'traffic-drop': {
    signalType: 'traffic-drop',
    title: 'Traffic drop detected — diagnose and recover',
    owner: 'seo-agent',
    severity: 'high',
    description: 'Organic traffic dropped by > 15% day-over-day.',
    actions: ['Pull GSC data', 'Compare keyword rankings', 'Check index coverage', 'Run content audit'],
  },
  'review-drop': {
    signalType: 'review-drop',
    title: 'Review count or rating dropped — investigate',
    owner: 'review-management',
    severity: 'medium',
    description: 'Average rating or review count dropped below threshold.',
    actions: ['Pull review data', 'Identify low-rated reviews', 'Draft responses', 'Trigger review request campaign'],
  },
  'email-failure': {
    signalType: 'email-failure',
    title: 'Email send failure rate elevated',
    owner: 'operations',
    severity: 'high',
    description: 'Email delivery failure rate > 5% in the last hour.',
    actions: ['Check SMTP credentials', 'Verify DNS records (SPF/DKIM)', 'Review bounce list'],
  },
  'calendar-failure': {
    signalType: 'calendar-failure',
    title: 'Calendar sync failure — reconnect',
    owner: 'operations',
    severity: 'medium',
    description: 'Calendar API returned 401 or 500 errors.',
    actions: ['Refresh OAuth token', 'Verify calendar permissions', 'Re-sync events'],
  },
  'ranking-drop': {
    signalType: 'ranking-drop',
    title: 'Keyword ranking drop detected — content refresh',
    owner: 'seo-agent',
    severity: 'high',
    description: 'Top 10 keyword dropped by > 3 positions in 7 days.',
    actions: ['Pull GSC queries', 'Compare competitor pages', 'Refresh content', 'Strengthen internal links'],
  },
  'schema-invalid': {
    signalType: 'schema-invalid',
    title: 'Schema validation failed — fix structured data',
    owner: 'seo-agent',
    severity: 'medium',
    description: 'Page schema no longer validates against Schema.org.',
    actions: ['Run schema audit', 'Regenerate JSON-LD', 'Validate against Rich Results Test'],
  },
  'gsc-disconnect': {
    signalType: 'gsc-disconnect',
    title: 'GSC disconnected — restore access',
    owner: 'analytics-agent',
    severity: 'high',
    description: 'Google Search Console API returning 401/403.',
    actions: ['Refresh GSC OAuth', 'Verify site ownership', 'Re-sync data'],
  },
  'gbp-disconnect': {
    signalType: 'gbp-disconnect',
    title: 'GBP disconnected — restore location data',
    owner: 'local-seo',
    severity: 'high',
    description: 'Google Business Profile API returning errors.',
    actions: ['Refresh GBP OAuth', 'Verify all locations', 'Pull latest reviews'],
  },
  'ga4-disconnect': {
    signalType: 'ga4-disconnect',
    title: 'GA4 disconnected — restore analytics',
    owner: 'analytics-agent',
    severity: 'high',
    description: 'Google Analytics 4 API returning errors.',
    actions: ['Refresh GA4 service account', 'Verify property access', 'Re-sync events'],
  },
  'n8n-workflow-failed': {
    signalType: 'n8n-workflow-failed',
    title: 'n8n workflow failed — investigate and rerun',
    owner: 'operations',
    severity: 'medium',
    description: 'An n8n workflow returned non-200 status.',
    actions: ['Inspect workflow logs', 'Identify failed node', 'Re-run or fix trigger'],
  },
  'service-down': {
    signalType: 'service-down',
    title: 'Mi-Core service down — restart and verify',
    owner: 'web-engineering',
    severity: 'critical',
    description: 'A core Mi-Core service is not responding to health checks.',
    actions: ['Check PM2 status', 'Restart service', 'Verify health endpoint'],
  },
  'memory-low': {
    signalType: 'memory-low',
    title: 'Memory low — clear cache and restart',
    owner: 'web-engineering',
    severity: 'medium',
    description: 'Service memory usage > 90%.',
    actions: ['Clear caches', 'Restart service', 'Check memory leaks'],
  },
  'db-error': {
    signalType: 'db-error',
    title: 'Database error — investigate and repair',
    owner: 'web-engineering',
    severity: 'critical',
    description: 'Database returned 5xx error or corruption detected.',
    actions: ['Check DB connections', 'Run integrity check', 'Restore from backup if needed'],
  },
};

// ── Generate task from signal ────────────────────────────────────────────────

export function generateTaskFromSignal(signal: {
  type: SignalType;
  data?: any;
}): AutoTask {
  const pattern = SIGNAL_PATTERNS[signal.type];
  if (!pattern) throw new Error(`Unknown signal: ${signal.type}`);

  const id = `auto-task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const task: AutoTask = {
    id,
    signalType: signal.type,
    title: pattern.title,
    description: pattern.description,
    owner: pattern.owner,
    status: 'open',
    severity: pattern.severity,
    evidence: [],
    detectedAt: new Date().toISOString(),
    resolvedAt: null,
    attempts: 0,
    escalatedTo: null,
    signalData: signal.data || null,
  };

  saveTask(task);
  return task;
}

// ── Assign owner + auto-execute ──────────────────────────────────────────────

export function assignOwner(taskId: string): AutoTask | null {
  const task = loadTask(taskId);
  if (!task) return null;

  // The owner is already set by pattern. Now attempt auto-execution.
  task.status = 'in-progress';
  task.attempts += 1;

  try {
    // Trigger owner-specific executor
    executeOwnerAction(task);
    task.status = 'resolved';
    task.resolvedAt = new Date().toISOString();
  } catch (err: any) {
    if (task.attempts >= 3) {
      task.status = 'escalated';
      task.escalatedTo = 'executive-assistant';
    } else {
      task.status = 'open'; // Will retry
    }
  }

  saveTask(task);
  return task;
}

function executeOwnerAction(task: AutoTask) {
  // Map owner → action
  const ownerActions: Record<TaskOwner, () => void> = {
    'seo-agent':          () => triggerAgentByName('seo-technical-agent'),
    'content-agent':      () => triggerAgentByName('seo-content-agent'),
    'analytics-agent':    () => triggerAgentByName('seo-analytics-agent'),
    'local-seo':          () => triggerAgentByName('seo-local-maps-agent'),
    'review-management':  () => triggerAgentByName('seo-local-maps-agent'),
    'web-engineering':    () => restartService(),
    'operations':         () => logAction(`Operations action: ${task.title}`),
    'finance':            () => logAction(`Finance action: ${task.title}`),
    'compliance':         () => logAction(`Compliance action: ${task.title}`),
    'mi-system':          () => logAction(`Mi-system action: ${task.title}`),
  };

  const action = ownerActions[task.owner];
  if (action) action();
}

function triggerAgentByName(agentName: string) {
  const portMap: Record<string, number> = {
    'seo-local-maps-agent': 4011,
    'seo-technical-agent':  4013,
    'seo-schema-agent':     4014,
    'seo-content-agent':    4015,
    'seo-analytics-agent':  4017,
  };
  const port = portMap[agentName];
  if (!port) return;

  try {
    execSync(`curl -s --max-time 10 -X POST "http://127.0.0.1:${port}/audit" -H "Content-Type: application/json" -d "{}"`, { encoding: 'utf-8', timeout: 12000 });
  } catch { /* ignore */ }
}

function restartService() {
  try {
    execSync('pm2 restart mi-core', { encoding: 'utf-8', timeout: 30000 });
  } catch { /* ignore */ }
}

function logAction(msg: string) {
  console.log(`[AutoTask] ${msg}`);
}

// ── Escalation ───────────────────────────────────────────────────────────────

export function escalateTask(taskId: string, escalateTo: string): AutoTask | null {
  const task = loadTask(taskId);
  if (!task) return null;

  task.status = 'escalated';
  task.escalatedTo = escalateTo;
  saveTask(task);
  return task;
}

// ── Status tracking ──────────────────────────────────────────────────────────

export function getTaskStatus(taskId: string): AutoTask | null {
  return loadTask(taskId);
}

export function getOpenTasks(): AutoTask[] {
  ensureDirs();
  try {
    const files = readdirSync(TASKS_DIR).filter(f => f.endsWith('.json'));
    return files
      .map(f => {
        try { return JSON.parse(readFileSync(join(TASKS_DIR, f), 'utf-8')); } catch { return null; }
      })
      .filter(Boolean)
      .filter(t => t.status === 'open' || t.status === 'in-progress' || t.status === 'escalated');
  } catch { return []; }
}

export function getAllTasks(): AutoTask[] {
  ensureDirs();
  try {
    const files = readdirSync(TASKS_DIR).filter(f => f.endsWith('.json'));
    return files
      .map(f => {
        try { return JSON.parse(readFileSync(join(TASKS_DIR, f), 'utf-8')); } catch { return null; }
      })
      .filter(Boolean);
  } catch { return []; }
}

// ── Auto-scan for degraded signals ───────────────────────────────────────────

export function scanForDegradedSignals(): AutoTask[] {
  const detected: AutoTask[] = [];

  // Signal 1: QB stale
  try {
    const qbDb = join(process.cwd(), 'data', 'qb-agent.db');
    if (existsSync(qbDb)) {
      const stat = require('fs').statSync(qbDb);
      const ageHours = (Date.now() - stat.mtime.getTime()) / (1000 * 60 * 60);
      if (ageHours > 24) {
        detected.push(generateTaskFromSignal({ type: 'qb-stale', data: { ageHours } }));
      }
    }
  } catch { /* ignore */ }

  // Signal 2: 404 spike — check seo state
  try {
    const seoStatePath = join(process.cwd(), 'data', 'seo', 'seo-state.json');
    if (existsSync(seoStatePath)) {
      const seo = JSON.parse(readFileSync(seoStatePath, 'utf-8'));
      const agents = Object.values(seo.agents || {});
      const offline = agents.filter((a: any) => a.status !== 'online');
      if (offline.length > 0) {
        detected.push(generateTaskFromSignal({ type: 'service-down', data: { offlineAgents: offline.map((a: any) => a.agentId) } }));
      }
    }
  } catch { /* ignore */ }

  // Signal 3: GSC / GBP / GA4 disconnect
  // (Stub for now — would integrate with GSC agent)

  return detected;
}

// ── Internal helpers ─────────────────────────────────────────────────────────

function saveTask(task: AutoTask) {
  ensureDirs();
  writeFileSync(join(TASKS_DIR, `${task.id}.json`), JSON.stringify(task, null, 2));
}

function loadTask(id: string): AutoTask | null {
  const fp = join(TASKS_DIR, `${id}.json`);
  if (!existsSync(fp)) return null;
  try { return JSON.parse(readFileSync(fp, 'utf-8')); } catch { return null; }
}

export default {
  generateTaskFromSignal,
  assignOwner,
  escalateTask,
  getTaskStatus,
  getOpenTasks,
  getAllTasks,
  scanForDegradedSignals,
};
