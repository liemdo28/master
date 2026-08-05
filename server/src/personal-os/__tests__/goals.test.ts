import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PersonalOsService } from '../service';
import { PersonalOsStore } from '../store';
import { TaskStore } from '../../task-runtime/store';
import { ProjectRegistryService, seedMiCoreProject } from '../../project-registry/service';

function run() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-goals-'));
  process.env.MI_TASK_RUNTIME_DIR = path.join(root, 'tasks');
  process.env.MI_PROJECT_REGISTRY_DIR = path.join(root, 'projects');
  process.env.MI_PROJECT_REGISTRY_WORKSPACE_ROOTS = process.cwd();
  const store = new PersonalOsStore(path.join(root, 'personal'));
  const tasks = new TaskStore(path.join(root, 'tasks'));
  const registry = new ProjectRegistryService();
  registry.registerProject(seedMiCoreProject(process.cwd()));
  const service = new PersonalOsService(store, tasks, registry);

  const goal = store.createGoal({
    title: 'Prepare and organize the next development work for Mi without modifying production.',
    projectIds: ['mi-core'],
    successCriteria: ['No production changes', 'Draft tasks only'],
  });
  assert.strictEqual(goal.status, 'DRAFT');
  const planned = service.planGoal(goal.id);
  assert.ok(planned.plan.milestones.length <= 5);
  assert.ok(planned.plan.proposedTasks.length <= 10);
  assert.strictEqual(planned.childTaskIds.length, planned.plan.proposedTasks.length);
  for (const id of planned.childTaskIds) {
    const task = tasks.getTask(id);
    assert.strictEqual(task?.status, 'WAITING_APPROVAL');
    assert.strictEqual(task?.parentTaskId, goal.id);
  }

  assert.strictEqual(store.updateGoalStatus(goal.id, 'ACTIVE').status, 'ACTIVE');
  assert.strictEqual(store.updateGoalStatus(goal.id, 'PAUSED').status, 'PAUSED');
  assert.strictEqual(store.updateGoalStatus(goal.id, 'ACTIVE').status, 'ACTIVE');
  assert.throws(() => store.updateGoalStatus(goal.id, 'DRAFT'), /invalid goal transition/);

  service.close();
  const restarted = new PersonalOsStore(path.join(root, 'personal'));
  assert.ok(restarted.getGoal(goal.id));
  assert.ok(restarted.getGoalPlan(goal.id).childTaskIds.length > 0);
  restarted.close();
  fs.rmSync(root, { recursive: true, force: true });
  console.log('[goals] PASS');
}

run();
