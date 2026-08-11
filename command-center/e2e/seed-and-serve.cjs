/**
 * §32 E2E fixture backend — seeds a fully isolated, disposable temp environment
 * (its own SQLite databases, its own PIN, its own port) with synthetic data, then
 * starts the real compiled server against it. Never touches the live checkout or
 * any real database. Torn down by the Playwright config's webServer lifecycle.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const SERVER_ROOT = path.resolve(__dirname, '..', '..', 'server');
const DIST = path.join(SERVER_ROOT, 'dist');
const ROOT_REGISTRY = path.resolve(__dirname, '..', 'test-results', 'e2e-fixture-roots.jsonl');

const PORT = process.env.E2E_PORT || '4098';
const PIN = process.env.E2E_PIN || '135790';
const API_KEY = crypto.randomBytes(24).toString('hex');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-5e-e2e-'));
fs.mkdirSync(path.dirname(ROOT_REGISTRY), { recursive: true });
fs.appendFileSync(ROOT_REGISTRY, JSON.stringify({ root, createdAt: new Date().toISOString() }) + '\n');
process.env.MI_TASK_RUNTIME_DIR = path.join(root, 'tasks');
process.env.MI_PROJECT_REGISTRY_DIR = path.join(root, 'projects');
process.env.MI_PROJECT_REGISTRY_WORKSPACE_ROOTS = root;
process.env.MI_PERSONAL_OS_DIR = path.join(root, 'personal');
process.env.MI_TEST_TODAY = '2026-08-07';

async function seed() {
  const { ProjectRegistryService, seedMiCoreProject } = require(path.join(DIST, 'project-registry', 'service.js'));
  const { TaskEngine } = require(path.join(DIST, 'task-runtime', 'engine.js'));
  const { TaskStore } = require(path.join(DIST, 'task-runtime', 'store.js'));
  const { PersonalOsStore } = require(path.join(DIST, 'personal-os', 'store.js'));
  const { DocumentStore } = require(path.join(DIST, 'personal-os', 'documents', 'store.js'));
  const { KnowledgeDocumentService } = require(path.join(DIST, 'personal-os', 'documents', 'service.js'));
  const { OperatingStore } = require(path.join(DIST, 'personal-os', 'operating', 'store.js'));
  const { DailyOperatingLoop } = require(path.join(DIST, 'personal-os', 'operating', 'loop.js'));
  const { GovernedOrchestrationService } = require(path.join(DIST, 'personal-os', 'orchestration', 'service.js'));
  const { DelegationService } = require(path.join(DIST, 'personal-os', 'delegation', 'service.js'));

  const registry = new ProjectRegistryService();
  registry.registerProject(seedMiCoreProject(root));

  const taskStore = new TaskStore(process.env.MI_TASK_RUNTIME_DIR);
  const engine = new TaskEngine(taskStore);
  const waiting = engine.createTask({ userRequest: 'E2E fixture: deploy the pricing page', taskKind: 'general', projectId: 'mi-core' });
  engine.transition(waiting.id, 'CONTEXT_BUILDING');
  engine.transition(waiting.id, 'PLANNING');
  engine.transition(waiting.id, 'WAITING_APPROVAL');

  const personal = new PersonalOsStore(process.env.MI_PERSONAL_OS_DIR);
  const goal = personal.createGoal({ title: 'E2E fixture goal', description: 'Ship the E2E fixture feature', category: 'engineering', projectIds: ['mi-core'] });
  personal.updateGoalStatus(goal.id, 'ACTIVE');

  const docRoot = path.join(root, 'docs');
  fs.mkdirSync(docRoot, { recursive: true });
  const docPath = path.join(docRoot, 'architecture.md');
  fs.writeFileSync(docPath, '# E2E Fixture Architecture\n\nThe E2E fixture feature ships behind a bounded, approval-gated task.\n', 'utf8');
  const documentStore = new DocumentStore(process.env.MI_PERSONAL_OS_DIR);
  const docService = new KnowledgeDocumentService({ store: documentStore, roots: { documentRoots: [docRoot] } });
  await docService.ingestApprovedDocument({ filePath: docPath, projectIds: ['mi-core'] });

  const operatingStore = new OperatingStore(process.env.MI_PERSONAL_OS_DIR);
  const loop = new DailyOperatingLoop({ personalStore: personal, taskStore, registry, documentStore, operatingStore });
  await loop.morning('2026-08-07');
  loop.plan('2026-08-07');

  const orchestration = new GovernedOrchestrationService(process.env.MI_PERSONAL_OS_DIR);
  const plan = orchestration.createPlan({
    title: 'E2E fixture: prepare customer follow-up', objective: 'Prepare a customer follow-up.', projectId: 'mi-core',
    steps: [
      { key: 'retrieve', type: 'READ_ONLY', description: 'Retrieve context.' },
      {
        key: 'draft', type: 'CONTROLLED_ACTION', description: 'Prepare Gmail draft.', dependsOnKeys: ['retrieve'],
        actionType: 'GMAIL_CREATE_DRAFT',
        actionPayload: { to: ['owner@example.com'], subject: 'E2E fixture follow-up', body: 'Fixture body.', projectId: 'mi-core', reason: 'E2E fixture' },
      },
    ],
  });
  orchestration.validate(plan.id);
  orchestration.start(plan.id);
  orchestration.close();

  const delegation = new DelegationService(process.env.MI_PERSONAL_OS_DIR);
  const activeStartsAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const activeExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const delegationInput = (suffix, overrides = {}) => ({
    title: `E2E delegation ${suffix}`,
    description: 'Fixture delegation for Command Center E2E.',
    owner: 'liem',
    projectId: 'mi-core',
    allowedActionTypes: ['GMAIL_CREATE_DRAFT'],
    deniedActionTypes: [],
    targetRestriction: { allowedDomains: ['example.com'], maxRecipients: 3 },
    riskCeiling: 'R2',
    approvalLevelCeiling: 'STANDARD',
    startsAt: activeStartsAt,
    expiresAt: activeExpiresAt,
    timezone: 'UTC',
    maxExecutions: 3,
    maxTargets: 9,
    actionBudgets: [],
    ...overrides,
  });
  const activate = (suffix, overrides = {}) => {
    const d = delegation.createDelegation(delegationInput(suffix, overrides));
    delegation.submitForApproval(d.id);
    return delegation.approve(d.id, { approver: 'liem', strongConfirmation: `AUTHORIZE:${d.id}` });
  };
  const activeDelegation = activate('active');
  delegation.createDelegation(delegationInput('draft'));
  const waitingDelegation = delegation.createDelegation(delegationInput('waiting-approval'));
  delegation.submitForApproval(waitingDelegation.id);
  const pausedDelegation = activate('paused');
  delegation.pause(pausedDelegation.id, 'liem', 'fixture pause');
  const expiredDelegation = activate('expired', {
    startsAt: '2026-08-01T08:00:00.000Z',
    expiresAt: '2026-08-01T09:00:00.000Z',
  });
  delegation.get(expiredDelegation.id);
  const revokedDelegation = activate('revoked');
  delegation.revoke(revokedDelegation.id, 'liem', 'fixture revoke');
  delegation.close();

  personal.close(); taskStore.close(); registry.close(); documentStore.close(); operatingStore.close();

  fs.writeFileSync(path.join(root, 'waiting-task-id.txt'), waiting.id, 'utf8');
  fs.writeFileSync(path.join(root, 'plan-id.txt'), plan.id, 'utf8');
  fs.writeFileSync(path.join(root, 'active-delegation-id.txt'), activeDelegation.id, 'utf8');
  return { waitingTaskId: waiting.id, planId: plan.id, activeDelegationId: activeDelegation.id };
}

seed().then(({ waitingTaskId, activeDelegationId }) => {
  process.env.MI_PORT = PORT;
  process.env.MI_CORE_API_KEY = API_KEY;
  process.env.MI_PIN = PIN;
  process.env.MI_E2E_FIXTURE = '1';
  process.env.MI_E2E_FIXTURE_ROOT = root;
  process.env.GLOBAL_DIR = path.join(root, 'local-agent-global');
  process.env.MI_INTELLIGENCE_TOKEN_DIR = path.join(root, 'local-agent-global');
  process.env.ALLOWED_ORIGINS = `http://127.0.0.1:${PORT},http://localhost:${PORT}`;

  const child = spawn(process.execPath, [path.join(DIST, 'index.js')], {
    cwd: SERVER_ROOT,
    env: process.env,
    stdio: 'inherit',
  });

  console.log(`[e2e-fixture] waitingTaskId=${waitingTaskId} activeDelegationId=${activeDelegationId} pin=${PIN} port=${PORT}`);

  let cleaned = false;
  const removeRoot = () => {
    try { fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 }); } catch { /* best effort */ }
  };
  const cleanup = (signal) => {
    if (cleaned) return;
    cleaned = true;
    const finish = () => {
      removeRoot();
      if (signal) process.exit(0);
    };
    if (child.exitCode == null && !child.killed) {
      child.once('exit', finish);
      child.kill('SIGTERM');
      setTimeout(() => {
        if (child.exitCode == null && !child.killed) child.kill('SIGKILL');
        finish();
      }, 7000).unref();
    } else {
      finish();
    }
  };
  child.once('exit', () => cleanup());
  process.once('SIGINT', () => cleanup('SIGINT'));
  process.once('SIGTERM', () => cleanup('SIGTERM'));
  process.once('exit', removeRoot);
}).catch(err => {
  console.error('[e2e-fixture] seed failed:', err);
  process.exit(1);
});
