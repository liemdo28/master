import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { normalizeWorkflowRegistry } from './workflow-registry';
import type { WorkflowRegistryEntry } from './types';

function findProjectRoot(start = process.cwd()): string {
  let current = start;
  for (let i = 0; i < 6; i++) {
    if (existsSync(join(current, 'Mi')) && existsSync(join(current, 'mi-core'))) return current;
    const next = dirname(current);
    if (next === current) break;
    current = next;
  }
  return join(process.cwd(), '..');
}

function readJsonFile<T>(path: string, fallback: T): T {
  try {
    if (!existsSync(path)) return fallback;
    return JSON.parse(readFileSync(path, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

export interface WorkflowFabricStatus {
  final_status: 'READY' | 'PARTIAL' | 'BLOCKED';
  machine_registered_workflows: number;
  documented_workflows: number;
  imported_documented_workflows: number;
  missing_documented_workflows: string[];
  registry: WorkflowRegistryEntry[];
  routes: {
    log: string;
    status: string;
  };
  blockers: string[];
}

const documentedWorkflowIds = [
  'exec-daily-brief',
  'exec-weekly-brief',
  'exec-monthly-report',
  'finance-qb-sync',
  'finance-tax-reminder',
  'finance-payroll-reminder',
  'ops-daily-store-health',
  'ops-compliance-summary',
  'ops-missed-task-alert',
  'mkt-seo-summary',
  'mkt-review-summary',
  'mkt-campaign-summary',
  'eng-pm2-health',
  'eng-build-monitor',
  'eng-error-monitor',
];

export function buildWorkflowFabricStatus(projectRoot = findProjectRoot()): WorkflowFabricStatus {
  const registryPath = join(projectRoot, 'Mi', 'n8n', 'config', 'workflow-registry.json');
  const rawRegistry = readJsonFile<any>(registryPath, { workflows: [] });
  const workflows = Array.isArray(rawRegistry.workflows) ? rawRegistry.workflows : [];
  const registry = normalizeWorkflowRegistry(workflows);
  const registryIds = new Set(registry.map((w) => w.workflow_id));
  const missing_documented_workflows = documentedWorkflowIds.filter((id) => !registryIds.has(id));
  const blockers = [];
  if (missing_documented_workflows.length) {
    blockers.push(`${missing_documented_workflows.length} documented workflows are not machine-registered.`);
  }
  if (!registry.length) {
    blockers.push('Machine workflow registry is empty or unreadable.');
  }

  return {
    final_status: blockers.length ? 'PARTIAL' : 'READY',
    machine_registered_workflows: registry.length,
    documented_workflows: documentedWorkflowIds.length,
    imported_documented_workflows: documentedWorkflowIds.length - missing_documented_workflows.length,
    missing_documented_workflows,
    registry,
    routes: {
      log: 'POST /api/workflows/log',
      status: 'GET /api/workflows/status',
    },
    blockers,
  };
}
