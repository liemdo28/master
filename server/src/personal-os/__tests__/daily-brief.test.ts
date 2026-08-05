import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PersonalOsService } from '../service';
import { PersonalOsStore } from '../store';
import { TaskStore } from '../../task-runtime/store';
import { ProjectRegistryService } from '../../project-registry/service';
import { TaskEngine } from '../../task-runtime/engine';

function run() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-daily-brief-'));
  process.env.MI_TEST_TODAY = '2026-08-05';
  process.env.MI_PROJECT_REGISTRY_DIR = path.join(root, 'projects');
  const store = new PersonalOsStore(path.join(root, 'personal'));
  const tasks = new TaskStore(path.join(root, 'tasks'));
  const service = new PersonalOsService(store, tasks, new ProjectRegistryService());
  const goal = store.createGoal({ title: 'Organize Mi work', projectIds: ['mi-core'] });
  store.updateGoalStatus(goal.id, 'ACTIVE');
  const engine = new TaskEngine(tasks);
  const task = engine.createTask({ userRequest: 'Review pending work', riskLevel: 'read-only' });
  engine.transition(task.id, 'CONTEXT_BUILDING');
  engine.transition(task.id, 'PLANNING');
  engine.transition(task.id, 'WAITING_APPROVAL');

  const brief = service.generateDailyBrief();
  assert.strictEqual(brief.date, '2026-08-05');
  assert.ok(brief.facts.some(fact => fact.includes('goal')));
  assert.ok(brief.suggestions.length > 0);
  assert.ok(brief.unknowns.some(item => item.includes('Calendar')));
  assert.ok(brief.pendingApprovals.length > 0);
  assert.ok(brief.evidenceReferences.some(ref => ref.includes(task.id)));

  service.close();
  const restarted = new PersonalOsStore(path.join(root, 'personal'));
  assert.strictEqual(restarted.latestDailyBrief('2026-08-05')?.id, brief.id);
  restarted.close();
  fs.rmSync(root, { recursive: true, force: true });
  delete process.env.MI_TEST_TODAY;
  delete process.env.MI_PROJECT_REGISTRY_DIR;
  console.log('[daily-brief] PASS');
}

run();
