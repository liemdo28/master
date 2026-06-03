// ============================================================
// Agent OS - Master Journal Writer
// ============================================================

import * as fs from 'fs';
import * as path from 'path';

const MASTER_ROOT = path.resolve(process.env.MASTER_ROOT || path.join(process.cwd(), '..', '..'));
const JOURNAL_ROOT = path.join(MASTER_ROOT, 'master-journal');

export interface JournalEvent {
  type: string;
  taskId?: string;
  project?: string;
  actor?: string;
  risk?: string;
  rollbackPlan?: string;
  data?: Record<string, any>;
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function writeJournalEvent(event: JournalEvent): string {
  const timestamp = new Date().toISOString();
  const record = { timestamp, ...event };
  const dir = path.join(JOURNAL_ROOT, 'events');
  ensureDir(dir);
  const file = path.join(dir, `${timestamp.slice(0, 10)}.jsonl`);
  fs.appendFileSync(file, `${JSON.stringify(record)}\n`, 'utf-8');
  return file;
}

export function writeDecision(params: {
  taskId: string;
  decision: string;
  reason: string;
  actor?: string;
  risk?: string;
  rollbackPlan?: string;
}): string {
  const timestamp = new Date().toISOString();
  const dir = path.join(JOURNAL_ROOT, 'decisions');
  ensureDir(dir);
  const file = path.join(dir, `${timestamp.replace(/[:.]/g, '-')}-${params.taskId}.md`);
  const content = [
    '# Decision',
    '',
    `- Task: ${params.taskId}`,
    `- Decision: ${params.decision}`,
    `- Who approved: ${params.actor || 'ceo'}`,
    `- When: ${timestamp}`,
    `- Risk: ${params.risk || 'unknown'}`,
    '',
    '## Why',
    '',
    params.reason,
    '',
    '## Rollback Plan',
    '',
    params.rollbackPlan || 'Stop task, restore previous snapshot, and inspect artifacts.',
    '',
  ].join('\n');
  fs.writeFileSync(file, content, 'utf-8');
  return file;
}

export function writeAiMemoryEntry(params: {
  taskId: string;
  project: string;
  businessReason?: string;
  technicalReason?: string;
  risk?: string;
  warning?: string;
  rollbackNotes?: string;
  artifacts?: string[];
  qaCoverage?: string;
}): string {
  const timestamp = new Date().toISOString();
  const dir = path.join(JOURNAL_ROOT, 'ai-memory');
  ensureDir(dir);
  const file = path.join(dir, `${timestamp.replace(/[:.]/g, '-')}-${params.taskId}-AI_MEMORY_ENTRY.md`);
  const content = [
    '# AI Memory Entry',
    '',
    `- Task: ${params.taskId}`,
    `- Project: ${params.project}`,
    `- When: ${timestamp}`,
    '',
    '## Business Reason',
    '',
    params.businessReason || 'Agent OS task execution.',
    '',
    '## Technical Reason',
    '',
    params.technicalReason || 'Task was created and processed through Agent OS.',
    '',
    '## Risk',
    '',
    params.risk || 'Review task logs and artifacts before release.',
    '',
    '## Warning',
    '',
    params.warning || 'No production deploy, file deletion, git push, cloud access, or email send should occur without approval.',
    '',
    '## Rollback Notes',
    '',
    params.rollbackNotes || 'Use MASTER-PREVIOUS.zip or project-specific restore procedure if this task causes regression.',
    '',
    '## Artifacts',
    '',
    ...(params.artifacts?.length ? params.artifacts.map(a => `- ${a}`) : ['- None recorded yet.']),
    '',
    '## QA Coverage',
    '',
    params.qaCoverage || 'Pending QA Platform integration result.',
    '',
  ].join('\n');
  fs.writeFileSync(file, content, 'utf-8');
  return file;
}
