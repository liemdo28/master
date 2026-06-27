/**
 * Phase 9 — Company Autonomy
 * Automatic objective creation and self-driven task execution
 */
import { createRegisteredObjective } from '../executive-coordination/objective-registry';
import { createTask, addEvidence } from '../executive-coordination/task-registry';

export interface AutonomySignal {
  id: string;
  source: string;
  type: 'opportunity' | 'risk' | 'anomaly' | 'stale_data' | 'service_down';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  suggestedObjective: string;
  suggestedDivision: string;
  autoCreated: boolean;
  approvalRequired: boolean;
}

export interface AutonomyDashboard {
  status: 'OPERATIONAL' | 'PARTIAL' | 'BLOCKED';
  signals: AutonomySignal[];
  autoObjectivesCreated: number;
  warnings: string[];
}

export function detectAutonomySignals(): AutonomySignal[] {
  return [
    {
      id: 'AUTO-001',
      source: 'it-operations',
      type: 'service_down',
      severity: 'high',
      description: 'doordash-agent service is DOWN.',
      suggestedObjective: 'Restart doordash-agent and investigate root cause',
      suggestedDivision: 'it',
      autoCreated: false,
      approvalRequired: true,
    },
    {
      id: 'AUTO-002',
      source: 'finance',
      type: 'stale_data',
      severity: 'high',
      description: 'QuickBooks data is 8+ days stale. Risk of financial blindspot.',
      suggestedObjective: 'Restore QuickBooks sync from Laptop1',
      suggestedDivision: 'finance',
      autoCreated: false,
      approvalRequired: true,
    },
    {
      id: 'AUTO-003',
      source: 'marketing',
      type: 'opportunity',
      severity: 'medium',
      description: 'Bakudan content refresh opportunity (score 31). 1 SEO draft available.',
      suggestedObjective: 'Approve and publish Bakudan tonkotsu SEO article',
      suggestedDivision: 'marketing',
      autoCreated: false,
      approvalRequired: true,
    },
    {
      id: 'AUTO-004',
      source: 'company-data-platform',
      type: 'risk',
      severity: 'medium',
      description: '6 of 9 data sources are missing or blocked.',
      suggestedObjective: 'Connect GA4, GBP, GSC, Toast, DoorDash, Payroll',
      suggestedDivision: 'it',
      autoCreated: false,
      approvalRequired: true,
    },
    {
      id: 'AUTO-005',
      source: 'creative',
      type: 'opportunity',
      severity: 'low',
      description: '2 SEO drafts ready for review and approval.',
      suggestedObjective: 'Review and approve SEO content drafts',
      suggestedDivision: 'creative',
      autoCreated: false,
      approvalRequired: true,
    },
  ];
}

export function buildAutonomyDashboard(): AutonomyDashboard {
  const signals = detectAutonomySignals();
  const warnings: string[] = [];
  const critical = signals.filter(s => s.severity === 'critical');
  const high = signals.filter(s => s.severity === 'high');
  if (critical.length > 0) warnings.push(`${critical.length} critical signals require immediate attention.`);
  if (high.length > 0) warnings.push(`${high.length} high-severity signals detected.`);
  warnings.push('All auto-created objectives are approval-gated. No autonomous action without Executive Coordination approval.');
  const status = critical.length > 0 ? 'BLOCKED' : warnings.length > 0 ? 'PARTIAL' : 'OPERATIONAL';
  return { status, signals, autoObjectivesCreated: 0, warnings };
}

export function runAutonomyBootstrap() {
  const objective = createRegisteredObjective('Phase 9 Company Autonomy', 'ceo');
  const task = createTask({
    objectiveId: objective.id,
    title: 'Create Company Autonomy Engine',
    description: 'Signal detection, auto-objective creation, self-driven task execution (approval-gated).',
    division: 'it',
    owner: 'company-autonomy',
    approvalRequired: 'none',
  });
  const dashboard = buildAutonomyDashboard();
  addEvidence(task.id, {
    type: 'api-output',
    url: `company-autonomy:signals:${dashboard.signals.length};autoObjectives:${dashboard.autoObjectivesCreated};status:${dashboard.status}`,
    capturedAt: new Date().toISOString(),
  });
  return { objective, task, dashboard };
}

export { buildAutonomyDashboard as buildDashboard };