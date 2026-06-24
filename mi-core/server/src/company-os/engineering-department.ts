/**
 * Mi Company OS — Engineering Department
 * Handles: code review, bug fix, feature build, repo audit, test generation.
 *
 * Brain: qwen2.5-coder:7b — specialized coding model.
 * Approval: REQUIRED — no code changes without CEO approval.
 *
 * Tools:
 *   - Read relevant source files
 *   - Recent pipeline evidence (are we building on solid ground?)
 *   - qa-gate output for any prior related run
 */

import { runDepartment, type RuntimeOutput } from './department-runtime';
import { recordStep, completeStep, recentPipelineRuns } from './evidence-store';
import type { DeptReport } from './report-center';
import path from 'path';
import fs from 'fs';

const DEPT_ID = 'engineering';
const REPO_ROOT = path.resolve(__dirname, '../../..');

export interface EngineeringRequest {
  pipeline_id: string;
  intent: string;
  command: string;
  target_file?: string;
}

export interface EngineeringReport extends DeptReport {
  requires_approval: true;
  files_examined: string[];
  action_type: 'review' | 'audit' | 'build' | 'debug';
}

function readTargetFile(filePath: string): string | null {
  try {
    const abs = path.isAbsolute(filePath)
      ? filePath
      : path.join(REPO_ROOT, 'server/src', filePath);
    if (!fs.existsSync(abs)) return null;
    const content = fs.readFileSync(abs, 'utf8');
    // Limit to 3000 chars for context window
    return content.length > 3000 ? content.substring(0, 3000) + '\n... [truncated]' : content;
  } catch {
    return null;
  }
}

function detectActionType(intent: string, command: string): 'review' | 'audit' | 'build' | 'debug' {
  const t = (intent + ' ' + command).toLowerCase();
  if (/review|audit/.test(t)) return t.includes('audit') ? 'audit' : 'review';
  if (/build|feature|create|add/.test(t)) return 'build';
  if (/fix|bug|debug|error/.test(t)) return 'debug';
  return 'review';
}

export async function executeEngineeringRequest(req: EngineeringRequest): Promise<EngineeringReport> {
  const { pipeline_id, intent, command, target_file } = req;

  const dataStep = recordStep(pipeline_id, DEPT_ID, 'engineering_context_gather', { intent, target_file });

  const filesExamined: string[] = [];
  const contextParts: string[] = [];
  const actionType = detectActionType(intent, command);

  // Read target file if specified
  if (target_file) {
    const content = readTargetFile(target_file);
    if (content) {
      filesExamined.push(target_file);
      contextParts.push(`File: ${target_file}\n\`\`\`\n${content}\n\`\`\``);
    }
  }

  // Read recent Company OS pipeline evidence for context
  const recentRuns = recentPipelineRuns(5);
  contextParts.push(`Recent pipeline history (for context):\n${JSON.stringify(
    recentRuns.map(r => ({ cmd: r.ceo_command.substring(0, 50), status: r.status })), null, 2
  )}`);

  // For audit: list company-os files
  if (actionType === 'audit') {
    try {
      const cosDir = path.join(REPO_ROOT, 'server/src/company-os');
      const files = fs.readdirSync(cosDir).filter(f => f.endsWith('.ts'));
      filesExamined.push(...files.map(f => `company-os/${f}`));
      contextParts.push(`Company OS files:\n${files.join('\n')}`);
    } catch {
      // directory not readable
    }
  }

  completeStep(dataStep.id, {
    action_type: actionType,
    files_examined: filesExamined,
    context_size: contextParts.join('').length,
  }, filesExamined.length > 0 ? 0.88 : 0.70);

  // Approval gate — always required for engineering
  const approvalStep = recordStep(pipeline_id, DEPT_ID, 'approval_gate_check', { requires_approval: true });
  completeStep(approvalStep.id, {
    policy: 'REQUIRES_APPROVAL',
    message: 'Engineering output requires CEO approval. No code changes applied yet.',
  }, 1.0);

  const prompt = actionType === 'review'
    ? `Review the following code for correctness, security, and quality. Command: ${command}`
    : actionType === 'audit'
    ? `Audit the codebase structure. Identify: dead code, missing tests, security issues. Command: ${command}`
    : actionType === 'debug'
    ? `Debug the issue described. Identify root cause and propose a minimal fix. Command: ${command}`
    : `Plan the feature build. Describe: files to change, interfaces to add, tests needed. Command: ${command}`;

  const runtimeResult: RuntimeOutput = await runDepartment({
    pipeline_id,
    dept_id: DEPT_ID,
    intent,
    command: prompt,
    extra_context: contextParts.join('\n\n') || undefined,
  });

  return {
    ...runtimeResult,
    dept_id: DEPT_ID,
    dept_name: 'Engineering',
    requires_approval: true,
    files_examined: filesExamined,
    action_type: actionType,
    summary: `Engineering ${actionType} complete. ${filesExamined.length} file(s) examined. CEO approval required before any code is committed.`,
  };
}
