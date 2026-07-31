import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { TaskEngine } from '../task-runtime/engine';
import { TaskStore } from '../task-runtime/store';
import { ProjectRegistryService, seedMiCoreProject } from './service';

async function main(): Promise<boolean> {
  const repoRoot = process.env.MI_PROJECT_REGISTRY_ACCEPTANCE_ROOT ?? path.resolve(process.cwd(), '..');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-project-registry-'));
  process.env.MI_PROJECT_REGISTRY_DIR = path.join(tempDir, 'registry');
  process.env.MI_TASK_RUNTIME_DIR = path.join(tempDir, 'tasks');
  process.env.MI_TASK_RUNTIME_WORKSPACE_ROOTS = repoRoot;

  const service = new ProjectRegistryService();
  const taskStore = new TaskStore();
  const taskEngine = new TaskEngine(taskStore);
  try {
    const project = service.registerProject(seedMiCoreProject(repoRoot));
    const verified = service.verifyProject(project.id);
    const map = service.generateProjectMap(project.id);
    const resume = service.buildResumeContext(project.id, null, 'Acceptance resume context.');
    const pack = service.buildContextPack(project.id, 'task runtime project registry guard', resume.id);
    const task = taskEngine.createTask({
      taskKind: 'coding',
      userRequest: 'Acceptance coding task with registry context.',
      projectId: project.id,
      mapVersion: map.mapVersion,
      contextPackId: pack.id,
      workingDirectory: repoRoot,
    });

    let rejectedOutside = false;
    try {
      taskEngine.createTask({
        taskKind: 'coding',
        userRequest: 'Invalid outside cwd should fail.',
        projectId: project.id,
        mapVersion: map.mapVersion,
        contextPackId: pack.id,
        workingDirectory: os.tmpdir(),
      });
    } catch {
      rejectedOutside = true;
    }

    const summary = {
      ok: verified.status === 'ACTIVE' && map.status === 'FRESH' && pack.policy !== 'REMAP_REQUIRED' && task.status === 'CREATED' && rejectedOutside,
      projectId: project.id,
      mapVersion: map.mapVersion,
      contextPackId: pack.id,
      taskId: task.id,
      rejectedOutside,
    };
    console.log(JSON.stringify(summary, null, 2));
    return summary.ok;
  } finally {
    service.close();
    taskStore.close();
  }
}

main()
  .then(ok => {
    if (!ok) process.exitCode = 1;
  })
  .catch(err => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  });
