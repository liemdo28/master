/**
 * Mi Company OS — Tool Registry (Phase 2)
 * Full spec: tool_id, owner_department, execution_method, credential_status,
 *            approval_required, evidence_output, failure_policy
 */

import path from 'path';

const DATA_ROOT = process.env.DATA_ROOT || 'E:/Project/Master/.local-agent-global';
const MI_PORT   = process.env.MI_PORT   || '4001';
const BASE_URL  = `http://localhost:${MI_PORT}`;

export type CredentialStatus = 'CONFIGURED' | 'MISSING' | 'DEGRADED' | 'EXTERNAL';
export type FailurePolicy    = 'SKIP' | 'ABORT' | 'FALLBACK' | 'ALERT_CEO';
export type ExecutionMethod  = 'HTTP_API' | 'SQLITE_DIRECT' | 'REQUIRE_MODULE' | 'CLI' | 'PLAYWRIGHT' | 'EXTERNAL_API';

export interface Tool {
  id: string;
  name: string;
  description: string;
  owner_department: string;
  execution_method: ExecutionMethod;
  credential_status: CredentialStatus;
  approval_required: boolean;
  evidence_output: boolean;
  failure_policy: FailurePolicy;
  call: (args?: Record<string, unknown>) => Promise<unknown>;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

async function localGet(endpoint: string): Promise<unknown> {
  const apiKey = process.env.MI_CORE_API_KEY || '';
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: { 'x-api-key': apiKey, 'x-mi-auth': apiKey },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`${endpoint} → ${res.status}`);
  return res.json();
}

// ── Tool implementations ──────────────────────────────────────────────────────

const TOOL_CATALOG: Record<string, Tool> = {

  // ── Executive Assistant tools ─────────────────────────────────────────────
  'task-snapshot': {
    id: 'task-snapshot', name: 'Task Snapshot',
    description: 'Full operational snapshot: work orders, approvals, blockers',
    owner_department: 'executive-assistant',
    execution_method: 'HTTP_API', credential_status: 'CONFIGURED',
    approval_required: false, evidence_output: true, failure_policy: 'SKIP',
    call: () => localGet('/api/tasks/snapshot'),
  },
  'task-today': {
    id: 'task-today', name: 'Today Tasks',
    description: "CEO's tasks for today from SQLite",
    owner_department: 'executive-assistant',
    execution_method: 'HTTP_API', credential_status: 'CONFIGURED',
    approval_required: false, evidence_output: true, failure_policy: 'SKIP',
    call: () => localGet('/api/tasks/today'),
  },
  'task-approvals': {
    id: 'task-approvals', name: 'Pending Approvals',
    description: 'Work orders waiting for CEO approval',
    owner_department: 'executive-assistant',
    execution_method: 'HTTP_API', credential_status: 'CONFIGURED',
    approval_required: false, evidence_output: true, failure_policy: 'SKIP',
    call: () => localGet('/api/tasks/approvals'),
  },
  'health-intel': {
    id: 'health-intel', name: 'Health Intelligence',
    description: 'CEO biometric data: sleep, HRV, steps from Apple/Huawei export',
    owner_department: 'executive-assistant',
    execution_method: 'HTTP_API', credential_status: 'CONFIGURED',
    approval_required: false, evidence_output: false, failure_policy: 'SKIP',
    call: () => localGet('/api/health-intel/latest'),
  },
  'gmail': {
    id: 'gmail', name: 'Gmail Reader',
    description: 'Read CEO emails from last 48 hours, classify important ones',
    owner_department: 'executive-assistant',
    execution_method: 'EXTERNAL_API', credential_status: 'CONFIGURED',
    approval_required: false, evidence_output: true, failure_policy: 'ALERT_CEO',
    call: () => localGet('/api/gmail/recent'),
  },
  'calendar': {
    id: 'calendar', name: 'Calendar Summary',
    description: 'CEO calendar events and upcoming meetings',
    owner_department: 'executive-assistant',
    execution_method: 'EXTERNAL_API', credential_status: 'CONFIGURED',
    approval_required: false, evidence_output: true, failure_policy: 'SKIP',
    call: () => localGet('/api/calendar/summary'),
  },

  // ── Finance tools ─────────────────────────────────────────────────────────
  'quickbooks': {
    id: 'quickbooks', name: 'QuickBooks',
    description: 'P&L, cash flow, expenses from QuickBooks Online',
    owner_department: 'finance',
    execution_method: 'EXTERNAL_API', credential_status: 'CONFIGURED',
    approval_required: true, evidence_output: true, failure_policy: 'ABORT',
    call: () => localGet('/api/quickbooks/summary'),
  },
  'toast-pos': {
    id: 'toast-pos', name: 'Toast POS',
    description: 'Restaurant sales data from Toast POS',
    owner_department: 'finance',
    execution_method: 'EXTERNAL_API', credential_status: 'CONFIGURED',
    approval_required: false, evidence_output: true, failure_policy: 'FALLBACK',
    call: () => localGet('/api/toast/summary'),
  },
  'accounting-engine': {
    id: 'accounting-engine', name: 'Accounting Engine',
    description: 'Local accounting engine API (port 8844)',
    owner_department: 'finance',
    execution_method: 'HTTP_API', credential_status: 'CONFIGURED',
    approval_required: false, evidence_output: true, failure_policy: 'ALERT_CEO',
    call: async () => {
      const res = await fetch('http://localhost:8844/api/summary', { signal: AbortSignal.timeout(10_000) });
      return res.json();
    },
  },
  'pdf-evidence': {
    id: 'pdf-evidence', name: 'PDF Evidence',
    description: 'Read financial PDFs and extract evidence',
    owner_department: 'finance',
    execution_method: 'REQUIRE_MODULE', credential_status: 'CONFIGURED',
    approval_required: true, evidence_output: true, failure_policy: 'ABORT',
    call: async (args) => ({ status: 'pdf_reader_pending', path: args?.path }),
  },

  // ── Operations tools ──────────────────────────────────────────────────────
  'visibility-dashboard': {
    id: 'visibility-dashboard', name: 'Visibility Dashboard',
    description: 'Cross-system connector status and metrics',
    owner_department: 'technical-operations',
    execution_method: 'HTTP_API', credential_status: 'CONFIGURED',
    approval_required: false, evidence_output: true, failure_policy: 'SKIP',
    call: () => localGet('/api/visibility/dashboard'),
  },
  'food-safety': {
    id: 'food-safety', name: 'Food Safety Gateway',
    description: 'Food safety compliance data and violations',
    owner_department: 'restaurant-intelligence',
    execution_method: 'HTTP_API', credential_status: 'CONFIGURED',
    approval_required: false, evidence_output: true, failure_policy: 'SKIP',
    call: () => localGet('/api/food-safety/latest'),
  },
  'doordash': {
    id: 'doordash', name: 'DoorDash',
    description: 'DoorDash order and campaign data',
    owner_department: 'restaurant-intelligence',
    execution_method: 'EXTERNAL_API', credential_status: 'CONFIGURED',
    approval_required: false, evidence_output: true, failure_policy: 'FALLBACK',
    call: () => localGet('/api/doordash/summary'),
  },
  'review-system': {
    id: 'review-system', name: 'Review Management System',
    description: 'Customer review analysis and response system',
    owner_department: 'marketing',
    execution_method: 'HTTP_API', credential_status: 'CONFIGURED',
    approval_required: false, evidence_output: true, failure_policy: 'SKIP',
    call: async () => {
      const res = await fetch('http://localhost:8000/api/reviews/summary', { signal: AbortSignal.timeout(10_000) });
      return res.json();
    },
  },

  // ── Engineering tools ─────────────────────────────────────────────────────
  'git': {
    id: 'git', name: 'Git',
    description: 'Git status, log, diff for project audit',
    owner_department: 'engineering',
    execution_method: 'CLI', credential_status: 'CONFIGURED',
    approval_required: false, evidence_output: true, failure_policy: 'SKIP',
    call: (args) => {
      const { execSync } = require('child_process');
      const repo = String(args?.repo || 'E:/Project/Master/mi-core');
      const cmd = String(args?.cmd || 'status --short');
      const out = execSync(`git -C "${repo}" ${cmd}`, { encoding: 'utf8', timeout: 10_000 });
      return Promise.resolve({ output: out });
    },
  },
  'build': {
    id: 'build', name: 'Build',
    description: 'Run TypeScript compile for a project',
    owner_department: 'engineering',
    execution_method: 'CLI', credential_status: 'CONFIGURED',
    approval_required: true, evidence_output: true, failure_policy: 'ABORT',
    call: async (args) => ({ status: 'build_pending', project: args?.project }),
  },
  'logs': {
    id: 'logs', name: 'Log Reader',
    description: 'Read PM2 logs for a service',
    owner_department: 'engineering',
    execution_method: 'CLI', credential_status: 'CONFIGURED',
    approval_required: false, evidence_output: true, failure_policy: 'SKIP',
    call: (args) => {
      const { execSync } = require('child_process');
      const service = String(args?.service || 'mi-core');
      const lines = Number(args?.lines || 50);
      try {
        const out = execSync(`pm2 logs ${service} --lines ${lines} --nostream`, { encoding: 'utf8', timeout: 10_000 });
        return Promise.resolve({ service, lines: out.split('\n').slice(-lines) });
      } catch { return Promise.resolve({ service, error: 'log_unavailable' }); }
    },
  },

  // ── Infrastructure tools ──────────────────────────────────────────────────
  'pm2-status': {
    id: 'pm2-status', name: 'PM2 Status',
    description: 'Running process status from PM2',
    owner_department: 'infrastructure',
    execution_method: 'HTTP_API', credential_status: 'CONFIGURED',
    approval_required: false, evidence_output: true, failure_policy: 'SKIP',
    call: () => localGet('/api/nodes/pm2'),
  },
  'node-registry': {
    id: 'node-registry', name: 'Node Registry',
    description: 'Multi-device node registration status',
    owner_department: 'infrastructure',
    execution_method: 'HTTP_API', credential_status: 'CONFIGURED',
    approval_required: false, evidence_output: false, failure_policy: 'SKIP',
    call: () => localGet('/api/nodes/registry'),
  },
  'health-checks': {
    id: 'health-checks', name: 'Health Checks',
    description: 'Live health check all registered services',
    owner_department: 'infrastructure',
    execution_method: 'HTTP_API', credential_status: 'CONFIGURED',
    approval_required: false, evidence_output: true, failure_policy: 'ALERT_CEO',
    call: () => localGet('/api/company-os/services/health'),
  },
  'docker': {
    id: 'docker', name: 'Docker',
    description: 'Docker container status',
    owner_department: 'infrastructure',
    execution_method: 'CLI', credential_status: 'CONFIGURED',
    approval_required: false, evidence_output: true, failure_policy: 'SKIP',
    call: async () => {
      const { execSync } = require('child_process');
      try {
        const out = execSync('docker ps --format "{{json .}}"', { encoding: 'utf8', timeout: 5_000 });
        return { containers: out.trim().split('\n').filter(Boolean).map((l: string) => JSON.parse(l)) };
      } catch { return { containers: [], error: 'docker_unavailable' }; }
    },
  },

  // ── Intelligence / Memory tools ───────────────────────────────────────────
  'briefing-latest': {
    id: 'briefing-latest', name: 'Latest Briefing',
    description: 'Most recent daily executive briefing',
    owner_department: 'report-center',
    execution_method: 'HTTP_API', credential_status: 'CONFIGURED',
    approval_required: false, evidence_output: false, failure_policy: 'SKIP',
    call: () => localGet('/api/briefing/latest'),
  },
  'strategic-memory': {
    id: 'strategic-memory', name: 'Strategic Memory',
    description: 'Long-term business trends and insights',
    owner_department: 'report-center',
    execution_method: 'HTTP_API', credential_status: 'CONFIGURED',
    approval_required: false, evidence_output: false, failure_policy: 'SKIP',
    call: () => localGet('/api/strategic/trends'),
  },
  'agenview-snapshot': {
    id: 'agenview-snapshot', name: 'AgenView Snapshot',
    description: 'CEO system dashboard snapshot',
    owner_department: 'report-center',
    execution_method: 'HTTP_API', credential_status: 'CONFIGURED',
    approval_required: false, evidence_output: false, failure_policy: 'SKIP',
    call: () => localGet('/api/agenview/snapshot'),
  },
  'pipeline-history': {
    id: 'pipeline-history', name: 'Pipeline History',
    description: 'Recent Company OS pipeline runs',
    owner_department: 'qa',
    execution_method: 'HTTP_API', credential_status: 'CONFIGURED',
    approval_required: false, evidence_output: false, failure_policy: 'SKIP',
    call: () => localGet('/api/company-os/pipelines'),
  },
  'evidence-reader': {
    id: 'evidence-reader', name: 'Evidence Reader',
    description: 'Read execution evidence from SQLite (QA use)',
    owner_department: 'qa',
    execution_method: 'SQLITE_DIRECT', credential_status: 'CONFIGURED',
    approval_required: false, evidence_output: false, failure_policy: 'ABORT',
    call: (args) => {
      const { recentPipelineRuns, getPipelineRun, getStepsForPipeline } = require('./evidence-store');
      if (args?.pipeline_id) {
        return Promise.resolve({ run: getPipelineRun(args.pipeline_id), steps: getStepsForPipeline(args.pipeline_id) });
      }
      return Promise.resolve({ recent: recentPipelineRuns(10) });
    },
  },
  'dept-definitions': {
    id: 'dept-definitions', name: 'Department Definitions',
    description: 'Read department registry from memory',
    owner_department: 'dispatch',
    execution_method: 'REQUIRE_MODULE', credential_status: 'CONFIGURED',
    approval_required: false, evidence_output: false, failure_policy: 'SKIP',
    call: () => Promise.resolve(require('./departments').DEPARTMENTS),
  },
  'source-inventory-reader': {
    id: 'source-inventory-reader', name: 'Source Inventory',
    description: 'Read tool/model/source classifications',
    owner_department: 'library',
    execution_method: 'REQUIRE_MODULE', credential_status: 'CONFIGURED',
    approval_required: false, evidence_output: false, failure_policy: 'SKIP',
    call: () => {
      const { SOURCE_INVENTORY, getRemoveCandidates } = require('./source-inventory');
      return Promise.resolve({ inventory: SOURCE_INVENTORY, remove: getRemoveCandidates() });
    },
  },
  'rag-search': {
    id: 'rag-search', name: 'RAG Search',
    description: 'Semantic search over knowledge base',
    owner_department: 'library',
    execution_method: 'HTTP_API', credential_status: 'CONFIGURED',
    approval_required: false, evidence_output: false, failure_policy: 'SKIP',
    call: (args) => localGet(`/api/knowledge/search?q=${encodeURIComponent(String(args?.query || ''))}`),
  },
  'document-search': {
    id: 'document-search', name: 'Document Search',
    description: 'Full-text search in knowledge DB',
    owner_department: 'library',
    execution_method: 'HTTP_API', credential_status: 'CONFIGURED',
    approval_required: false, evidence_output: false, failure_policy: 'SKIP',
    call: (args) => localGet(`/api/knowledge/docs?q=${encodeURIComponent(String(args?.query || ''))}`),
  },

  // ── Creative tools ────────────────────────────────────────────────────────
  'comfyui': {
    id: 'comfyui', name: 'ComfyUI',
    description: 'Image generation via ComfyUI workflow',
    owner_department: 'brand-creative',
    execution_method: 'HTTP_API', credential_status: 'MISSING',
    approval_required: true, evidence_output: true, failure_policy: 'ALERT_CEO',
    call: async () => ({ status: 'comfyui_not_installed', action: 'Phase 10 — requires ComfyUI setup' }),
  },
  'flux': {
    id: 'flux', name: 'Flux Image Generation',
    description: 'High-quality image generation via Flux model',
    owner_department: 'brand-creative',
    execution_method: 'HTTP_API', credential_status: 'MISSING',
    approval_required: true, evidence_output: true, failure_policy: 'ALERT_CEO',
    call: async () => ({ status: 'flux_not_installed', action: 'Phase 10 — requires Flux setup' }),
  },
  'restaurant-creative-engine': {
    id: 'restaurant-creative-engine', name: 'Restaurant Creative Engine',
    description: 'Generate restaurant-specific flyers and social content',
    owner_department: 'brand-creative',
    execution_method: 'HTTP_API', credential_status: 'MISSING',
    approval_required: true, evidence_output: true, failure_policy: 'SKIP',
    call: async () => ({ status: 'creative_engine_pending', action: 'Phase 10' }),
  },
};

// ── Department → tool mapping ─────────────────────────────────────────────────

const DEPT_TOOLS: Record<string, string[]> = {
  'dispatch':               ['dept-definitions', 'pipeline-history'],
  'executive-assistant':    ['task-snapshot', 'task-today', 'task-approvals', 'health-intel', 'gmail', 'calendar'],
  'report-center':          ['briefing-latest', 'visibility-dashboard', 'agenview-snapshot', 'strategic-memory', 'pipeline-history'],
  'library':                ['dept-definitions', 'source-inventory-reader', 'rag-search', 'document-search'],
  'qa':                     ['evidence-reader', 'pipeline-history'],
  'finance':                ['visibility-dashboard', 'strategic-memory', 'quickbooks', 'toast-pos', 'accounting-engine', 'pdf-evidence'],
  'tax-compliance':         ['quickbooks', 'pdf-evidence', 'accounting-engine'],
  'restaurant-intelligence':['visibility-dashboard', 'toast-pos', 'doordash', 'food-safety'],
  'engineering':            ['pipeline-history', 'evidence-reader', 'git', 'build', 'logs'],
  'infrastructure':         ['pm2-status', 'node-registry', 'visibility-dashboard', 'health-checks', 'docker'],
  'marketing':              ['strategic-memory', 'visibility-dashboard', 'doordash', 'review-system'],
  'brand-creative':         ['strategic-memory', 'comfyui', 'flux', 'restaurant-creative-engine'],
  'technical-operations':   ['pm2-status', 'node-registry', 'visibility-dashboard', 'health-checks'],
  'rd':                     ['source-inventory-reader', 'dept-definitions', 'strategic-memory', 'rag-search'],
};

export function getToolsForDept(deptId: string): Tool[] {
  const ids = DEPT_TOOLS[deptId] || [];
  return ids.map(id => TOOL_CATALOG[id]).filter(Boolean);
}

export function getTool(toolId: string): Tool | undefined {
  return TOOL_CATALOG[toolId];
}

export function listAllTools(): Tool[] {
  return Object.values(TOOL_CATALOG);
}

export function getToolPermissionMatrix(): Array<{
  tool_id: string; owner: string; approval: boolean; evidence: boolean; credential: string; failure: string;
}> {
  return Object.values(TOOL_CATALOG).map(t => ({
    tool_id: t.id, owner: t.owner_department,
    approval: t.approval_required, evidence: t.evidence_output,
    credential: t.credential_status, failure: t.failure_policy,
  }));
}

export async function gatherToolContext(deptId: string, args?: Record<string, unknown>): Promise<{
  context: string; tools_used: string[]; tools_failed: string[];
}> {
  const tools = getToolsForDept(deptId);
  const sections: string[] = [];
  const used: string[] = [];
  const failed: string[] = [];

  await Promise.all(tools.map(async tool => {
    try {
      const data = await tool.call(args);
      const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
      sections.push(`=== ${tool.name} ===\n${text.substring(0, 800)}`);
      used.push(tool.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      sections.push(`=== ${tool.name} ===\n[unavailable: ${msg}]`);
      // Apply failure policy
      if (tool.failure_policy === 'ALERT_CEO') {
        sections.push(`[ALERT: ${tool.name} is DOWN — CEO should be notified]`);
      }
      failed.push(tool.id);
    }
  }));

  return { context: sections.join('\n\n'), tools_used: used, tools_failed: failed };
}
