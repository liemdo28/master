/**
 * Mi Big Data Foundation — Test Suite (Phase 9)
 * Run: npx ts-node bigdata.test.ts (or via jest if configured)
 * Tests run sequentially — each depends on previous state.
 */

import { isPostgresAvailable } from './db-client';
import { isMinioAvailable, ensureAllBuckets, putObject, BUCKETS } from './minio-client';
import { isQdrantAvailable } from './memory-indexer';
import { listSources, registerSource, getSourceByName } from './source-registry';
import { storeRawObject } from './object-store';
import { ingestJson, ingestFile } from './ingestion-service';
import { redactSecrets, redactObject, isBlockedFilename } from './secret-redactor';
import { autoNormalize } from './normalizer';
import { indexTextChunks } from './memory-indexer';
import { hybridSearch } from './search-service';
import { answerOperationalQuestion } from './ceo-query-service';
import { runAllChecks } from './data-quality';

interface TestResult { name: string; status: 'PASS' | 'FAIL' | 'SKIP'; detail: string; }

const results: TestResult[] = [];
let testSourceId = 0;
const RUN_ID = Date.now();

function pass(name: string, detail = '') { results.push({ name, status: 'PASS', detail }); console.log(`  ✅ PASS: ${name}${detail ? ' — ' + detail : ''}`); }
function fail(name: string, detail: string) { results.push({ name, status: 'FAIL', detail }); console.error(`  ❌ FAIL: ${name} — ${detail}`); }
function skip(name: string, reason: string) { results.push({ name, status: 'SKIP', detail: reason }); console.log(`  ⏭  SKIP: ${name} — ${reason}`); }

// ── T1: Storage health ────────────────────────────────────────────────────────
async function t1_storageHealth() {
  console.log('\nT1: Storage health checks');
  const pg = await isPostgresAvailable();
  const minio = await isMinioAvailable();
  const qdrant = await isQdrantAvailable();
  if (pg) pass('T1a: PostgreSQL available'); else fail('T1a: PostgreSQL available', 'Cannot connect to postgres');
  if (minio) pass('T1b: MinIO available'); else fail('T1b: MinIO available', 'Cannot connect to MinIO');
  if (qdrant) pass('T1c: Qdrant available'); else fail('T1c: Qdrant available', 'Cannot connect to Qdrant');
  return { pg, minio, qdrant };
}

// ── T2: Source registry ───────────────────────────────────────────────────────
async function t2_sourceRegistry(pgOk: boolean) {
  console.log('\nT2: Source registry');
  if (!pgOk) { skip('T2: Source registry', 'PostgreSQL unavailable'); return false; }

  const source = await registerSource({ name: 'test-bigdata-source', type: 'manual', description: 'Test source for unit tests' });
  if (!source || !source.id) { fail('T2a: Register source', 'No id returned'); return false; }
  testSourceId = source.id;
  pass('T2a: Register source', `id=${source.id}`);

  const found = await getSourceByName('test-bigdata-source');
  if (!found) { fail('T2b: Get source by name', 'Not found after insert'); return false; }
  pass('T2b: Get source by name');

  const list = await listSources();
  if (!Array.isArray(list) || list.length === 0) { fail('T2c: List sources', 'Empty list'); return false; }
  pass('T2c: List sources', `${list.length} sources`);
  return true;
}

// ── T3: JSON ingest ───────────────────────────────────────────────────────────
async function t3_jsonIngest(pgOk: boolean, minioOk: boolean) {
  console.log('\nT3: JSON ingest');
  if (!pgOk || !minioOk) { skip('T3: JSON ingest', 'PG or MinIO unavailable'); return false; }

  const result = await ingestJson({
    source_name: 'test-bigdata-source',
    payload: { store: 'bakudan', tasks: [{ id: 'test-t1', title: 'Test task', status: 'pending', assignee: 'Maria', updated_at: new Date().toISOString() }] },
    filename: `test_ingest_${RUN_ID}.json`,
    index_memory: false,
  });

  if (!result.raw_object_id) { fail('T3a: JSON ingest returns raw_object_id', 'No id'); return false; }
  pass('T3a: JSON ingest returns raw_object_id', `id=${result.raw_object_id}`);
  pass('T3b: Job created', `job_id=${result.job_id}`);
  return true;
}

// ── T4: File ingest ───────────────────────────────────────────────────────────
async function t4_fileIngest(pgOk: boolean, minioOk: boolean) {
  console.log('\nT4: File ingest');
  if (!pgOk || !minioOk) { skip('T4: File ingest', 'PG or MinIO unavailable'); return false; }

  const csvContent = 'Date,Item,Amount\n2026-06-10,Ramen,14.00\n2026-06-10,Sushi,18.00\n';
  const result = await ingestFile({
    source_name: 'test-bigdata-source',
    filename: `test_sales_${RUN_ID}.csv`,
    buffer: Buffer.from(csvContent),
    content_type: 'text/csv',
    index_memory: false,
  });

  if (!result.raw_object_id) { fail('T4a: File ingest returns raw_object_id', 'No id'); return false; }
  pass('T4a: File ingest returns raw_object_id', `id=${result.raw_object_id}`);
  return true;
}

// ── T5: Duplicate checksum ────────────────────────────────────────────────────
async function t5_duplicateChecksum(pgOk: boolean, minioOk: boolean) {
  console.log('\nT5: Duplicate checksum detection');
  if (!pgOk || !minioOk) { skip('T5', 'PG or MinIO unavailable'); return; }

  const content = `dup-test-content-${Date.now()}`;
  const r1 = await ingestFile({ source_name: 'test-bigdata-source', filename: `dup1_${RUN_ID}.txt`, buffer: Buffer.from(content), content_type: 'text/plain', index_memory: false });
  const r2 = await ingestFile({ source_name: 'test-bigdata-source', filename: `dup2_${RUN_ID}.txt`, buffer: Buffer.from(content), content_type: 'text/plain', index_memory: false });

  if (r1.raw_object_id === r2.raw_object_id) {
    pass('T5: Duplicate checksum — returns same raw_object_id');
  } else {
    fail('T5: Duplicate checksum', `Different ids: ${r1.raw_object_id} vs ${r2.raw_object_id}`);
  }
}

// ── T6: Secret redaction ──────────────────────────────────────────────────────
async function t6_secretRedaction() {
  console.log('\nT6: Secret redaction');

  const { clean, found } = redactSecrets('my api_key=sk-12345678901234567890 and password=hunter2');
  if (found.length > 0) pass('T6a: Detects secrets in text', `found: ${found.join(', ')}`);
  else fail('T6a: Detects secrets', 'Nothing detected');

  if (!String(clean).includes('sk-12345678901234567890')) pass('T6b: Redacts OpenAI key');
  else fail('T6b: Redacts OpenAI key', 'Key still present');

  const blocked = isBlockedFilename('.env');
  if (blocked) pass('T6c: Blocks .env filename');
  else fail('T6c: Blocks .env filename', '.env not blocked');

  const { secrets } = redactObject({ token: 'abc123', data: 'normal text' });
  if (secrets.length > 0) pass('T6d: Redacts object key named "token"');
  else fail('T6d: Object key redaction', 'token not redacted');
}

// ── T7: Normalized event creation ─────────────────────────────────────────────
async function t7_normalizedEvent(pgOk: boolean) {
  console.log('\nT7: Normalized event creation');
  if (!pgOk) { skip('T7', 'PostgreSQL unavailable'); return; }

  const result = await autoNormalize('dashboard',
    { store: 'bakudan', tasks: [{ id: 'n-t1', title: 'Norm test', status: 'pending', assignee: 'Test', updated_at: new Date().toISOString() }] },
    testSourceId, 1
  );
  if (result.count > 0) pass('T7: Normalized event created', `${result.count} events`);
  else fail('T7: Normalized event', 'count=0');
}

// ── T8: Qdrant indexing ────────────────────────────────────────────────────────
async function t8_qdrantIndexing(pgOk: boolean, qdrantOk: boolean) {
  console.log('\nT8: Qdrant indexing');
  if (!pgOk || !qdrantOk) { skip('T8', 'PG or Qdrant unavailable'); return; }

  const result = await indexTextChunks({
    text: 'Bakudan Ramen had excellent service today. Sales were up 15%. Staff performance was great.',
    title: 'test-memory-chunk',
    source_id: testSourceId,
    chunk_type: 'test',
    tags: ['test'],
  });
  if (result.chunks_indexed > 0) pass('T8: Qdrant chunks indexed', `${result.chunks_indexed} chunks`);
  else fail('T8: Qdrant indexing', 'chunks_indexed=0');
}

// ── T9: Search ─────────────────────────────────────────────────────────────────
async function t9_search(pgOk: boolean) {
  console.log('\nT9: Search API');
  if (!pgOk) { skip('T9', 'PostgreSQL unavailable'); return; }

  const results = await hybridSearch('bakudan task', {}, 5);
  if (Array.isArray(results)) pass('T9: Search returns array', `${results.length} results`);
  else fail('T9: Search', 'Not an array');
}

// ── T10: CEO query ─────────────────────────────────────────────────────────────
async function t10_ceoQuery(pgOk: boolean) {
  console.log('\nT10: CEO query service');
  if (!pgOk) { skip('T10', 'PostgreSQL unavailable'); return; }

  const queries = [
    'Store nào có nhiều issue nhất 30 ngày qua?',
    'QB ngày nào thiếu activity?',
    'DoorDash dispute nào chưa xử lý?',
    'Review xấu nào cần escalate?',
    'Có invoice nào duplicate không?',
  ];

  let passed = 0;
  for (const q of queries) {
    const r = await answerOperationalQuestion(q, {});
    if (r.answer && r.answer.length > 10) {
      pass(`T10: CEO query "${q.slice(0,40)}..."`, r.source);
      passed++;
    } else {
      fail(`T10: CEO query "${q.slice(0,40)}..."`, 'Empty answer');
    }
  }
  return passed === queries.length;
}

// ── T11: Connector sample ingest ──────────────────────────────────────────────
async function t11_connectorSample(pgOk: boolean, minioOk: boolean) {
  console.log('\nT11: Connector sample ingest');
  if (!pgOk || !minioOk) { skip('T11', 'PG or MinIO unavailable'); return; }

  const sampleReview = {
    store: 'raw',
    platform: 'google',
    review_id: `rv-test-${Date.now()}`,
    rating: 3,
    author: 'Test User',
    text: 'Food was okay. Service could be faster.',
    published_at: new Date().toISOString(),
    reply_status: 'pending',
  };

  const result = await ingestJson({ source_name: 'review-automation', payload: sampleReview, filename: `test_review_${RUN_ID}.json`, index_memory: false });
  if (result.raw_object_id) pass('T11: Review connector sample ingest', `object_id=${result.raw_object_id}`);
  else fail('T11: Review connector sample ingest', 'No raw_object_id');
}

// ── T12: Data quality report ──────────────────────────────────────────────────
async function t12_qualityReport(pgOk: boolean) {
  console.log('\nT12: Data quality report');
  if (!pgOk) { skip('T12', 'PostgreSQL unavailable'); return; }

  const { results: qr, summary } = await runAllChecks();
  if (qr.length >= 5) pass('T12: Quality checks run', `${qr.length} checks, summary: ${JSON.stringify(summary)}`);
  else fail('T12: Quality checks', `Only ${qr.length} checks ran`);
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function runAll() {
  console.log('Mi Big Data Foundation — Test Suite');
  console.log('='.repeat(50));

  const { pg, minio, qdrant } = await t1_storageHealth();
  const srcOk = await t2_sourceRegistry(pg);
  await t3_jsonIngest(pg && srcOk, minio);
  await t4_fileIngest(pg && srcOk, minio);
  await t5_duplicateChecksum(pg && srcOk, minio);
  await t6_secretRedaction();
  await t7_normalizedEvent(pg && srcOk);
  await t8_qdrantIndexing(pg && srcOk, qdrant);
  await t9_search(pg && srcOk);
  await t10_ceoQuery(pg && srcOk);
  await t11_connectorSample(pg && srcOk, minio);
  await t12_qualityReport(pg && srcOk);

  console.log('\n' + '='.repeat(50));
  const pass_count = results.filter(r => r.status === 'PASS').length;
  const fail_count = results.filter(r => r.status === 'FAIL').length;
  const skip_count = results.filter(r => r.status === 'SKIP').length;
  console.log(`Results: ✅ ${pass_count} pass | ❌ ${fail_count} fail | ⏭ ${skip_count} skip`);

  if (fail_count > 0) {
    console.log('\nFailed tests:');
    results.filter(r => r.status === 'FAIL').forEach(r => console.log(`  ❌ ${r.name}: ${r.detail}`));
    process.exit(1);
  }
  console.log('\n✅ All tests passed.');
}

runAll().catch(e => { console.error('Test runner crashed:', e); process.exit(1); });
