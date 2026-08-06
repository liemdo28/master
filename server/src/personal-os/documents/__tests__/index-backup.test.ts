/**
 * Phase 5D-2 §22 — backup/restore foundation for the index/DB.
 */

import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import Database from 'better-sqlite3';
import { DocumentStore } from '../store';
import { KnowledgeDocumentService } from '../service';
import { KnowledgeRetrievalService } from '../retrieval';
import { backupDatabase, restoreFromBackup, verifyBackup } from '../backup';

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mi-5d2-backup-'));
}

function write(root: string, rel: string, content: string): string {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
  return full;
}

async function run(): Promise<void> {
  const root = tmp();
  const dbDir = tmp();
  const store = new DocumentStore(dbDir);
  const service = new KnowledgeDocumentService({ store, roots: { documentRoots: [root] } });

  const filePath = write(root, 'backup-fixture.md', '# Backup Fixture\n\nThe canary phrase for this backup test is zephyr-quartz-77.\n');
  const outcome = await service.ingestApprovedDocument({ filePath, projectIds: ['proj-backup'] });
  assert.strictEqual(outcome.status, 'ACTIVE');

  const liveDbPath = path.join(dbDir, 'personal-os.db');
  const backupDir = tmp();
  const backupPath = path.join(backupDir, 'personal-os-backup.db');

  // --- backup is a consistent copy, taken without stopping the process --------------
  const backupResult = await backupDatabase(liveDbPath, backupPath);
  assert.ok(fs.existsSync(backupPath));
  assert.ok(backupResult.sizeBytes > 0);

  // The live database must still be fully usable immediately after backing it up —
  // taking a backup is never a reason to stop or lock the source.
  const stillWorks = store.searchChunks('zephyr-quartz-77', { projectIds: ['proj-backup'] });
  assert.strictEqual(stillWorks.length, 1, 'the live store keeps working during and after a backup');

  // --- the copy verifies clean and carries the v5 tables, including the FTS index ---
  const verification = verifyBackup(backupPath);
  assert.strictEqual(verification.integrityCheck, 'ok');
  assert.strictEqual(verification.foreignKeyViolations, 0);
  assert.strictEqual(verification.schemaVersion, 5);
  assert.strictEqual(verification.documents, 1);
  assert.strictEqual(verification.chunks, 1);
  assert.strictEqual(verification.ftsRows, 1, 'the backup copy carries the structural index itself, not just document rows');
  assert.strictEqual(verification.conflicts, 0);
  assert.strictEqual(verification.relations, 0);

  // --- the copy is independently queryable, without touching the live store ----------
  const copyDb = new Database(backupPath, { readonly: true });
  const copyHits = copyDb.prepare(
    `SELECT c.id FROM knowledge_chunks_fts f JOIN knowledge_chunks c ON c.id = f.chunkId WHERE knowledge_chunks_fts MATCH ?`,
  ).all('"zephyr-quartz-77"');
  assert.strictEqual(copyHits.length, 1, 'the backup copy is searchable on its own, with no rebuild step');
  copyDb.close();

  // --- restore: a fresh store opened against the restored file has the same content --
  const restoreDir = tmp();
  const restoredDbPath = path.join(restoreDir, 'personal-os.db');
  restoreFromBackup(backupPath, restoredDbPath);
  const restoredStore = new DocumentStore(restoreDir);
  const restoredHits = restoredStore.searchChunks('zephyr-quartz-77', { projectIds: ['proj-backup'] });
  assert.strictEqual(restoredHits.length, 1, 'a store opened against the restored file finds the same content immediately');
  assert.strictEqual(restoredStore.integrity().integrityCheck, 'ok');
  restoredStore.close();

  // --- the original live database is never mutated by any of the above -------------
  assert.strictEqual(store.stats().documents, 1, 'live document count unchanged by backup/restore operations elsewhere');

  service.close();
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(dbDir, { recursive: true, force: true });
  fs.rmSync(backupDir, { recursive: true, force: true });
  fs.rmSync(restoreDir, { recursive: true, force: true });

  console.log('[index-backup] PASS');
}

run().catch(err => { console.error('[index-backup] FAIL:', err); process.exit(1); });
