/**
 * Phase 6E §21-23 — scale fixture and metrics. A disposable, generated corpus only:
 * never touches the production DB, never a destructive load against anything shared.
 * Every document/section here is synthetic markdown built at test time.
 */
import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DocumentStore } from '../store';
import { KnowledgeDocumentService } from '../service';
import { KnowledgeRetrievalService } from '../retrieval';

const DOC_COUNT = 1000;
const SECTIONS_PER_DOC = 11; // >= 10,000 chunks total across DOC_COUNT documents
const PROJECT_COUNT = 20;

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mi-6e-scale-'));
}

function genDoc(index: number, projectId: string): string {
  const lines = [`# Scale Fixture Document ${index}`, ''];
  for (let s = 0; s < SECTIONS_PER_DOC; s++) {
    lines.push(`## Section ${s} of document ${index}`);
    lines.push('');
    lines.push(
      `This is synthetic scale-test content for document ${index}, section ${s}, project ${projectId}. ` +
      `It exists only to exercise ingestion, chunking, and FTS indexing at volume, and carries a unique ` +
      `marker token doc${index}sec${s}marker for deterministic retrieval checks. Padding to realistic chunk ` +
      `length: widgets, gateways, configuration, deployment, rollback, and monitoring are common terms ` +
      `repeated here to give the FTS index representative term-frequency statistics across the corpus.`,
    );
    lines.push('');
  }
  return lines.join('\n');
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

async function run() {
  const root = tmp();
  const dbDir = tmp();
  const service = new KnowledgeDocumentService({ store: new DocumentStore(dbDir), roots: { documentRoots: [root] } });

  const projectIds = Array.from({ length: PROJECT_COUNT }, (_, i) => `proj-scale-${i}`);
  const ingestStart = Date.now();
  let totalChunks = 0;
  for (let i = 0; i < DOC_COUNT; i++) {
    const projectId = projectIds[i % PROJECT_COUNT];
    const filePath = path.join(root, projectId, `doc-${i}.md`);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, genDoc(i, projectId), 'utf8');
    const outcome = await service.ingestApprovedDocument({ filePath, projectIds: [projectId], operationId: `scale-${i}` });
    assert.strictEqual(outcome.status, 'ACTIVE', `document ${i} must ingest cleanly`);
    totalChunks += outcome.chunkCount ?? 0;
  }
  const ingestMs = Date.now() - ingestStart;

  const stats = service.store.stats();
  assert.ok(stats.documents >= DOC_COUNT, `expected >= ${DOC_COUNT} documents, got ${stats.documents}`);
  assert.ok(stats.chunks >= 10_000, `expected >= 10,000 chunks, got ${stats.chunks}`);
  assert.strictEqual(totalChunks, stats.chunks, 'reported chunk counts add up to the store total');

  // --- retrieval latency at scale ---------------------------------------------------
  const retrieval = new KnowledgeRetrievalService(service.store);
  const latencies: number[] = [];
  for (let i = 0; i < 50; i++) {
    const docIndex = Math.floor(Math.random() * DOC_COUNT);
    const projectId = projectIds[docIndex % PROJECT_COUNT];
    const start = Date.now();
    const pack = retrieval.buildKnowledgePack({ text: `doc${docIndex}sec0marker`, projectIds: [projectId] });
    latencies.push(Date.now() - start);
    assert.ok(!pack.unknown, `marker query for doc ${docIndex} must resolve at scale`);
  }
  const p50 = percentile(latencies, 50);
  const p95 = percentile(latencies, 95);

  // --- incremental reindex: touching one document must not rebuild the corpus -------
  const touchedPath = path.join(root, projectIds[0], 'doc-0.md');
  const reindexStart = Date.now();
  const reindexOutcome = await service.ingestApprovedDocument({ filePath: touchedPath, operationId: 'scale-0-unchanged-recheck' });
  const reindexMs = Date.now() - reindexStart;
  assert.strictEqual(reindexOutcome.status, 'UNCHANGED', 'an unchanged source is a no-op, not a full re-chunk');

  fs.writeFileSync(touchedPath, genDoc(0, projectIds[0]).replace('doc0sec0marker', 'doc0sec0markerCHANGED'), 'utf8');
  const changedStart = Date.now();
  const changedOutcome = await service.ingestApprovedDocument({ filePath: touchedPath, operationId: `scale-0-changed-${Date.now()}` });
  const changedMs = Date.now() - changedStart;
  assert.strictEqual(changedOutcome.status, 'SUPERSEDED', 'a genuinely changed document reindexes as a new version');
  assert.ok(changedMs < ingestMs, 'reindexing one changed document is far cheaper than the initial full ingest');

  // --- DB/FTS/WAL size -----------------------------------------------------------
  const dbFile = path.join(dbDir, 'personal-os.db');
  const dbBytes = fs.existsSync(dbFile) ? fs.statSync(dbFile).size : 0;
  const walBytes = fs.existsSync(`${dbFile}-wal`) ? fs.statSync(`${dbFile}-wal`).size : 0;
  const memoryMb = process.memoryUsage().rss / (1024 * 1024);

  const report = {
    documents: stats.documents,
    chunks: stats.chunks,
    projects: PROJECT_COUNT,
    ingestThroughputDocsPerSec: Math.round((DOC_COUNT / ingestMs) * 1000 * 100) / 100,
    ingestThroughputChunksPerSec: Math.round((stats.chunks / ingestMs) * 1000 * 100) / 100,
    totalIngestMs: ingestMs,
    retrieval: { p50Ms: p50, p95Ms: p95, samples: latencies.length },
    incrementalReindex: { unchangedMs: reindexMs, changedDocumentMs: changedMs, fullCorpusIngestMs: ingestMs },
    dbSizeBytes: dbBytes,
    walSizeBytes: walBytes,
    processRssMb: Math.round(memoryMb),
  };
  console.log('[knowledge-scale]', JSON.stringify(report, null, 2));

  service.close();
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(dbDir, { recursive: true, force: true });

  console.log('[knowledge-scale] PASS');
}

run().catch(err => { console.error('[knowledge-scale] FAIL:', err); process.exit(1); });
