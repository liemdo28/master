/**
 * DashboardActionService.mjs
 * Create/update/assign/complete tasks on dashboard.bakudanramen.com.
 * All writes require approval.
 */

import { ApprovalRequiredAction } from './ApprovalRequiredAction.mjs';
import { dashboardConnector } from '../universal-visibility/DashboardVisibilityConnector.mjs';

const DASHBOARD_API = process.env.DASHBOARD_API || 'http://dashboard.bakudanramen.com';

export class DashboardActionService {
  /** Get current tasks — auto-allowed */
  static async getTasks() {
    return dashboardConnector.getTasks();
  }

  /** Get dashboard status — auto-allowed */
  static getSummary() {
    return dashboardConnector.getSummaryText();
  }

  /** Create task on dashboard — requires approval */
  static createTask(params) {
    const { title, assignee, due_date, priority = 'medium', notes, store } = params;

    const action = ApprovalRequiredAction.create({
      type: 'create-task',
      target: `dashboard/${store || 'general'}`,
      description: `Create Dashboard task: "${title}"${assignee ? ` → ${assignee}` : ''}${due_date ? ` due ${due_date}` : ''}${store ? ` (${store})` : ''}`,
      payload: { title, assignee, due_date, priority, notes, store, endpoint: `${DASHBOARD_API}/api/tasks` },
      before_state: 'Task does not exist',
      rollback_plan: 'Delete task from Dashboard',
    });

    return {
      status: 'pending_approval',
      action,
      preview: [
        `🏪 Dashboard Task Draft:`,
        `Title: ${title}`,
        assignee ? `Assignee: ${assignee}` : '',
        due_date ? `Due: ${due_date}` : '',
        store ? `Store: ${store}` : '',
        `Priority: ${priority}`,
      ].filter(Boolean).join('\n'),
      formatted: ApprovalRequiredAction.formatForResponse(action),
    };
  }

  /** Update task — requires approval */
  static updateTask(taskId, updates) {
    const action = ApprovalRequiredAction.create({
      type: 'update-task',
      target: `dashboard/task/${taskId}`,
      description: `Update Dashboard task ${taskId}: ${JSON.stringify(updates)}`,
      payload: { taskId, updates, endpoint: `${DASHBOARD_API}/api/tasks/${taskId}` },
      before_state: 'Task exists with original values',
      rollback_plan: 'Revert task values in Dashboard',
    });
    return { status: 'pending_approval', action, formatted: ApprovalRequiredAction.formatForResponse(action) };
  }

  /** Complete/cancel task — requires approval */
  static completeTask(taskId, action_type = 'complete') {
    const act = ApprovalRequiredAction.create({
      type: 'complete-task',
      target: `dashboard/task/${taskId}`,
      description: `${action_type === 'cancel' ? 'Cancel' : 'Complete'} Dashboard task ${taskId}`,
      payload: { taskId, action_type, endpoint: `${DASHBOARD_API}/api/tasks/${taskId}` },
      before_state: 'Task is active',
      rollback_plan: 'Reopen task in Dashboard',
    });
    return { status: 'pending_approval', action: act, formatted: ApprovalRequiredAction.formatForResponse(act) };
  }

  /** Pull report — auto-allowed */
  static async pullReport(reportType = 'daily') {
    return {
      status: 'ok',
      source: 'dashboard',
      report_type: reportType,
      data: dashboardConnector.getCacheSnapshot()?.data || null,
      note: 'Report data from last cache sync',
    };
  }
}
