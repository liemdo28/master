import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { KnowledgeDocumentService } from '../service';
import { DocumentStore } from '../store';
import { buildChunks } from '../chunking';
import { parseMarkdown, parseJson, parseYaml, parsePlainText, parseHtml } from '../parsers';
import { CHUNK_DEFAULTS } from '../types';

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mi-5d-ingest-'));
}

function write(root: string, rel: string, body: string): string {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, body);
  return full;
}

function makeService(root: string, projectRoot: string, dbDir = 'db') {
  return new KnowledgeDocumentService({
    store: new DocumentStore(path.join(root, dbDir)),
    registry: null,
    roots: { projectRoots: { 'fixture-project': projectRoot }, documentRoots: [], approvedFiles: [] },
  });
}

const ARCHITECTURE = `---
title: Fixture Architecture
owner: platform
---

# Architecture

The service is a single Node process.

## Deployment

Deploys are built from a clean worktree.

### Rollback

Restore the previous dist and restart only mi-core.

\`\`\`bash
# a fenced block: a # here is code, not a heading
pm2 restart mi-core
\`\`\`
`;

async function run() {
  const root = tmp();
  const projectRoot = path.join(root, 'project');
  fs.mkdirSync(projectRoot, { recursive: true });

  // --- parsers ---------------------------------------------------------------
  const md = parseMarkdown(ARCHITECTURE);
  assert.strictEqual(md.title, 'Architecture', 'markdown title comes from the first heading');
  assert.strictEqual(md.metadata.owner, 'platform', 'front matter is parsed as metadata');
  const rollback = md.sections.find(s => s.sectionTitle === 'Rollback');
  assert.ok(rollback, 'nested heading produces a section');
  assert.deepStrictEqual(rollback!.headingPath, ['Architecture', 'Deployment', 'Rollback'], 'heading hierarchy preserved');
  assert.ok(rollback!.text.includes('pm2 restart mi-core'), 'fenced code stays with its section');
  assert.ok(!md.sections.some(s => s.sectionTitle?.includes('a fenced block')), 'a # inside a fence is not a heading');

  const text = parsePlainText('First paragraph.\n\nSecond paragraph.\n');
  assert.strictEqual(text.sections.length, 2, 'text splits on blank lines');

  const jsonSource = JSON.stringify({ b: 2, a: { nested: 'value' }, password: 'should-not-appear-xyz' });
  const json = parseJson(jsonSource);
  const jsonBlob = JSON.stringify(json.sections);
  // Keys are walked in sorted order, so the nested "a" group is emitted before the
  // root-level group holding "b". Re-parsing must give byte-identical output.
  assert.deepStrictEqual(json.sections.map(s => s.sectionTitle), ['a', 'b'], 'structured groups are emitted in stable sorted order');
  assert.deepStrictEqual(JSON.stringify(parseJson(jsonSource).sections), jsonBlob, 'structured parsing is deterministic');
  assert.ok(json.sections[0].text.includes('a.nested: value'));
  assert.ok(!jsonBlob.includes('should-not-appear-xyz'), 'a sensitive JSON key is redacted');
  assert.ok(jsonBlob.includes('[REDACTED]'));

  const yaml = parseYaml('title: Fixture\nsteps:\n  - build\n  - deploy\nnested:\n  api_key: leak-me-not-abc\n');
  const yamlBlob = JSON.stringify(yaml.sections);
  assert.ok(yamlBlob.includes('steps.0: build'), 'YAML sequences are flattened');
  assert.ok(!yamlBlob.includes('leak-me-not-abc'), 'a sensitive YAML key is redacted');

  const html = parseHtml('<h1>Guide</h1><p>Body text here.</p>');
  assert.strictEqual(html.sections[0].sectionTitle, 'Guide');
  assert.ok(html.sections[0].text.includes('Body text'));

  // --- deterministic chunking -------------------------------------------------
  const chunkOnce = buildChunks({ documentId: 'doc-fixed', sections: md.sections, projectIds: ['p'], sensitivity: 'INTERNAL', now: 'now' });
  const chunkTwice = buildChunks({ documentId: 'doc-fixed', sections: md.sections, projectIds: ['p'], sensitivity: 'INTERNAL', now: 'later' });
  assert.deepStrictEqual(chunkOnce.chunks.map(c => c.id), chunkTwice.chunks.map(c => c.id), 'chunking is deterministic across runs');
  assert.deepStrictEqual(chunkOnce.chunks.map(c => c.contentHash), chunkTwice.chunks.map(c => c.contentHash));
  assert.ok(chunkOnce.chunks.every((c, i) => c.ordinal === i), 'ordinals are stable and dense');
  assert.ok(chunkOnce.chunks.every(c => c.text.length <= CHUNK_DEFAULTS.maxChars), 'chunks respect the size bound');
  assert.ok(chunkOnce.chunks.some(c => c.headingPath.length === 3), 'chunk keeps its heading path for citation');

  // Use a section comfortably above the minimum chunk size, so the assertion is about
  // deduplication rather than about the short-section filter.
  const repeatable = {
    headingPath: ['Deployment'],
    text: 'Deploys are built from a clean worktree and never from the live checkout.',
    sourceStart: 0, sourceEnd: 72, pageNumber: null, sectionTitle: 'Deployment',
  };
  const duplicated = buildChunks({
    documentId: 'doc-dup',
    sections: [repeatable, { ...repeatable }],
    projectIds: [], sensitivity: 'INTERNAL', now: 'now',
  });
  assert.strictEqual(duplicated.chunks.length, 1, 'the duplicate is not stored twice');
  assert.strictEqual(duplicated.duplicatesSkipped, 1, 'identical sections deduplicate');

  const oversized = buildChunks({
    documentId: 'doc-big',
    sections: [{ headingPath: ['Big'], text: 'word '.repeat(2000), sourceStart: 0, sourceEnd: 10, pageNumber: null, sectionTitle: 'Big' }],
    projectIds: [], sensitivity: 'INTERNAL', now: 'now',
  });
  assert.ok(oversized.chunks.length > 1, 'an oversized section is split');
  assert.ok(oversized.chunks.every(c => c.text.length <= CHUNK_DEFAULTS.maxChars), 'every split piece is bounded');

  const empty = buildChunks({
    documentId: 'doc-empty',
    sections: [{ headingPath: [], text: '   ', sourceStart: 0, sourceEnd: 0, pageNumber: null, sectionTitle: null }],
    projectIds: [], sensitivity: 'INTERNAL', now: 'now',
  });
  assert.strictEqual(empty.chunks.length, 0, 'empty sections are ignored');

  // --- end-to-end ingestion ---------------------------------------------------
  const service = makeService(root, projectRoot);
  const archPath = write(projectRoot, 'docs/architecture.md', ARCHITECTURE);

  const first = await service.ingestApprovedDocument({ filePath: archPath, operationId: 'op-1' });
  assert.strictEqual(first.status, 'ACTIVE', 'an approved markdown file activates');
  assert.ok(first.documentId, 'a document id is returned');
  assert.strictEqual(first.version, 1);
  assert.ok((first.chunkCount ?? 0) > 0, 'chunks were produced');
  assert.strictEqual(first.sourceUri, 'docs/architecture.md', 'the returned uri is project-relative');
  assert.ok(!JSON.stringify(first).includes(projectRoot), 'the outcome carries no absolute path');

  const document = service.store.getDocument(first.documentId!)!;
  assert.strictEqual(document.status, 'ACTIVE');
  assert.deepStrictEqual(document.projectIds, ['fixture-project'], 'the project link comes from the approved root');
  assert.ok(document.checksum.length === 64, 'a checksum is recorded');

  const chunks = service.store.listChunks(first.documentId!);
  assert.ok(chunks.every(c => c.documentId === first.documentId));
  assert.ok(chunks.some(c => c.sectionTitle === 'Rollback'), 'section provenance is persisted');

  // --- idempotency and duplicate operations -----------------------------------
  const repeat = await service.ingestApprovedDocument({ filePath: archPath, operationId: 'op-1' });
  assert.strictEqual(repeat.status, 'UNCHANGED', 'a repeated operationId does not ingest twice');
  assert.strictEqual(repeat.documentId, first.documentId);

  const unchanged = await service.ingestApprovedDocument({ filePath: archPath, operationId: 'op-2' });
  assert.strictEqual(unchanged.status, 'UNCHANGED', 'an unchanged source is a no-op even under a new operation');
  assert.strictEqual(service.store.stats().documents, 1, 'no duplicate document row is created');

  // --- staleness, re-index and supersession -----------------------------------
  assert.strictEqual(service.refreshStaleness().length, 0, 'an untouched source is not stale');

  // A same-length edit proves staleness is driven by the checksum, not just the size.
  const sameSizeEdit = ARCHITECTURE.replace('a single Node process', 'a single node PROCESS');
  assert.strictEqual(sameSizeEdit.length, ARCHITECTURE.length, 'the edit keeps the byte length identical');
  fs.writeFileSync(archPath, sameSizeEdit);
  const contentStale = service.refreshStaleness();
  assert.strictEqual(contentStale.length, 1, 'a same-size content change is still detected');
  assert.strictEqual(contentStale[0].reason, 'source content changed', 'detected by checksum, not size');
  assert.strictEqual(service.store.getDocument(first.documentId!)?.status, 'STALE');

  // Restore ACTIVE, then make a size-changing edit for the re-index path below.
  service.store.setStatus(first.documentId!, 'ACTIVE');
  fs.writeFileSync(archPath, `${ARCHITECTURE}\n## Monitoring\n\nSelfHeal probes /api/health for readiness.\n`);
  const stale = service.refreshStaleness();
  assert.strictEqual(stale.length, 1, 'a changed source becomes stale');
  assert.strictEqual(stale[0].reason, 'source size changed');
  assert.strictEqual(service.store.getDocument(first.documentId!)?.status, 'STALE');

  const reindexed = await service.reindex(first.documentId!);
  assert.strictEqual(reindexed.status, 'SUPERSEDED', 're-indexing a changed source creates a new version');
  assert.strictEqual(reindexed.version, 2);
  assert.notStrictEqual(reindexed.documentId, first.documentId, 'the new version gets its own id');
  assert.strictEqual(service.store.getDocument(first.documentId!)?.status, 'SUPERSEDED', 'the old version is superseded');
  assert.strictEqual(service.store.countChunks(first.documentId!), 0, 'superseded chunks are removed');
  const newDoc = service.store.getDocument(reindexed.documentId!)!;
  assert.strictEqual(newDoc.supersedesId, first.documentId, 'supersession is linked');
  assert.ok(service.store.listChunks(newDoc.id).some(c => c.sectionTitle === 'Monitoring'), 'new content is indexed');

  // --- missing source ---------------------------------------------------------
  const throwaway = write(projectRoot, 'docs/temporary.md',
    '# Temp\n\nThis temporary note carries enough content to clear the minimum chunk size.\n');
  const temp = await service.ingestApprovedDocument({ filePath: throwaway, operationId: 'op-temp' });
  assert.strictEqual(temp.status, 'ACTIVE');

  // A document with nothing above the minimum chunk size is a clean failure, not an
  // ACTIVE document with zero chunks.
  const tiny = write(projectRoot, 'docs/tiny.md', '# T\n\nToo short.\n');
  const tinyOutcome = await service.ingestApprovedDocument({ filePath: tiny, operationId: 'op-tiny' });
  assert.strictEqual(tinyOutcome.status, 'FAILED');
  assert.strictEqual(tinyOutcome.errorCode, 'NO_CONTENT');
  assert.strictEqual(tinyOutcome.documentId, null, 'no document row is created for empty content');
  fs.unlinkSync(throwaway);
  const missing = service.refreshStaleness();
  assert.ok(missing.some(m => m.documentId === temp.documentId && m.reason === 'source file is missing'),
    'a deleted source is reported, not silently dropped');

  // --- deletion ---------------------------------------------------------------
  const deleted = service.store.deleteDocument(temp.documentId!);
  assert.strictEqual(deleted?.status, 'DELETED');
  assert.strictEqual(service.store.countChunks(temp.documentId!), 0, 'deletion removes chunks');
  assert.ok(service.store.getDocument(temp.documentId!), 'the audit record itself survives deletion');
  assert.ok(!service.store.listDocuments().some(d => d.id === temp.documentId), 'deleted documents leave the default listing');

  // --- other formats end to end -----------------------------------------------
  for (const [rel, body] of [
    ['docs/notes.txt', 'A plain paragraph with enough words to be worth indexing here.\n\nAnother paragraph follows.'],
    ['docs/config.json', JSON.stringify({ service: 'mi-core', port: 4001, deployment: { strategy: 'clean worktree build' } }, null, 2)],
    ['docs/pipeline.yaml', 'name: deploy\nsteps:\n  - build the server\n  - restart only mi-core\n'],
    ['docs/guide.html', '<html><body><h1>Guide</h1><p>Restore the previous dist and restart mi-core.</p></body></html>'],
  ] as Array<[string, string]>) {
    const file = write(projectRoot, rel, body);
    const outcome = await service.ingestApprovedDocument({ filePath: file, operationId: `op-${rel}` });
    assert.strictEqual(outcome.status, 'ACTIVE', `${rel} ingests`);
    assert.ok((outcome.chunkCount ?? 0) > 0, `${rel} produces chunks`);
  }

  // --- no orphan chunks, integrity holds ---------------------------------------
  const stats = service.store.stats();
  const orphans = service.store.handle.prepare(
    `SELECT COUNT(*) c FROM knowledge_chunks WHERE documentId NOT IN (SELECT id FROM knowledge_documents)`,
  ).get() as { c: number };
  assert.strictEqual(orphans.c, 0, 'no orphan chunks exist');
  const integrity = service.store.integrity();
  assert.strictEqual(integrity.integrityCheck, 'ok');
  assert.deepStrictEqual(integrity.foreignKeyViolations, []);
  assert.strictEqual(integrity.schemaVersion, 4);
  service.close();

  // --- close and reopen --------------------------------------------------------
  const reopened = makeService(root, projectRoot);
  assert.strictEqual(reopened.store.stats().documents, stats.documents, 'documents survive reopen');
  assert.strictEqual(reopened.store.stats().chunks, stats.chunks, 'chunks survive reopen');
  assert.strictEqual(reopened.store.integrity().integrityCheck, 'ok');
  const survivor = reopened.store.getDocument(newDoc.id)!;
  assert.strictEqual(survivor.version, 2, 'version survives reopen');
  assert.ok(reopened.store.listChunks(newDoc.id).length > 0, 'chunk provenance survives reopen');
  reopened.close();

  // --- discovery lists but never ingests ---------------------------------------
  const discoverService = makeService(root, projectRoot, 'db2');
  write(projectRoot, 'node_modules/pkg/readme.md', '# should be skipped');
  write(projectRoot, '.env', 'SECRET_TOKEN=abcdefghijklmnop');
  const discovered = discoverService.discover(projectRoot);
  assert.ok(discovered.documents.length > 0, 'discovery finds approved documents');
  assert.ok(!discovered.documents.some(d => d.sourceUri.includes('node_modules')), 'discovery skips excluded folders');
  assert.ok(!discovered.documents.some(d => d.sourceUri.includes('.env')), 'discovery skips excluded files');
  assert.ok(discovered.documents.every(d => !path.isAbsolute(d.sourceUri)), 'discovery returns relative uris only');
  assert.strictEqual(discoverService.store.stats().documents, 0, 'discovery ingests nothing');
  discoverService.close();

  fs.rmSync(root, { recursive: true, force: true });
  console.log('[document-ingestion] PASS');
}

run().catch(err => { console.error('[document-ingestion] FAIL:', err); process.exit(1); });
