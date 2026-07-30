/**
 * AsanaActionService.mjs
 * Create, update, assign, complete Asana tasks. All writes require approval.
 */

import { ApprovalRequiredAction } from './ApprovalRequiredAction.mjs';
import { asanaConnector } from '../universal-visibility/AsanaVisibilityConnector.mjs';

export class AsanaActionService {
  /** Search tasks — auto-allowed */
  static searchTasks(query) {
    return asanaConnector.searchTasks(query);
  }

  /** Get overdue tasks — auto-allowed */
  static getOverdue() {
    return asanaConnector.getOverdueTasks();
  }

  /** Get tasks for a person — auto-allowed */
  static getTasksForPerson(name) {
    return asanaConnector.getTasksForPerson(name);
  }

  /** Create task — requires approval */
  static createTask(params) {
    const { title, assignee, due_date, project, notes, priority = 'normal' } = params;

    if (!asanaConnector.isConfigured()) {
      return {
        status: 'CONNECTOR_NOT_CONFIGURED',
        message: 'Asana not configured — add ASANA_TOKEN to .env',
        setup: 'asana.com/0/my-apps',
      };
    }

    const action = ApprovalRequiredAction.create({
      type: 'create-task',
      target: 'asana',
      description: `Create task: "${title}"${assignee ? ` → ${assignee}` : ''}${due_date ? ` due ${due_date}` : ''}${project ? ` in ${project}` : ''}`,
      payload: { title, assignee, due_date, project, notes, priority },
      before_state: 'Task does not exist',
      rollback_plan: 'Delete created task from Asana',
    });

    return {
      status: 'pending_approval',
      action,
      preview: [
        `✅ Asana Task Draft:`,
        `Title: ${title}`,
        assignee ? `Assignee: ${assignee}` : '',
        due_date ? `Due: ${due_date}` : '',
        project ? `Project: ${project}` : '',
        `Priority: ${priority}`,
        notes ? `Notes: ${notes}` : '',
      ].filter(Boolean).join('\n'),
      formatted: ApprovalRequiredAction.formatForResponse(action),
    };
  }

  /** Update task — requires approval */
  static updateTask(taskId, updates) {
    const action = ApprovalRequiredAction.create({
      type: 'update-task',
      target: `asana/task/${taskId}`,
      description: `Update Asana task ${taskId}: ${Object.entries(updates).map(([k,v]) => `${k}=${v}`).join(', ')}`,
      payload: { taskId, updates },
      before_state: 'Task exists with original values',
      rollback_plan: 'Revert task to original values in Asana',
    });
    return { status: 'pending_approval', action, formatted: ApprovalRequiredAction.formatForResponse(action) };
  }

  /** Mark task complete — requires approval */
  static completeTask(taskId, taskName = '') {
    const action = ApprovalRequiredAction.create({
      type: 'complete-task',
      target: `asana/task/${taskId}`,
      description: `Mark complete: "${taskName || taskId}"`,
      payload: { taskId, completed: true },
      before_state: 'Task is incomplete',
      rollback_plan: 'Mark task incomplete again in Asana',
    });
    return { status: 'pending_approval', action, formatted: ApprovalRequiredAction.formatForResponse(action) };
  }

  /** Assign task to someone — requires approval */
  static assignTask(taskId, assigneeEmail) {
    const action = ApprovalRequiredAction.create({
      type: 'assign-task',
      target: `asana/task/${taskId}`,
      description: `Assign task ${taskId} to ${assigneeEmail}`,
      payload: { taskId, assigneeEmail },
      before_state: 'Task has current assignee',
      rollback_plan: 'Re-assign task to original assignee',
    });
    return { status: 'pending_approval', action, formatted: ApprovalRequiredAction.formatForResponse(action) };
  }
}
