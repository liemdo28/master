/**
 * Phase 6E §38 — security coverage for the NEW surfaces this phase adds. Cross-project
 * leakage, path traversal, unapproved roots, and secret ingestion are already
 * exhaustively covered by retrieval-security.test.ts and document-security.test.ts —
 * this file does not re-test them. It targets: the ingestion-jobs/debug-search/
 * quality-summary routes, the evidence dangling-ID fix, and malicious document
 * metadata.
 */
import assert from 'assert';
import express from 'express';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { AddressInfo } from 'net';
import type { NextFunction, Request, Response } from 'express';
import { DocumentStore } from '../store';
import { KnowledgeDocumentService } from '../service';
import { knowledgeDocumentsJsonParser, knowledgeDocumentsRouter } from '../router';
import { taskRuntimeJsonErrorHandler } from '../../../routes/task-runtime';
import { EvidenceService } from '../../../evidence/service';

const API_KEY = 'phase6e-security-test-key';

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mi-6e-sec-'));
}

async function startApi(dbRoot: string) {
  process.env.MI_PERSONAL_OS_DIR = dbRoot;
  const app = express();
  const auth = (req: Request, res: Response, next: NextFunction) =>
    String(req.headers['x-api-key'] || '') === API_KEY ? next() : res.status(401).json({ error: 'Unauthorized' });
  app.use('/api', knowledgeDocumentsJsonParser, taskRuntimeJsonErrorHandler, auth, knowledgeDocumentsRouter);
  return new Promise<{ baseUrl: string; close: () => Promise<void> }>(resolve => {
    const server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        baseUrl: `http://127.0.0.1:${port}/api`,
        close: () => new Promise<void>((ok, no) => server.close(e => (e ? no(e) : ok()))),
      });
    });
  });
}

async function run() {
  const dbRoot = tmp();
  const root = tmp();

  // --- ingestion-jobs: no absolute path ever leaks through the API -------------------
  const service = new KnowledgeDocumentService({ store: new DocumentStore(dbRoot), roots: { documentRoots: [root] } });
  const huge = path.join(root, 'huge.md');
  fs.writeFileSync(huge, 'x'.repeat(6 * 1024 * 1024));
  await service.ingestApprovedDocument({ filePath: huge, operationId: 'op-huge' });
  service.close();

  const api = await startApi(dbRoot);
  const headers = { 'content-type': 'application/json', 'x-api-key': API_KEY };

  assert.strictEqual((await fetch(`${api.baseUrl}/knowledge-documents/ingestion-jobs`)).status, 401, 'unauthenticated jobs list rejected');
  const jobsRes = await fetch(`${api.baseUrl}/knowledge-documents/ingestion-jobs`, { headers });
  assert.strictEqual(jobsRes.status, 200);
  const jobsBody = await jobsRes.text();
  assert.ok(!/[A-Za-z]:[\\/]/.test(jobsBody), 'ingestion-jobs response leaks no absolute path');
  assert.ok(jobsBody.includes('FILE_TOO_LARGE'), 'the failure is still visible with its reason code');

  const filteredRes = await fetch(`${api.baseUrl}/knowledge-documents/ingestion-jobs?status=FAILED`, { headers });
  const filtered = (await filteredRes.json()) as { jobs: Array<{ status: string }> };
  assert.ok(filtered.jobs.every(j => j.status === 'FAILED'), 'status filter is honored');
  assert.ok(filtered.jobs.length >= 1);
  const badStatus = await fetch(`${api.baseUrl}/knowledge-documents/ingestion-jobs?status=DROP+TABLE`, { headers });
  assert.strictEqual(badStatus.status, 200, 'an unrecognised status value is ignored, not passed through to SQL');

  // --- debug-search: never leaks canonicalPath, requires the same project scope ------
  assert.strictEqual((await fetch(`${api.baseUrl}/knowledge-documents/debug-search`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status, 401);
  const noScopeRes = await fetch(`${api.baseUrl}/knowledge-documents/debug-search`, { method: 'POST', headers, body: JSON.stringify({ text: 'anything' }) });
  assert.strictEqual(noScopeRes.status, 400, 'debug-search still requires KnowledgeQuery project scoping — no bypass');
  const debugRes = await fetch(`${api.baseUrl}/knowledge-documents/debug-search`, { method: 'POST', headers, body: JSON.stringify({ text: 'huge', projectIds: ['proj-x'] }) });
  const debugBody = await debugRes.text();
  assert.ok(!debugBody.includes('canonicalPath'), 'debug-search never exposes canonicalPath');
  assert.ok(!/[A-Za-z]:[\\/]/.test(debugBody), 'debug-search response leaks no absolute path');

  // --- quality-summary: read-only, authenticated, no path leakage --------------------
  assert.strictEqual((await fetch(`${api.baseUrl}/knowledge-documents/quality-summary`)).status, 401);
  const summaryRes = await fetch(`${api.baseUrl}/knowledge-documents/quality-summary`, { headers });
  assert.strictEqual(summaryRes.status, 200);
  const summary = await summaryRes.json() as Record<string, unknown>;
  assert.ok(typeof summary.documents === 'number' && typeof summary.failedIngestion === 'number');

  await api.close();
  delete process.env.MI_PERSONAL_OS_DIR;

  // --- malicious document metadata is inert data, never treated as instructions ------
  // Markdown source is stored and cited as plain text (the HTML sanitizer in
  // document-security.test.ts covers the HTML parser specifically, a different code
  // path) — the actual invariant here is that hostile content never changes what the
  // pipeline *does*: it does not gain extra citations, escape its project scope, or
  // cause the service to throw out of its normal ACTIVE/REJECTED/FAILED outcome shape.
  {
    const maliciousRoot = tmp();
    const maliciousDb = tmp();
    const svc = new KnowledgeDocumentService({ store: new DocumentStore(maliciousDb), roots: { documentRoots: [maliciousRoot] } });
    const evilPath = path.join(maliciousRoot, 'evil.md');
    fs.writeFileSync(evilPath, `# Notes\n\nThis section carries enough real prose content to clear the minimum chunk size threshold for ingestion.\n\n<script>alert(1)</script>\n\n\${constructor.constructor('return process')()}\n`);
    const outcome = await svc.ingestApprovedDocument({ filePath: evilPath, projectIds: ['proj-evil'] });
    assert.strictEqual(outcome.status, 'ACTIVE', 'hostile content ingests as ordinary inert text, no special handling');
    const chunks = svc.store.listChunks(outcome.documentId!);
    assert.ok(chunks.every(c => c.projectIds.length === 1 && c.projectIds[0] === 'proj-evil'), 'hostile content never escapes its declared project scope');
    svc.close();
    fs.rmSync(maliciousRoot, { recursive: true, force: true });
    fs.rmSync(maliciousDb, { recursive: true, force: true });
  }

  // --- Phase 6E evidence fix: every FAILED_INGESTION evidenceId now resolves ---------
  {
    const evidenceRoot = tmp();
    const svc = new KnowledgeDocumentService({ store: new DocumentStore(evidenceRoot), roots: { documentRoots: [root] } });
    const exe = path.join(root, 'tool.exe');
    fs.writeFileSync(exe, 'MZ binary');
    await svc.ingestApprovedDocument({ filePath: exe, operationId: 'op-evidence-exe' });
    svc.close();

    const evidence = new EvidenceService({ personalOsRoot: evidenceRoot });
    const health = evidence.health();
    const failedDimension = health.find(m => m.dimension === 'FAILED_INGESTION');
    assert.ok(failedDimension && failedDimension.value >= 1, 'FAILED_INGESTION dimension reports the failure');
    for (const id of failedDimension!.evidenceIds) {
      assert.ok(evidence.get(id) !== null, `every FAILED_INGESTION evidenceId must resolve via get(): ${id}`);
    }
    evidence.close();
    fs.rmSync(evidenceRoot, { recursive: true, force: true });
  }

  fs.rmSync(dbRoot, { recursive: true, force: true });
  fs.rmSync(root, { recursive: true, force: true });

  console.log('[knowledge-quality-security] PASS');
}

run().catch(err => { console.error('[knowledge-quality-security] FAIL:', err); process.exit(1); });
