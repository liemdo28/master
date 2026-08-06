/**
 * Phase 5D-2 §2 — structural index correctness.
 *
 * The FTS5 index is synced incrementally (never rebuilt) inside the same transaction as
 * document activation/supersession/deletion. This suite proves that sync stays correct
 * across the whole document lifecycle, and that a v4 database backfills cleanly on
 * upgrade to v5.
 */

import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import Database from 'better-sqlite3';
import { DocumentStore, applyPhase5dMigration, applyPhase5d2Migration } from '../store';
import { KnowledgeDocumentService } from '../service';

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mi-5d2-index-'));
}

function write(root: string, rel: string, content: string): string {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
  return full;
}

function ftsRowCount(store: DocumentStore): number {
  return (store.handle.prepare(`SELECT COUNT(*) c FROM knowledge_chunks_fts`).get() as { c: number }).c;
}

async function run() {
  const root = tmp();
  const dbDir = tmp();
  const store = new DocumentStore(dbDir);
  const service = new KnowledgeDocumentService({ store, roots: { documentRoots: [root] } });

  // --- ingest -> immediately searchable, incrementally (no rebuild call anywhere) ----
  const filePath = write(root, 'docs/widget.md', '# Widget\n\nThe widget subsystem processes orders and emits a receipt-ready event when complete.\n');
  const outcome = await service.ingestApprovedDocument({ filePath, projectIds: ['proj-widget'] });
  assert.strictEqual(outcome.status, 'ACTIVE');
  assert.strictEqual(ftsRowCount(store), outcome.chunkCount, 'every activated chunk is indexed');

  let hits = store.searchChunks('receipt-ready event', { projectIds: ['proj-widget'] });
  assert.strictEqual(hits.length, 1, 'newly ingested content is searchable without any separate index step');

  // --- reindex with changed content: old chunk unindexed, new chunk indexed ---------
  write(root, 'docs/widget.md', '# Widget\n\nThe widget subsystem now processes orders and emits a shipment-ready event when complete.\n');
  const reindexed = await service.ingestApprovedDocument({ filePath, operationId: `reindex-${Date.now()}`, projectIds: ['proj-widget'] });
  assert.strictEqual(reindexed.status, 'SUPERSEDED');

  // "receipt-ready" alone (not OR'd with the still-present word "event") isolates
  // whether the *old* chunk specifically survived, rather than a shared term matching
  // the new chunk instead.
  hits = store.searchChunks('receipt-ready', { projectIds: ['proj-widget'] });
  assert.strictEqual(hits.length, 0, 'the superseded chunk\'s content is no longer searchable');
  hits = store.searchChunks('shipment-ready', { projectIds: ['proj-widget'] });
  assert.strictEqual(hits.length, 1, 'the new version\'s content is searchable');
  assert.strictEqual(ftsRowCount(store), reindexed.chunkCount, 'index holds exactly the live version\'s chunks, no leftovers');

  // --- STALE: excluded by default, included with includeStale, still outranked -------
  const before = store.getDocument(reindexed.documentId!)!;
  store.setStatus(before.id, 'STALE');
  hits = store.searchChunks('shipment-ready', { projectIds: ['proj-widget'] });
  assert.strictEqual(hits.length, 0, 'STALE is excluded from the default search');
  hits = store.searchChunks('shipment-ready', { projectIds: ['proj-widget'], includeStale: true });
  assert.strictEqual(hits.length, 1, 'includeStale brings a STALE document back into results');
  store.setStatus(before.id, 'ACTIVE');

  // --- delete: unindexed, never searchable again -------------------------------------
  store.deleteDocument(reindexed.documentId!);
  hits = store.searchChunks('shipment-ready', { projectIds: ['proj-widget'], includeStale: true });
  assert.strictEqual(hits.length, 0, 'a deleted document\'s content is gone from the index even with includeStale');
  assert.strictEqual(ftsRowCount(store), 0, 'index is empty after the only document is deleted');

  service.close();
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(dbDir, { recursive: true, force: true });

  // --- v4 -> v5 backfill: a chunk written before the FTS table existed gets indexed ---
  const backfillRoot = tmp();
  const rawDb = new Database(path.join(backfillRoot, 'personal-os.db'));
  applyPhase5dMigration(rawDb); // stop at v4, deliberately, before the FTS table exists
  const now = new Date().toISOString();
  rawDb.exec(`
    INSERT INTO knowledge_documents (id,title,sourceType,sourceUri,canonicalPath,projectIds,goalIds,taskIds,
      mimeType,language,checksum,sizeBytes,status,sensitivity,ingestionPolicy,createdAt,updatedAt,version,metadata,evidenceReferences)
    VALUES ('doc-11111111-1111-1111-1111-111111111111','Pre-v5 Doc','MARKDOWN','a.md','/tmp/a.md','[]','[]','[]',
      'text/markdown','en','chk',10,'ACTIVE','INTERNAL','PROJECT_DOCS','${now}','${now}',1,'{}','[]');
  `);
  rawDb.prepare(`
    INSERT INTO knowledge_chunks (id,documentId,ordinal,headingPath,text,normalizedText,tokenEstimate,contentHash,
      sourceStart,sourceEnd,pageNumber,sectionTitle,tags,projectIds,sensitivity,createdAt,updatedAt)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run('chunk-preexisting', 'doc-11111111-1111-1111-1111-111111111111', 0, '[]',
    'this chunk predates the phase 5D-2 structural index entirely', 'this chunk predates the phase 5d-2 structural index entirely',
    10, 'hash1', 0, 10, null, null, '[]', '[]', 'INTERNAL', now, now);
  assert.strictEqual((rawDb.prepare(`SELECT COUNT(*) c FROM sqlite_master WHERE name='knowledge_chunks_fts'`).get() as { c: number }).c, 0,
    'sanity: the FTS table genuinely does not exist yet at v4');
  rawDb.close();

  const migrated = new Database(path.join(backfillRoot, 'personal-os.db'));
  const migration = applyPhase5d2Migration(migrated);
  assert.strictEqual(migration.to, 5);
  const backfilled = migrated.prepare(`SELECT COUNT(*) c FROM knowledge_chunks_fts WHERE chunkId = 'chunk-preexisting'`).get() as { c: number };
  assert.strictEqual(backfilled.c, 1, 'the migration backfills a chunk that predates the index, without a full rebuild sweep of unrelated tables');
  const searchable = migrated.prepare(`SELECT chunkId FROM knowledge_chunks_fts WHERE knowledge_chunks_fts MATCH ?`).all('predates');
  assert.strictEqual(searchable.length, 1, 'the backfilled chunk is immediately searchable');
  migrated.close();
  fs.rmSync(backfillRoot, { recursive: true, force: true });

  console.log('[knowledge-index] PASS');
}

run().catch(err => { console.error('[knowledge-index] FAIL:', err); process.exit(1); });
