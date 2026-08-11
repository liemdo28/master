import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DocumentStore } from '../../personal-os/documents/store';
import { EvidenceService } from '../service';

function tempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'phase6d-conflicts-'));
}

function main() {
  const root = tempRoot();
  const documents = new DocumentStore(root);
  let evidence: EvidenceService | undefined;
  try {
    // Two independent conflicts, one per project, plus one already-resolved conflict
    // seeded directly as RESOLVED so it never appears as open at all.
    const openA = documents.createConflict({
      chunkIds: ['chunk-1'], documentIds: ['doc-1'], projectIds: ['project-a'],
      description: 'project-a: two chunks disagree about the deployment date', detectionReason: 'test-seeded',
    });
    const openB = documents.createConflict({
      chunkIds: ['chunk-2'], documentIds: ['doc-2'], projectIds: ['project-b'],
      description: 'project-b: stale doc contradicts fresh doc', detectionReason: 'test-seeded',
    });
    const alreadyResolved = documents.createConflict({
      chunkIds: ['chunk-3'], documentIds: ['doc-3'], projectIds: ['project-a'],
      description: 'already resolved before evidence ever reads it', detectionReason: 'test-seeded',
      status: 'RESOLVED',
    });

    evidence = new EvidenceService({ personalOsRoot: root });

    const conflicts = evidence.conflicts();
    const conflictSourceIds = new Set(conflicts.map(c => c.sourceId));
    assert.ok(conflictSourceIds.has(openA.id), 'open conflict A must be visible');
    assert.ok(conflictSourceIds.has(openB.id), 'open conflict B must be visible');
    assert.ok(!conflictSourceIds.has(alreadyResolved.id), 'a conflict already RESOLVED at source must never appear as open');
    console.log('[evidence-conflicts] PASS: only genuinely open conflicts are visible');

    // Conflict must never be silently picked-a-winner — the evidence record itself
    // carries no "resolution", only the raw fact that a conflict exists and which
    // documents/chunks it touches.
    const recordA = conflicts.find(c => c.sourceId === openA.id)!;
    assert.strictEqual(recordA.category, 'CONFLICT');
    assert.ok(recordA.relatedEvidence.includes('KNOWLEDGE:doc-1'), 'conflict must link back to the documents it touches');
    assert.strictEqual(recordA.projectId, 'project-a');
    console.log('[evidence-conflicts] PASS: conflict record links to its documents and never resolves itself');

    // Cross-project isolation: filtering by project-b must never leak project-a's conflict.
    const projectBOnly = evidence.list({ projectId: 'project-b', category: 'CONFLICT' });
    assert.ok(projectBOnly.every(c => c.projectId === 'project-b'));
    assert.ok(!projectBOnly.some(c => c.sourceId === openA.id));
    console.log('[evidence-conflicts] PASS: project filter never leaks another project\'s conflict');

    // Resolving at the source makes it disappear from conflicts() without any
    // evidence-layer mutation — evidence has no resolve() method at all.
    documents.updateConflictStatus(openA.id, 'RESOLVED', 'resolved for test');
    const afterResolve = evidence.conflicts();
    assert.ok(!afterResolve.some(c => c.sourceId === openA.id), 'resolving at the source must be reflected on the very next read, with no caching');
    assert.ok(afterResolve.some(c => c.sourceId === openB.id), 'resolving one conflict must never affect an unrelated open conflict');
    console.log('[evidence-conflicts] PASS: resolution at the source is reflected immediately, scoped to only that conflict');

    console.log('[evidence-conflicts] ALL PASS');
  } finally {
    evidence?.close();
    documents.close();
    try { fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch (e) { console.error('cleanup warning:', e); }
  }
}

main();
