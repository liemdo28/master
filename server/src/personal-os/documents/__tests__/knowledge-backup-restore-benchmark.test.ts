/**
 * Phase 6E §33 — extends the Phase 5D-2 backup/restore foundation (backup.ts,
 * proven against a single canary phrase in index-backup.test.ts) to prove
 * retrieval-equivalence on a real benchmark subset: the same queries against the
 * restored copy must return the same top citation, not just "some content exists."
 */
import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DocumentStore } from '../store';
import { KnowledgeDocumentService } from '../service';
import { KnowledgeRetrievalService } from '../retrieval';
import { backupDatabase, restoreFromBackup, verifyBackup } from '../backup';
import { buildQualityCorpus, buildRecallCases, tmpDir } from '../knowledge-quality-fixtures';

async function run() {
  const root = tmpDir();
  const dbDir = tmpDir();
  const service = new KnowledgeDocumentService({ store: new DocumentStore(dbDir), roots: { documentRoots: [root] } });
  await buildQualityCorpus(service, root);

  const liveDbPath = path.join(dbDir, 'personal-os.db');
  const backupDir = tmpDir();
  const backupPath = path.join(backupDir, 'personal-os-backup.db');
  await backupDatabase(liveDbPath, backupPath);
  const verification = verifyBackup(backupPath);
  assert.strictEqual(verification.integrityCheck, 'ok');
  assert.strictEqual(verification.foreignKeyViolations, 0);

  const restoreDir = tmpDir();
  const restoredDbPath = path.join(restoreDir, 'personal-os.db');
  restoreFromBackup(backupPath, restoredDbPath);
  const restoredStore = new DocumentStore(restoreDir);
  const restoredRetrieval = new KnowledgeRetrievalService(restoredStore);
  const liveRetrieval = new KnowledgeRetrievalService(service.store);

  // A 40-case subset of the benchmark: every case must produce the identical top
  // citation from the restored copy as from the live store it was backed up from.
  const subset = buildRecallCases(2).filter((_, i) => i % 3 === 0).slice(0, 40);
  assert.ok(subset.length >= 30, `expected a substantial benchmark subset, got ${subset.length}`);

  let mismatches = 0;
  for (const c of subset) {
    const livePack = liveRetrieval.buildKnowledgePack({ text: c.text, projectIds: [c.project], limit: 3 });
    const restoredPack = restoredRetrieval.buildKnowledgePack({ text: c.text, projectIds: [c.project], limit: 3 });
    const liveTop = livePack.items[0]?.citations[0]?.chunkId ?? null;
    const restoredTop = restoredPack.items[0]?.citations[0]?.chunkId ?? null;
    if (liveTop !== restoredTop) mismatches++;
  }
  assert.strictEqual(mismatches, 0, `${mismatches}/${subset.length} benchmark cases returned a different top result after restore`);

  restoredStore.close();
  service.close();
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(dbDir, { recursive: true, force: true });
  fs.rmSync(backupDir, { recursive: true, force: true });
  fs.rmSync(restoreDir, { recursive: true, force: true });

  console.log(`[knowledge-backup-restore-benchmark] PASS (${subset.length} cases, 0 mismatches)`);
}

run().catch(err => { console.error('[knowledge-backup-restore-benchmark] FAIL:', err); process.exit(1); });
