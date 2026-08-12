/**
 * Phase 6E — shared deterministic fixture corpus + query generator.
 *
 * Reused by both `knowledge-quality-evaluation.ts` (the large deterministic case set)
 * and `__tests__/knowledge-quality.test.ts` (targeted assertions per category). No
 * LLM anywhere in this file: every query and every expected answer is a fixed string
 * template, so re-running this file always produces the same corpus and the same case
 * list — determinism is the point, not an incidental property.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DocumentStore } from './store';
import { KnowledgeDocumentService } from './service';
import { scanForConflicts } from './conflicts';

export function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mi-6e-quality-'));
}

export function writeFile(root: string, rel: string, content: string): string {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
  return full;
}

export type QueryCategory =
  | 'RECALL' | 'NO_ANSWER' | 'WRONG_PROJECT_DISTRACTOR' | 'EXACT_PATH' | 'SYMBOL'
  | 'MULTI_HOP' | 'CONFLICT' | 'STALENESS' | 'SUPERSEDED_VERSION' | 'DUPLICATE_AMBIGUOUS'
  | 'GENERATED_VS_CANONICAL';

export interface EvalCase {
  id: string;
  category: QueryCategory;
  project: string;
  text: string;
  /** At least one of these must appear in the top-3 items' citation.sourceUri, unless expectEmpty. */
  expectSourceUriAny?: string[];
  expectExcerptContains?: string;
  /** For MULTI_HOP: every one of these sourceUris must appear somewhere across the returned items. */
  expectAllSourceUris?: string[];
  expectEmpty?: boolean;
  /** Text that must never appear anywhere in the serialized pack. */
  forbiddenText?: string[];
  /** Query options beyond project scope. */
  includeStale?: boolean;
  limit?: number;
}

interface ProjectDef {
  id: string;
  gatewayPort: string;
  language: string;
  database: string;
  framework: string;
  incidentSymbol: string;
  incidentAction: string;
  decisionChoice: string;
  decisionRejected: string;
  decisionReason: string;
  deployCommand: string;
  rollbackCommand: string;
}

const PROJECTS: ProjectDef[] = [
  { id: 'proj-zeta', gatewayPort: '8101', language: 'TypeScript', database: 'PostgreSQL', framework: 'Fastify', incidentSymbol: 'zeta-worker-pool.ts', incidentAction: 'restart the zeta-ingest worker', decisionChoice: 'Fastify', decisionRejected: 'Express', decisionReason: 'lower per-request overhead under Zeta\'s sustained load', deployCommand: 'npm run deploy:zeta', rollbackCommand: 'npm run rollback:zeta' },
  { id: 'proj-eta', gatewayPort: '8102', language: 'Go', database: 'CockroachDB', framework: 'chi router', incidentSymbol: 'eta-dispatcher.go', incidentAction: 'drain the eta-dispatcher queue', decisionChoice: 'chi router', decisionRejected: 'gin', decisionReason: 'chi\'s stdlib-compatible middleware chain matched Eta\'s existing net/http handlers', deployCommand: 'make deploy-eta', rollbackCommand: 'make rollback-eta' },
  { id: 'proj-theta', gatewayPort: '8103', language: 'Python', database: 'MongoDB', framework: 'FastAPI', incidentSymbol: 'theta_scheduler.py', incidentAction: 'clear the theta_scheduler dead-letter queue', decisionChoice: 'FastAPI', decisionRejected: 'Flask', decisionReason: 'native async support and generated OpenAPI schemas for Theta\'s public API', deployCommand: 'fab deploy:theta', rollbackCommand: 'fab rollback:theta' },
  { id: 'proj-iota', gatewayPort: '8104', language: 'Rust', database: 'SQLite', framework: 'axum', incidentSymbol: 'iota_router.rs', incidentAction: 'restart the iota-edge process', decisionChoice: 'axum', decisionRejected: 'actix-web', decisionReason: 'axum\'s tower-based middleware composed more cleanly with Iota\'s existing tower services', deployCommand: 'cargo xtask deploy-iota', rollbackCommand: 'cargo xtask rollback-iota' },
  { id: 'proj-kappa', gatewayPort: '8105', language: 'Java', database: 'MySQL', framework: 'Spring Boot', incidentSymbol: 'KappaJobRunner.java', incidentAction: 'restart the kappa-job-runner service', decisionChoice: 'Spring Boot', decisionRejected: 'Micronaut', decisionReason: 'the team\'s existing operational tooling already targeted Spring Boot actuator endpoints', deployCommand: './gradlew deployKappa', rollbackCommand: './gradlew rollbackKappa' },
  { id: 'proj-lambda', gatewayPort: '8106', language: 'C#', database: 'SQL Server', framework: 'ASP.NET Core', incidentSymbol: 'LambdaQueueWorker.cs', incidentAction: 'restart the lambda-queue-worker host', decisionChoice: 'ASP.NET Core', decisionRejected: 'NancyFx', decisionReason: 'first-party long-term support and native dependency injection for Lambda\'s modules', deployCommand: 'dotnet run --project deploy/Lambda', rollbackCommand: 'dotnet run --project rollback/Lambda' },
  { id: 'proj-mu', gatewayPort: '8107', language: 'Elixir', database: 'PostgreSQL', framework: 'Phoenix', incidentSymbol: 'MuPresence.ex', incidentAction: 'restart the mu-presence tracker', decisionChoice: 'Phoenix', decisionRejected: 'Plug alone', decisionReason: 'Phoenix channels gave Mu real-time presence tracking without a hand-rolled websocket layer', deployCommand: 'mix deploy.mu', rollbackCommand: 'mix rollback.mu' },
  { id: 'proj-nu', gatewayPort: '8108', language: 'Kotlin', database: 'Redis', framework: 'Ktor', incidentSymbol: 'NuSessionCache.kt', incidentAction: 'flush the nu-session-cache', decisionChoice: 'Ktor', decisionRejected: 'Vert.x', decisionReason: 'Ktor\'s coroutine-first API matched Nu\'s existing Kotlin coroutine codebase', deployCommand: './deploy-nu.sh', rollbackCommand: './rollback-nu.sh' },
];

/** Ingests the full 8-project corpus plus dedicated edge-case fixtures into `service`,
 *  rooted at `root`. Returns identifiers the caller needs to build forbidden-text lists
 *  (deleted doc id) and to know which project ids exist for scoping. */
export async function buildQualityCorpus(service: KnowledgeDocumentService, root: string): Promise<{
  deletedDocId: string;
  projectIds: string[];
  staleProjectId: string;
  conflictProjectId: string;
  versionProjectId: string;
  duplicateProjectIds: [string, string];
  generatedVsCanonicalProjectId: string;
}> {
  for (const p of PROJECTS) {
    await service.ingestApprovedDocument({
      filePath: writeFile(root, `${p.id}/architecture.md`,
        `# Architecture\n\n## API Gateway\n\nThe ${p.id} gateway listens on port ${p.gatewayPort} and forwards requests into the core service mesh.\n\n` +
        `## Language\n\nThe ${p.id} codebase is implemented end to end in ${p.language}, chosen for its fit with the team's existing tooling.\n\n` +
        `## Database\n\nFor persistence, ${p.id} uses ${p.database} as its primary datastore for all durable application state.\n\n` +
        `## Framework\n\n${p.id}'s HTTP layer is built on the ${p.framework} framework, which handles routing and middleware.\n`),
      projectIds: [p.id],
    });
    await service.ingestApprovedDocument({
      filePath: writeFile(root, `${p.id}/runbook.md`,
        `# Runbook\n\n## Incident: elevated error rate\n\nIf ${p.id} reports an elevated error rate, ${p.incidentAction} and check ${p.incidentSymbol} for the failing call site.\n`),
      projectIds: [p.id],
    });
    await service.ingestApprovedDocument({
      filePath: writeFile(root, `${p.id}/adr-001.md`,
        `# ADR 001: Choose ${p.decisionChoice} over ${p.decisionRejected}\n\nWe chose ${p.decisionChoice} for ${p.id} over ${p.decisionRejected} because ${p.decisionReason}.\n`),
      projectIds: [p.id],
    });
    await service.ingestApprovedDocument({
      filePath: writeFile(root, `${p.id}/deployment.md`,
        `# Deployment\n\n## Production release\n\nTo publish a new production release of ${p.id}, run ${p.deployCommand}.\n\n` +
        `## Reverting a bad release\n\nWhen a ${p.id} release needs to be undone, run ${p.rollbackCommand} to restore the last known-good build.\n`),
      projectIds: [p.id],
    });
  }

  // --- deleted document: must never be citable again -------------------------------
  const deletedOutcome = await service.ingestApprovedDocument({
    filePath: writeFile(root, 'proj-zeta/withdrawn-notes.md', '# Withdrawn\n\nThis note about the zeta legacy queue codename phoenix-wing-41 has been withdrawn.\n'),
    projectIds: ['proj-zeta'],
  });
  const deletedDocId = deletedOutcome.documentId!;
  service.store.deleteDocument(deletedDocId);

  // --- conflict fixture: two docs in one project disagree on a labelled value -------
  const conflictProjectId = 'proj-conflict';
  await service.ingestApprovedDocument({
    filePath: writeFile(root, `${conflictProjectId}/service-a.md`, '# Service A\n\nService A handles inbound webhook delivery. The configured request timeout: 30s applies to every outbound call it makes.\n'),
    projectIds: [conflictProjectId],
  });
  await service.ingestApprovedDocument({
    filePath: writeFile(root, `${conflictProjectId}/service-b.md`, '# Service B\n\nService B handles inbound webhook delivery as well. The configured request timeout: 60s applies to every outbound call it makes.\n'),
    projectIds: [conflictProjectId],
  });
  scanForConflicts(service.store, [conflictProjectId]);

  // --- staleness fixture: source mutates on disk without going through the service --
  const staleProjectId = 'proj-stale';
  const staleFilePath = writeFile(root, `${staleProjectId}/config.md`, '# Config\n\nThis document records the runtime cache configuration. The current cache ttl seconds: 120 for entries in the hot path.\n');
  await service.ingestApprovedDocument({ filePath: staleFilePath, projectIds: [staleProjectId] });
  fs.writeFileSync(staleFilePath, '# Config\n\nThis document records the runtime cache configuration. The current cache ttl seconds: 900 for entries in the hot path.\n', 'utf8');
  service.refreshStaleness();

  // --- superseded-version fixture: explicit re-ingest creates a new version ---------
  const versionProjectId = 'proj-version';
  const versionFilePath = writeFile(root, `${versionProjectId}/limits.md`, '# Limits\n\nThis document records upload limits for the ingest pipeline. The max upload size mb: 10 for any single file today.\n');
  await service.ingestApprovedDocument({ filePath: versionFilePath, projectIds: [versionProjectId] });
  fs.writeFileSync(versionFilePath, '# Limits\n\nThis document records upload limits for the ingest pipeline. The max upload size mb: 50 for any single file today.\n', 'utf8');
  await service.ingestApprovedDocument({ filePath: versionFilePath, operationId: `reindex-${versionProjectId}-${Date.now()}`, projectIds: [versionProjectId] });

  // --- duplicate/ambiguous-term fixture: same generic term, two projects, different specifics
  const duplicateProjectIds: [string, string] = ['proj-dup-a', 'proj-dup-b'];
  await service.ingestApprovedDocument({
    filePath: writeFile(root, `${duplicateProjectIds[0]}/auth.md`, '# Authentication\n\nThe authentication flow for proj-dup-a issues a short-lived token valid for 15 minutes.\n'),
    projectIds: [duplicateProjectIds[0]],
  });
  await service.ingestApprovedDocument({
    filePath: writeFile(root, `${duplicateProjectIds[1]}/auth.md`, '# Authentication\n\nThe authentication flow for proj-dup-b issues a long-lived token valid for 30 days.\n'),
    projectIds: [duplicateProjectIds[1]],
  });

  // --- generated-artifact vs canonical source: same fact, two documents in one project
  const generatedVsCanonicalProjectId = 'proj-genvcanon';
  await service.ingestApprovedDocument({
    filePath: writeFile(root, `${generatedVsCanonicalProjectId}/architecture.md`, '# Architecture\n\nThe genvcanon service retry limit is 5 attempts.\n'),
    projectIds: [generatedVsCanonicalProjectId],
  });
  await service.ingestApprovedDocument({
    filePath: writeFile(root, `${generatedVsCanonicalProjectId}/CHANGELOG-generated.md`, '# Changelog\n\nv1.2.0: retry limit is 5 attempts (auto-generated from build metadata).\n'),
    projectIds: [generatedVsCanonicalProjectId],
  });

  return {
    deletedDocId,
    projectIds: PROJECTS.map(p => p.id),
    staleProjectId, conflictProjectId, versionProjectId, duplicateProjectIds, generatedVsCanonicalProjectId,
  };
}

/** `variantCount` phrasings per fact-kind, applied across all 8 projects. 7 variants x
 *  8 kinds x 8 projects = 448 RECALL cases at the default; the caller can shrink this
 *  for a faster targeted test run. */
export function buildRecallCases(variantCount = 7): EvalCase[] {
  const cases: EvalCase[] = [];
  let n = 0;
  for (const p of PROJECTS) {
    const kinds: Array<{ kind: string; templates: string[]; sourceUri: string; expect: string }> = [
      {
        kind: 'port', sourceUri: 'architecture.md', expect: p.gatewayPort,
        templates: [
          `what port does the ${p.id} gateway listen on`,
          `which port is used by the ${p.id} api gateway`,
          `${p.id} gateway listens on which port`,
          `what is the ${p.id} gateway's listening port`,
          `on what port does ${p.id} accept requests`,
          `${p.id} api gateway port number`,
          `tell me the port the ${p.id} gateway binds to`,
        ],
      },
      {
        kind: 'language', sourceUri: 'architecture.md', expect: p.language,
        templates: [
          `what language is ${p.id} implemented in`,
          `what programming language does ${p.id} use`,
          `${p.id} is written in which language`,
          `which language powers ${p.id}`,
          `what is ${p.id}'s implementation language`,
          `programming language used by ${p.id}`,
          `${p.id} source language`,
        ],
      },
      {
        kind: 'database', sourceUri: 'architecture.md', expect: p.database,
        templates: [
          `what database does ${p.id} use`,
          `which datastore does ${p.id} rely on`,
          `${p.id}'s primary database is what`,
          `what is the primary datastore for ${p.id}`,
          `database technology used by ${p.id}`,
          `what does ${p.id} use for persistence`,
          `${p.id} database choice`,
        ],
      },
      {
        kind: 'framework', sourceUri: 'architecture.md', expect: p.framework,
        templates: [
          `what framework does ${p.id}'s http layer use`,
          `which web framework does ${p.id} use`,
          `${p.id} http layer is built on what`,
          `what is ${p.id}'s http framework`,
          `framework powering ${p.id}'s api`,
          `what does ${p.id} use for its http server`,
          `${p.id} web framework choice`,
        ],
      },
      {
        kind: 'incident', sourceUri: 'runbook.md', expect: p.incidentSymbol,
        templates: [
          `${p.id} reports an elevated error rate what do I check`,
          `what file should I check for ${p.id}'s elevated error rate`,
          `how do I investigate an elevated error rate in ${p.id}`,
          `${p.id} elevated error rate runbook`,
          `where do I look when ${p.id} error rate spikes`,
          `${p.id} incident: elevated error rate`,
          `troubleshooting ${p.id} elevated error rate`,
        ],
      },
      {
        kind: 'decision', sourceUri: 'adr-001.md', expect: p.decisionReason.slice(0, 20),
        templates: [
          `why did we choose ${p.decisionChoice} over ${p.decisionRejected} for ${p.id}`,
          `what was the reasoning for picking ${p.decisionChoice} in ${p.id}`,
          `${p.id} adr: ${p.decisionChoice} vs ${p.decisionRejected}`,
          `why was ${p.decisionRejected} rejected for ${p.id}`,
          `rationale for ${p.decisionChoice} in ${p.id}`,
          `${p.id} architecture decision record for ${p.decisionChoice}`,
          `explain the choice of ${p.decisionChoice} for ${p.id}`,
        ],
      },
      {
        kind: 'deploy', sourceUri: 'deployment.md', expect: p.deployCommand,
        templates: [
          `how do I deploy ${p.id} to production`,
          `what is the deploy command for ${p.id}`,
          `${p.id} production deployment command`,
          `how to release ${p.id}`,
          `command to deploy ${p.id}`,
          `${p.id} deploy procedure`,
          `deploying ${p.id} to prod`,
        ],
      },
      {
        kind: 'rollback', sourceUri: 'deployment.md', expect: p.rollbackCommand,
        templates: [
          `how do I rollback a failed ${p.id} deploy`,
          `what is the rollback command for ${p.id}`,
          `${p.id} rollback procedure`,
          `how to restore the last known-good ${p.id} build`,
          `command to rollback ${p.id}`,
          `how do I undo a bad ${p.id} release`,
          `reverting a bad ${p.id} deployment`,
        ],
      },
    ];
    for (const k of kinds) {
      for (let i = 0; i < Math.min(variantCount, k.templates.length); i++) {
        n++;
        cases.push({
          id: `recall-${n}`, category: 'RECALL', project: p.id, text: k.templates[i],
          expectSourceUriAny: [k.sourceUri], expectExcerptContains: k.expect,
        });
      }
    }
  }
  return cases;
}

export function buildEdgeCaseCases(): EvalCase[] {
  const cases: EvalCase[] = [];
  let n = 0;

  // NO_ANSWER: one per project, deliberately outside the corpus.
  for (const p of PROJECTS) {
    n++;
    cases.push({
      id: `noanswer-${n}`, category: 'NO_ANSWER', project: p.id,
      text: 'recommended sourdough bread hydration ratio and proofing temperature',
      expectEmpty: true,
    });
  }

  // WRONG_PROJECT_DISTRACTOR: ask project B's port question while scoped to project A.
  // The generic terms ("gateway", "port", "listen") legitimately match the asker's own
  // project content — that is correct, scoped behavior, not a leak — so correctness
  // here means "the other project's value never appears," not "the result is empty."
  for (let i = 0; i < PROJECTS.length; i++) {
    const asker = PROJECTS[i];
    const other = PROJECTS[(i + 1) % PROJECTS.length];
    n++;
    cases.push({
      id: `distractor-${n}`, category: 'WRONG_PROJECT_DISTRACTOR', project: asker.id,
      text: `what port does the ${other.id} gateway listen on`,
      forbiddenText: [other.gatewayPort, `${other.id} gateway listens on port ${other.gatewayPort}`],
    });
  }

  // EXACT_PATH: literal filename reference.
  for (const p of PROJECTS) {
    n++;
    cases.push({
      id: `exactpath-${n}`, category: 'EXACT_PATH', project: p.id,
      text: `what is documented in ${p.id}/architecture.md`,
      expectSourceUriAny: ['architecture.md'],
    });
  }

  // SYMBOL: literal filename/symbol from the runbook.
  for (const p of PROJECTS) {
    n++;
    cases.push({
      id: `symbol-${n}`, category: 'SYMBOL', project: p.id,
      text: `what does ${p.incidentSymbol} have to do with`,
      expectSourceUriAny: ['runbook.md'], expectExcerptContains: p.incidentSymbol,
    });
  }

  // MULTI_HOP: a query whose full answer spans architecture.md (framework) and adr-001.md
  // (why that framework was chosen) — both must appear somewhere in the returned pack.
  for (const p of PROJECTS) {
    n++;
    cases.push({
      id: `multihop-${n}`, category: 'MULTI_HOP', project: p.id,
      text: `what framework does ${p.id} use and why was it chosen over ${p.decisionRejected}`,
      expectAllSourceUris: ['architecture.md', 'adr-001.md'],
      limit: 6,
    });
  }

  // CONFLICT: two docs in proj-conflict disagree on "request timeout".
  for (const text of [
    'what is the request timeout',
    'request timeout value',
    'what timeout should I configure',
    'how long is the request timeout',
    'request timeout seconds',
  ]) {
    n++;
    cases.push({ id: `conflict-${n}`, category: 'CONFLICT', project: 'proj-conflict', text });
  }

  // STALENESS: default query must exclude the stale doc; includeStale=true must surface it.
  for (const includeStale of [false, true]) {
    for (const text of ['cache ttl seconds', 'what is the cache ttl', 'how long is the cache ttl configured for']) {
      n++;
      cases.push({ id: `stale-${n}`, category: 'STALENESS', project: 'proj-stale', text, includeStale });
    }
  }

  // SUPERSEDED_VERSION: default query must return the current (50) value, never the old (10).
  for (const text of ['max upload size mb', 'what is the max upload size', 'upload size limit in mb']) {
    n++;
    cases.push({
      id: `version-${n}`, category: 'SUPERSEDED_VERSION', project: 'proj-version', text,
      expectExcerptContains: '50', forbiddenText: ['max upload size mb: 10'],
    });
  }

  // DUPLICATE_AMBIGUOUS: the generic term "authentication flow" must resolve per project scope.
  n++;
  cases.push({
    id: `dup-${n}`, category: 'DUPLICATE_AMBIGUOUS', project: 'proj-dup-a', text: 'authentication flow token lifetime',
    expectExcerptContains: '15 minutes', forbiddenText: ['30 days'],
  });
  n++;
  cases.push({
    id: `dup-${n}`, category: 'DUPLICATE_AMBIGUOUS', project: 'proj-dup-b', text: 'authentication flow token lifetime',
    expectExcerptContains: '30 days', forbiddenText: ['15 minutes'],
  });

  // GENERATED_VS_CANONICAL: both docs mention the same fact; recorded for its own sake,
  // not asserted against a ranking target the system has no structural signal for (see
  // docs/architecture/PHASE6E_KNOWLEDGE_QUALITY.md's honest-gap note).
  for (const text of ['what is the retry limit', 'retry limit attempts', 'how many retry attempts']) {
    n++;
    cases.push({ id: `genvcanon-${n}`, category: 'GENERATED_VS_CANONICAL', project: 'proj-genvcanon', text, expectExcerptContains: '5 attempts' });
  }

  return cases;
}

export function allProjectIds(): string[] {
  return PROJECTS.map(p => p.id);
}
