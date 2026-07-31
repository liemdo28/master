import * as fs from 'fs';
import * as path from 'path';

interface JsonResult {
  status: number;
  body: any;
  raw: string;
}

const baseUrl = requiredEnv('TASK_RUNTIME_BASE_URL').replace(/\/$/, '');
const authHeaders = buildAuthHeaders();
const existingTaskIds = (process.env.TASK_RUNTIME_VERIFY_TASK_IDS || process.env.TASK_RUNTIME_VERIFY_TASK_ID || '')
  .split(',')
  .map(v => v.trim())
  .filter(Boolean);
const workingDirectory = process.env.TASK_RUNTIME_WORKING_DIRECTORY || process.cwd();
const reportPath = process.env.TASK_RUNTIME_REPORT_PATH || path.join('reports', 'evidence', 'task-runtime-live-acceptance.json');

async function main() {
  const startedAt = new Date().toISOString();
  const summary: any = {
    ok: false,
    startedAt,
    baseUrl,
    auth: authHeaders.authSummary,
    checks: [],
    knownLimitations: ['command execution uses synchronous execFileSync with timeout and maxBuffer controls'],
  };

  try {
    const health = await request('GET', '/api/health');
    summary.checks.push(check('health', health.status === 200, { status: health.status }));

    const tools = await request('GET', '/api/tools');
    summary.checks.push(check('tools route', tools.status === 200 && Array.isArray(tools.body?.tools), { status: tools.status }));

    if (existingTaskIds.length) {
      const recovered = [];
      for (const taskId of existingTaskIds) {
        recovered.push(await verifyTask(taskId));
      }
      summary.tasks = recovered.map(r => sanitizeVerifiedTask(r));
      summary.checks.push(check('verify existing tasks after restart', recovered.every(r => r.commandEventCount === 1)));
      summary.checks.push(check('completed task persisted', recovered.some(r => r.task.status === 'COMPLETED')));
      summary.checks.push(check('failed task persisted', recovered.some(r => r.task.status === 'FAILED')));
    } else {
      const unauthenticated = await request('POST', '/api/task-runtime/tasks', {
        userRequest: 'Unauthenticated task-runtime probe',
        repository: 'mi-core',
        workingDirectory,
        projectId: 'mi-core',
      }, { authenticated: false });
      summary.checks.push(check('unauthenticated rejected', unauthenticated.status === 401, { status: unauthenticated.status }));

      const successTask = await request('POST', '/api/task-runtime/tasks', {
        userRequest: 'Live task-runtime acceptance',
        repository: 'mi-core',
        workingDirectory,
        projectId: 'mi-core',
      });
      summary.checks.push(check('create success task', successTask.status === 201, { status: successTask.status }));
      const successTaskId = successTask.body.id;

      const rejected = await request('POST', `/api/task-runtime/tasks/${successTaskId}/inspect`, { command: 'rm', args: ['-rf', '/'] });
      summary.checks.push(check('reject disallowed command', rejected.status === 400, { status: rejected.status }));

      const executed = await request('POST', `/api/task-runtime/tasks/${successTaskId}/inspect`, { command: 'node', args: ['--version'] });
      summary.checks.push(check('execute allowed command', executed.status === 200, { status: executed.status, exitCode: executed.body.exitCode }));
      summary.successTaskId = successTaskId;
      summary.successStatus = executed.body.task?.status;
      summary.successEvidenceId = executed.body.evidenceId;
      summary.successRelativePath = executed.body.relativePath;
      summary.checks.push(check('no absolute evidence path returned', !executed.body.evidencePath && !/^[A-Za-z]:[\\/]/.test(String(executed.body.relativePath || ''))));
      summary.checks.push(check('success completes only on exit 0', executed.body.exitCode === 0 && executed.body.task?.status === 'COMPLETED'));

      const failureTask = await request('POST', '/api/task-runtime/tasks', {
        userRequest: 'Live task-runtime deterministic failure',
        repository: 'mi-core',
        workingDirectory,
        projectId: 'mi-core',
      });
      summary.checks.push(check('create failure task', failureTask.status === 201, { status: failureTask.status }));
      const failureTaskId = failureTask.body.id;
      const failed = await request('POST', `/api/task-runtime/tasks/${failureTaskId}/inspect`, { command: 'node', args: ['--task-runtime-intentional-failure'] });
      summary.checks.push(check('nonzero command rejected as failed task', failed.status === 422 && failed.body.exitCode !== 0 && failed.body.task?.status === 'FAILED', {
        status: failed.status,
        exitCode: failed.body.exitCode,
        taskStatus: failed.body.task?.status,
      }));
      summary.failureTaskId = failureTaskId;
      summary.failureStatus = failed.body.task?.status;
      summary.failureEvidenceId = failed.body.evidenceId;
      summary.failureRelativePath = failed.body.relativePath;
      summary.checks.push(check('failed task never completed', failed.body.task?.status === 'FAILED'));
      summary.checks.push(check('failed evidence path is relative', !failed.body.evidencePath && !/^[A-Za-z]:[\\/]/.test(String(failed.body.relativePath || ''))));

      const successVerified = await verifyTask(successTaskId);
      const failureVerified = await verifyTask(failureTaskId);
      summary.tasks = [sanitizeVerifiedTask(successVerified), sanitizeVerifiedTask(failureVerified)];
      summary.checks.push(check('success event count valid', successVerified.commandEventCount === 1));
      summary.checks.push(check('failure event count valid', failureVerified.commandEventCount === 1 && failureVerified.completedEventCount === 0 && failureVerified.failedEventCount === 1));
    }

    summary.ok = summary.checks.every((c: any) => c.ok);
    summary.finishedAt = new Date().toISOString();
    writeReport(summary);
    console.log(JSON.stringify(summary, null, 2));
    process.exit(summary.ok ? 0 : 1);
  } catch (err) {
    summary.error = err instanceof Error ? err.message : String(err);
    summary.finishedAt = new Date().toISOString();
    writeReport(summary);
    console.error(JSON.stringify(summary, null, 2));
    process.exit(1);
  }
}

async function verifyTask(taskId: string) {
  const taskRes = await request('GET', `/api/task-runtime/tasks/${taskId}`);
  const eventsRes = await request('GET', `/api/task-runtime/tasks/${taskId}/events`);
  const events = Array.isArray(eventsRes.body) ? eventsRes.body : [];
  return {
    task: taskRes.body,
    eventCount: events.length,
    commandEventCount: events.filter((e: any) => e.type === 'command.completed').length,
    completedEventCount: events.filter((e: any) => e.type === 'task.completed').length,
    failedEventCount: events.filter((e: any) => e.type === 'task.failed').length,
  };
}

async function request(method: string, route: string, body?: unknown, options: { authenticated?: boolean } = {}): Promise<JsonResult> {
  const headers: Record<string, string> = options.authenticated === false ? {} : { ...authHeaders.headers };
  let payload: string | undefined;
  if (body !== undefined) {
    headers['content-type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${baseUrl}${route}`, { method, headers, body: payload });
  const raw = await res.text();
  let parsed: any = null;
  try { parsed = raw ? JSON.parse(raw) : null; } catch { parsed = raw; }
  return { status: res.status, body: parsed, raw };
}

function buildAuthHeaders(): { headers: Record<string, string>; authSummary: string } {
  if (process.env.TASK_RUNTIME_API_KEY) {
    return { headers: { 'x-api-key': process.env.TASK_RUNTIME_API_KEY }, authSummary: 'x-api-key' };
  }
  if (process.env.TASK_RUNTIME_BEARER_TOKEN) {
    return { headers: { authorization: `Bearer ${process.env.TASK_RUNTIME_BEARER_TOKEN}` }, authSummary: 'bearer' };
  }
  throw new Error('Set TASK_RUNTIME_API_KEY or TASK_RUNTIME_BEARER_TOKEN; secrets are not printed.');
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

function check(name: string, ok: boolean, detail: Record<string, unknown> = {}) {
  return { name, ok, ...detail };
}

function sanitizeVerifiedTask(verified: Awaited<ReturnType<typeof verifyTask>>) {
  return {
    id: verified.task.id,
    status: verified.task.status,
    eventCount: verified.eventCount,
    commandEventCount: verified.commandEventCount,
    completedEventCount: verified.completedEventCount,
    failedEventCount: verified.failedEventCount,
    workingDirectory: verified.task.workingDirectory,
  };
}

function writeReport(summary: unknown) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2));
}

main();
