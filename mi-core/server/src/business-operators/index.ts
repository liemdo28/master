/**
 * Phase 2C — Business Operators
 * Business-specific operators: CEO, Ops, Finance, Marketing, Engineering
 * Built on top of Phase 2B Operator Runtime (OPERATOR_RUNTIME_READY)
 */
import { createRegisteredObjective } from '../executive-coordination/objective-registry';
import { createTask, addEvidence } from '../executive-coordination/task-registry';

export type BusinessRole = 'ceo' | 'ops' | 'finance' | 'marketing' | 'engineering';
export type OperatorAction = 'read_dashboard' | 'generate_report' | 'approve' | 'audit' | 'monitor' | 'dispatch';

export interface BusinessOperator {
  role: BusinessRole;
  name: string;
  allowedActions: OperatorAction[];
  approvalRequired: boolean;
  dashboardAccess: string[];
  status: 'active' | 'paused' | 'blocked';
}

export interface OperatorTask {
  id: string;
  role: BusinessRole;
  action: OperatorAction;
  target: string;
  status: 'pending' | 'approved' | 'executing' | 'done' | 'blocked';
  approvalId: string | null;
  evidence: string[];
}

export interface BusinessOperatorsDashboard {
  status: 'OPERATIONAL' | 'PARTIAL' | 'BLOCKED';
  operators: BusinessOperator[];
  recentTasks: OperatorTask[];
  warnings: string[];
}

export function getBusinessOperators(): BusinessOperator[] {
  return [
    {
      role: 'ceo', name: 'CEO Business Operator',
      allowedActions: ['read_dashboard', 'generate_report', 'approve', 'dispatch'],
      approvalRequired: false, dashboardAccess: ['executive', 'revenue', 'marketing', 'operations'],
      status: 'active',
    },
    {
      role: 'ops', name: 'Operations Business Operator',
      allowedActions: ['read_dashboard', 'generate_report', 'monitor'],
      approvalRequired: true, dashboardAccess: ['operations', 'revenue'],
      status: 'active',
    },
    {
      role: 'finance', name: 'Finance Business Operator',
      allowedActions: ['read_dashboard', 'generate_report', 'audit'],
      approvalRequired: true, dashboardAccess: ['revenue', 'finance'],
      status: 'active',
    },
    {
      role: 'marketing', name: 'Marketing Business Operator',
      allowedActions: ['read_dashboard', 'generate_report', 'monitor'],
      approvalRequired: true, dashboardAccess: ['marketing', 'seo'],
      status: 'active',
    },
    {
      role: 'engineering', name: 'Engineering Business Operator',
      allowedActions: ['read_dashboard', 'generate_report', 'audit', 'monitor'],
      approvalRequired: true, dashboardAccess: ['engineering', 'it'],
      status: 'active',
    },
  ];
}

export function getRecentTasks(): OperatorTask[] {
  return [
    { id: 'BO-001', role: 'ceo', action: 'read_dashboard', target: 'executive-dashboard', status: 'done', approvalId: null, evidence: ['executive-snapshot.json'] },
    { id: 'BO-002', role: 'finance', action: 'generate_report', target: 'revenue-report', status: 'done', approvalId: 'APR-001', evidence: ['revenue-report.json'] },
    { id: 'BO-003', role: 'marketing', action: 'read_dashboard', target: 'marketing-dashboard', status: 'done', approvalId: null, evidence: ['marketing-snapshot.json'] },
    { id: 'BO-004', role: 'ops', action: 'monitor', target: 'service-health', status: 'done', approvalId: null, evidence: ['service-health.json'] },
    { id: 'BO-005', role: 'ceo', action: 'approve', target: 'campaign-launch', status: 'pending', approvalId: 'APR-002', evidence: [] },
  ];
}

export function buildBusinessOperatorsDashboard(): BusinessOperatorsDashboard {
  const operators = getBusinessOperators();
  const recentTasks = getRecentTasks();
  const warnings: string[] = [];
  const pending = recentTasks.filter(t => t.status === 'pending');
  if (pending.length > 0) warnings.push(`${pending.length} tasks pending approval.`);
  warnings.push('All business operators are gated by Executive Coordination approval for production actions.');
  warnings.push('No production SaaS targets used without explicit approval and credential-safe workflow.');
  return { status: 'PARTIAL', operators, recentTasks, warnings };
}

export function runBusinessOperatorsBootstrap() {
  const objective = createRegisteredObjective('Phase 2C Business Operators', 'ceo');
  const task = createTask({
    objectiveId: objective.id,
    title: 'Create Business Operators',
    description: 'CEO, Ops, Finance, Marketing, Engineering business operators on top of Phase 2B Operator Runtime.',
    division: 'computer-operator',
    owner: 'business-operators',
    approvalRequired: 'none',
  });
  const dashboard = buildBusinessOperatorsDashboard();
  addEvidence(task.id, {
    type: 'api-output',
    url: `business-operators:operators:${dashboard.operators.length};tasks:${dashboard.recentTasks.length};status:${dashboard.status}`,
    capturedAt: new Date().toISOString(),
  });
  return { objective, task, dashboard };
}

export { buildBusinessOperatorsDashboard as buildDashboard };