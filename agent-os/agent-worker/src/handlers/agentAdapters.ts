// ============================================================
// Agent OS - Agent Adapter Handoff Artifacts
// Creates auditable handoff packages for IDE/extension agents.
// ============================================================

import * as fs from 'fs';
import * as path from 'path';

export type AgentAdapter = 'antigravity' | 'cline';

export interface AgentHandoffOptions {
  status: string;
  nativeInjection: boolean;
  reason: string;
}

const MASTER_ROOT = path.resolve(process.env.MASTER_ROOT || path.join(process.cwd(), '..', '..'));

function resolveProjectPath(project: string): string {
  if (path.isAbsolute(project)) return project;
  return path.resolve(MASTER_ROOT, project);
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getPrompt(task: any): string {
  const payload = task.payload || {};
  return String(
    payload.prompt ||
    payload.handoffPrompt ||
    payload.commanderPlan?.handoffPrompt ||
    payload.originalMessage ||
    `Handle task ${task.id}`
  );
}

export function createAgentHandoff(task: any, adapter: AgentAdapter, options: AgentHandoffOptions) {
  const payload = task.payload || {};
  const projectPath = resolveProjectPath(String(payload.projectPath || task.project || MASTER_ROOT));
  const prompt = getPrompt(task);
  const taskId = String(task.id || `handoff-${Date.now()}`);
  const dir = path.join(MASTER_ROOT, 'artifact-registry', 'agent-handoffs', taskId);
  ensureDir(dir);

  const handoff = {
    taskId,
    adapter,
    status: options.status,
    nativeInjection: options.nativeInjection,
    reason: options.reason,
    project: task.project || payload.projectPath || MASTER_ROOT,
    projectPath,
    prompt,
    commanderIntent: payload.commanderIntent || null,
    executionStrategy: payload.executionStrategy || adapter,
    taskSize: payload.taskSize || null,
    qaRequired: payload.qaRequired ?? null,
    createdAt: new Date().toISOString(),
  };

  const jsonPath = path.join(dir, 'handoff.json');
  const promptPath = path.join(dir, 'PROMPT.md');

  fs.writeFileSync(jsonPath, JSON.stringify(handoff, null, 2), 'utf-8');
  fs.writeFileSync(promptPath, [
    '# Agent Handoff Prompt',
    '',
    `Adapter: ${adapter}`,
    `Task ID: ${taskId}`,
    `Project: ${handoff.project}`,
    `Project path: ${projectPath}`,
    `Native injection: ${options.nativeInjection ? 'true' : 'false'}`,
    `Status: ${options.status}`,
    '',
    '## Instructions',
    '',
    prompt,
    '',
    '## Rules',
    '',
    '- Do not guess. Use KNOWN_UNKNOWN if evidence is missing.',
    '- Report blockers at least 48h before a deadline slip.',
    '- If you disagree with the task direction, say it before execution.',
    '- Acceptance means the script or workflow runs on the CEO machine.',
    '- Never run global process-kill commands such as taskkill /F /IM node.exe, killall node, or broad npm/pnpm/yarn kills.',
    '- If a restart is required, identify the exact PID by port and project path first, then kill only that PID.',
    '- Do not stop PM2, the API gateway, Agent OS, or unrelated Node processes unless this handoff explicitly names that service.',
  ].join('\n'), 'utf-8');

  return {
    directory: dir,
    jsonPath,
    promptPath,
    projectPath,
    nativeInjection: options.nativeInjection,
    status: options.status,
  };
}
