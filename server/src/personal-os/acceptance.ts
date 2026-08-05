import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PersonalOsService } from './service';
import { PersonalOsStore } from './store';
import { TaskStore } from '../task-runtime/store';
import { ProjectRegistryService, seedMiCoreProject } from '../project-registry/service';

async function run() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-phase5a-acceptance-'));
  process.env.MI_TASK_RUNTIME_DIR = path.join(root, 'tasks');
  process.env.MI_PROJECT_REGISTRY_DIR = path.join(root, 'projects');
  process.env.MI_PROJECT_REGISTRY_WORKSPACE_ROOTS = process.cwd();
  process.env.MI_PERSONAL_OS_DIR = path.join(root, 'personal');
  process.env.MI_TEST_TODAY = '2026-08-05';

  const registry = new ProjectRegistryService();
  registry.registerProject(seedMiCoreProject(process.cwd()));
  const map = registry.generateProjectMap('mi-core');
  const context = registry.buildContextPack('mi-core', 'Retrieve current tagged v1.0 state and plan safe Phase 5A work.');
  const service = new PersonalOsService(new PersonalOsStore(path.join(root, 'personal')), new TaskStore(path.join(root, 'tasks')), registry);

  const goal = service.store.createGoal({
    title: 'Prepare and organize the next development work for Mi without modifying production.',
    projectIds: ['mi-core'],
    successCriteria: ['Draft child tasks only', 'No automatic execution', 'Daily brief persists'],
    constraints: ['No push', 'No merge', 'No deploy', 'No email', 'No publish'],
  });
  const planned = service.planGoal(goal.id);
  const brief = service.generateDailyBrief();
  assert.strictEqual(map.status, 'FRESH');
  assert.ok(context.id);
  assert.ok(planned.plan.milestones.length <= 5);
  assert.ok(planned.childTaskIds.length <= 10);
  for (const taskId of planned.childTaskIds) {
    assert.strictEqual(service.taskStore.getTask(taskId)?.status, 'WAITING_APPROVAL');
  }

  const goalId = goal.id;
  const childTaskIds = planned.childTaskIds;
  const briefId = brief.id;
  service.close();

  const restarted = new PersonalOsService(new PersonalOsStore(path.join(root, 'personal')), new TaskStore(path.join(root, 'tasks')), new ProjectRegistryService());
  assert.ok(restarted.store.getGoal(goalId));
  assert.strictEqual(restarted.store.getDailyBrief(briefId)?.id, briefId);
  for (const taskId of childTaskIds) {
    assert.strictEqual(restarted.taskStore.getTask(taskId)?.status, 'WAITING_APPROVAL');
  }
  restarted.close();

  console.log(JSON.stringify({
    status: 'PASS',
    goalId,
    mapVersion: map.mapVersion,
    contextPackId: context.id,
    childTaskIds,
    dailyBriefId: briefId,
    restartPersistence: true,
    automaticExternalActions: false,
  }, null, 2));

  fs.rmSync(root, { recursive: true, force: true });
  delete process.env.MI_TEST_TODAY;
}

run().catch(err => {
  console.error('[phase5a] FAIL', err);
  process.exit(1);
});
