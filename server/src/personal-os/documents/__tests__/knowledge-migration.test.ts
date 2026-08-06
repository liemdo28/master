import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import Database from 'better-sqlite3';
import { PersonalOsStore } from '../../store';
import { IntelligenceStore } from '../../../intelligence/store';
import { DocumentStore, applyPhase5dMigration, currentSchemaVersion, PHASE5D2_SCHEMA_VERSION } from '../store';

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mi-5d-migration-'));
}

/** Builds a database carrying real Phase 5A/5B/5C data at schema v3. */
function buildV3(root: string) {
  const personal = new PersonalOsStore(root);
  const preference = personal.createPreference({ category: 'workflow', key: 'status-language', value: 'Vietnamese for status' });
  const goal = personal.createGoal({ title: 'Close Phase 5D foundation', projectIds: [] });
  const knowledge = personal.createKnowledge({
    kind: 'PROJECT_CONVENTION', title: 'Clean worktree deploys',
    summary: 'Production deploys are built from a clean worktree.',
    content: 'Production deploys are built from a clean worktree.',
    provenance: 'migration fixture', sourceType: 'PROJECT_DECISION', projectIds: ['mi-core'],
  });
  const brief = personal.saveDailyBrief({
    id: `brief-${'0'.repeat(8)}-0000-0000-0000-${'0'.repeat(12)}`,
    date: '2026-08-06', generatedAt: new Date().toISOString(),
    activeGoals: [], activeProjects: [], pendingTasks: [], pendingApprovals: [],
    recentFailures: [], recentSuccesses: [], systemAlerts: [], recommendedNextActions: [],
    evidenceReferences: [], facts: ['fixture'], suggestions: [], unknowns: [],
  });
  personal.close();

  const intelligence = new IntelligenceStore(root);
  const agenda = intelligence.saveAgenda({
    id: `agenda-${'1'.repeat(8)}-1111-1111-1111-${'1'.repeat(12)}`,
    date: '2026-08-06', timezone: 'UTC', meetings: [], deadlines: [], followUps: [],
    activeGoals: [], priorityTasks: [], availableFocusWindows: [], risks: [],
    facts: ['fixture'], suggestions: [], unknowns: [], evidenceReferences: ['email:abc'],
    generatedAt: new Date().toISOString(), version: 1,
  });
  intelligence.recordSync('gmail', 'primary', 'READY', 3);
  const version = intelligence.integrity().schemaVersion;
  intelligence.close();

  return { preferenceId: preference.id, goalId: goal.id, knowledgeId: knowledge.id, briefId: brief.id, agendaId: agenda.id, version };
}

function tableCounts(file: string): Record<string, number> {
  const db = new Database(file, { readonly: true });
  const tables = (db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`).all() as Array<{ name: string }>)
    .map(t => t.name).sort();
  const counts: Record<string, number> = {};
  for (const t of tables) counts[t] = (db.prepare(`SELECT COUNT(*) c FROM "${t}"`).get() as { c: number }).c;
  db.close();
  return counts;
}

function run() {
  // --- a brand new v4 database ----------------------------------------------
  const freshRoot = tmp();
  const fresh = new DocumentStore(freshRoot);
  const freshIntegrity = fresh.integrity();
  assert.strictEqual(freshIntegrity.integrityCheck, 'ok');
  assert.deepStrictEqual(freshIntegrity.foreignKeyViolations, []);
  assert.strictEqual(freshIntegrity.schemaVersion, PHASE5D2_SCHEMA_VERSION, 'a new database is created at v5');
  assert.strictEqual(fresh.handle.pragma('journal_mode', { simple: true }), 'wal');
  assert.strictEqual(fresh.handle.pragma('foreign_keys', { simple: true }), 1);
  fresh.close();
  fs.rmSync(freshRoot, { recursive: true, force: true });

  // --- v3 → v4 preserving every existing row ---------------------------------
  const root = tmp();
  const seeded = buildV3(root);
  assert.strictEqual(seeded.version, 3, 'fixture starts at schema v3');

  const dbFile = path.join(root, 'personal-os.db');
  const before = tableCounts(dbFile);
  assert.ok(before.preferences >= 1 && before.goals >= 1 && before.knowledge_records >= 1);
  assert.ok(before.daily_briefs >= 1 && before.daily_agendas >= 1 && before.connector_sync_state >= 1);

  const store = new DocumentStore(root);
  assert.strictEqual(store.integrity().schemaVersion, 5, 'opening a DocumentStore moves v3 straight to v5');
  store.close();

  const after = tableCounts(dbFile);
  for (const [table, count] of Object.entries(before)) {
    // schema_migrations is the one table the migration is *supposed* to grow: it gains
    // exactly the v4 and v5 rows and nothing else.
    if (table === 'schema_migrations') {
      assert.strictEqual(after[table], count + 2, 'schema_migrations gains exactly the v4 and v5 rows');
      continue;
    }
    assert.strictEqual(after[table], count, `row count preserved for ${table}`);
  }
  for (const added of [
    'knowledge_documents', 'knowledge_chunks', 'knowledge_ingestion_jobs', 'knowledge_document_projects',
    'knowledge_chunks_fts', 'knowledge_conflicts', 'knowledge_relations',
  ]) {
    assert.ok(added in after, `${added} created by the migration`);
    assert.strictEqual(after[added], 0, `${added} starts empty`);
  }

  // --- every pre-existing record is still readable through its own API --------
  const personal = new PersonalOsStore(root);
  assert.ok(personal.getPreference(seeded.preferenceId), 'preference survives');
  assert.ok(personal.getGoal(seeded.goalId), 'goal survives');
  assert.ok(personal.getKnowledge(seeded.knowledgeId), 'knowledge survives');
  assert.ok(personal.getDailyBrief(seeded.briefId), 'daily brief survives');
  const personalIntegrity = personal.integrity();
  assert.strictEqual(personalIntegrity.integrityCheck, 'ok');
  assert.strictEqual(personalIntegrity.schemaVersion, 5, 'Phase 5B store reports the new shared version');
  personal.close();

  const intelligence = new IntelligenceStore(root);
  assert.ok(intelligence.getAgenda(seeded.agendaId), 'Phase 5C agenda survives');
  assert.strictEqual(intelligence.listSyncState().length, 1, 'connector sync state survives');
  intelligence.close();

  // --- rerunning the v4 migration is a no-op, even against an already-v5 database ---
  const rerunDb = new Database(dbFile);
  const first = applyPhase5dMigration(rerunDb);
  const second = applyPhase5dMigration(rerunDb);
  assert.strictEqual(first.to, 5, 'the shared database is already at v5 by this point');
  assert.strictEqual(first.applied, false, 'v4 migration has nothing left to apply on a v5 database');
  assert.strictEqual(second.applied, false, 'a second run applies nothing');
  assert.strictEqual(currentSchemaVersion(rerunDb), 5);
  rerunDb.close();
  assert.deepStrictEqual(tableCounts(dbFile), after, 'rerun changes no row counts');

  // --- interrupted ingestion is recovered, never left half-active ------------
  const recoveryRoot = tmp();
  const recovery = new DocumentStore(recoveryRoot);
  const job = recovery.createJob('op-interrupted', 'test');
  recovery.handle.prepare(
    `INSERT INTO knowledge_documents (id,title,sourceType,sourceUri,canonicalPath,projectIds,goalIds,taskIds,
      mimeType,language,checksum,sizeBytes,status,sensitivity,ingestionPolicy,createdAt,updatedAt,version,metadata,evidenceReferences)
     VALUES (?,?,?,?,?,'[]','[]','[]','text/markdown','en','abc',10,'INDEXING','INTERNAL','PROJECT_DOCS',?,?,1,'{}','[]')`,
  ).run('doc-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 'partial', 'MARKDOWN', 'a.md', '/tmp/a.md', new Date().toISOString(), new Date().toISOString());
  recovery.updateJob(job.id, { documentId: 'doc-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', status: 'RUNNING' });
  recovery.handle.prepare(
    `INSERT INTO knowledge_chunks (id,documentId,ordinal,headingPath,text,normalizedText,tokenEstimate,contentHash,
      sourceStart,sourceEnd,sensitivity,createdAt,updatedAt,tags,projectIds)
     VALUES ('chunk-orphan','doc-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',0,'[]','x','x',1,'h',0,1,'INTERNAL',?,?,'[]','[]')`,
  ).run(new Date().toISOString(), new Date().toISOString());
  recovery.close();

  const reopened = new DocumentStore(recoveryRoot);
  const recovered = reopened.listJobs(10).find(j => j.operationId === 'op-interrupted');
  assert.strictEqual(recovered?.status, 'RECOVERY_REQUIRED', 'an interrupted job is flagged on reopen');
  assert.strictEqual(reopened.getDocument('doc-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')?.status, 'FAILED',
    'a half-indexed document is not left INDEXING');
  assert.strictEqual(reopened.countChunks('doc-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'), 0,
    'orphan chunks from the interrupted run are removed');
  assert.strictEqual(reopened.integrity().integrityCheck, 'ok');
  reopened.close();
  fs.rmSync(recoveryRoot, { recursive: true, force: true });

  // --- close/reopen is clean --------------------------------------------------
  const reopenedAgain = new DocumentStore(root);
  assert.strictEqual(reopenedAgain.integrity().integrityCheck, 'ok');
  assert.strictEqual(reopenedAgain.integrity().schemaVersion, 5);
  reopenedAgain.close();

  fs.rmSync(root, { recursive: true, force: true });
  console.log('[knowledge-migration] PASS');
}

run();
