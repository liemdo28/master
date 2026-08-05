import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { TaskEngine } from '../../task-runtime/engine';
import { TaskStore } from '../../task-runtime/store';
import { PersonalOsService } from '../service';
import { PersonalOsStore } from '../store';

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mi-knowledge-'));
}

function completeTask(engine: TaskEngine, tasks: TaskStore, userRequest: string, resultSummary: string) {
  const task = engine.createTask({ userRequest, taskKind: 'general', projectId: 'mi-core' });
  engine.transition(task.id, 'CONTEXT_BUILDING');
  engine.transition(task.id, 'PLANNING');
  engine.transition(task.id, 'READY');
  engine.transition(task.id, 'RUNNING');
  tasks.updateCodingFields(task.id, { resultSummary });
  engine.transition(task.id, 'VALIDATING');
  return engine.transition(task.id, 'COMPLETED');
}

function run() {
  const root = tmp();
  const store = new PersonalOsStore(path.join(root, 'personal'));

  const preference = store.createKnowledge({
    kind: 'USER_PREFERENCE',
    title: 'Status language',
    summary: 'Use Vietnamese for status reports and English for code identifiers.',
    content: 'Use Vietnamese for status reports and English for code identifiers.',
    provenance: 'explicit owner statement',
    sourceType: 'USER_STATEMENT',
    tags: ['status', 'language'],
    evidenceReferences: ['user:phase5b'],
  });
  assert.strictEqual(preference.status, 'ACTIVE');
  assert.ok(preference.lastConfirmedAt);

  const duplicate = store.createKnowledge({
    kind: 'USER_PREFERENCE',
    title: 'Status language',
    summary: 'Use Vietnamese for status reports and English for code identifiers.',
    content: 'Use Vietnamese for status reports and English for code identifiers.',
    provenance: 'explicit owner statement again',
    sourceType: 'USER_STATEMENT',
    tags: ['status', 'language'],
  });
  assert.strictEqual(duplicate.id, preference.id, 'content hash dedupes equivalent active records');

  const inferred = store.createKnowledge({
    kind: 'USER_PREFERENCE',
    title: 'Short status preference',
    summary: 'The owner may prefer compact status notes.',
    content: 'The owner may prefer compact status notes.',
    provenance: 'inferred from interaction pattern',
    sourceType: 'INFERRED',
  });
  assert.strictEqual(inferred.status, 'NEEDS_CONFIRMATION');
  assert.strictEqual(store.confirmKnowledge(inferred.id).status, 'ACTIVE');

  const oldRule = store.createKnowledge({
    kind: 'PROJECT_CONVENTION',
    title: 'Deployment cleanliness',
    summary: 'Deployments may start from any checkout.',
    content: 'Deployments may start from any checkout.',
    provenance: 'old note',
    sourceType: 'PROJECT_DECISION',
    projectIds: ['mi-core'],
    tags: ['deployment'],
  });
  const replacement = store.supersedeKnowledge(oldRule.id, {
    summary: 'Mi Core production deployments must be built from a clean worktree.',
    content: 'Mi Core production deployments must be built from a clean worktree.',
    provenance: 'release runbook',
  });
  assert.strictEqual(store.getKnowledge(oldRule.id)?.status, 'SUPERSEDED');
  assert.strictEqual(replacement.supersedesId, oldRule.id);

  const expired = store.createKnowledge({
    kind: 'REFERENCE',
    title: 'Old temporary fact',
    summary: 'Temporary fact from an old date.',
    content: 'Temporary fact from an old date.',
    provenance: 'test',
    validUntil: '2026-01-01',
  });
  store.updateKnowledge(expired.id, { status: 'EXPIRED' });
  assert.ok(!store.searchKnowledge({ query: 'temporary fact', includeUnconfirmed: true }).some(result => result.record.id === expired.id));

  const deleted = store.deleteKnowledge(preference.id);
  assert.strictEqual(deleted.status, 'DELETED');
  assert.ok(!store.searchKnowledge({ query: 'Vietnamese status', includeUnconfirmed: true }).some(result => result.record.id === preference.id));

  const conflictA = store.createKnowledge({
    kind: 'WORKFLOW',
    title: 'Review gate',
    summary: 'Review must pass before PR readiness.',
    content: 'Review must pass before PR readiness.',
    provenance: 'audit A',
    tags: ['review'],
  });
  const conflictB = store.createKnowledge({
    kind: 'WORKFLOW',
    title: 'Review gate',
    summary: 'Review may be skipped for tiny changes.',
    content: 'Review may be skipped for tiny changes.',
    provenance: 'audit B',
    tags: ['review'],
  });
  assert.ok(store.listKnowledgeConflicts().some(item => item.records.some(record => record.id === conflictA.id) && item.records.some(record => record.id === conflictB.id)));

  const integrity = store.integrity();
  assert.strictEqual(integrity.integrityCheck, 'ok');
  assert.ok(integrity.schemaVersion >= 2);
  store.close();

  const taskStore = new TaskStore(path.join(root, 'tasks'));
  const service = new PersonalOsService(new PersonalOsStore(path.join(root, 'personal-2')), taskStore);
  const engine = new TaskEngine(taskStore);
  const completed = completeTask(
    engine,
    taskStore,
    'Run local LLM acceptance and verify failure before hotfix.',
    'A single failed local LLM acceptance run must be reproduced before opening a hotfix.',
  );
  const extracted = service.extractKnowledgeFromTask(completed.id);
  const extractedAgain = service.extractKnowledgeFromTask(completed.id);
  assert.strictEqual(extractedAgain.id, extracted.id, 'task extraction is idempotent through content hash');
  assert.strictEqual(extracted.status, 'NEEDS_CONFIRMATION');
  assert.deepStrictEqual(extracted.taskIds, [completed.id]);
  assert.ok(extracted.evidenceReferences.includes(`task:${completed.id}`));
  service.close();
  taskStore.close();

  fs.rmSync(root, { recursive: true, force: true });
  console.log('[knowledge] PASS');
}

run();
