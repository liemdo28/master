/**
 * Release Agent
 * Owns deployment, rollback, and production readiness.
 * All deployment actions require CEO approval (risk_level 3).
 */

import { execSync } from 'child_process';
import { WorkOrder } from '../work-order-engine';
import { logAction } from '../execution-ledger';

export interface ReleaseCheckResult {
  ready: boolean;
  checklist: Array<{ item: string; status: 'PASS' | 'FAIL' | 'SKIP'; note: string }>;
  rollback_plan: string;
  blockers: string[];
}

const PM2_NAMES: Record<string, string> = {
  'mi-core': 'mi-core',
  'whatsapp-ai-gateway': 'whatsapp-ai-gateway',
  'antigravity-gateway': 'antigravity-gateway',
};

export async function prepareRelease(wo: WorkOrder, qaCleared: boolean): Promise<ReleaseCheckResult> {
  const target = wo.target_project || 'mi-core';
  const pm2Name = PM2_NAMES[target] || target;
  const checklist: ReleaseCheckResult['checklist'] = [];
  const blockers: string[] = [];

  // Check 1: QA gate
  checklist.push({
    item: 'QA gate cleared',
    status: qaCleared ? 'PASS' : 'FAIL',
    note: qaCleared ? 'All required QA checks passed' : 'QA checks not completed — cannot deploy',
  });
  if (!qaCleared) blockers.push('QA gate not cleared');

  // Check 2: PM2 process exists
  try {
    const out = execSync('pm2 jlist', { timeout: 8000, encoding: 'utf8' });
    const procs = JSON.parse(out);
    const proc = procs.find((p: { name: string }) => p.name === pm2Name);
    checklist.push({
      item: `PM2 process '${pm2Name}' exists`,
      status: proc ? 'PASS' : 'FAIL',
      note: proc ? `PID ${proc.pid} | Restarts: ${proc.pm2_env?.restart_time}` : 'Process not found in PM2',
    });
    if (!proc) blockers.push(`PM2 process ${pm2Name} not found`);
  } catch {
    checklist.push({ item: 'PM2 accessible', status: 'FAIL', note: 'PM2 jlist failed' });
    blockers.push('PM2 not accessible');
  }

  // Check 3: Build dist exists (mi-core)
  if (target === 'mi-core') {
    const distPath = 'E:/Project/Master/mi-core/server/dist/index.js';
    try {
      const { existsSync } = await import('fs');
      const exists = existsSync(distPath);
      checklist.push({
        item: 'Production build dist exists',
        status: exists ? 'PASS' : 'FAIL',
        note: exists ? distPath : `Not found: ${distPath}`,
      });
      if (!exists) blockers.push('Production build not found — run npm run build first');
    } catch {
      checklist.push({ item: 'Production build dist exists', status: 'SKIP', note: 'Could not check' });
    }
  }

  // Rollback plan
  const rollbackPlan = [
    `To rollback ${target}:`,
    `1. pm2 stop ${pm2Name}`,
    `2. git checkout HEAD~1 -- server/dist/ (if built from source)`,
    `3. pm2 start ${pm2Name}`,
    `4. Verify health: curl http://127.0.0.1:4001/api/health`,
  ].join('\n');

  const ready = blockers.length === 0;

  logAction({
    work_order_id: wo.request_id,
    requested_by: wo.requested_by,
    agent_role: 'release_agent',
    action_type: 'release_readiness_check',
    target,
    evidence: checklist.map(c => `[${c.status}] ${c.item}`).join(' | '),
    verdict: ready ? 'APPROVAL_REQUIRED' : 'FAIL',
    detail: blockers.length > 0 ? `Blockers: ${blockers.join(', ')}` : 'Ready for CEO approval',
  });

  return { ready, checklist, rollback_plan: rollbackPlan, blockers };
}

export async function executeRestart(wo: WorkOrder, pm2Name: string): Promise<{ success: boolean; output: string }> {
  // This action requires prior CEO approval — caller must verify before calling
  try {
    const out = execSync(`pm2 restart ${pm2Name}`, { timeout: 30000, encoding: 'utf8' });
    logAction({
      work_order_id: wo.request_id,
      requested_by: wo.requested_by,
      agent_role: 'release_agent',
      action_type: 'pm2_restart',
      target: pm2Name,
      command_run: `pm2 restart ${pm2Name}`,
      evidence: out.slice(0, 200),
      verdict: 'PASS',
    });
    return { success: true, output: out };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logAction({
      work_order_id: wo.request_id,
      requested_by: wo.requested_by,
      agent_role: 'release_agent',
      action_type: 'pm2_restart',
      target: pm2Name,
      command_run: `pm2 restart ${pm2Name}`,
      evidence: msg.slice(0, 200),
      verdict: 'FAIL',
    });
    return { success: false, output: msg };
  }
}
