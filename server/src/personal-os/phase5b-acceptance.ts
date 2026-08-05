import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ProjectRegistryService, seedMiCoreProject } from '../project-registry/service';
import { TaskEngine } from '../task-runtime/engine';
import { TaskStore } from '../task-runtime/store';
import { PersonalOsService } from './service';
import { PersonalOsStore } from './store';

async function run() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-phase5b-acceptance-'));
  process.env.MI_TASK_RUNTIME_DIR = path.join(root, 'tasks');
  process.env.MI_PROJECT_REGISTRY_DIR = path.join(root, 'projects');
  process.env.MI_PROJECT_REGISTRY_WORKSPACE_ROOTS = process.cwd();
  process.env.MI_PERSONAL_OS_DIR = path.join(root, 'personal');
  process.env.MI_TEST_TODAY = '2026-08-05';

  const registry = new ProjectRegistryService();
  registry.registerProject(seedMiCoreProject(process.cwd()));
  const map = registry.generateProjectMap('mi-core');
  const context = registry.buildContextPack('mi-core', 'Prepare the next Mi development task.');
  const store = new PersonalOsStore(path.join(root, 'personal'));
  const taskStore = new TaskStore(path.join(root, 'tasks'));
  const service = new PersonalOsService(store, taskStore, registry);

  const preference = service.createKnowledge({
    kind: 'USER_PREFERENCE',
    title: 'Status language',
    summary: 'Use Vietnamese for status reports and English for code identifiers.',
    content: 'Use Vietnamese for status reports and English for code identifiers.',
    provenance: 'explicit owner statement',
    sourceType: 'USER_STATEMENT',
    tags: ['status', 'language'],
    evidenceReferences: ['user:phase5b-acceptance'],
  });
  const convention = service.createKnowledge({
    kind: 'PROJECT_CONVENTION',
    title: 'Clean Mi Core production checkout',
    summary: 'Mi Core production deployments must be built from a clean worktree.',
    content: 'Mi Core production deployments must be built from a clean worktree.',
    provenance: 'Phase 5A release runbook',
    sourceType: 'PROJECT_DECISION',
    projectIds: ['mi-core'],
    tags: ['deployment', 'clean-worktree'],
    evidenceReferences: ['docs:PHASE5A_RUNBOOK'],
  });

  const engine = new TaskEngine(taskStore);
  const task = engine.createTask({
    userRequest: 'Record local LLM acceptance hotfix lesson.',
    taskKind: 'general',
    projectId: 'mi-core',
  });
  engine.transition(task.id, 'CONTEXT_BUILDING');
  engine.transition(task.id, 'PLANNING');
  engine.transition(task.id, 'READY');
  engine.transition(task.id, 'RUNNING');
  taskStore.updateCodingFields(task.id, {
    resultSummary: 'A single failed local LLM acceptance run must be reproduced before opening a hotfix.',
  });
  engine.transition(task.id, 'VALIDATING');
  const completed = engine.transition(task.id, 'COMPLETED');
  const lesson = service.extractKnowledgeFromTask(completed.id);
  store.confirmKnowledge(lesson.id);

  const inferred = service.createKnowledge({
    kind: 'USER_PREFERENCE',
    title: 'Inferred morning planning preference',
    summary: 'The owner may prefer memory-backed morning planning.',
    content: 'The owner may prefer memory-backed morning planning.',
    provenance: 'model inference candidate',
    sourceType: 'INFERRED',
    tags: ['planning'],
  });

  const unrelated = service.createKnowledge({
    kind: 'PROJECT_CONVENTION',
    title: 'Unrelated project convention',
    summary: 'Another project has a separate deployment rule.',
    content: 'Another project has a separate deployment rule.',
    provenance: 'other project',
    sourceType: 'PROJECT_DECISION',
    projectIds: ['other-project'],
    tags: ['deployment'],
  });

  const pack = service.buildMemoryPack({
    query: 'Prepare the next Mi development task with status reports, deployment validation, and local LLM hotfix checks.',
    projectIds: ['mi-core'],
    policy: 'PERSONAL_AND_PROJECT',
    includeUnconfirmed: true,
    maxRecords: 12,
    maxBytes: 8000,
  });

  assert.strictEqual(map.status, 'FRESH');
  assert.ok(context.id);
  assert.ok(pack.confirmedPreferences.some(record => record.id === preference.id));
  assert.ok(pack.relevantProjectConventions.some(record => record.id === convention.id));
  assert.ok(pack.previousLessons.some(record => record.id === lesson.id));
  assert.ok(pack.uncertainRecords.some(record => record.id === inferred.id));
  assert.ok(!JSON.stringify(pack).includes(unrelated.id), 'unrelated project data must be excluded');
  assert.ok(pack.evidenceReferences.includes('docs:PHASE5A_RUNBOOK'));
  assert.ok(JSON.stringify(pack).length <= 8000);
  assert.strictEqual(pack.policy, 'CONFIRMATION_REQUIRED');

  const superseded = store.supersedeKnowledge(convention.id, {
    summary: 'Mi Core production deployments require a clean worktree and passing release gates.',
    content: 'Mi Core production deployments require a clean worktree and passing release gates.',
    provenance: 'Phase 5B acceptance replacement',
    projectIds: ['mi-core'],
    tags: ['deployment', 'clean-worktree', 'release-gates'],
  });
  const afterSupersede = service.buildMemoryPack({
    query: 'clean worktree release gates',
    projectIds: ['mi-core'],
    policy: 'PROJECT_ONLY',
  });
  assert.ok(afterSupersede.relevantProjectConventions.some(record => record.id === superseded.id));
  assert.ok(!afterSupersede.relevantProjectConventions.some(record => record.id === convention.id));

  store.deleteKnowledge(preference.id);
  const afterDelete = service.buildMemoryPack({
    query: 'Vietnamese status reports',
    policy: 'PERSONAL_AND_PROJECT',
  });
  assert.ok(!afterDelete.confirmedPreferences.some(record => record.id === preference.id));

  const memoryPackId = pack.id;
  const lessonId = lesson.id;
  const conventionId = superseded.id;
  service.close();

  const restarted = new PersonalOsService(
    new PersonalOsStore(path.join(root, 'personal')),
    new TaskStore(path.join(root, 'tasks')),
    new ProjectRegistryService(),
  );
  const restartedPack = restarted.buildMemoryPack({
    query: 'local LLM hotfix release gates',
    projectIds: ['mi-core'],
    policy: 'PROJECT_ONLY',
  });
  assert.ok(restartedPack.previousLessons.some(record => record.id === lessonId));
  assert.ok(restartedPack.relevantProjectConventions.some(record => record.id === conventionId));
  restarted.close();

  console.log(JSON.stringify({
    status: 'PASS',
    mapVersion: map.mapVersion,
    contextPackId: context.id,
    memoryPackId,
    confirmedPreferenceIncluded: true,
    projectConventionIncluded: true,
    lessonIncluded: true,
    inferredCandidateNeedsConfirmation: true,
    unrelatedDataExcluded: true,
    boundedSize: true,
    restartPersistence: true,
    deletionRemovesFromRetrieval: true,
    supersessionReplacesOldActive: true,
    automaticExternalActions: false,
  }, null, 2));

  fs.rmSync(root, { recursive: true, force: true });
  delete process.env.MI_TEST_TODAY;
  delete process.env.MI_TASK_RUNTIME_DIR;
  delete process.env.MI_PROJECT_REGISTRY_DIR;
  delete process.env.MI_PROJECT_REGISTRY_WORKSPACE_ROOTS;
  delete process.env.MI_PERSONAL_OS_DIR;
}

run().catch(err => {
  console.error('[phase5b] FAIL', err);
  process.exit(1);
});
