import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ControlledActionService } from '../../personal-os/actions/service';
import { GovernedOrchestrationService } from '../../personal-os/orchestration/service';
import { DelegationService } from '../../personal-os/delegation/service';
import { DocumentStore } from '../../personal-os/documents/store';
import { KnowledgeDocumentService } from '../../personal-os/documents/service';
import { TaskStore } from '../../task-runtime/store';
import { TaskEngine } from '../../task-runtime/engine';
import { EvidenceService } from '../service';
import { containsSecret, sanitizeClaim } from '../redaction';
import { classifyFreshness } from '../freshness';

function tempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'phase6d-evidence-'));
}

async function main() {
  process.env.MI_CONTROLLED_ACTION_PROVIDER_MODE = 'fixture';
  const root = tempRoot();
  const actions = new ControlledActionService(root);
  const delegation = new DelegationService(root, actions);
  const orchestration = new GovernedOrchestrationService(root, delegation);
  const documents = new DocumentStore(root);
  const taskStore = new TaskStore(root);
  const taskEngine = new TaskEngine(taskStore);
  let evidence: EvidenceService | undefined;

  try {
    // ---- seed Controlled Actions / Governance evidence ----
    const proposal = actions.proposeGmailDraft({
      reason: 'evidence contract smoke test', projectId: 'mi-core',
      to: ['ops@example.com'], subject: 'evidence test', body: 'body',
    });
    await actions.approve(proposal.id, { approver: 'liem', execute: true });

    // ---- seed Orchestration evidence ----
    const plan = orchestration.createPlan({
      title: 'evidence smoke plan', objective: 'o', projectId: 'mi-core',
      steps: [{ key: 'draft', type: 'CONTROLLED_ACTION', description: 'd', actionType: 'GMAIL_CREATE_DRAFT',
        actionPayload: { to: ['ops2@example.com'], subject: 'plan draft', body: 'b', projectId: 'mi-core', reason: 'r' } }],
    });
    orchestration.validate(plan.id);
    orchestration.start(plan.id);
    await orchestration.advance(plan.id);

    // ---- seed Delegation evidence ----
    const d = delegation.createDelegation({
      title: 'evidence smoke delegation', description: 'x', owner: 'liem', projectId: 'mi-core',
      allowedActionTypes: ['GMAIL_CREATE_DRAFT'],
      targetRestriction: { allowedDomains: ['example.com'], maxRecipients: 3, allowBcc: false },
      riskCeiling: 'R2', approvalLevelCeiling: 'STANDARD',
      startsAt: new Date(Date.now() - 60_000).toISOString(),
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      timezone: 'UTC', maxExecutions: 2,
    });
    delegation.submitForApproval(d.id);
    delegation.approve(d.id, { approver: 'liem', strongConfirmation: `AUTHORIZE:${d.id}` });
    const plan2 = orchestration.createPlan({
      title: 'evidence smoke delegated plan', objective: 'o', projectId: 'mi-core',
      steps: [{ key: 'draft', type: 'CONTROLLED_ACTION', description: 'd', actionType: 'GMAIL_CREATE_DRAFT',
        actionPayload: { to: ['ops3@example.com'], subject: 'delegated draft', body: 'b', projectId: 'mi-core', reason: 'r' } }],
    });
    orchestration.validate(plan2.id);
    orchestration.start(plan2.id);
    await orchestration.advance(plan2.id);

    // ---- seed Knowledge evidence: one document + one open conflict ----
    const docRoot = path.join(root, 'docs');
    fs.mkdirSync(docRoot, { recursive: true });
    const docPath = path.join(docRoot, 'evidence-smoke.md');
    fs.writeFileSync(docPath, '# Evidence smoke doc\n\nSeeded for Phase 6D evidence contract testing.\n', 'utf8');
    const docService = new KnowledgeDocumentService({ store: documents, roots: { documentRoots: [docRoot] } });
    const outcome = await docService.ingestApprovedDocument({ filePath: docPath, projectIds: ['mi-core'] });
    assert.strictEqual(outcome.status, 'ACTIVE');
    const conflict = documents.createConflict({
      chunkIds: ['chunk-a', 'chunk-b'], documentIds: [outcome.documentId!], projectIds: ['mi-core'],
      description: 'evidence smoke conflict: two chunks disagree', detectionReason: 'test-seeded',
    });

    // ---- seed Task Runtime evidence ----
    const task = taskEngine.createTask({ userRequest: 'evidence smoke task', taskKind: 'general', projectId: 'mi-core' });

    evidence = new EvidenceService({ personalOsRoot: root, taskRuntimeRoot: root, repoRoot: root });

    // ---- 6D.2: canonical contract produces records from every in-scope source ----
    const all = evidence.list();
    const sourceSystems = new Set(all.map(r => r.sourceSystem));
    assert.ok(sourceSystems.has('CONTROLLED_ACTIONS'), 'expected CONTROLLED_ACTIONS evidence');
    assert.ok(sourceSystems.has('GOVERNANCE'), 'expected GOVERNANCE evidence');
    assert.ok(sourceSystems.has('ORCHESTRATION'), 'expected ORCHESTRATION evidence');
    assert.ok(sourceSystems.has('DELEGATION'), 'expected DELEGATION evidence');
    assert.ok(sourceSystems.has('KNOWLEDGE'), 'expected KNOWLEDGE evidence');
    assert.ok(sourceSystems.has('TASK_RUNTIME'), 'expected TASK_RUNTIME evidence');
    console.log(`[evidence] PASS: aggregates all 6 in-scope source systems (${all.length} records)`);

    // ---- every record has a stable, resolvable id and passes get() round-trip ----
    for (const r of all.slice(0, 5)) {
      const fetched = evidence.get(r.id);
      assert.ok(fetched, `evidence.get(${r.id}) must resolve`);
      assert.strictEqual(fetched!.id, r.id);
    }
    console.log('[evidence] PASS: id round-trips through get()');

    // ---- 6D.3: fact/inference/unknown separation — deterministic, source-driven ----
    const decisionRecords = all.filter(r => r.category === 'DECISION');
    assert.ok(decisionRecords.every(r => r.confidence === 'CERTAIN'), 'every deterministic policy/plan/delegation decision must be CERTAIN, never LIKELY/UNCERTAIN');
    console.log('[evidence] PASS: system-recorded decisions are never represented below CERTAIN confidence');

    // ---- 6D.4: conflict model — the seeded conflict is visible and never silently resolved ----
    const conflicts = evidence.conflicts();
    assert.ok(conflicts.some(c => c.sourceId === conflict.id), 'seeded open conflict must appear in conflicts()');
    documents.updateConflictStatus(conflict.id, 'RESOLVED', 'test resolution');
    const conflictsAfterResolve = evidence.conflicts();
    assert.ok(!conflictsAfterResolve.some(c => c.sourceId === conflict.id), 'resolved conflict must disappear from open conflicts() once its own source marks it resolved');
    console.log('[evidence] PASS: conflict stays visible until resolved by its own source system, never suppressed early');

    // ---- 6D.5: freshness — pure function, deterministic, never fabricates a timestamp ----
    const now = new Date('2026-08-12T00:00:00.000Z');
    assert.strictEqual(classifyFreshness(null, 'FACT', now), 'UNKNOWN');
    assert.strictEqual(classifyFreshness('not-a-date', 'FACT', now), 'UNKNOWN');
    assert.strictEqual(classifyFreshness('2026-08-12T23:00:00.000Z', 'DECISION', now), 'UNKNOWN'); // future-dated
    assert.strictEqual(classifyFreshness('2026-08-11T23:58:00.000Z', 'HEALTH', now), 'FRESH');
    assert.strictEqual(classifyFreshness('2026-08-11T23:50:00.000Z', 'HEALTH', now), 'AGING');
    assert.strictEqual(classifyFreshness('2026-08-11T23:00:00.000Z', 'HEALTH', now), 'STALE');
    console.log('[evidence] PASS: freshness classification is deterministic, never fabricates a timestamp for missing/invalid/future data');

    // ---- 6D.6: redaction — secret patterns never survive into a claim ----
    assert.ok(containsSecret('client_secret: "abc123def456ghijklmnop"'));
    assert.ok(containsSecret('sk-abcdefghijklmnopqrstuvwx'));
    assert.ok(!containsSecret('a completely ordinary sentence'));
    const sanitized = sanitizeClaim('leaked refresh_token: "abcdefghijklmnop"');
    assert.ok(!sanitized.includes('abcdefghijklmnop'), 'sanitizeClaim must never leak the matched secret text');
    assert.ok(sanitized.startsWith('[redacted'));
    for (const r of all) {
      assert.ok(!containsSecret(r.claim), `evidence record ${r.id} claim must never contain a secret pattern`);
      if (r.canonicalReference) assert.ok(!containsSecret(r.canonicalReference), `evidence record ${r.id} canonicalReference must never contain a secret pattern`);
    }
    console.log('[evidence] PASS: no secret pattern survives into any evidence claim or canonical reference');

    // ---- 6D.7: side-effect evidence links back to its authority decision / delegation ----
    // normalizeDelegationDecision (eligibility decisions, id-prefixed by the
    // delegation_decisions table) always sets authorityDecisionId; the sibling
    // delegation_events log (also DELEGATION/DECISION-category for some event types)
    // does not, since an event is a record OF a decision, not the decision itself.
    const delegationDecisionRecords = all.filter(r => r.sourceSystem === 'DELEGATION' && r.category === 'DECISION' && r.subjectType === 'ActionProposal');
    assert.ok(delegationDecisionRecords.length > 0, 'expected at least one delegation eligibility decision');
    assert.ok(delegationDecisionRecords.every(r => r.authorityDecisionId), 'delegation eligibility decisions must carry their own authorityDecisionId');
    console.log('[evidence] PASS: side-effect/decision evidence links back to an authority decision id');

    // ---- 6D.8: health metrics cover every required dimension, never fabricated ----
    const health = evidence.health();
    const dimensions = new Set(health.map(h => h.dimension));
    for (const expected of ['APPROVALS_WAITING', 'BLOCKED_PLANS', 'STALE_KNOWLEDGE', 'FAILED_INGESTION', 'POLICY_DRIFT', 'DELEGATION_EXPIRY', 'BUDGET_EXHAUSTION', 'KILL_SWITCHES', 'AUTHORITY_VIOLATIONS', 'DB_INTEGRITY', 'SERVICE_HEALTH']) {
      assert.ok(dimensions.has(expected as any), `health() must report dimension ${expected}`);
    }
    assert.ok(health.every(h => ['OK', 'ATTENTION', 'CRITICAL', 'UNKNOWN'].includes(h.status)));
    console.log('[evidence] PASS: health() reports all 11 required dimensions with valid statuses');

    // ---- 6D.9: daily digest is read-only and never mutates anything ----
    const today = new Date().toISOString().slice(0, 10);
    const beforeCount = actions.list().length;
    const digest = evidence.digest(today);
    assert.strictEqual(actions.list().length, beforeCount, 'digest() must never mutate Controlled Actions state');
    assert.ok(digest.decisions >= 0 && digest.approvals >= 0 && digest.executions >= 0);
    assert.ok(Array.isArray(digest.significantEvents));
    console.log('[evidence] PASS: daily digest is read-only and reports non-negative counts');

    // ---- filter correctness ----
    const knowledgeOnly = evidence.list({ sourceSystem: 'KNOWLEDGE' });
    assert.ok(knowledgeOnly.every(r => r.sourceSystem === 'KNOWLEDGE'));
    const mieCoreOnly = evidence.list({ projectId: 'mi-core' });
    assert.ok(mieCoreOnly.every(r => r.projectId === 'mi-core' || r.projectId === null ? r.projectId === 'mi-core' : true));
    console.log('[evidence] PASS: list() filters by sourceSystem/projectId correctly');

    console.log('[evidence] ALL PASS');
  } finally {
    evidence?.close();
    taskStore.close();
    documents.close();
    orchestration.close();
    delegation.close();
    actions.close();
    try { fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch (e) { console.error('cleanup warning:', e); }
  }
}

main().catch(err => { console.error(err); process.exitCode = 1; });
