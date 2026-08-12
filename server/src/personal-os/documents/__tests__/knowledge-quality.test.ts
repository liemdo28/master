/**
 * Phase 6E §35 — targeted assertions per required category: ranking, exact path,
 * symbols, project scope, versions, freshness, conflicts, no-answer, citations,
 * partial failure. Uses the shared Phase 6E fixture corpus at a small variant count
 * (fast) — the full 500+ deterministic case sweep lives in
 * knowledge-quality-evaluation.ts (`npm run knowledge-quality:evaluation`).
 */
import assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { DocumentStore } from '../store';
import { KnowledgeDocumentService } from '../service';
import { KnowledgeRetrievalService } from '../retrieval';
import { buildQualityCorpus, tmpDir } from '../knowledge-quality-fixtures';

async function run() {
  const root = tmpDir();
  const dbDir = tmpDir();
  const service = new KnowledgeDocumentService({ store: new DocumentStore(dbDir), roots: { documentRoots: [root] } });
  const built = await buildQualityCorpus(service, root);
  const retrieval = new KnowledgeRetrievalService(service.store);

  // --- ranking: exact phrase + heading boosts put the right chunk first ------------
  {
    const pack = retrieval.buildKnowledgePack({ text: 'what port does the proj-zeta gateway listen on', projectIds: ['proj-zeta'] });
    assert.ok(pack.items[0].citations[0]?.sourceUri.includes('architecture.md'), 'ranking: top result is the architecture doc');
    assert.ok(pack.items[0].statement.includes('8101'), 'ranking: top result carries the correct port');
  }

  // --- exact path: a literal filename reference resolves to that file --------------
  {
    const pack = retrieval.buildKnowledgePack({ text: 'what is documented in proj-eta/architecture.md', projectIds: ['proj-eta'] });
    assert.ok(pack.items.some(i => i.citations.some(c => c.sourceUri.includes('architecture.md'))), 'exact path: filename reference resolves');
  }

  // --- exact path at scale: the caller's own document is still found when 20+ other
  // projects share the exact same filename fragment and would otherwise crowd it out
  // of an un-over-fetched SQL LIMIT before project filtering ever runs -------------
  {
    const manyRoot = tmpDir();
    const manyDb = tmpDir();
    const manyService = new KnowledgeDocumentService({ store: new DocumentStore(manyDb), roots: { documentRoots: [manyRoot] } });
    for (let i = 0; i < 25; i++) {
      const decoyPath = path.join(manyRoot, `decoy-project-${i}`, 'shared-name.md');
      fs.mkdirSync(path.dirname(decoyPath), { recursive: true });
      fs.writeFileSync(decoyPath, `# Decoy\n\nThis is unrelated filler content for decoy project ${i}, sharing only the filename with the real target document below.\n`);
      await manyService.ingestApprovedDocument({ filePath: decoyPath, projectIds: [`decoy-project-${i}`] });
    }
    const targetPath = path.join(manyRoot, 'proj-target', 'shared-name.md');
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, '# Target\n\nThis document carries the marker phrase findable-only-by-exact-path-lookup for this regression test.\n');
    await manyService.ingestApprovedDocument({ filePath: targetPath, projectIds: ['proj-target'] });

    const manyRetrieval = new KnowledgeRetrievalService(manyService.store);
    const targetPack = manyRetrieval.buildKnowledgePack({ text: 'what is in shared-name.md', projectIds: ['proj-target'] });
    assert.ok(
      targetPack.items.some(i => i.statement.includes('findable-only-by-exact-path-lookup')),
      'exact path at scale: the in-scope document is found even when 20+ other projects share its exact filename',
    );
    manyService.close();
    fs.rmSync(manyRoot, { recursive: true, force: true });
    fs.rmSync(manyDb, { recursive: true, force: true });
  }

  // --- symbols: a literal code/file symbol from a runbook resolves -----------------
  {
    const pack = retrieval.buildKnowledgePack({ text: 'what does theta_scheduler.py have to do with', projectIds: ['proj-theta'] });
    assert.ok(pack.items.some(i => i.statement.includes('theta_scheduler.py')), 'symbol: exact symbol reference is retrievable');
  }

  // --- project scope: identical query text, different projects, no cross-leak -----
  {
    const packA = retrieval.buildKnowledgePack({ text: 'authentication flow token lifetime', projectIds: ['proj-dup-a'] });
    const packB = retrieval.buildKnowledgePack({ text: 'authentication flow token lifetime', projectIds: ['proj-dup-b'] });
    assert.ok(JSON.stringify(packA).includes('15 minutes'), 'scope: proj-dup-a gets its own answer');
    assert.ok(!JSON.stringify(packA).includes('30 days'), 'scope: proj-dup-a never sees proj-dup-b content');
    assert.ok(JSON.stringify(packB).includes('30 days'), 'scope: proj-dup-b gets its own answer');
    assert.ok(!JSON.stringify(packB).includes('15 minutes'), 'scope: proj-dup-b never sees proj-dup-a content');
  }

  // --- versions: current value wins by default, old value never leaks --------------
  {
    const pack = retrieval.buildKnowledgePack({ text: 'max upload size mb', projectIds: ['proj-version'] });
    assert.ok(JSON.stringify(pack).includes('50'), 'versions: current value is returned');
    assert.ok(!JSON.stringify(pack).includes('max upload size mb: 10'), 'versions: superseded value never leaks');
  }

  // --- freshness/staleness: excluded by default, included when requested, penalized either way
  {
    const defaultPack = retrieval.buildKnowledgePack({ text: 'cache ttl seconds', projectIds: ['proj-stale'] });
    assert.strictEqual(defaultPack.unknown, true, 'freshness: a STALE-only match is excluded by default');
    assert.strictEqual(defaultPack.unknownReason, 'STALE_ONLY', 'freshness: the reason is reported, not just an empty result');

    const includeStalePack = retrieval.buildKnowledgePack({ text: 'cache ttl seconds', projectIds: ['proj-stale'], includeStale: true });
    assert.strictEqual(includeStalePack.unknown, false, 'freshness: includeStale surfaces the stale match');
    assert.ok(includeStalePack.items[0].isStale, 'freshness: the item is honestly flagged as stale');
  }

  // --- conflicts: surfaced, never silently resolved to one side --------------------
  {
    const pack = retrieval.buildKnowledgePack({ text: 'what is the request timeout', projectIds: ['proj-conflict'] });
    assert.ok(pack.conflicts.length > 0, 'conflicts: an open conflict is surfaced on a query that touches it');
  }

  // --- no-answer: a genuinely unsupported query returns UNKNOWN, not a guess -------
  {
    const pack = retrieval.buildKnowledgePack({ text: 'recommended sourdough bread hydration ratio', projectIds: ['proj-zeta'] });
    assert.strictEqual(pack.unknown, true, 'no-answer: unsupported query returns UNKNOWN');
    assert.strictEqual(pack.items.length, 1, 'no-answer: exactly one explicit UNKNOWN item, not an empty list');
    assert.strictEqual(pack.items[0].factType, 'UNKNOWN');
    assert.strictEqual(pack.unknownReason, 'NO_SUPPORTED_ANSWER', 'no-answer: reason distinguishes this from an unindexed project');
  }

  // --- citations: every citation resolves to a real, checksum-matching chunk/document
  {
    const pack = retrieval.buildKnowledgePack({ text: 'what language is proj-kappa implemented in', projectIds: ['proj-kappa'] });
    for (const item of pack.items) {
      for (const citation of item.citations) {
        const chunk = service.store.listChunks(citation.documentId).find(c => c.id === citation.chunkId);
        const document = service.store.getDocument(citation.documentId);
        assert.ok(chunk && document, 'citations: cited chunk/document exist');
        assert.strictEqual(citation.chunkContentHash, chunk!.contentHash, 'citations: chunk hash matches');
        assert.strictEqual(citation.documentChecksum, document!.checksum, 'citations: document checksum matches');
        assert.ok(!('canonicalPath' in (citation as unknown as Record<string, unknown>)), 'citations: never carries canonicalPath');
      }
    }
  }

  // --- partial failure: PROJECT_NOT_INDEXED distinguishes "never indexed" from "no match"
  {
    const neverIndexed = retrieval.buildKnowledgePack({ text: 'anything at all', projectIds: ['proj-completely-unknown'] });
    assert.strictEqual(neverIndexed.unknown, true);
    assert.strictEqual(neverIndexed.unknownReason, 'PROJECT_NOT_INDEXED', 'partial failure: an unindexed project is distinguishable from a real no-answer');

    const genuinelyNoAnswer = retrieval.buildKnowledgePack({ text: 'recommended tire pressure for gravel trails', projectIds: ['proj-zeta'] });
    assert.strictEqual(genuinelyNoAnswer.unknownReason, 'NO_SUPPORTED_ANSWER', 'partial failure: an indexed project with no match is not confused with an unindexed one');
  }

  // --- deleted document is never citable again --------------------------------------
  {
    const pack = retrieval.buildKnowledgePack({ text: 'legacy queue codename withdrawn', projectIds: ['proj-zeta'] });
    assert.ok(!JSON.stringify(pack.items).includes('phoenix-wing-41'), 'deleted content never resurfaces');
    assert.strictEqual(pack.unknown, true, 'deleted content produces UNKNOWN, not a fabricated match');
  }

  service.close();
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(dbDir, { recursive: true, force: true });
  void built;

  console.log('[knowledge-quality] PASS');
}

run().catch(err => { console.error('[knowledge-quality] FAIL:', err); process.exit(1); });
