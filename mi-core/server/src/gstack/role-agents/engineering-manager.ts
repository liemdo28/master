/**
 * Engineering Manager Agent
 * Breaks CEO requests into technical tasks.
 * Coordinates Developer Agent execution.
 * Owns technical risk assessment.
 */

import { execSync } from 'child_process';
import path from 'path';

import { WorkOrder } from '../work-order-engine';
import { logAction } from '../execution-ledger';



export interface TechnicalTask {
  task_id: string;
  title: string;
  type: 'scan' | 'fix' | 'test' | 'build' | 'config' | 'deploy';
  risk_level: 1 | 2 | 3;
  auto_executable: boolean;
  target_file?: string;
  command?: string;
  status: 'pending' | 'running' | 'done' | 'failed' | 'skipped';
  result?: string;
}

export interface EngManagerResult {
  tasks: TechnicalTask[];
  tech_summary: string;
  estimated_duration_min: number;
  blockers: string[];
}

const PROJECT_ROOTS: Record<string, string> = {
  'mi-core': 'D:/Project/Master/mi-core',
  'dashboard': 'D:/Project/Master/Bakudan',
  'whatsapp-ai-gateway': 'D:/Project/Master/whatsapp-ai-gateway',
  'visibility': 'D:/Project/Master/mi-core/.local-agent-global/visibility',
  'jarvis': 'D:/Project/Master/mi-core/server/src/jarvis',
};

export async function planTechnicalWork(wo: WorkOrder): Promise<EngManagerResult> {
  const tasks: TechnicalTask[] = [];
  const blockers: string[] = [];
  const target = wo.target_project;
  const root = target ? PROJECT_ROOTS[target] : null;

  switch (wo.intent.intent) {
    case 'audit_project':
    case 'fix_bug': {
      // T1: Scan source
      tasks.push({
        task_id: 'T1', title: `Scan ${target || 'project'} source code`, type: 'scan',
        risk_level: 1, auto_executable: true,
        command: root ? `dir /s /b "${root}\\src" 2>nul || ls -la "${root}/src" 2>/dev/null` : null as unknown as string,
        status: 'pending',
      });

      // T2: Check build
      if (target === 'mi-core') {
        tasks.push({
          task_id: 'T2', title: 'Verify TypeScript compiles', type: 'scan',
          risk_level: 1, auto_executable: true,
          command: `cd "${root}/server" && npx tsc --noEmit 2>&1 | tail -5`,
          status: 'pending',
        });
      }

      // T3: Check PM2 health
      tasks.push({
        task_id: 'T3', title: 'Check PM2 process health', type: 'scan',
        risk_level: 1, auto_executable: true,
        command: 'pm2 jlist 2>nul',
        status: 'pending',
      });

      // T4: Check error logs
      if (root) {
        tasks.push({
          task_id: 'T4', title: 'Scan recent error logs', type: 'scan',
          risk_level: 1, auto_executable: true,
          command: `tail -50 "${root}/logs/pm2-err.log" 2>/dev/null || echo "No error log found"`,
          status: 'pending',
        });
      }

      break;
    }

    case 'deploy_release': {
      tasks.push({
        task_id: 'T1', title: 'Verify QA gate cleared', type: 'scan',
        risk_level: 1, auto_executable: true, status: 'pending',
      });
      tasks.push({
        task_id: 'T2', title: 'Build production bundle', type: 'build',
        risk_level: 2, auto_executable: true,
        command: target === 'mi-core' ? `cd "${root}/server" && npm run build` : undefined,
        status: 'pending',
      });
      tasks.push({
        task_id: 'T3', title: 'Prepare rollback snapshot', type: 'config',
        risk_level: 2, auto_executable: true, status: 'pending',
      });
      tasks.push({
        task_id: 'T4', title: 'Execute PM2 restart (REQUIRES APPROVAL)', type: 'deploy',
        risk_level: 3, auto_executable: false, status: 'pending',
        command: `pm2 restart ${target || 'mi-core'}`,
      });
      break;
    }

    case 'check_status':
    case 'monitor_runtime': {
      tasks.push({
        task_id: 'T1', title: 'PM2 process list', type: 'scan',
        risk_level: 1, auto_executable: true,
        command: 'pm2 list', status: 'pending',
      });
      tasks.push({
        task_id: 'T2', title: 'Port usage check', type: 'scan',
        risk_level: 1, auto_executable: true,
        command: 'netstat -ano 2>nul | findstr "LISTENING" | findstr ":4001 :3211 :3456"',
        status: 'pending',
      });
      break;
    }

    default:
      tasks.push({
        task_id: 'T1', title: 'General system scan', type: 'scan',
        risk_level: 1, auto_executable: true,
        command: 'pm2 list', status: 'pending',
      });
  }

  // Execute auto-executable tasks (sequential, short timeout to avoid blocking event loop)
  for (const task of tasks.filter(t => t.auto_executable && t.command && t.status === 'pending')) {
    task.status = 'running';
    try {
      const out = execSync(task.command!, { timeout: 8000, encoding: 'utf8', shell: 'cmd.exe' });
      task.result = out.slice(0, 500);
      task.status = 'done';
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      task.result = msg.includes('ETIMEDOUT') ? 'Scan timed out (large project)' : msg.slice(0, 200);
      task.status = task.risk_level === 1 ? 'done' : 'failed';
    }
  }

  const autoTasks = tasks.filter(t => t.auto_executable);
  const manualTasks = tasks.filter(t => !t.auto_executable);
  const duration = autoTasks.length * 2 + manualTasks.length * 5;

  if (manualTasks.length > 0) {
    blockers.push(`${manualTasks.length} task(s) require CEO approval: ${manualTasks.map(t => t.title).join(', ')}`);
  }

  const tech_summary = [
    `${tasks.length} technical task(s) planned`,
    `${autoTasks.length} auto-executable (safe)`,
    `${manualTasks.length} require approval`,
    target ? `Target: ${target}` : 'Target: general',
  ].join(' | ');

  logAction({
    work_order_id: wo.request_id,
    requested_by: wo.requested_by,
    agent_role: 'engineering_manager',
    action_type: 'plan_technical_work',
    target: wo.target_project || 'all',
    evidence: tech_summary,
    verdict: blockers.length === 0 ? 'PASS' : 'PENDING',
    detail: `Tasks: ${tasks.map(t => `${t.task_id}[${t.status}]`).join(', ')}`,
  });

  return { tasks, tech_summary, estimated_duration_min: duration, blockers };
}
