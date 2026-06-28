/**
 * department-boundary-policy.ts
 * Enforces ownership boundaries between departments.
 */
import type { DepartmentId } from './department-registry';
import { DEPARTMENTS } from './department-registry';

export interface BoundaryViolation {
  task_id: string;
  task_description: string;
  attempted_by: DepartmentId;
  owner: DepartmentId;
  violation_type: 'cross_ownership' | 'duplicate_ownership' | 'unauthorized_write';
}

export function checkBoundaryViolation(
  taskId: string,
  taskDescription: string,
  actingDept: DepartmentId
): BoundaryViolation | null {
  const owner = resolveTaskOwner(taskDescription);

  // Cross-ownership violation: a non-owner department acting as owner
  if (actingDept !== owner) {
    const canSupport = DEPARTMENTS[actingDept].supports.includes(
      DEPARTMENTS[owner].name.toLowerCase()
    );
    if (!canSupport) {
      return {
        task_id: taskId,
        task_description: taskDescription,
        attempted_by: actingDept,
        owner,
        violation_type: 'cross_ownership',
      };
    }
  }

  return null;
}

export function resolveTaskOwner(taskDescription: string): DepartmentId {
  const lower = taskDescription.toLowerCase();

  if (lower.includes('revenue') || lower.includes('strategy') || lower.includes('approval')) return 'executive';
  if (lower.includes('quickbooks') || lower.includes('payroll') || lower.includes('tax') || lower.includes('financial')) return 'finance';
  if (lower.includes('doordash') || lower.includes('food safety') || lower.includes('store health')) return 'operations';
  if (lower.includes('seo') || lower.includes('review') || lower.includes('gbp') || lower.includes('marketing')) return 'marketing';
  if (lower.includes('system health') || lower.includes('oss') || lower.includes('duplicate') || lower.includes('connector')) return 'it';
  if (lower.includes('creative') || lower.includes('asset')) return 'creative';
  if (lower.includes('customer') || lower.includes('cx') || lower.includes('sentiment')) return 'customer-experience';
  if (lower.includes('hr') || lower.includes('labor') || lower.includes('staff')) return 'hr-labor';
  if (lower.includes('vendor') || lower.includes('procurement') || lower.includes('sourcing')) return 'procurement';

  return 'executive';
}

export function enforceBoundary(violation: BoundaryViolation): { allowed: boolean; reason: string } {
  return {
    allowed: false,
    reason: `Department ${violation.attempted_by} cannot own task "${violation.task_description}" — owned by ${violation.owner}`,
  };
}
