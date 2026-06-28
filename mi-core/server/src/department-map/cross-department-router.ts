/**
 * cross-department-router.ts
 * Routes cross-department tasks and handoffs.
 */
import type { DepartmentId } from './department-registry';
import { DEPARTMENTS } from './department-registry';
import { assignTaskOwnership, handoffTask } from './task-ownership-engine';
import { addDependency } from './dependency-map';

export interface CrossDeptRoutingRequest {
  task_id: string;
  task_description: string;
  requesting_dept: DepartmentId;
  target_depts: DepartmentId[];
  action: 'request_support' | 'handoff' | 'escalate';
}

export interface CrossDeptRoutingResult {
  task_id: string;
  routed_to: DepartmentId;
  supporters: DepartmentId[];
  dependencies: string[];
  allowed: boolean;
  reason: string;
}

export function routeCrossDepartment(req: CrossDeptRoutingRequest): CrossDeptRoutingResult {
  const { task_id, task_description, requesting_dept, target_depts, action } = req;

  if (action === 'handoff') {
    const target = target_depts[0];
    const result = handoffTask(task_id, requesting_dept, target);
    if (!result) {
      return { task_id, routed_to: requesting_dept, supporters: [], dependencies: [], allowed: false, reason: 'Handoff failed: not current owner' };
    }
    addDependency({ from_task_id: task_id, to_task_id: `${task_id}-handoff-${target}`, from_department: requesting_dept, to_department: target, dependency_type: 'reports_to' });
    return { task_id, routed_to: target, supporters: [requesting_dept], dependencies: [`${task_id}-handoff-${target}`], allowed: true, reason: `Handoff from ${requesting_dept} to ${target}` };
  }

  if (action === 'request_support') {
    const supporters = target_depts.filter((d) => d !== requesting_dept);
    supporters.forEach((s) => {
      addDependency({ from_task_id: task_id, to_task_id: `${task_id}-support-${s}`, from_department: requesting_dept, to_department: s, dependency_type: 'supports' });
    });
    return { task_id, routed_to: requesting_dept, supporters, dependencies: supporters.map((s) => `${task_id}-support-${s}`), allowed: true, reason: `Support requested from ${supporters.join(', ')}` };
  }

  if (action === 'escalate') {
    const parent = DEPARTMENTS[requesting_dept].parent ?? 'executive';
    return { task_id, routed_to: parent, supporters: [requesting_dept], dependencies: [], allowed: true, reason: `Escalated from ${requesting_dept} to ${parent}` };
  }

  return { task_id, routed_to: requesting_dept, supporters: [], dependencies: [], allowed: false, reason: 'Unknown action' };
}
