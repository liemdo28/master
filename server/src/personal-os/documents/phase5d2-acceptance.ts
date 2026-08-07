/**
 * Phase 5D-2 §26 acceptance — one end-to-end scenario against active, stale,
 * conflicting, superseded/deleted documents and an unrelated private note, run through
 * the real KnowledgeDocumentService + KnowledgeRetrievalService + conflict/relation
 * scanners, exactly as a caller would use them.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DocumentStore } from './store';
import { KnowledgeDocumentService } from './service';
import { KnowledgeRetrievalService } from './retrieval';
import { scanForConflicts } from './conflicts';
import { scanForRelations } from './relations';

function write(root: string, rel: string, content: string): string {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
  return full;
}

async function run(): Promise<void> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-phase5d2-acceptance-'));
  const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-phase5d2-acceptance-db-'));
  const store = new DocumentStore(dbDir);
  const service = new KnowledgeDocumentService({ store, roots: { documentRoots: [root] } });
  const retrieval = new KnowledgeRetrievalService(store);
  const checks: Array<{ name: string; pass: boolean }> = [];
  const check = (name: string, pass: boolean) => checks.push({ name, pass });

  // 1) ACTIVE document, cleanly citable.
  const activePath = write(root, 'ops/runbook.md', '# Runbook\n\n## Incident response\n\nPage the on-call engineer and open incident channel #ops-incident.\n');
  const activeOutcome = await service.ingestApprovedDocument({ filePath: activePath, projectIds: ['proj-accept'] });
  check('active document ingests', activeOutcome.status === 'ACTIVE');

  // 2) A conflicting pair: two documents disagree on a labelled fact.
  const confA = write(root, 'ops/limits-a.md', '# Limits\n\nThe max upload size is 25MB per request, enforced at the gateway.\n');
  const confB = write(root, 'ops/limits-b.md', '# Limits\n\nThe max upload size is 50MB per request, enforced at the gateway.\n');
  await service.ingestApprovedDocument({ filePath: confA, projectIds: ['proj-accept'] });
  await service.ingestApprovedDocument({ filePath: confB, projectIds: ['proj-accept'] });
  const conflictScan = scanForConflicts(store, ['proj-accept']);
  check('conflicting documents raise exactly one OPEN conflict', conflictScan.created === 1 && store.listConflicts('OPEN').length === 1);

  // 3) A document that goes STALE (source changes underneath it).
  const stalePath = write(root, 'ops/stale-doc.md', '# Cache policy\n\nCache entries expire after 300 seconds by default policy.\n');
  await service.ingestApprovedDocument({ filePath: stalePath, projectIds: ['proj-accept'] });
  fs.writeFileSync(stalePath, '# Cache policy\n\nCache entries expire after 600 seconds by default policy.\n', 'utf8');
  const staleness = service.refreshStaleness();
  check('a changed source is marked STALE', staleness.some(s => s.status === 'STALE'));

  // 4) A document that is deleted outright.
  const deletePath = write(root, 'ops/withdrawn.md', '# Withdrawn policy\n\nThis policy about legacy-token-rotation has been withdrawn.\n');
  const deleteOutcome = await service.ingestApprovedDocument({ filePath: deletePath, projectIds: ['proj-accept'] });
  store.deleteDocument(deleteOutcome.documentId!);
  check('deleted document is gone from default search', store.searchChunks('legacy-token-rotation', { projectIds: ['proj-accept'] }).length === 0);
  check('deleted document is gone even with includeStale', store.searchChunks('legacy-token-rotation', { projectIds: ['proj-accept'], includeStale: true }).length === 0);

  // 5) An unrelated private note in a different project — must never leak into proj-accept queries.
  const privatePath = write(root, 'private/diary.md', '# Personal\n\nRemember the incident channel password is stored separately and never in this file.\n');
  await service.ingestApprovedDocument({ filePath: privatePath, projectIds: ['proj-private-notes'] });

  // --- retrieval behaviour against the whole fixture set -----------------------------
  const incidentPack = retrieval.buildKnowledgePack({ text: 'how do I respond to an incident', projectIds: ['proj-accept'] });
  check('incident response query returns a cited FACT', incidentPack.items.some(i => i.factType === 'FACT' && i.citations.length > 0));
  check('incident response query never leaks the private note', !JSON.stringify(incidentPack).includes('password is stored separately'));

  const limitsPack = retrieval.buildKnowledgePack({ text: 'what is the max upload size', projectIds: ['proj-accept'] });
  check('a query touching the conflicted fact surfaces the conflict, never a silent winner', limitsPack.conflicts.length >= 1);

  const staleQueryDefault = retrieval.buildKnowledgePack({ text: 'how long do cache entries live', projectIds: ['proj-accept'] });
  check('STALE is excluded by default', staleQueryDefault.items.every(i => !i.isStale));
  const staleQueryIncluded = retrieval.search({ text: 'how long do cache entries live', projectIds: ['proj-accept'], includeStale: true });
  check('includeStale brings the stale document back', staleQueryIncluded.some(r => r.isStale));

  const privateProjectQuery = retrieval.buildKnowledgePack({ text: 'incident channel password', projectIds: ['proj-accept'] });
  check('the private note is unreachable from proj-accept regardless of query phrasing', privateProjectQuery.unknown || !JSON.stringify(privateProjectQuery).includes('password is stored separately'));

  const relationScan = scanForRelations(store, ['proj-accept']);
  check('relation scan runs cleanly against the mixed fixture set', relationScan.scanned > 0);

  // --- citation correctness spot-check ------------------------------------------------
  for (const item of incidentPack.items) {
    for (const citation of item.citations) {
      const chunk = store.listChunks(citation.documentId).find(c => c.id === citation.chunkId);
      const document = store.getDocument(citation.documentId);
      check(`citation for ${citation.chunkId} resolves to a real, matching chunk/document`,
        Boolean(chunk && document && citation.chunkContentHash === chunk.contentHash && citation.documentChecksum === document.checksum));
      check(`citation for ${citation.chunkId} never carries canonicalPath`, !('canonicalPath' in (citation as unknown as Record<string, unknown>)));
    }
  }

  service.close();
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(dbDir, { recursive: true, force: true });

  const failed = checks.filter(c => !c.pass);
  for (const c of checks) console.log(`  [${c.pass ? 'PASS' : 'FAIL'}] ${c.name}`);
  console.log(`\n[phase5d2:acceptance] ${checks.length - failed.length}/${checks.length} checks passed`);
  if (failed.length) {
    console.error('[phase5d2:acceptance] FAIL');
    process.exit(1);
  }
  console.log('[phase5d2:acceptance] PASS');
}

run().catch(err => { console.error('[phase5d2:acceptance] FAIL:', err); process.exit(1); });
