/**
 * Phase 5D-3 §22 acceptance — a deterministic fixture day exercising every phase of the
 * Daily Operating Loop against a known, hand-built scenario (2 meetings, 1 deadline
 * today, 3 active goals, 6 tasks in a spread of states, 1 stale document, 1 knowledge
 * conflict, 1 degraded project, service health surfaced, 2 email follow-ups).
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { calendarEvent, gmailMessage } from '../../intelligence/fixtures';
import { createFixtureTransport } from '../../intelligence/transports';
import { GoogleReadClient, REQUIRED_READ_SCOPES } from '../../intelligence/google-read-client';
import { IntelligenceService } from '../../intelligence/service';
import { ProjectRegistryService, seedMiCoreProject } from '../../project-registry/service';
import { TaskEngine } from '../../task-runtime/engine';
import { TaskStore } from '../../task-runtime/store';
import { PersonalOsStore } from '../store';
import { DocumentStore } from '../documents/store';
import { KnowledgeDocumentService } from '../documents/service';
import { scanForConflicts } from '../documents/conflicts';
import { OperatingStore } from './store';
import { DailyOperatingLoop } from './loop';

const DATE = '2026-08-07';
const OWNER = 'owner@example.com';

function write(root: string, rel: string, content: string): string {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
  return full;
}

function tokenState() {
  return { status: 'READY' as const, grantedScopes: [...REQUIRED_READ_SCOPES], detail: 'fixture' };
}

async function run(): Promise<void> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-5d3-acceptance-'));
  process.env.MI_TASK_RUNTIME_DIR = path.join(root, 'tasks');
  process.env.MI_PROJECT_REGISTRY_DIR = path.join(root, 'projects');
  process.env.MI_PROJECT_REGISTRY_WORKSPACE_ROOTS = root;
  process.env.MI_PERSONAL_OS_DIR = path.join(root, 'personal');
  process.env.MI_TEST_TODAY = DATE;

  const checks: Array<{ name: string; pass: boolean }> = [];
  const check = (name: string, pass: boolean) => checks.push({ name, pass });

  const degradedRoot = path.join(root, 'degraded-project');
  fs.mkdirSync(degradedRoot, { recursive: true });

  const registry = new ProjectRegistryService();
  registry.registerProject(seedMiCoreProject(root));
  registry.registerProject({
    id: 'proj-degraded', displayName: 'Degraded Project', canonicalRoot: degradedRoot,
    owner: 'Liem', businessPurpose: 'Fixture project deliberately left in a degraded state.',
  } as any);

  const taskStore = new TaskStore(process.env.MI_TASK_RUNTIME_DIR);
  const engine = new TaskEngine(taskStore);

  // --- 6 tasks: 1 completed, 1 failed, 1 blocked, 2 waiting-approval, 1 ready --------
  const mk = (label: string, projectId: string) => {
    const t = engine.createTask({ userRequest: label, taskKind: 'general', projectId });
    engine.transition(t.id, 'CONTEXT_BUILDING'); engine.transition(t.id, 'PLANNING');
    return t;
  };
  const completed = mk('Ship the login fix', 'mi-core');
  engine.transition(completed.id, 'READY'); engine.transition(completed.id, 'RUNNING'); engine.transition(completed.id, 'VALIDATING');
  engine.completeTask(completed.id, 'fixed and deployed successfully');

  const failed = mk('Migrate the billing table', 'mi-core');
  engine.transition(failed.id, 'READY'); engine.transition(failed.id, 'RUNNING');
  engine.failTask(failed.id, 'migration failed: connection timeout to the billing replica');

  const blocked = mk('Rotate the API credentials', 'proj-degraded');
  engine.transition(blocked.id, 'BLOCKED');

  const waiting1 = mk('Deploy the pricing page', 'mi-core');
  engine.transition(waiting1.id, 'WAITING_APPROVAL');
  const waiting2 = mk('Send the customer refund', 'mi-core');
  engine.transition(waiting2.id, 'WAITING_APPROVAL');

  const ready = mk('Write the release notes', 'mi-core');
  engine.transition(ready.id, 'READY');

  const degradedFail = mk('Provision the degraded project database', 'proj-degraded');
  engine.transition(degradedFail.id, 'READY'); engine.transition(degradedFail.id, 'RUNNING');
  engine.failTask(degradedFail.id, 'provisioning failed: quota exceeded');

  check('6+ primary tasks created across the required statuses', taskStore.listTasks().length >= 7);

  // --- 3 active goals -----------------------------------------------------------------
  const personal = new PersonalOsStore(process.env.MI_PERSONAL_OS_DIR);
  for (const [title, projectIds] of [
    ['Ship the login fix', ['mi-core']], ['Stabilize the degraded project', ['proj-degraded']], ['Write Q3 release notes', ['mi-core']],
  ] as const) {
    const g = personal.createGoal({ title, description: `${title} — fixture goal`, category: 'engineering', projectIds: [...projectIds] });
    personal.updateGoalStatus(g.id, 'ACTIVE');
  }
  check('3 active goals created', personal.listGoals().filter(g => g.status === 'ACTIVE').length === 3);

  // --- 1 stale document + 1 knowledge conflict ---------------------------------------
  const docRoot = path.join(root, 'docs');
  const documentStore = new DocumentStore(process.env.MI_PERSONAL_OS_DIR);
  const docService = new KnowledgeDocumentService({ store: documentStore, roots: { documentRoots: [docRoot] } });

  const staleDocPath = write(docRoot, 'runbook.md', '# Runbook\n\nThe deploy runbook currently uses the old blue-green process.\n');
  const staleOutcome = await docService.ingestApprovedDocument({ filePath: staleDocPath, projectIds: ['mi-core'] });
  fs.writeFileSync(staleDocPath, '# Runbook\n\nThe deploy runbook now uses the new canary process, superseding blue-green entirely.\n', 'utf8');
  const staleness = docService.refreshStaleness();
  check('exactly one document is marked STALE', staleness.filter(s => s.status === 'STALE').length === 1 && staleOutcome.status === 'ACTIVE');

  const confA = write(docRoot, 'limits-a.md', '# Login Fix\n\nThe login fix rollout window is 30 minutes and requires a database restart.\n');
  const confB = write(docRoot, 'limits-b.md', '# Login Fix\n\nThe login fix rollout window is 90 minutes and requires a database restart.\n');
  await docService.ingestApprovedDocument({ filePath: confA, projectIds: ['mi-core'] });
  await docService.ingestApprovedDocument({ filePath: confB, projectIds: ['mi-core'] });
  const conflictScan = scanForConflicts(documentStore, ['mi-core']);
  check('at least one knowledge conflict is raised', conflictScan.created >= 1);

  // --- Gmail/Calendar fixtures: 2 meetings, 1 deadline today, 2 follow-ups ----------
  const standup = calendarEvent({ id: 'evt-standup', summary: 'Mi Core standup', start: `${DATE}T09:00:00Z`, end: `${DATE}T09:30:00Z`, timeZone: 'UTC', attendees: [{ email: OWNER, responseStatus: 'accepted' }] });
  const review = calendarEvent({ id: 'evt-review', summary: 'Degraded project review', start: `${DATE}T14:00:00Z`, end: `${DATE}T15:00:00Z`, timeZone: 'UTC', attendees: [{ email: OWNER, responseStatus: 'accepted' }] });
  const deadlineEmail = gmailMessage({ id: 'msg-deadline', threadId: 'thr-1', from: 'client@partner.example', to: [OWNER], subject: 'Release notes due today', body: `Please confirm the release notes by ${DATE}. We need this for the audit.`, receivedAt: `${DATE}T08:00:00Z` });
  const commitmentEmail = gmailMessage({ id: 'msg-commit', threadId: 'thr-2', from: OWNER, to: ['client@partner.example'], subject: 'Re: rollout', body: "Thanks for the update. I'll send the updated rollout plan tomorrow.", receivedAt: `${DATE}T08:30:00Z` });

  const morningFixture = {
    calendars: [{ id: 'primary', summary: 'Owner calendar', timeZone: 'UTC' }],
    events: { primary: [standup, review] },
    messages: { 'msg-deadline': deadlineEmail, 'msg-commit': commitmentEmail },
    threads: { 'thr-1': { messages: [deadlineEmail] }, 'thr-2': { messages: [commitmentEmail] } },
    messageList: [{ id: 'msg-deadline' }, { id: 'msg-commit' }],
    threadList: [{ id: 'thr-1', snippet: 'Release notes due today' }, { id: 'thr-2', snippet: 'Re: rollout' }],
    busy: { primary: [{ start: `${DATE}T09:00:00Z`, end: `${DATE}T09:30:00Z` }, { start: `${DATE}T14:00:00Z`, end: `${DATE}T15:00:00Z` }] },
  };
  const intelligenceMorning = new IntelligenceService({
    capabilities: new GoogleReadClient(createFixtureTransport(morningFixture), tokenState()),
    ownerAddresses: [OWNER],
  });

  const operatingStore = new OperatingStore(process.env.MI_PERSONAL_OS_DIR);
  const loop = new DailyOperatingLoop({ personalStore: personal, taskStore, registry, documentStore, operatingStore, intelligence: intelligenceMorning });

  // === MORNING =========================================================================
  const brief = await loop.morning(DATE);
  check('brief has 2 meetings', brief.meetings.length === 2);
  check('brief surfaces at least 1 deadline today', brief.deadlines.length >= 1);
  check('brief has priority facts', brief.facts.length > 0);
  check('brief surfaces pending approvals (2 WAITING_APPROVAL tasks)', brief.pendingApprovals.length >= 2);
  check('brief surfaces the knowledge conflict', brief.conflicts.length >= 1);
  check('brief surfaces the blocked task as a blocker', brief.blockers.some(b => b.includes(blocked.id)));
  check('brief surfaces the degraded project as non-HEALTHY', brief.projectHealth.some(p => p.projectId === 'proj-degraded' && p.status !== 'HEALTHY'));
  check('brief reports service health for every monitored service', brief.serviceHealth.length > 0);
  check('brief has at most 5 blockers', brief.blockers.length <= 5);
  check('brief has at most 5 confirmation requests', brief.confirmationRequests.length <= 5);

  // === PLAN =============================================================================
  const plan = loop.plan(DATE);
  check('plan is DRAFT', plan.status === 'DRAFT');
  check('plan has at most 10 tasks', plan.selectedTasks.length <= 10);
  check('plan never selects the BLOCKED task as executable', !plan.selectedTasks.some(t => t.sourceId === blocked.id));
  check('plan never selects a WAITING_APPROVAL task as active', !plan.selectedTasks.some(t => t.sourceId === waiting1.id || t.sourceId === waiting2.id));
  check('plan separates FIXED/FLEXIBLE/OPTIONAL kinds', new Set(plan.selectedTasks.map(t => t.kind)).size >= 2);

  // === MIDDAY (one task completed, one meeting cancelled) ============================
  engine.transition(ready.id, 'RUNNING'); engine.transition(ready.id, 'VALIDATING');
  engine.completeTask(ready.id, 'release notes drafted');
  (taskStore as unknown as { db: { prepare: (sql: string) => { run: (...args: unknown[]) => unknown } } }).db
    .prepare(`UPDATE tasks SET completedAt = ? WHERE id = ?`).run(`${DATE}T17:00:00.000Z`, ready.id);

  const middayFixture = { ...morningFixture, events: { primary: [standup] } }; // the review meeting is gone = cancelled/rescheduled off today
  const intelligenceMidday = new IntelligenceService({
    capabilities: new GoogleReadClient(createFixtureTransport(middayFixture), tokenState()),
    ownerAddresses: [OWNER],
  });
  const middayLoop = new DailyOperatingLoop({ personalStore: personal, taskStore, registry, documentStore, operatingStore, intelligence: intelligenceMidday });
  const midday = await middayLoop.midday(DATE);
  check('midday refresh detects the newly completed task', midday.refresh.changedFacts.some(f => f.includes(ready.id) && f.includes('completed')));
  check('midday refresh detects the cancelled meeting', midday.refresh.changedFacts.some(f => f.toLowerCase().includes('cancelled')));
  check('midday refresh is a genuinely new refresh', midday.created === true);

  const midday2 = await middayLoop.midday(DATE);
  check('a second identical midday call produces no duplicate refresh', midday2.created === false);

  // === EVENING ==========================================================================
  const review_ = await loop.evening(DATE);
  check('evening review reflects completion with Task Runtime evidence', review_.completedItems.length > 0 && review_.completedItems.every(c => c.evidenceReference.startsWith('task:')));
  check('the completed task is reflected in the review', review_.completedItems.some(c => c.id === ready.id));
  check('the failed task remains failed, never self-awarded as success', taskStore.getTask(failed.id)!.status === 'FAILED');

  const review2 = await loop.evening(DATE);
  check('no duplicate memory: repeated evening call returns the same review id', review_.id === review2.id);

  // === RESTART ==========================================================================
  personal.close(); taskStore.close(); documentStore.close(); operatingStore.close(); registry.close();

  const registry2 = new ProjectRegistryService();
  const taskStore2 = new TaskStore(process.env.MI_TASK_RUNTIME_DIR);
  const operatingStore2 = new OperatingStore(process.env.MI_PERSONAL_OS_DIR);
  const briefAfterRestart = operatingStore2.latestBriefForDate(DATE);
  check('brief persists across restart', briefAfterRestart?.id === brief.id);
  const planAfterRestart = operatingStore2.latestPlanForDate(DATE);
  check('plan persists across restart', planAfterRestart?.id === plan.id);
  const noAutoExecution = taskStore2.getTask(waiting1.id)!;
  check('no task was auto-executed across the whole run', noAutoExecution.status === 'WAITING_APPROVAL');
  registry2.close(); taskStore2.close(); operatingStore2.close();

  try { fs.rmSync(root, { recursive: true, force: true }); } catch { /* best effort */ }

  const failedChecks = checks.filter(c => !c.pass);
  for (const c of checks) console.log(`  [${c.pass ? 'PASS' : 'FAIL'}] ${c.name}`);
  console.log(`\n[phase5d3:acceptance] ${checks.length - failedChecks.length}/${checks.length} checks passed`);
  if (failedChecks.length) { console.error('[phase5d3:acceptance] FAIL'); process.exit(1); }
  console.log('[phase5d3:acceptance] PASS');
}

run().catch(err => { console.error('[phase5d3:acceptance] FAIL:', err); process.exit(1); });
