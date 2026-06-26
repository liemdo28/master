import type { WorkflowRegistryEntry, WorkflowRisk } from './types';

const mapRisk: Record<string, WorkflowRisk> = {
  low: 'READ_ONLY',
  medium: 'SAFE_WRITE',
  high: 'PRODUCTION_WRITE',
  financial: 'FINANCIAL',
  security: 'SECURITY',
};

export function normalizeWorkflowRegistryEntry(raw: any): WorkflowRegistryEntry {
  const schedule = raw.schedule?.cron ?? raw.schedule ?? 'manual';
  const risk = mapRisk[String(raw.risk_level ?? raw.risk ?? 'medium').toLowerCase()] ?? 'SAFE_WRITE';
  return {
    workflow_id: raw.id ?? raw.workflow_id,
    workflow_name: raw.name ?? raw.workflow_name,
    project: raw.domain ?? raw.project ?? 'unknown',
    division: raw.division ?? raw.domain ?? raw.project ?? 'unknown',
    owner: raw.owner ?? raw.technical_owner ?? 'unassigned',
    trigger: raw.trigger ?? raw.trigger_type ?? 'schedule',
    schedule,
    risk,
    approval_required: Boolean(raw.approval_required),
    status: raw.status ?? 'UNKNOWN',
    last_run: raw.last_run ?? null,
    next_run: raw.next_run ?? null,
  };
}

export function normalizeWorkflowRegistry(rawEntries: any[]): WorkflowRegistryEntry[] {
  return rawEntries.map(normalizeWorkflowRegistryEntry);
}
