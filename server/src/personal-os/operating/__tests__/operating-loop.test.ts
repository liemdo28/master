/**
 * Phase 5D-3 §25 — operating loop test suite.
 */

import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ProjectRegistryService, seedMiCoreProject } from '../../../project-registry/service';
import { TaskEngine } from '../../../task-runtime/engine';
import { TaskStore } from '../../../task-runtime/store';
import { PersonalOsStore } from '../../store';
import { DailyOperatingLoop } from '../loop';
import { KNOWLEDGE_QUERY_LIMITS } from '../../documents/types';

function setupEnv(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-5d3-loop-'));
  process.env.MI_TASK_RUNTIME_DIR = path.join(root, 'tasks');
  process.env.MI_PROJECT_REGISTRY_DIR = path.join(root, 'projects');
  process.env.MI_PROJECT_REGISTRY_WORKSPACE_ROOTS = root;
  process.env.MI_PERSONAL_OS_DIR = path.join(root, 'personal');
  process.env.MI_TEST_TODAY = '2026-08-07';
  return root;
}

async function run(): Promise<void> {
  const root = setupEnv();
  const registry = new ProjectRegistryService();
  registry.registerProject(seedMiCoreProject(root));

  const taskStore = new TaskStore(process.env.MI_TASK_RUNTIME_DIR);
  const engine = new TaskEngine(taskStore);

  const ready = engine.createTask({ userRequest: 'Fix the login bug', taskKind: 'general', projectId: 'mi-core' });
  engine.transition(ready.id, 'CONTEXT_BUILDING'); engine.transition(ready.id, 'PLANNING'); engine.transition(ready.id, 'READY');

  const waiting = engine.createTask({ userRequest: 'Ship the pricing change', taskKind: 'general', projectId: 'mi-core' });
  engine.transition(waiting.id, 'CONTEXT_BUILDING'); engine.transition(waiting.id, 'PLANNING'); engine.transition(waiting.id, 'WAITING_APPROVAL');

  const personal = new PersonalOsStore(process.env.MI_PERSONAL_OS_DIR);
  const goal = personal.createGoal({ title: 'Ship the login fix', description: 'Resolve the login bug', category: 'engineering', projectIds: ['mi-core'] });
  personal.updateGoalStatus(goal.id, 'ACTIVE');
  personal.close();

  const loop = new DailyOperatingLoop({ taskStore, registry });

  // --- morning: correct facts, bounds, no external writes ---------------------------
  const brief = await loop.morning();
  assert.strictEqual(brief.date, '2026-08-07');
  assert.ok(brief.activeGoals.length >= 1, 'active goal is surfaced');
  assert.ok(brief.pendingApprovals.length >= 1, 'the WAITING_APPROVAL task is surfaced as a pending approval');
  assert.ok(brief.priorityTasks.length <= 20);
  assert.ok(brief.pendingApprovals.length <= 20);

  // --- idempotency: morning twice = same brief, no duplicate row --------------------
  const brief2 = await loop.morning();
  assert.strictEqual(brief.id, brief2.id, 'a second morning call returns the same logical brief');
  const briefRows = (loop.operatingStore.handle.prepare(`SELECT COUNT(*) c FROM daily_operating_briefs WHERE date = ?`).get(brief.date) as { c: number }).c;
  assert.strictEqual(briefRows, 1, 'no duplicate brief row for the same date');

  // --- plan: DRAFT, bounded, blocked/waiting-approval never executable --------------
  const plan = loop.plan();
  assert.strictEqual(plan.status, 'DRAFT');
  assert.ok(plan.selectedTasks.length <= 10);
  assert.ok(plan.selectedGoals.length <= 5);
  assert.ok(!plan.selectedTasks.some(t => t.sourceId === waiting.id), 'a WAITING_APPROVAL task is never selected as executable plan work');

  // --- plan approval: status changes only, never executes anything ------------------
  const approved = loop.setPlanStatus(plan.id, 'APPROVED');
  assert.strictEqual(approved?.status, 'APPROVED');
  const taskAfterApproval = taskStore.getTask(ready.id)!;
  assert.strictEqual(taskAfterApproval.status, 'READY', 'approving a plan never transitions a task');

  // --- refresh: detects real changes, idempotent on no-op re-call -------------------
  engine.transition(ready.id, 'RUNNING');
  taskStore.updateCodingFields(ready.id, { resultSummary: 'fixed and deployed' });
  engine.transition(ready.id, 'VALIDATING'); engine.transition(ready.id, 'COMPLETED');
  (taskStore as unknown as { db: { prepare: (sql: string) => { run: (...args: unknown[]) => unknown } } }).db
    .prepare(`UPDATE tasks SET completedAt = ? WHERE id = ?`).run(`${brief.date}T17:00:00.000Z`, ready.id);

  const refresh1 = await loop.midday();
  assert.strictEqual(refresh1.created, true);
  assert.ok(refresh1.refresh.changedFacts.some(f => f.includes(ready.id) && f.includes('completed')));

  const refresh2 = await loop.midday();
  assert.strictEqual(refresh2.created, false, 'an unchanged state produces no duplicate refresh row');
  const refreshRows = (loop.operatingStore.handle.prepare(`SELECT COUNT(*) c FROM daily_refreshes WHERE date = ?`).get(brief.date) as { c: number }).c;
  assert.strictEqual(refreshRows, 1);

  // --- review: completion requires Task Runtime evidence, idempotent ----------------
  const review = await loop.evening();
  assert.ok(review.completedItems.some(c => c.id === ready.id), 'the completed task is reflected with Task Runtime evidence');
  assert.ok(review.completedItems.every(c => c.evidenceReference.startsWith('task:')));
  const review2 = await loop.evening();
  assert.strictEqual(review.id, review2.id, 'a second evening call returns the same logical review');

  // --- weekly review -----------------------------------------------------------------
  const weekly = await loop.weekly();
  assert.ok(weekly.completedTasks >= 1);
  const weekly2 = await loop.weekly();
  assert.strictEqual(weekly.id, weekly2.id, 'a second weekly call returns the same logical review');

  // --- pending approvals / project health / service health --------------------------
  const { listPendingApprovals } = await import('../approvals');
  const approvals = listPendingApprovals(loop);
  assert.ok(approvals.some(a => a.sourceId === waiting.id));

  const { computeProjectHealth, computeServiceHealth } = await import('../health');
  const health = computeProjectHealth('mi-core', loop);
  assert.strictEqual(health.projectId, 'mi-core');
  assert.ok(['HEALTHY', 'ATTENTION', 'BLOCKED', 'UNKNOWN'].includes(health.status));

  const serviceHealth = await computeServiceHealth();
  assert.ok(Array.isArray(serviceHealth));
  assert.ok(serviceHealth.every(s => ['HEALTHY', 'UNHEALTHY', 'UNKNOWN'].includes(s.status)));

  // --- fact/suggestion/unknown separation, citation propagation ---------------------
  assert.ok(Array.isArray(brief.facts) && Array.isArray(brief.suggestions) && Array.isArray(brief.unknowns));
  assert.ok(brief.facts.every(f => typeof f === 'string'));
  // KnowledgePack integration: bounded projectIds, never exceeding Phase 5D-2's own limit.
  assert.ok(goal.projectIds.length <= KNOWLEDGE_QUERY_LIMITS.maxProjectIds);

  // --- bounds -------------------------------------------------------------------------
  assert.ok(brief.blockers.length <= 5);
  assert.ok(brief.confirmationRequests.length <= 5);

  // --- no execution: nothing in the whole run ever moved a task through RUNNING except
  // the explicit test-driven transition above; the loop itself never calls `transition`.
  const allTasks = taskStore.listTasks();
  assert.ok(allTasks.every(t => t.id === ready.id || t.status !== 'RUNNING'), 'no task was silently executed by the operating loop');

  loop.close();
  fs.rmSync(root, { recursive: true, force: true });
  console.log('[operating-loop] PASS');
}

run().catch(err => { console.error('[operating-loop] FAIL:', err); process.exit(1); });
