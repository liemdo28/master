import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ProjectRegistryService, seedMiCoreProject } from '../../project-registry/service';
import { TaskStore } from '../../task-runtime/store';
import { PersonalOsService } from '../service';
import { PersonalOsStore } from '../store';

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mi-memory-retrieval-'));
}

function run() {
  const root = tmp();
  process.env.MI_TEST_TODAY = '2026-08-05';
  process.env.MI_PROJECT_REGISTRY_DIR = path.join(root, 'projects');
  process.env.MI_PROJECT_REGISTRY_WORKSPACE_ROOTS = process.cwd();
  const store = new PersonalOsStore(path.join(root, 'personal'));
  const tasks = new TaskStore(path.join(root, 'tasks'));
  const registry = new ProjectRegistryService();
  registry.registerProject(seedMiCoreProject(process.cwd()));
  const service = new PersonalOsService(store, tasks, registry);

  const preference = store.createKnowledge({
    kind: 'USER_PREFERENCE',
    title: 'Status language',
    summary: 'Use Vietnamese for status reports and English for code identifiers.',
    content: 'Use Vietnamese for status reports and English for code identifiers.',
    provenance: 'explicit owner statement',
    sourceType: 'USER_STATEMENT',
    tags: ['status', 'language'],
    evidenceReferences: ['user:language'],
  });
  const convention = store.createKnowledge({
    kind: 'PROJECT_CONVENTION',
    title: 'Clean production checkout',
    summary: 'Mi Core production deployments must be built from a clean worktree.',
    content: 'Mi Core production deployments must be built from a clean worktree.',
    provenance: 'release runbook',
    sourceType: 'PROJECT_DECISION',
    projectIds: ['mi-core'],
    tags: ['deployment', 'clean'],
    evidenceReferences: ['docs:runbook'],
  });
  const lesson = store.createKnowledge({
    kind: 'LESSON_LEARNED',
    title: 'Reproduce local LLM failures',
    summary: 'A single failed local LLM acceptance run must be reproduced before opening a hotfix.',
    content: 'A single failed local LLM acceptance run must be reproduced before opening a hotfix.',
    provenance: 'completed task summary',
    sourceType: 'TASK_SUMMARY',
    projectIds: ['mi-core'],
    tags: ['llm', 'acceptance', 'hotfix'],
    evidenceReferences: ['task:local-llm'],
  });
  const unrelated = store.createKnowledge({
    kind: 'PROJECT_CONVENTION',
    title: 'Other project release note',
    summary: 'Another project uses a different release process.',
    content: 'Another project uses a different release process.',
    provenance: 'other project',
    sourceType: 'PROJECT_DECISION',
    projectIds: ['other-project'],
    tags: ['release'],
  });
  const inferred = store.createKnowledge({
    kind: 'USER_PREFERENCE',
    title: 'Morning summaries',
    summary: 'The owner may prefer morning summaries.',
    content: 'The owner may prefer morning summaries.',
    provenance: 'model inference',
    sourceType: 'INFERRED',
    tags: ['summary'],
  });
  const stale = store.createKnowledge({
    kind: 'REFERENCE',
    title: 'Stale validation note',
    summary: 'A validation note with an elapsed review window.',
    content: 'A validation note with an elapsed review window.',
    provenance: 'old task',
    sourceType: 'TASK_SUMMARY',
    projectIds: ['mi-core'],
    validUntil: '2026-07-01',
    tags: ['validation'],
  });

  const results = store.searchKnowledge({
    query: 'Prepare Mi Core deployment with local LLM acceptance validation',
    projectIds: ['mi-core'],
    includeUnconfirmed: true,
    maxRecords: 10,
  });
  assert.ok(results.some(result => result.record.id === convention.id));
  assert.ok(results.some(result => result.record.id === lesson.id));
  assert.ok(results.some(result => result.record.id === stale.id));
  assert.ok(!results.some(result => result.record.id === unrelated.id), 'cross-project records should not leak into project-scoped retrieval');

  const pack = store.buildMemoryPack({
    query: 'Prepare the next Mi development task with status and deployment validation.',
    projectIds: ['mi-core'],
    policy: 'PERSONAL_AND_PROJECT',
    includeUnconfirmed: true,
    maxBytes: 8000,
  });
  assert.ok(pack.confirmedPreferences.some(record => record.id === preference.id));
  assert.ok(pack.relevantProjectConventions.some(record => record.id === convention.id));
  assert.ok(pack.previousLessons.some(record => record.id === lesson.id));
  assert.ok(pack.uncertainRecords.some(record => record.id === inferred.id));
  assert.ok(pack.staleWarnings.some(item => item.includes(stale.id)));
  assert.ok(pack.evidenceReferences.includes('docs:runbook'));
  assert.ok(pack.retrievalExplanation.length > 0);
  assert.ok(JSON.stringify(pack).length <= 8000);

  const noMemory = store.buildMemoryPack({ query: 'no memory please', policy: 'NO_MEMORY' });
  assert.strictEqual(noMemory.confirmedPreferences.length, 0);
  assert.strictEqual(noMemory.retrievalExplanation[0], 'memory disabled by policy');

  const projectOnly = store.buildMemoryPack({
    query: 'Vietnamese clean production checkout',
    projectIds: ['mi-core'],
    policy: 'PROJECT_ONLY',
    includeUnconfirmed: true,
  });
  assert.ok(!projectOnly.confirmedPreferences.some(record => record.id === preference.id));
  assert.ok(projectOnly.relevantProjectConventions.some(record => record.id === convention.id));

  // Regression: a record the owner scoped PERSONAL_ONLY must never reach a PROJECT_ONLY
  // pack, even when it carries projectIds. Retrieval previously filtered on projectIds
  // alone and ignored the record's own scope field entirely.
  const privateFact = store.createKnowledge({
    kind: 'USER_FACT',
    title: 'Owner personal availability',
    summary: 'The owner is unavailable on weekends for deployment work.',
    content: 'The owner is unavailable on weekends for deployment work.',
    provenance: 'private owner statement',
    sourceType: 'USER_STATEMENT',
    scope: 'PERSONAL_ONLY',
    projectIds: ['mi-core'],
    tags: ['availability'],
  });
  const projectOnlyAfterPrivate = store.buildMemoryPack({
    query: 'deployment work for mi-core',
    projectIds: ['mi-core'],
    policy: 'PROJECT_ONLY',
    includeUnconfirmed: true,
  });
  assert.ok(
    ![
      ...projectOnlyAfterPrivate.relevantUserFacts,
      ...projectOnlyAfterPrivate.confirmedPreferences,
      ...projectOnlyAfterPrivate.relevantProjectConventions,
      ...projectOnlyAfterPrivate.uncertainRecords,
    ].some(record => record.id === privateFact.id),
    'PERSONAL_ONLY records must not leak into PROJECT_ONLY memory packs',
  );
  assert.ok(
    store.buildMemoryPack({
      query: 'owner availability for deployment work',
      projectIds: ['mi-core'],
      policy: 'PERSONAL_AND_PROJECT',
      includeUnconfirmed: true,
    }).relevantUserFacts.some(record => record.id === privateFact.id),
    'PERSONAL_ONLY records remain available to personal packs',
  );

  const goal = store.createGoal({ title: 'Prepare deployment validation for Mi Core', projectIds: ['mi-core'] });
  const planned = service.planGoal(goal.id);
  assert.ok(planned.plan.memoryReferences?.includes(convention.id));

  const brief = service.generateDailyBrief();
  assert.ok(brief.confirmedMemory?.some((record: any) => record.id === lesson.id));
  assert.ok(brief.confirmationRequests?.some((record: any) => record.id === inferred.id));

  service.close();
  const restarted = new PersonalOsStore(path.join(root, 'personal'));
  assert.ok(restarted.buildMemoryPack({
    query: 'clean worktree deployment',
    projectIds: ['mi-core'],
    policy: 'PROJECT_ONLY',
  }).relevantProjectConventions.some(record => record.id === convention.id));
  restarted.close();

  fs.rmSync(root, { recursive: true, force: true });
  delete process.env.MI_TEST_TODAY;
  delete process.env.MI_PROJECT_REGISTRY_DIR;
  delete process.env.MI_PROJECT_REGISTRY_WORKSPACE_ROOTS;
  console.log('[memory-retrieval] PASS');
}

run();
