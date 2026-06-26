import fs from 'fs';
import path from 'path';
import { captureEvidence } from './evidence-capture';
import { coordinationClient } from './coordination-client';
import { evaluatePolicy } from './policy-guard';
import { PlaywrightRunner } from './playwright-adapter';
import { saveStoredTask } from './task-store';
import { OperatorTaskInput, OperatorTaskResult, StoredTaskRecord } from './types';

const HTML_DIR = path.join(process.cwd(), '.local-agent-global', 'operator-runtime', 'html');

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

export async function runOperatorTask(task: OperatorTaskInput): Promise<OperatorTaskResult> {
  const startedAt = Date.now();
  const executionLog: Array<Record<string, unknown>> = [];
  const screenshots: string[] = [];
  const downloads: string[] = [];
  const errors: string[] = [];

  const coordinationCheck = await coordinationClient.verifyTask(task.task_id, task.objective_id);
  await coordinationClient.updateStatus(task.task_id, 'DISPATCHED');

  const baseRecord: StoredTaskRecord = {
    id: task.task_id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    input: task,
    status: 'DISPATCHED',
    evidence: [],
    coordination: {
      checked: true,
      available: coordinationCheck.available,
      status_updates: ['DISPATCHED'],
      evidence_registered: false,
    },
  };
  saveStoredTask(baseRecord);

  const policy = evaluatePolicy(task);
  executionLog.push({ step: 'policy_check', policy });

  if (!policy.ok) {
    const blockedResult: OperatorTaskResult = {
      ok: false,
      task_id: task.task_id,
      status: 'BLOCKED_BY_POLICY',
      reason: policy.reason,
    };
    const evidence = captureEvidence({
      task_id: task.task_id,
      objective_id: task.objective_id,
      adapter: task.adapter,
      mode: task.mode,
      target_url: task.target.url,
      policy_decision: policy,
      task_input: task,
      task_output: blockedResult,
      execution_log: executionLog,
      screenshots,
      downloads,
      timing_ms: Date.now() - startedAt,
      errors,
    });
    await coordinationClient.updateStatus(task.task_id, 'BLOCKED');
    await coordinationClient.registerEvidence(task.task_id, evidence);
    saveStoredTask({
      ...baseRecord,
      updated_at: new Date().toISOString(),
      output: blockedResult,
      status: 'BLOCKED_BY_POLICY',
      evidence,
      coordination: {
        ...baseRecord.coordination,
        status_updates: ['DISPATCHED', 'BLOCKED'],
        evidence_registered: true,
      },
    });
    return {
      ...blockedResult,
      evidence,
      coordination: {
        check: coordinationCheck,
        updates: ['DISPATCHED', 'BLOCKED'],
      },
    };
  }

  await coordinationClient.updateStatus(task.task_id, 'IN_PROGRESS');
  const adapter = new PlaywrightRunner();
  const aggregateResult: Record<string, unknown> = {};
  let htmlSnapshot: string | undefined;

  try {
    for (const action of task.actions) {
      const actionResult = await adapter.runAction(action);
      executionLog.push({ step: action.type, action, actionResult });
      if (!actionResult.ok && actionResult.error) errors.push(actionResult.error);
      if (actionResult.result) Object.assign(aggregateResult, actionResult.result);
      const ss = adapter.getLastScreenshot();
      if (ss && !screenshots.includes(ss)) screenshots.push(ss);
      const dl = adapter.getLastDownload();
      if (dl && !downloads.includes(dl)) downloads.push(dl);
    }

    if (task.target.url.startsWith('http://localhost') || task.target.url.startsWith('http://127.0.0.1') || /example\.com/i.test(task.target.url)) {
      ensureDir(HTML_DIR);
      htmlSnapshot = path.join(HTML_DIR, `${task.task_id}.html`);
      const pageContent = await adapter.getPageContent();
      fs.writeFileSync(htmlSnapshot, String(pageContent || aggregateResult.text || aggregateResult.title || ''), 'utf-8');
    }
  } finally {
    await adapter.close();
  }

  const ok = errors.length === 0;
  const result: OperatorTaskResult = {
    ok,
    task_id: task.task_id,
    status: ok ? 'DONE' : 'FAILED',
    result: aggregateResult,
    errors: errors.length ? errors : undefined,
  };

  const evidence = captureEvidence({
    task_id: task.task_id,
    objective_id: task.objective_id,
    adapter: task.adapter,
    mode: task.mode,
    target_url: task.target.url,
    policy_decision: policy,
    task_input: task,
    task_output: result,
    execution_log: executionLog,
    screenshots,
    downloads,
    html_snapshot: htmlSnapshot,
    timing_ms: Date.now() - startedAt,
    errors,
  });

  const finalEvidence = [...(result.evidence || []), ...evidence, ...screenshots, ...downloads, ...(htmlSnapshot ? [htmlSnapshot] : [])];
  result.evidence = finalEvidence;
  result.coordination = {
    check: coordinationCheck,
    updates: ['DISPATCHED', 'IN_PROGRESS', result.status],
  };

  await coordinationClient.updateStatus(task.task_id, result.status);
  await coordinationClient.registerEvidence(task.task_id, finalEvidence);

  saveStoredTask({
    ...baseRecord,
    updated_at: new Date().toISOString(),
    output: result,
    status: result.status,
    evidence: finalEvidence,
    coordination: {
      ...baseRecord.coordination,
      status_updates: ['DISPATCHED', 'IN_PROGRESS', result.status],
      evidence_registered: true,
    },
  });

  return result;
}
