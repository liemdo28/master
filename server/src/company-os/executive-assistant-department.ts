/**
 * Mi Company OS — Executive Assistant Department
 * Handles: task queries, schedules, reminders, follow-ups, inbox triage.
 *
 * Data sources (real SQLite, no LLM required for data):
 *   - task-intelligence: buildSnapshot(), queryTodayTasks(), queryPendingApprovals()
 *   - operational-memory: recent executions
 *   - health-intelligence: biometric snapshot
 *
 * Brain: qwen3:8b — generates the natural language summary from raw data.
 */

import { runDepartment, type RuntimeOutput } from './department-runtime';
import { recordStep, completeStep } from './evidence-store';
import type { DeptReport } from './report-center';

const DEPT_ID = 'executive-assistant';

// ── Direct data access (no HTTP — module require for speed) ─────────────────

function getTaskData(): { snapshot: unknown; today: unknown; approvals: unknown } {
  try {
    const { buildSnapshot } = require('../task-intelligence/task-data-collector');
    const { queryTodayTasks, queryPendingApprovals, queryBlockers } = require('../task-intelligence/task-query-engine');
    const snap = buildSnapshot();
    return {
      snapshot: {
        open_work_orders: snap.open_work_orders?.length || 0,
        pending_approvals: snap.pending_approvals?.length || 0,
        open_blockers: snap.open_blockers?.length || 0,
        certifications_pending: snap.certifications_pending?.length || 0,
      },
      today: queryTodayTasks(snap),
      approvals: queryPendingApprovals(snap),
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      snapshot: { error: msg },
      today: { error: msg },
      approvals: { error: msg },
    };
  }
}

function getHealthData(): unknown {
  try {
    const { getLatestHealthSnapshot } = require('../health-intelligence/health-data-reader');
    return getLatestHealthSnapshot();
  } catch {
    return null;
  }
}

export interface ExecutiveAssistantRequest {
  pipeline_id: string;
  intent: string;
  command: string;
}

export interface ExecutiveAssistantReport extends DeptReport {
  task_count: number;
  approval_count: number;
  data_fresh: boolean;
}

export async function executeExecutiveAssistant(req: ExecutiveAssistantRequest): Promise<ExecutiveAssistantReport> {
  const { pipeline_id, intent, command } = req;

  // Fetch task data (synchronous SQLite reads)
  const dataStep = recordStep(pipeline_id, DEPT_ID, 'task_data_load', { intent });
  const taskData = getTaskData();
  const healthData = getHealthData();

  const snap = taskData.snapshot as Record<string, unknown>;
  const taskCount = typeof snap.open_work_orders === 'number' ? snap.open_work_orders : 0;
  const approvalCount = typeof snap.pending_approvals === 'number' ? snap.pending_approvals : 0;
  const dataFresh = !('error' in snap);

  completeStep(dataStep.id, {
    task_count: taskCount,
    approval_count: approvalCount,
    data_fresh: dataFresh,
  }, dataFresh ? 0.95 : 0.40);

  // Phase 8: Email scan
  let emailContext = '';
  try {
    const { getImportantEmailsAll } = require('../visibility/visibility-hub');
    const emails = getImportantEmailsAll(5);
    if (emails?.gmail?.length > 0) {
      emailContext = emails.gmail.map((e: { subject: string; from: string; snippet?: string }) =>
        `• ${e.subject} — ${e.from}`).join('\n');
    }
  } catch { /* non-blocking */ }

  // Phase 8: Calendar summary
  let calendarContext = '';
  try {
    const { getTodayEventsAll } = require('../visibility/visibility-hub');
    const events = getTodayEventsAll();
    if (events?.calendar?.length > 0) {
      calendarContext = events.calendar.map((e: { title: string; start: string }) =>
        `• ${e.title} @ ${new Date(e.start).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`).join('\n');
    }
  } catch { /* non-blocking */ }

  // Build context string for brain
  const contextParts = [
    `Task Snapshot:\n${JSON.stringify(taskData.snapshot, null, 2)}`,
    `Today's Tasks:\n${JSON.stringify(taskData.today, null, 2).substring(0, 1000)}`,
    `Pending Approvals:\n${JSON.stringify(taskData.approvals, null, 2).substring(0, 800)}`,
  ];

  if (emailContext) contextParts.push(`Important Emails:\n${emailContext}`);
  if (calendarContext) contextParts.push(`Today's Calendar:\n${calendarContext}`);

  if (healthData) {
    contextParts.push(`CEO Health Data:\n${JSON.stringify(healthData, null, 2).substring(0, 500)}`);
  }

  // Run brain to generate natural language response
  const runtimeResult: RuntimeOutput = await runDepartment({
    pipeline_id,
    dept_id: DEPT_ID,
    intent,
    command,
    extra_context: contextParts.join('\n\n'),
  });

  return {
    ...runtimeResult,
    dept_id: DEPT_ID,
    dept_name: 'Executive Assistant',
    task_count: taskCount,
    approval_count: approvalCount,
    data_fresh: dataFresh,
    summary: dataFresh
      ? `${taskCount} open tasks, ${approvalCount} pending approvals. ${runtimeResult.summary}`
      : `Task data unavailable. ${runtimeResult.summary}`,
  };
}
