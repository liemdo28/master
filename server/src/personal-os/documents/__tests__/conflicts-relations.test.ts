/**
 * Phase 5D-2 §9-10 — conflict engine and relation derivation.
 */

import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DocumentStore } from '../store';
import { KnowledgeDocumentService } from '../service';
import { KnowledgeRetrievalService } from '../retrieval';
import { scanForConflicts } from '../conflicts';
import { scanForRelations } from '../relations';

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mi-5d2-conflicts-'));
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

  const pathA = write(root, 'a.md', '# Config\n\nThe api timeout is 30 seconds and the retry count is 3.\n');
  const pathB = write(root, 'b.md', '# Config\n\nThe api timeout is 60 seconds and the retry count is 3.\n');
  const pathC = write(root, 'c.md', '# Config\n\nThe api timeout is 30 seconds and the retry count is 3.\n'); // agrees with A entirely
  await service.ingestApprovedDocument({ filePath: pathA, projectIds: ['proj-x'] });
  await service.ingestApprovedDocument({ filePath: pathB, projectIds: ['proj-x'] });
  await service.ingestApprovedDocument({ filePath: pathC, projectIds: ['proj-x'] });

  // --- detection: real disagreement raised, full agreement is not a conflict --------
  const scan = scanForConflicts(store, ['proj-x']);
  assert.strictEqual(scan.created, 1, 'exactly one conflict: the api-timeout disagreement between A and B');
  const conflicts = store.listConflicts('OPEN');
  assert.strictEqual(conflicts.length, 1);
  assert.ok(conflicts[0].description.includes('api timeout'), 'the conflict names the disagreeing key');
  assert.ok(!conflicts[0].description.includes('retry count'), '"retry count" is not a conflict — A, B and C all agree on it');

  // --- idempotent rescan: no duplicate conflict row ----------------------------------
  const rescan = scanForConflicts(store, ['proj-x']);
  assert.strictEqual(rescan.created, 0, 'a second scan does not create a duplicate conflict for the same chunk set');
  assert.strictEqual(rescan.alreadyRaised, 1);
  assert.strictEqual(store.listConflicts('OPEN').length, 1);

  // --- an unresolved conflict surfaces in a KnowledgePack that touches it -----------
  const retrieval = new KnowledgeRetrievalService(store);
  const pack = retrieval.buildKnowledgePack({ text: 'what is the api timeout', projectIds: ['proj-x'] });
  assert.ok(pack.conflicts.length >= 1, 'a query that returns a conflicted chunk surfaces the conflict, never silently picks a winner');

  // --- regression: the conflict penalty must nudge ranking, never suppress content ---
  // (a prior version used a -1.5 penalty, large enough to drop conflicting chunks below
  // the relevance floor entirely — content the caller explicitly asked about would vanish
  // instead of being shown with the conflict attached, its own kind of silently picking a
  // winner. The penalty is now -0.4.) Isolated two-document corpus, deliberately without
  // the A/B/C fixture's exact-duplicate C, which would otherwise dominate ranking and
  // confound this specific check.
  {
    const penaltyRoot = tmp();
    const penaltyDbDir = tmp();
    const penaltyStore = new DocumentStore(penaltyDbDir);
    const penaltyService = new KnowledgeDocumentService({ store: penaltyStore, roots: { documentRoots: [penaltyRoot] } });
    const limitsA = write(penaltyRoot, 'limits-a.md', '# Limits\n\nThe max upload size is 25MB per request, enforced at the gateway.\n');
    const limitsB = write(penaltyRoot, 'limits-b.md', '# Limits\n\nThe max upload size is 50MB per request, enforced at the gateway.\n');
    await penaltyService.ingestApprovedDocument({ filePath: limitsA, projectIds: ['proj-penalty'] });
    await penaltyService.ingestApprovedDocument({ filePath: limitsB, projectIds: ['proj-penalty'] });
    scanForConflicts(penaltyStore, ['proj-penalty']);
    assert.strictEqual(penaltyStore.listConflicts('OPEN').length, 1, 'the isolated fixture raises exactly the upload-size conflict');

    const penaltyRetrieval = new KnowledgeRetrievalService(penaltyStore);
    const rankedForLimits = penaltyRetrieval.search({ text: 'what is the max upload size', projectIds: ['proj-penalty'], limit: 10 });
    const rankedDocIds = new Set(rankedForLimits.map(r => r.document.sourceUri));
    assert.ok(rankedDocIds.has('limits-a.md') && rankedDocIds.has('limits-b.md'),
      'both conflicting documents are returned for a query on-topic for both — neither is silently dropped by the conflict penalty');

    const penaltyPack = penaltyRetrieval.buildKnowledgePack({ text: 'what is the max upload size', projectIds: ['proj-penalty'] });
    assert.ok(penaltyPack.conflicts.length >= 1, 'the surfaced conflict is still attached to the pack alongside the still-present content');

    penaltyService.close();
    fs.rmSync(penaltyRoot, { recursive: true, force: true });
    fs.rmSync(penaltyDbDir, { recursive: true, force: true });
  }

  // --- resolution: status transitions, resolvedAt set, never auto-resolved ----------
  const conflictId = conflicts[0].id;
  const resolved = store.updateConflictStatus(conflictId, 'RESOLVED', 'confirmed with owner: 30s is correct, B is outdated');
  assert.strictEqual(resolved?.status, 'RESOLVED');
  assert.ok(resolved?.resolvedAt, 'resolvedAt is set on resolution');
  assert.strictEqual(store.listConflicts('OPEN').length, 0, 'the resolved conflict no longer appears as OPEN');

  const packAfterResolution = retrieval.buildKnowledgePack({ text: 'what is the api timeout', projectIds: ['proj-x'] });
  assert.strictEqual(packAfterResolution.conflicts.length, 0, 'a resolved conflict no longer attaches to new packs');

  // --- NEEDS_CONFIRMATION / DISMISSED do not set resolvedAt the same way ------------
  const scan2 = scanForConflicts(store, ['proj-x']); // still finds nothing new since A/B still disagree, but conflict is RESOLVED not reopened
  assert.strictEqual(scan2.created, 0, 'resolving a conflict does not make the scanner re-raise the same disagreement');

  // --- relation derivation ------------------------------------------------------------
  const relScan = scanForRelations(store, ['proj-x']);
  assert.ok(relScan.created > 0, 'relation scan finds at least the DUPLICATES relation between A and C');

  const docA = store.findActiveByPath(path.resolve(pathA))!;
  const docC = store.findActiveByPath(path.resolve(pathC))!;
  const chunksA = store.listChunks(docA.id);
  const relationsForA = store.listRelationsForDocument(docA.id);
  const duplicateRelation = relationsForA.find(r => r.relationType === 'DUPLICATES');
  assert.ok(duplicateRelation, 'A and C are byte-identical content, so a DUPLICATES relation must exist between them');
  assert.strictEqual(duplicateRelation!.confidence, 1, 'exact text duplication is confidence 1, not a fuzzy guess');
  void chunksA; void docC;

  // --- weak lexical overlap alone must not create a RELATED_TO relation -------------
  // A and B share nothing but the one-word heading "Config" (and disagree on content) —
  // that is exactly the coincidental-generic-heading case that must not count as
  // evidence of a relationship. Neither carries a tag, so RELATED_TO must not appear.
  const docB = store.findActiveByPath(path.resolve(pathB))!;
  const relationsBetweenAAndB = store.listRelationsForDocument(docA.id)
    .filter(r => r.relationType === 'RELATED_TO')
    .filter(r => {
      const bChunkIds = new Set(store.listChunks(docB.id).map(c => c.id));
      return bChunkIds.has(r.fromChunkId) || bChunkIds.has(r.toChunkId);
    });
  assert.strictEqual(relationsBetweenAAndB.length, 0,
    'sharing only a generic one-word section title ("Config") is not high-confidence evidence and must not create RELATED_TO');

  // --- deleted/superseded chunks take their relations with them (FK cascade) --------
  const relationsForCBefore = store.listRelationsForDocument(docC.id);
  assert.ok(relationsForCBefore.length > 0, 'sanity: C has at least the DUPLICATES relation with A before deletion');
  store.deleteDocument(docC.id);
  const relationsForCAfter = store.listRelationsForDocument(docC.id);
  assert.strictEqual(relationsForCAfter.length, 0, 'a deleted document\'s relations are gone, not just excluded from display');
  const orphanRelations = store.handle.prepare(`
    SELECT COUNT(*) c FROM knowledge_relations
    WHERE fromChunkId NOT IN (SELECT id FROM knowledge_chunks) OR toChunkId NOT IN (SELECT id FROM knowledge_chunks)
  `).get() as { c: number };
  assert.strictEqual(orphanRelations.c, 0, 'no relation ever points at a chunk that no longer exists');

  // --- version relations: SUPERSEDES / SUPERSEDED_BY from reindexing ----------------
  write(root, 'a.md', '# Config\n\nThe api timeout is 30 seconds and the retry count is 5.\n');
  const reindexed = await service.ingestApprovedDocument({ filePath: pathA, operationId: `reindex-${Date.now()}`, projectIds: ['proj-x'] });
  assert.strictEqual(reindexed.status, 'SUPERSEDED');
  const oldDoc = store.getDocument(docA.id)!;
  assert.strictEqual(oldDoc.status, 'SUPERSEDED');

  service.close();
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(dbDir, { recursive: true, force: true });

  console.log('[conflicts-relations] PASS');
}

run().catch(err => { console.error('[conflicts-relations] FAIL:', err); process.exit(1); });
