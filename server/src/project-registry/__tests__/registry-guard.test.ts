import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ProjectRegistryService, seedMiCoreProject } from '../service';
import { TaskEngine } from '../../task-runtime/engine';
import { TaskStore } from '../../task-runtime/store';

function log(message: string) {
  console.log(`[project-registry] ${message}`);
}

async function run() {
  const repoRoot = path.resolve(process.cwd(), '..');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-project-registry-test-'));
  process.env.MI_PROJECT_REGISTRY_DIR = path.join(tmpDir, 'registry');
  process.env.MI_TASK_RUNTIME_DIR = path.join(tmpDir, 'tasks');
  process.env.MI_TASK_RUNTIME_WORKSPACE_ROOTS = repoRoot;

  const service = new ProjectRegistryService();
  const taskStore = new TaskStore();
  const taskEngine = new TaskEngine(taskStore);
  try {
    const project = service.registerProject(seedMiCoreProject(repoRoot));
    assert.strictEqual(project.id, 'mi-core');
    assert.strictEqual(project.status, 'ACTIVE');
    assert.ok(project.packageManagers.includes('npm'));
    log('registered Mi Core without broad scanner');

    const map = service.generateProjectMap(project.id);
    assert.strictEqual(map.status, 'FRESH');
    assert.ok(map.modules.some(module => module.name === 'task-runtime'));
    assert.ok(map.modules.some(module => module.name === 'project-registry'));
    log(`generated project map ${map.mapVersion}`);

    const pack = service.buildContextPack(project.id, 'project registry task runtime guard');
    assert.strictEqual(pack.projectId, project.id);
    assert.strictEqual(pack.mapVersion, map.mapVersion);
    assert.notStrictEqual(pack.policy, 'REMAP_REQUIRED');
    log(`created context pack ${pack.id}`);

    const task = taskEngine.createTask({
      taskKind: 'coding',
      userRequest: 'Registry-aware coding task',
      projectId: project.id,
      mapVersion: map.mapVersion,
      contextPackId: pack.id,
      workingDirectory: repoRoot,
    });
    assert.strictEqual(task.status, 'CREATED');
    assert.strictEqual(task.taskKind, 'coding');
    assert.strictEqual(task.projectId, project.id);
    log('allowed coding task with matching project map and context pack');

    assert.throws(() => taskEngine.createTask({
      taskKind: 'coding',
      userRequest: 'Missing context pack must fail',
      projectId: project.id,
      mapVersion: map.mapVersion,
      workingDirectory: repoRoot,
    }), /contextPackId/);
    log('rejected missing context pack');

    assert.throws(() => taskEngine.createTask({
      taskKind: 'coding',
      userRequest: 'Outside cwd must fail',
      projectId: project.id,
      mapVersion: map.mapVersion,
      contextPackId: pack.id,
      workingDirectory: os.tmpdir(),
    }), /workspace roots|inside canonical project root/);
    log('rejected coding task outside project boundary');
  } finally {
    service.close();
    taskStore.close();
  }

  log('PASS');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
