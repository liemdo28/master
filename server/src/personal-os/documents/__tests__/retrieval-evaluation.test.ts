/**
 * Phase 5D-2 §13-15 — measured retrieval evaluation.
 *
 * 30 queries: 15 against three synthetic fixture projects (always run, fully portable),
 * 15 against three real projects' approved documentation (Mi Core, Mi Academy,
 * Healthy-LD — skipped, not failed, on a machine where those checkouts are not present,
 * exactly like Phase 5C's real-connector acceptance). Every query is scored against the
 * hard targets from the directive; a summary prints at the end either way.
 */

import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DocumentStore } from '../store';
import { KnowledgeDocumentService } from '../service';
import { KnowledgeRetrievalService } from '../retrieval';
import type { KnowledgePack } from '../types';

interface EvalQuery {
  id: number;
  project: string;
  text: string;
  expectSourceUri?: string;
  expectExcerptContains?: string;
  expectEmpty?: boolean;
  forbiddenText?: string[];
}

const TARGETS = {
  top3Recall: 0.90,
  citationCorrectness: 1.0,
  projectLeakage: 0,
  deletedSupersededLeakage: 0,
  unrelatedResultRate: 0.10,
  deterministicOrdering: 1.0,
  p95Ms: 500,
};

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mi-5d2-eval-'));
}

function write(root: string, rel: string, content: string): string {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
  return full;
}

async function buildSyntheticFixtures(service: KnowledgeDocumentService, root: string): Promise<{ deletedDocId: string }> {
  const files: Record<string, string> = {
    'alpha/alpha-architecture.md':
      '# Architecture\n\n## API Gateway\n\nThe Alpha API Gateway listens on port 7001 and routes requests to the auth-service and billing-service.\n\n' +
      '## Database\n\nAlpha uses PostgreSQL 15 as its primary datastore, with Redis for session caching.\n',
    'alpha/alpha-deployment.md':
      '# Deployment\n\n## Production\n\nDeploy Alpha with npm run deploy:alpha. The production branch is release/alpha.\n\n' +
      '## Rollback\n\nIf a deploy fails, run npm run rollback:alpha to restore the last known-good build.\n',
    'alpha/alpha-old-port.md':
      '# Gateway Port History\n\nThe alpha gateway historically listened on port 7000 before the migration.\n',
    'alpha/alpha-deleted.md':
      '# Deprecated Alpha Notes\n\nThis document about the alpha legacy queue system has been withdrawn and must never be cited.\n',
    'beta/beta-architecture.md':
      '# Architecture\n\nBeta CLI is written in Go. The Beta command dispatcher lives in cmd/beta/main.go and delegates to internal/executor for all subcommands.\n',
    'beta/beta-runbook.md':
      '# Runbook\n\n## Incident: high memory usage\n\nIf Beta CLI reports high memory usage, restart the beta-worker process ' +
      'and check internal/executor/pool.go for a leaked goroutine.\n',
    'gamma/gamma-architecture.md':
      '# Architecture\n\nGamma mobile app is built with React Native. State management uses Zustand, ' +
      'and navigation uses React Navigation v6.\n',
    'gamma/gamma-adr-001.md':
      '# ADR 001: Choose Zustand over Redux\n\nWe chose Zustand for Gamma state management because it has ' +
      'less boilerplate than Redux and integrates cleanly with React Native rendering.\n',
    'private/private-note.md':
      '# Personal Note\n\nRemember to call the dentist next week and pick up the dry cleaning on Friday.\n',
  };

  const projectFor = (rel: string): string => rel.split('/')[0] === 'private' ? 'proj-private' : `proj-${rel.split('/')[0]}`;
  let deletedDocId = '';
  for (const [rel, content] of Object.entries(files)) {
    const filePath = write(root, rel, content);
    const outcome = await service.ingestApprovedDocument({ filePath, projectIds: [projectFor(rel)] });
    assert.strictEqual(outcome.status, 'ACTIVE', `fixture ${rel} must ingest cleanly`);
    if (rel === 'alpha/alpha-deleted.md') deletedDocId = outcome.documentId!;
  }

  // Supersede alpha-old-port.md in place: same path, new content, old value must never
  // be citable again once the reindex completes. The new content deliberately covers a
  // different fact (migration outcome, not the port number) so it does not collide with
  // alpha-architecture.md's own port-7001 fact in the evaluation queries below.
  const oldPortPath = write(root, 'alpha/alpha-old-port.md', '# Gateway Migration History\n\nThe alpha gateway migration completed successfully with zero downtime and no dropped connections.\n');
  const reindexed = await service.ingestApprovedDocument({ filePath: oldPortPath, operationId: `reindex-${Date.now()}`, projectIds: ['proj-alpha'] });
  assert.strictEqual(reindexed.status, 'SUPERSEDED', 'alpha-old-port.md must be re-ingested as a new version');

  assert.ok(deletedDocId, 'alpha-deleted.md must have ingested');
  service.store.deleteDocument(deletedDocId);

  return { deletedDocId };
}

const SYNTHETIC_QUERIES: EvalQuery[] = [
  { id: 1, project: 'proj-alpha', text: 'what port does the alpha api gateway listen on', expectSourceUri: 'alpha-architecture.md', expectExcerptContains: '7001' },
  { id: 2, project: 'proj-alpha', text: 'how do I deploy alpha to production', expectSourceUri: 'alpha-deployment.md', expectExcerptContains: 'deploy:alpha' },
  { id: 3, project: 'proj-alpha', text: 'how do I rollback a failed alpha deploy', expectSourceUri: 'alpha-deployment.md', expectExcerptContains: 'rollback:alpha' },
  { id: 4, project: 'proj-alpha', text: 'what database does alpha use for session caching', expectSourceUri: 'alpha-architecture.md', expectExcerptContains: 'Redis' },
  { id: 5, project: 'proj-alpha', text: 'what was the old alpha gateway port before the migration', forbiddenText: ['port 7000', 'legacy queue system', 'withdrawn'] },
  { id: 6, project: 'proj-beta', text: 'what language is beta cli written in', expectSourceUri: 'beta-architecture.md', expectExcerptContains: 'Go' },
  { id: 7, project: 'proj-beta', text: 'where does the beta command dispatcher live', expectSourceUri: 'beta-architecture.md', expectExcerptContains: 'cmd/beta/main.go' },
  { id: 8, project: 'proj-beta', text: 'beta cli reports high memory usage what do I do', expectSourceUri: 'beta-runbook.md', expectExcerptContains: 'beta-worker' },
  { id: 9, project: 'proj-beta', text: 'what should I check for a leaked goroutine in beta', expectSourceUri: 'beta-runbook.md', expectExcerptContains: 'pool.go' },
  { id: 10, project: 'proj-beta', text: 'does beta use postgresql for its datastore', forbiddenText: ['Alpha uses PostgreSQL', 'alpha-architecture.md'] },
  { id: 11, project: 'proj-gamma', text: 'what state management does gamma use', expectSourceUri: 'gamma-architecture.md', expectExcerptContains: 'Zustand' },
  { id: 12, project: 'proj-gamma', text: 'why did we choose zustand over redux for gamma', expectSourceUri: 'gamma-adr-001.md', expectExcerptContains: 'boilerplate' },
  { id: 13, project: 'proj-gamma', text: 'what navigation library does gamma use', expectSourceUri: 'gamma-architecture.md', expectExcerptContains: 'React Navigation' },
  { id: 14, project: 'proj-gamma', text: 'what framework is the gamma mobile app built with', expectSourceUri: 'gamma-architecture.md', expectExcerptContains: 'React Native' },
  { id: 15, project: 'proj-gamma', text: 'does gamma use the alpha api gateway on port 7001', forbiddenText: ['Alpha API Gateway', 'alpha-architecture.md'] },
];

interface RealProject { id: string; root: string; files: Array<{ rel: string; dest: string }>; }

function realProjects(): RealProject[] {
  return [
    {
      id: 'mi-core',
      root: 'D:/mi-core-phase5d2-index-retrieval',
      files: [
        { rel: 'docs/architecture/PHASE5D_FOUNDATION.md', dest: 'PHASE5D_FOUNDATION.md' },
        { rel: 'docs/operations/PHASE5D_MIGRATION.md', dest: 'PHASE5D_MIGRATION.md' },
        { rel: 'docs/operations/PHASE5D_ROLLBACK.md', dest: 'PHASE5D_ROLLBACK.md' },
      ],
    },
    {
      id: 'mi-academy',
      root: 'D:/Project/Mi-Academy-System/mi-academy',
      files: [
        { rel: 'docs/CURRENT_ARCHITECTURE.md', dest: 'CURRENT_ARCHITECTURE.md' },
        { rel: 'docs/api-specification.md', dest: 'api-specification.md' },
      ],
    },
    {
      id: 'healthy-ld',
      root: 'D:/Project/Mi-core-system/Master/healthy-ld',
      files: [
        { rel: 'docs/ARCHITECTURE.md', dest: 'ARCHITECTURE.md' },
        { rel: 'docs/DEPLOYMENT.md', dest: 'DEPLOYMENT.md' },
      ],
    },
  ];
}

function realProjectsAvailable(projects: RealProject[]): boolean {
  return projects.every(p => p.files.every(f => fs.existsSync(path.join(p.root, f.rel))));
}

const REAL_QUERIES: EvalQuery[] = [
  { id: 16, project: 'mi-core', text: 'why is broad ingestion forbidden in phase 5D', expectSourceUri: 'PHASE5D_FOUNDATION.md', expectExcerptContains: 'absent' },
  { id: 17, project: 'mi-core', text: 'what is the sole gated ingestion entry point for documents', expectSourceUri: 'PHASE5D_FOUNDATION.md', expectExcerptContains: 'ingestApprovedDocument' },
  { id: 18, project: 'mi-core', text: 'how is the schema v3 to v4 migration proven safe against production', expectSourceUri: 'PHASE5D_MIGRATION.md', expectExcerptContains: 'online backup' },
  { id: 19, project: 'mi-core', text: 'is any v3 table altered renamed or dropped by the migration', expectSourceUri: 'PHASE5D_MIGRATION.md', expectExcerptContains: 'No v3 table' },
  { id: 20, project: 'mi-core', text: 'what rejection codes does the approved root path policy return', expectSourceUri: 'PHASE5D_FOUNDATION.md', expectExcerptContains: 'NOT_FOUND' },
  { id: 21, project: 'mi-academy', text: 'what backend framework does mi academy use', expectSourceUri: 'CURRENT_ARCHITECTURE.md', expectExcerptContains: 'FastAPI' },
  { id: 22, project: 'mi-academy', text: 'does the mi academy flutter client exist yet as code', expectSourceUri: 'CURRENT_ARCHITECTURE.md', expectExcerptContains: 'does not yet exist' },
  { id: 23, project: 'mi-academy', text: 'what database does the mi academy backend use', expectSourceUri: 'CURRENT_ARCHITECTURE.md', expectExcerptContains: 'PostgreSQL' },
  { id: 24, project: 'mi-academy', text: 'does mi academy backend track content versioning with a ContentVersion model', expectSourceUri: 'CURRENT_ARCHITECTURE.md', expectExcerptContains: 'ContentVersion' },
  { id: 25, project: 'mi-academy', text: 'is the mi academy game_core package duplicated', expectSourceUri: 'CURRENT_ARCHITECTURE.md', expectExcerptContains: 'Duplicated' },
  { id: 26, project: 'healthy-ld', text: 'what engine owns pantry inventory logic in healthy ld', expectSourceUri: 'ARCHITECTURE.md', expectExcerptContains: 'pantry-engine' },
  { id: 27, project: 'healthy-ld', text: 'what does planner-engine.js own in healthy ld, offline deterministic plan generation', expectSourceUri: 'ARCHITECTURE.md', expectExcerptContains: 'planner-engine.js' },
  { id: 28, project: 'healthy-ld', text: 'what is the recommended cloudflare pages build command for healthy ld', expectSourceUri: 'DEPLOYMENT.md', expectExcerptContains: 'npm run build' },
  { id: 29, project: 'healthy-ld', text: 'what output directory does healthy ld deploy from', expectSourceUri: 'DEPLOYMENT.md', expectExcerptContains: 'dist-pages' },
  { id: 30, project: 'healthy-ld', text: 'what node version should healthy ld use for cloudflare deployment', expectSourceUri: 'DEPLOYMENT.md', expectExcerptContains: '24' },
];

interface Metrics {
  total: number;
  recallHits: number;
  recallEligible: number;
  unknownEligible: number;
  unknownHits: number;
  top1Hits: number;
  reciprocalRankSum: number;
  citationChecks: number;
  citationFailures: number;
  rangeChecks: number;
  rangeFailures: number;
  projectLeaks: number;
  deletedSupersededLeaks: number;
  staleLeaks: number;
  unrelatedProbes: number;
  unrelatedLeaks: number;
  nonDeterministic: number;
  latenciesMs: number[];
  packBytes: number[];
}

function newMetrics(): Metrics {
  return {
    total: 0, recallHits: 0, recallEligible: 0, unknownEligible: 0, unknownHits: 0, top1Hits: 0, reciprocalRankSum: 0,
    citationChecks: 0, citationFailures: 0, rangeChecks: 0, rangeFailures: 0,
    projectLeaks: 0, deletedSupersededLeaks: 0, staleLeaks: 0,
    unrelatedProbes: 0, unrelatedLeaks: 0, nonDeterministic: 0, latenciesMs: [], packBytes: [],
  };
}

function runQueries(retrieval: KnowledgeRetrievalService, store: DocumentStore, queries: EvalQuery[], metrics: Metrics, forbiddenGlobal: string[]): void {
  for (const q of queries) {
    metrics.total++;
    const start = Date.now();
    const pack: KnowledgePack = retrieval.buildKnowledgePack({ text: q.text, projectIds: [q.project], limit: 3 });
    metrics.latenciesMs.push(Date.now() - start);
    metrics.packBytes.push(Buffer.byteLength(JSON.stringify(pack)));

    // Every item's isStale flag must be false when the query never opted into includeStale.
    if (pack.items.some(i => i.isStale)) metrics.staleLeaks++;

    // Determinism: an identical query, run again, must produce the same citation order.
    const pack2 = retrieval.buildKnowledgePack({ text: q.text, projectIds: [q.project], limit: 3 });
    const order1 = pack.items.map(i => i.citations[0]?.chunkId ?? '');
    const order2 = pack2.items.map(i => i.citations[0]?.chunkId ?? '');
    if (JSON.stringify(order1) !== JSON.stringify(order2)) metrics.nonDeterministic++;

    // Citation correctness: every citation returned must resolve to a real, matching chunk/document.
    for (const item of pack.items) {
      for (const citation of item.citations) {
        metrics.citationChecks++;
        const chunk = store.listChunks(citation.documentId).find(c => c.id === citation.chunkId);
        const document = store.getDocument(citation.documentId);
        const ok = chunk && document
          && citation.chunkContentHash === chunk.contentHash
          && citation.documentChecksum === document.checksum
          && citation.sourceUri === document.sourceUri
          && !('canonicalPath' in (citation as unknown as Record<string, unknown>));
        if (!ok) metrics.citationFailures++;
        if (!citation.projectIds.includes(q.project)) metrics.projectLeaks++;

        // Range accuracy: a line-cited chunk's range must actually be within the source
        // file's line count, non-inverted, and consistent with the chunk it points at;
        // a heading/page-cited chunk must carry the citation locator it claims to.
        metrics.rangeChecks++;
        const hasLineRange = citation.lineStart !== null && citation.lineEnd !== null;
        const hasHeadingOrPage = citation.headingPath.length > 0 || citation.pageNumber !== null;
        const rangeOk = chunk && (
          (hasLineRange && citation.lineStart! >= 1 && citation.lineEnd! >= citation.lineStart! && citation.lineStart === chunk.lineStart && citation.lineEnd === chunk.lineEnd)
          || (!hasLineRange && hasHeadingOrPage)
        );
        if (!rangeOk) metrics.rangeFailures++;
      }
    }

    // Deleted/superseded leakage and other forbidden strings, checked against the whole pack.
    const serialized = JSON.stringify(pack);
    const forbidden = [...(q.forbiddenText ?? []), ...forbiddenGlobal];
    for (const banned of forbidden) {
      if (serialized.includes(banned)) metrics.deletedSupersededLeaks++;
    }

    if (q.expectEmpty) {
      metrics.unknownEligible++;
      if (pack.unknown && pack.items.length === 1 && pack.items[0].factType === 'UNKNOWN') metrics.unknownHits++;
    }

    if (q.expectSourceUri) {
      metrics.recallEligible++;
      const top3 = pack.items.slice(0, 3);
      const matchesExpected = (i: typeof pack.items[number]) => i.citations.some(c => c.sourceUri.includes(q.expectSourceUri!))
        && (!q.expectExcerptContains || i.statement.includes(q.expectExcerptContains));
      const hit = top3.some(matchesExpected);
      if (hit) metrics.recallHits++;
      if (matchesExpected(pack.items[0])) metrics.top1Hits++;
      const rank = pack.items.findIndex(matchesExpected);
      if (rank >= 0) metrics.reciprocalRankSum += 1 / (rank + 1);
      if (process.env.EVAL_DEBUG) {
        console.log(`Q${q.id} [${hit ? 'HIT' : 'MISS'}] "${q.text}" expect=${q.expectSourceUri}/${q.expectExcerptContains}`);
        for (const i of top3) console.log(`   -> ${i.citations[0]?.chunkId} ${i.citations[0]?.sourceUri} :: ${i.statement.slice(0, 60)}`);
      }

      // Unrelated-result rate: of everything actually returned for a query with a known
      // right answer, how much of it is noise (doesn't match the expected source)?
      for (const item of pack.items) {
        if (item.factType !== 'FACT') continue;
        metrics.unrelatedProbes++;
        const matches = item.citations.some(c => c.sourceUri.includes(q.expectSourceUri!));
        if (!matches) metrics.unrelatedLeaks++;
      }
    }
  }
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

function mean(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function report(label: string, m: Metrics): void {
  const unknownAccuracy = m.unknownEligible ? m.unknownHits / m.unknownEligible : 1;
  const top1 = m.recallEligible ? m.top1Hits / m.recallEligible : 1;
  const recall = m.recallEligible ? m.recallHits / m.recallEligible : 1;
  const mrr = m.recallEligible ? m.reciprocalRankSum / m.recallEligible : 1;
  const citationCorrectness = m.citationChecks ? 1 - m.citationFailures / m.citationChecks : 1;
  const rangeAccuracy = m.rangeChecks ? 1 - m.rangeFailures / m.rangeChecks : 1;
  const unrelatedRate = m.unrelatedProbes ? m.unrelatedLeaks / m.unrelatedProbes : 0;
  const deterministic = m.total ? 1 - m.nonDeterministic / m.total : 1;
  const p50 = percentile(m.latenciesMs, 50);
  const p95 = percentile(m.latenciesMs, 95);
  const meanPackBytes = mean(m.packBytes);

  console.log(`[retrieval-evaluation:${label}] queries=${m.total} top1=${(top1 * 100).toFixed(1)}% ` +
    `top3Recall=${(recall * 100).toFixed(1)}% mrr=${mrr.toFixed(3)} ` +
    `citationCorrectness=${(citationCorrectness * 100).toFixed(1)}% rangeAccuracy=${(rangeAccuracy * 100).toFixed(1)}% ` +
    `projectLeaks=${m.projectLeaks} deletedSupersededLeaks=${m.deletedSupersededLeaks} staleLeaks=${m.staleLeaks} ` +
    `unrelatedRate=${(unrelatedRate * 100).toFixed(1)}% deterministic=${(deterministic * 100).toFixed(1)}% ` +
    `p50Ms=${p50} p95Ms=${p95} meanPackBytes=${Math.round(meanPackBytes)} unknownAccuracy=${(unknownAccuracy * 100).toFixed(1)}%`);

  if (m.unknownEligible) assert.strictEqual(unknownAccuracy, 1, `${label}: a query with no real answer must report UNKNOWN, not a fabricated result`);
  assert.ok(recall >= TARGETS.top3Recall, `${label}: top-3 recall ${recall} below target ${TARGETS.top3Recall}`);
  assert.ok(citationCorrectness >= TARGETS.citationCorrectness, `${label}: citation correctness ${citationCorrectness} below target`);
  assert.strictEqual(rangeAccuracy, 1, `${label}: citation range accuracy below 100%`);
  assert.strictEqual(m.projectLeaks, TARGETS.projectLeakage, `${label}: project leakage detected`);
  assert.strictEqual(m.deletedSupersededLeaks, TARGETS.deletedSupersededLeakage, `${label}: deleted/superseded content leaked`);
  assert.strictEqual(m.staleLeaks, 0, `${label}: a STALE item leaked into a query that never set includeStale`);
  assert.ok(unrelatedRate <= TARGETS.unrelatedResultRate, `${label}: unrelated result rate ${unrelatedRate} above target`);
  assert.ok(deterministic >= TARGETS.deterministicOrdering, `${label}: non-deterministic ordering detected`);
  assert.ok(p95 <= TARGETS.p95Ms, `${label}: p95 latency ${p95}ms above target ${TARGETS.p95Ms}ms`);
}

async function run() {
  const root = tmp();
  const dbDir = tmp();
  const service = new KnowledgeDocumentService({ store: new DocumentStore(dbDir), roots: { documentRoots: [root] } });
  const { deletedDocId } = await buildSyntheticFixtures(service, root);
  const retrieval = new KnowledgeRetrievalService(service.store);

  const syntheticMetrics = newMetrics();
  runQueries(retrieval, service.store, SYNTHETIC_QUERIES, syntheticMetrics, [deletedDocId]);
  runQueries(retrieval, service.store, [
    { id: 33, project: 'proj-alpha', text: 'recommended sourdough bread hydration ratio and proofing temperature', expectEmpty: true },
  ], syntheticMetrics, [deletedDocId]);
  report('synthetic', syntheticMetrics);
  service.close();
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(dbDir, { recursive: true, force: true });

  const real = realProjects();
  if (realProjectsAvailable(real)) {
    const realRoot = tmp();
    const realDbDir = tmp();
    for (const project of real) {
      for (const file of project.files) {
        const content = fs.readFileSync(path.join(project.root, file.rel), 'utf8');
        write(realRoot, `${project.id}/${file.dest}`, content);
      }
    }
    const realService = new KnowledgeDocumentService({ store: new DocumentStore(realDbDir), roots: { documentRoots: [realRoot] } });
    for (const project of real) {
      for (const file of project.files) {
        const filePath = path.join(realRoot, project.id, file.dest);
        const outcome = await realService.ingestApprovedDocument({ filePath, projectIds: [project.id] });
        assert.strictEqual(outcome.status, 'ACTIVE', `real fixture ${project.id}/${file.dest} must ingest cleanly`);
      }
    }
    const realRetrieval = new KnowledgeRetrievalService(realService.store);
    const realMetrics = newMetrics();
    runQueries(realRetrieval, realService.store, REAL_QUERIES, realMetrics, []);

    // Supplementary to the frozen 30-query set (§9 acceptance, not §8's reproduction):
    // a question genuinely outside the ingested approved docs must come back UNKNOWN,
    // never a fabricated answer stitched from unrelated text.
    const unknownProbes: EvalQuery[] = [
      { id: 31, project: 'mi-academy', text: 'recommended tire pressure for a mountain bike on gravel trails', expectEmpty: true },
      { id: 32, project: 'healthy-ld', text: 'quarterly astronomy calendar for observing the next lunar eclipse', expectEmpty: true },
    ];
    runQueries(realRetrieval, realService.store, unknownProbes, realMetrics, []);

    report('real-projects', realMetrics);
    realService.close();
    fs.rmSync(realRoot, { recursive: true, force: true });
    fs.rmSync(realDbDir, { recursive: true, force: true });
    console.log('[retrieval-evaluation] real-project portion: RAN (Mi Core, Mi Academy, Healthy-LD approved docs present on this machine)');
  } else {
    console.log('[retrieval-evaluation] real-project portion: SKIPPED — one or more of Mi Academy / Healthy-LD checkouts is not present on this machine');
  }

  console.log('[retrieval-evaluation] PASS');
}

run().catch(err => { console.error('[retrieval-evaluation] FAIL:', err); process.exit(1); });
