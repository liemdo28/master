import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import assert from 'assert';
import { ProjectRegistryService, seedMiCoreProject } from '../project-registry/service';
import { CodingWorkflow, INTERNAL_ENGINE_ID } from './workflow';

async function run() {
  const repoRoot = path.resolve(process.cwd(), '..');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-coding-acceptance-'));
  process.env.MI_PROJECT_REGISTRY_DIR = path.join(tmpDir, 'registry');
  process.env.MI_TASK_RUNTIME_DIR = path.join(tmpDir, 'tasks');
  process.env.MI_CODING_WORKTREE_ROOT = path.join(tmpDir, 'worktrees');
  process.env.MI_PROJECT_REGISTRY_WORKSPACE_ROOTS = [repoRoot, tmpDir].join(path.delimiter);
  process.env.MI_TASK_RUNTIME_WORKSPACE_ROOTS = [repoRoot, tmpDir].join(path.delimiter);

  const service = new ProjectRegistryService();
  const workflow = new CodingWorkflow(undefined, service);
  try {
    const project = service.registerProject(seedMiCoreProject(repoRoot));
    const map = service.generateProjectMap(project.id);
    const pack = service.buildContextPack(project.id, 'Add a read-only endpoint that returns the active coding engine registry and model roles');
    const result = await workflow.run({
      projectId: project.id,
      contextPackId: pack.id,
      mapVersion: map.mapVersion,
      userRequest: 'Add a read-only endpoint that returns the active coding engine registry and model roles',
      commitPolicy: 'local-only',
      maxRetries: 1,
      engineId: INTERNAL_ENGINE_ID,
    });
    if (result.task.status !== 'COMPLETED') {
      console.error(JSON.stringify({
        status: result.task.status,
        validation: result.validation.map(item => ({ name: item.name, configured: item.configured, exitCode: item.exitCode, timedOut: item.timedOut, stderr: item.stderr.slice(0, 500) })),
        review: result.review,
      }, null, 2));
    }
    assert.strictEqual(result.task.status, 'COMPLETED');
    assert.ok(result.commitSha);
    assert.strictEqual(result.review.status, 'PASS');
    assert.ok(result.apply.changedFiles.includes('server/src/routes/coding.ts'));
    console.log(JSON.stringify({
      acceptanceRoot: tmpDir,
      taskId: result.task.id,
      worktreePath: result.task.worktreePath,
      commitSha: result.commitSha,
      status: result.task.status,
    }, null, 2));
  } finally {
    workflow.close();
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
