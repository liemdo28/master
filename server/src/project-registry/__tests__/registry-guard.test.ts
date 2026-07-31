import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { ProjectRegistryService, seedMiCoreProject } from '../service';
import { TaskEngine } from '../../task-runtime/engine';
import { TaskStore } from '../../task-runtime/store';

function log(message: string) {
  console.log(`[project-registry] ${message}`);
}

async function run() {
  const repoRoot = path.resolve(process.cwd(), '..');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-project-registry-test-'));
  const fixtureRoot = path.join(tmpDir, 'fixture-project');
  createGitFixture(fixtureRoot);
  const nonGitRoot = path.join(tmpDir, 'non-git-project');
  fs.mkdirSync(nonGitRoot, { recursive: true });
  fs.writeFileSync(path.join(nonGitRoot, 'package.json'), JSON.stringify({ scripts: { build: 'tsc' } }));
  process.env.MI_PROJECT_REGISTRY_DIR = path.join(tmpDir, 'registry');
  process.env.MI_PROJECT_REGISTRY_WORKSPACE_ROOTS = [repoRoot, tmpDir].join(path.delimiter);
  process.env.MI_TASK_RUNTIME_DIR = path.join(tmpDir, 'tasks');
  process.env.MI_TASK_RUNTIME_WORKSPACE_ROOTS = [repoRoot, tmpDir].join(path.delimiter);

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
    assert.ok(map.sourceSha);
    assert.ok(map.modules.some(module => module.name === 'task-runtime'));
    assert.ok(map.modules.some(module => module.name === 'project-registry'));
    assert.ok(map.modules.every(module => module.paths.length <= 25));
    assert.ok(!JSON.stringify(map).includes('node_modules'));
    assert.ok(!JSON.stringify(map).includes('fixture-secret'));
    log(`generated project map ${map.mapVersion}`);

    const pack = service.buildContextPack(project.id, 'project registry task runtime guard');
    assert.strictEqual(pack.projectId, project.id);
    assert.strictEqual(pack.mapVersion, map.mapVersion);
    assert.strictEqual(pack.sourceSha, map.sourceSha);
    assert.strictEqual(pack.mapStatus, 'FRESH');
    assert.ok(pack.moduleSummaries.some(summary => summary.includes('task-runtime')));
    assert.ok(pack.excludedPaths.includes('node_modules'));
    assert.ok(JSON.stringify(pack).length < 16384);
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
      userRequest: 'Missing project must fail',
      mapVersion: map.mapVersion,
      contextPackId: pack.id,
      workingDirectory: repoRoot,
    }), /projectId/);
    assert.throws(() => taskEngine.createTask({
      taskKind: 'coding',
      userRequest: 'Wrong map must fail',
      projectId: project.id,
      mapVersion: 'map-wrong',
      contextPackId: pack.id,
      workingDirectory: repoRoot,
    }), /mapVersion/);
    log('rejected missing project and mismatched map');

    assert.throws(() => taskEngine.createTask({
      taskKind: 'coding',
      userRequest: 'Outside cwd must fail',
      projectId: project.id,
      mapVersion: map.mapVersion,
      contextPackId: pack.id,
      workingDirectory: os.tmpdir(),
    }), /workspace roots|inside canonical project root/);
    log('rejected coding task outside project boundary');

    const generalTask = taskEngine.createTask({
      userRequest: 'Non-coding utility task remains compatible',
      workingDirectory: repoRoot,
    });
    assert.strictEqual(generalTask.taskKind, 'general');
    assert.strictEqual(generalTask.status, 'CREATED');
    log('accepted non-coding task without registry metadata');

    assert.throws(() => service.registerProject({
      id: 'missing-root',
      displayName: 'Missing Root',
      canonicalRoot: path.join(tmpDir, 'missing'),
    }), /existing directory|workspace roots/);
    assert.throws(() => service.registerProject({
      id: 'outside-root',
      displayName: 'Outside Root',
      canonicalRoot: os.homedir(),
    }), /workspace roots/);
    assert.throws(() => service.registerProject({
      id: 'duplicate-mi',
      displayName: 'Duplicate Mi',
      canonicalRoot: repoRoot,
    }), /already registered/);
    log('rejected missing, outside, and duplicate project roots');

    const nestedOuter = path.join(tmpDir, 'nested-workspace');
    const nestedRepo = path.join(nestedOuter, 'Master', 'mi-core');
    createGitFixture(nestedRepo);
    const nested = service.registerProject({
      id: 'nested-project',
      displayName: 'Nested Project',
      canonicalRoot: nestedOuter,
    });
    assert.strictEqual(nested.canonicalRoot, fs.realpathSync.native(nestedRepo));
    assert.strictEqual(nested.gitRoot, fs.realpathSync.native(nestedRepo));
    log('resolved a single nested Git root from an explicit workspace root');

    const nonGit = service.registerProject({
      id: 'non-git',
      displayName: 'Non Git Project',
      canonicalRoot: nonGitRoot,
    });
    assert.strictEqual(nonGit.gitRoot, null);
    assert.strictEqual(nonGit.status, 'ACTIVE');
    log('accepted explicit non-Git project root');

    const fixture = service.registerProject({
      id: 'fixture',
      displayName: 'Fixture Project',
      canonicalRoot: fixtureRoot,
    });
    const fixtureMap = service.generateProjectMap(fixture.id);
    mutateGitFixture(fixtureRoot);
    const stale = service.getMapStatus(fixture.id);
    assert.strictEqual(stale.mapStatus, 'STALE');
    const stalePack = service.buildContextPack(fixture.id, 'task-runtime guard');
    assert.strictEqual(stalePack.policy, 'REMAP_REQUIRED');
    assert.throws(() => taskEngine.createTask({
      taskKind: 'coding',
      userRequest: 'Stale map must fail',
      projectId: fixture.id,
      mapVersion: fixtureMap.mapVersion,
      contextPackId: stalePack.id,
      workingDirectory: fixtureRoot,
    }), /fresh project map/);
    log('detected stale map and blocked coding task');

    const freshMap = service.generateProjectMap(fixture.id);
    const freshPack = service.buildContextPack(fixture.id, 'task-runtime guard');
    assert.strictEqual(freshPack.mapVersion, freshMap.mapVersion);
    assert.throws(() => taskEngine.createTask({
      taskKind: 'coding',
      userRequest: 'Mismatched project context pack must fail',
      projectId: project.id,
      mapVersion: map.mapVersion,
      contextPackId: freshPack.id,
      workingDirectory: repoRoot,
    }), /contextPackId/);
    log('rejected context pack from another project');

    const deployedSha = '0123456789abcdef0123456789abcdef01234567';
    process.env.MI_DEPLOYED_SOURCE_SHA = deployedSha;
    const deployedMap = service.generateProjectMap(fixture.id);
    assert.strictEqual(deployedMap.sourceSha, deployedSha);
    assert.strictEqual(service.getMapStatus(fixture.id).sourceSha, deployedSha);
    delete process.env.MI_DEPLOYED_SOURCE_SHA;
    log('used deployed source SHA override when configured');

    const previousVersion = deployedMap.mapVersion;
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
    assert.throws(() => service.generateProjectMap(fixture.id), /missing/);
    const afterFailure = service.getMapStatus(fixture.id);
    assert.strictEqual(afterFailure.mapVersion, previousVersion);
    assert.strictEqual(afterFailure.mapStatus, 'FRESH');
    log('preserved last-known-good map after failed refresh');
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

function createGitFixture(root: string): void {
  fs.mkdirSync(path.join(root, 'server', 'src', 'task-runtime'), { recursive: true });
  fs.mkdirSync(path.join(root, 'node_modules', 'ignored'), { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
    scripts: { build: 'tsc', 'test:ci': 'tsx test.ts' },
    dependencies: { express: '1.0.0', typescript: '1.0.0' },
  }, null, 2));
  fs.writeFileSync(path.join(root, 'package-lock.json'), JSON.stringify({ lockfileVersion: 3 }));
  fs.writeFileSync(path.join(root, '.env'), 'API_KEY=redacted');
  fs.writeFileSync(path.join(root, 'server', 'src', 'task-runtime', 'index.ts'), 'export const fixture = true;\n');
  fs.writeFileSync(path.join(root, 'node_modules', 'ignored', 'secret.ts'), 'fixture-secret');
  execFileSync('git', ['init', '-b', 'master'], { cwd: root, stdio: 'ignore' });
  execFileSync('git', ['add', '.'], { cwd: root, stdio: 'ignore' });
  execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-m', 'init'], { cwd: root, stdio: 'ignore' });
}

function mutateGitFixture(root: string): void {
  fs.writeFileSync(path.join(root, 'server', 'src', 'task-runtime', 'changed.ts'), 'export const changed = true;\n');
  execFileSync('git', ['add', '.'], { cwd: root, stdio: 'ignore' });
  execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-m', 'change'], { cwd: root, stdio: 'ignore' });
}
