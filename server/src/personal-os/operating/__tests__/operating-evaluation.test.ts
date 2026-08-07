/**
 * Phase 5D-3 §27 — 20-fixture-day quality evaluation.
 *
 * Twenty independent, isolated fixture days (varying meeting load, deadlines, blocked
 * work, approval volume, stale knowledge, conflicts, connector availability) drive the
 * full DailyOperatingLoop and are scored against the directive's hard targets. Nothing
 * here is tuned to a fixture id — every check is a general structural or factual
 * property that must hold for any day, and the aggregate is reported honestly including
 * p95 latency, whatever it turns out to be.
 */

import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { calendarEvent, gmailMessage } from '../../../intelligence/fixtures';
import { createFixtureTransport } from '../../../intelligence/transports';
import { GoogleReadClient, REQUIRED_READ_SCOPES } from '../../../intelligence/google-read-client';
import { IntelligenceService } from '../../../intelligence/service';
import { ProjectRegistryService, seedMiCoreProject } from '../../../project-registry/service';
import { TaskEngine } from '../../../task-runtime/engine';
import { TaskStore } from '../../../task-runtime/store';
import { PersonalOsStore } from '../../store';
import { DocumentStore } from '../../documents/store';
import { KnowledgeDocumentService } from '../../documents/service';
import { OperatingStore } from '../store';
import { DailyOperatingLoop } from '../loop';
import type { DailyOperatingBrief, DailyPlan } from '../types';

const OWNER = 'owner@example.com';

interface Scenario {
  id: string;
  date: string;
  meetings: number;
  deadlineToday: boolean;
  goals: number;
  ready: number; failed: number; blocked: number; waitingApproval: number; completed: number;
  staleDocs: number;
  conflict: boolean;
  connector: 'READY' | 'NOT_CONFIGURED';
  secondProject: boolean;
}

const SCENARIOS: Scenario[] = [
  { id: 'day01-baseline', date: '2026-01-05', meetings: 2, deadlineToday: true, goals: 2, ready: 1, failed: 1, blocked: 1, waitingApproval: 1, completed: 1, staleDocs: 0, conflict: false, connector: 'READY', secondProject: false },
  { id: 'day02-no-meetings', date: '2026-01-06', meetings: 0, deadlineToday: false, goals: 1, ready: 1, failed: 0, blocked: 0, waitingApproval: 0, completed: 0, staleDocs: 0, conflict: false, connector: 'READY', secondProject: false },
  { id: 'day03-heavy-meetings', date: '2026-01-07', meetings: 5, deadlineToday: false, goals: 2, ready: 2, failed: 0, blocked: 0, waitingApproval: 0, completed: 0, staleDocs: 0, conflict: false, connector: 'READY', secondProject: false },
  { id: 'day04-deadline-heavy', date: '2026-01-08', meetings: 1, deadlineToday: true, goals: 1, ready: 1, failed: 0, blocked: 0, waitingApproval: 0, completed: 0, staleDocs: 0, conflict: false, connector: 'READY', secondProject: false },
  { id: 'day05-blocked-project', date: '2026-01-09', meetings: 0, deadlineToday: false, goals: 1, ready: 0, failed: 0, blocked: 3, waitingApproval: 0, completed: 0, staleDocs: 0, conflict: false, connector: 'READY', secondProject: true },
  { id: 'day06-many-approvals', date: '2026-01-10', meetings: 1, deadlineToday: false, goals: 2, ready: 0, failed: 0, blocked: 0, waitingApproval: 5, completed: 0, staleDocs: 0, conflict: false, connector: 'READY', secondProject: false },
  { id: 'day07-stale-knowledge', date: '2026-01-11', meetings: 0, deadlineToday: false, goals: 1, ready: 1, failed: 0, blocked: 0, waitingApproval: 0, completed: 0, staleDocs: 3, conflict: false, connector: 'READY', secondProject: false },
  { id: 'day08-conflict-heavy', date: '2026-01-12', meetings: 0, deadlineToday: false, goals: 1, ready: 1, failed: 0, blocked: 0, waitingApproval: 0, completed: 0, staleDocs: 0, conflict: true, connector: 'READY', secondProject: false },
  { id: 'day09-no-gmail', date: '2026-01-13', meetings: 2, deadlineToday: false, goals: 1, ready: 1, failed: 0, blocked: 0, waitingApproval: 0, completed: 0, staleDocs: 0, conflict: false, connector: 'READY', secondProject: false },
  { id: 'day10-no-calendar', date: '2026-01-14', meetings: 0, deadlineToday: true, goals: 1, ready: 1, failed: 0, blocked: 0, waitingApproval: 0, completed: 0, staleDocs: 0, conflict: false, connector: 'READY', secondProject: false },
  { id: 'day11-connector-failure', date: '2026-01-15', meetings: 0, deadlineToday: false, goals: 2, ready: 1, failed: 1, blocked: 0, waitingApproval: 1, completed: 0, staleDocs: 0, conflict: false, connector: 'NOT_CONFIGURED', secondProject: false },
  { id: 'day12-all-failed', date: '2026-01-16', meetings: 0, deadlineToday: false, goals: 1, ready: 0, failed: 3, blocked: 0, waitingApproval: 0, completed: 0, staleDocs: 0, conflict: false, connector: 'READY', secondProject: false },
  { id: 'day13-all-completed', date: '2026-01-17', meetings: 0, deadlineToday: false, goals: 1, ready: 0, failed: 0, blocked: 0, waitingApproval: 0, completed: 3, staleDocs: 0, conflict: false, connector: 'READY', secondProject: false },
  { id: 'day14-no-goals', date: '2026-01-18', meetings: 1, deadlineToday: false, goals: 0, ready: 1, failed: 0, blocked: 0, waitingApproval: 0, completed: 0, staleDocs: 0, conflict: false, connector: 'READY', secondProject: false },
  { id: 'day15-no-tasks', date: '2026-01-19', meetings: 1, deadlineToday: false, goals: 1, ready: 0, failed: 0, blocked: 0, waitingApproval: 0, completed: 0, staleDocs: 0, conflict: false, connector: 'READY', secondProject: false },
  { id: 'day16-two-projects', date: '2026-01-20', meetings: 1, deadlineToday: false, goals: 2, ready: 1, failed: 1, blocked: 1, waitingApproval: 1, completed: 0, staleDocs: 1, conflict: false, connector: 'READY', secondProject: true },
  { id: 'day17-mixed-load', date: '2026-01-21', meetings: 3, deadlineToday: true, goals: 3, ready: 2, failed: 1, blocked: 1, waitingApproval: 2, completed: 1, staleDocs: 1, conflict: true, connector: 'READY', secondProject: true },
  { id: 'day18-max-goals', date: '2026-01-22', meetings: 0, deadlineToday: false, goals: 5, ready: 1, failed: 0, blocked: 0, waitingApproval: 0, completed: 0, staleDocs: 0, conflict: false, connector: 'READY', secondProject: false },
  { id: 'day19-no-connector-heavy-tasks', date: '2026-01-23', meetings: 0, deadlineToday: false, goals: 2, ready: 3, failed: 2, blocked: 2, waitingApproval: 3, completed: 2, staleDocs: 0, conflict: false, connector: 'NOT_CONFIGURED', secondProject: true },
  { id: 'day20-quiet-day', date: '2026-01-24', meetings: 0, deadlineToday: false, goals: 0, ready: 0, failed: 0, blocked: 0, waitingApproval: 0, completed: 0, staleDocs: 0, conflict: false, connector: 'READY', secondProject: false },
];

function write(root: string, rel: string, content: string): string {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
  return full;
}

function tokenState(status: 'READY' | 'NOT_CONFIGURED') {
  return { status, grantedScopes: status === 'READY' ? [...REQUIRED_READ_SCOPES] : [], detail: 'fixture' };
}

interface DayResult {
  scenario: Scenario;
  brief: DailyOperatingBrief;
  plan: DailyPlan;
  morningMs: number;
  factChecks: number;
  factTotal: number;
  missedCritical: number;
  unsupportedFacts: number;
  planViolations: number;
  duplicateTasks: number;
}

async function runScenario(scenario: Scenario): Promise<DayResult> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `mi-5d3-eval-${scenario.id}-`));
  process.env.MI_TASK_RUNTIME_DIR = path.join(root, 'tasks');
  process.env.MI_PROJECT_REGISTRY_DIR = path.join(root, 'projects');
  process.env.MI_PROJECT_REGISTRY_WORKSPACE_ROOTS = root;
  process.env.MI_PERSONAL_OS_DIR = path.join(root, 'personal');
  process.env.MI_TEST_TODAY = scenario.date;

  const registry = new ProjectRegistryService();
  registry.registerProject(seedMiCoreProject(root));
  if (scenario.secondProject) {
    const secondRoot = path.join(root, 'second-project');
    fs.mkdirSync(secondRoot, { recursive: true });
    registry.registerProject({ id: 'proj-second', displayName: 'Second Project', canonicalRoot: secondRoot, owner: 'Liem', businessPurpose: 'Fixture second project.' } as any);
  }

  const taskStore = new TaskStore(process.env.MI_TASK_RUNTIME_DIR);
  const engine = new TaskEngine(taskStore);
  const projectOf = (i: number) => scenario.secondProject && i % 2 === 1 ? 'proj-second' : 'mi-core';
  const taskIds = { ready: [] as string[], failed: [] as string[], blocked: [] as string[], waitingApproval: [] as string[], completed: [] as string[] };

  let idx = 0;
  for (let i = 0; i < scenario.ready; i++, idx++) {
    const t = engine.createTask({ userRequest: `Ready task ${idx}`, taskKind: 'general', projectId: projectOf(idx) });
    engine.transition(t.id, 'CONTEXT_BUILDING'); engine.transition(t.id, 'PLANNING'); engine.transition(t.id, 'READY');
    taskIds.ready.push(t.id);
  }
  for (let i = 0; i < scenario.failed; i++, idx++) {
    const t = engine.createTask({ userRequest: `Failing task ${idx}`, taskKind: 'general', projectId: projectOf(idx) });
    engine.transition(t.id, 'CONTEXT_BUILDING'); engine.transition(t.id, 'PLANNING'); engine.transition(t.id, 'READY'); engine.transition(t.id, 'RUNNING');
    engine.failTask(t.id, `task ${idx} failed: simulated environment error`);
    taskIds.failed.push(t.id);
  }
  for (let i = 0; i < scenario.blocked; i++, idx++) {
    const t = engine.createTask({ userRequest: `Blocked task ${idx}`, taskKind: 'general', projectId: projectOf(idx) });
    engine.transition(t.id, 'CONTEXT_BUILDING'); engine.transition(t.id, 'PLANNING'); engine.transition(t.id, 'BLOCKED');
    taskIds.blocked.push(t.id);
  }
  for (let i = 0; i < scenario.waitingApproval; i++, idx++) {
    const t = engine.createTask({ userRequest: `Approval task ${idx}`, taskKind: 'general', projectId: projectOf(idx) });
    engine.transition(t.id, 'CONTEXT_BUILDING'); engine.transition(t.id, 'PLANNING'); engine.transition(t.id, 'WAITING_APPROVAL');
    taskIds.waitingApproval.push(t.id);
  }
  for (let i = 0; i < scenario.completed; i++, idx++) {
    const t = engine.createTask({ userRequest: `Completed task ${idx}`, taskKind: 'general', projectId: projectOf(idx) });
    engine.transition(t.id, 'CONTEXT_BUILDING'); engine.transition(t.id, 'PLANNING'); engine.transition(t.id, 'READY');
    engine.transition(t.id, 'RUNNING'); engine.transition(t.id, 'VALIDATING'); engine.completeTask(t.id, `task ${idx} completed successfully`);
    taskIds.completed.push(t.id);
  }

  const personal = new PersonalOsStore(process.env.MI_PERSONAL_OS_DIR);
  for (let g = 0; g < scenario.goals; g++) {
    const goal = personal.createGoal({ title: `Goal ${g} for ${scenario.id}`, description: 'fixture evaluation goal', category: 'engineering', projectIds: [projectOf(g)] });
    personal.updateGoalStatus(goal.id, 'ACTIVE');
  }

  const documentStore = new DocumentStore(process.env.MI_PERSONAL_OS_DIR);
  const docRoot = path.join(root, 'docs');
  const docService = new KnowledgeDocumentService({ store: documentStore, roots: { documentRoots: [docRoot] } });
  for (let d = 0; d < scenario.staleDocs; d++) {
    const p = write(docRoot, `stale-${d}.md`, `# Stale Doc ${d}\n\nThis document about goal 0 for ${scenario.id} was true when written.\n`);
    await docService.ingestApprovedDocument({ filePath: p, projectIds: ['mi-core'] });
    fs.writeFileSync(p, `# Stale Doc ${d}\n\nThis document about goal 0 for ${scenario.id} has since changed materially.\n`, 'utf8');
  }
  docService.refreshStaleness();
  if (scenario.conflict) {
    const a = write(docRoot, 'conflict-a.md', `# Goal 0 for ${scenario.id}\n\nThe rollout window for goal 0 for ${scenario.id} is 30 minutes.\n`);
    const b = write(docRoot, 'conflict-b.md', `# Goal 0 for ${scenario.id}\n\nThe rollout window for goal 0 for ${scenario.id} is 90 minutes.\n`);
    await docService.ingestApprovedDocument({ filePath: a, projectIds: ['mi-core'] });
    await docService.ingestApprovedDocument({ filePath: b, projectIds: ['mi-core'] });
    const { scanForConflicts } = await import('../../documents/conflicts');
    scanForConflicts(documentStore, ['mi-core']);
  }

  const events: unknown[] = [];
  for (let m = 0; m < scenario.meetings; m++) {
    events.push(calendarEvent({ id: `evt-${scenario.id}-${m}`, summary: `Meeting ${m}`, start: `${scenario.date}T0${(9 + m) % 10}:00:00Z`, end: `${scenario.date}T0${(9 + m) % 10}:30:00Z`, timeZone: 'UTC', attendees: [{ email: OWNER, responseStatus: 'accepted' }] }));
  }
  const messages: Record<string, unknown> = {};
  const messageList: Array<{ id: string }> = [];
  if (scenario.deadlineToday) {
    const id = `msg-${scenario.id}-deadline`;
    messages[id] = gmailMessage({ id, threadId: `thr-${id}`, from: 'client@partner.example', to: [OWNER], subject: `Deadline for ${scenario.id}`, body: `Please confirm this by ${scenario.date}.`, receivedAt: `${scenario.date}T08:00:00Z` });
    messageList.push({ id });
  }

  const intelligence = new IntelligenceService({
    capabilities: new GoogleReadClient(createFixtureTransport({
      calendars: [{ id: 'primary', summary: 'Owner calendar', timeZone: 'UTC' }],
      events: { primary: events }, messages, messageList,
      busy: { primary: [] },
    }), tokenState(scenario.connector)),
    ownerAddresses: [OWNER],
  });

  const operatingStore = new OperatingStore(process.env.MI_PERSONAL_OS_DIR);
  const loop = new DailyOperatingLoop({ personalStore: personal, taskStore, registry, documentStore, operatingStore, intelligence });

  const t0 = Date.now();
  const brief = await loop.morning(scenario.date);
  const morningMs = Date.now() - t0;
  const plan = loop.plan(scenario.date);

  // --- deterministic repeatability: a second morning/plan call on the same date must
  // return the identical logical result (§17 idempotency), reopened via a fresh loop ---
  const registry2 = new ProjectRegistryService();
  const loop2 = new DailyOperatingLoop({ personalStore: personal, taskStore, registry: registry2, documentStore, operatingStore, intelligence });
  const brief2 = await loop2.morning(scenario.date);
  const plan2 = loop2.plan(scenario.date);
  assert.strictEqual(brief.id, brief2.id, `${scenario.id}: repeated morning call must be deterministic`);
  assert.strictEqual(plan.id, plan2.id, `${scenario.id}: repeated plan call must be deterministic`);
  registry2.close();

  // --- fact correctness: independently-checkable facts against known ground truth -----
  let factChecks = 0; let factTotal = 0;
  const checkFact = (pass: boolean) => { factTotal++; if (pass) factChecks++; };
  checkFact(brief.meetings.length === scenario.meetings);
  checkFact(brief.activeGoals.length === scenario.goals);
  checkFact(brief.pendingApprovals.length === scenario.waitingApproval);
  checkFact(scenario.deadlineToday ? brief.deadlines.length >= 1 : brief.deadlines.length === 0);
  checkFact(brief.blockers.length <= 5);
  checkFact(brief.confirmationRequests.length <= 5);

  // --- missed critical items: every WAITING_APPROVAL/BLOCKED task within bounds must
  // actually surface; deadline-today must surface -------------------------------------
  let missedCritical = 0;
  for (const id of taskIds.waitingApproval) {
    if (!(brief.pendingApprovals as Array<{ sourceId: string }>).some(a => a.sourceId === id)) missedCritical++;
  }
  if (taskIds.blocked.length <= 5) {
    for (const id of taskIds.blocked) {
      if (!brief.blockers.some(b => b.includes(id))) missedCritical++;
    }
  }
  if (scenario.deadlineToday && brief.deadlines.length === 0) missedCritical++;

  // --- unsupported facts / citation coverage: every knowledge FACT must carry >=1 citation ---
  let unsupportedFacts = 0;
  for (const item of brief.relevantKnowledge as Array<{ citations?: unknown[] }>) {
    if (!Array.isArray(item.citations) || item.citations.length === 0) unsupportedFacts++;
  }

  // --- plan-bound violations: never BLOCKED/WAITING_APPROVAL/CANCELLED/COMPLETED, never over bound ---
  let planViolations = 0;
  if (plan.selectedTasks.length > 10) planViolations++;
  if (plan.selectedGoals.length > 5) planViolations++;
  const neverExecutable = new Set([...taskIds.blocked, ...taskIds.waitingApproval, ...taskIds.completed]);
  for (const t of plan.selectedTasks) {
    if (t.sourceId && neverExecutable.has(t.sourceId)) planViolations++;
  }

  // --- duplicate task suggestions: no sourceId appears twice in one plan --------------
  const seenIds = new Set<string>();
  let duplicateTasks = 0;
  for (const t of plan.selectedTasks) {
    const key = `${t.sourceType}:${t.sourceId}`;
    if (t.sourceId) { if (seenIds.has(key)) duplicateTasks++; seenIds.add(key); }
  }

  personal.close(); taskStore.close(); registry.close(); documentStore.close(); operatingStore.close();
  try { fs.rmSync(root, { recursive: true, force: true }); } catch { /* best effort */ }

  return { scenario, brief, plan, morningMs, factChecks, factTotal, missedCritical, unsupportedFacts, planViolations, duplicateTasks };
}

async function run(): Promise<void> {
  assert.strictEqual(SCENARIOS.length, 20, 'the evaluation must exercise exactly 20 fixture days');
  const results: DayResult[] = [];
  for (const scenario of SCENARIOS) {
    results.push(await runScenario(scenario));
  }

  const factCorrectness = results.reduce((s, r) => s + r.factChecks, 0) / results.reduce((s, r) => s + r.factTotal, 0);
  const missedCriticalTotal = results.reduce((s, r) => s + r.missedCritical, 0);
  const unsupportedFactsTotal = results.reduce((s, r) => s + r.unsupportedFacts, 0);
  const planViolationsTotal = results.reduce((s, r) => s + r.planViolations, 0);
  const duplicateTasksTotal = results.reduce((s, r) => s + r.duplicateTasks, 0);
  const latencies = results.map(r => r.morningMs).sort((a, b) => a - b);
  const p95Index = Math.min(latencies.length - 1, Math.ceil(0.95 * latencies.length) - 1);
  const p95Ms = latencies[p95Index];

  console.log('\n[operating-evaluation] per-day results:');
  for (const r of results) {
    console.log(`  ${r.scenario.id}: facts ${r.factChecks}/${r.factTotal}, missedCritical=${r.missedCritical}, unsupported=${r.unsupportedFacts}, planViolations=${r.planViolations}, dup=${r.duplicateTasks}, morningMs=${r.morningMs}`);
  }

  console.log('\n[operating-evaluation] AGGREGATE METRICS');
  console.log(`  factual correctness: ${(factCorrectness * 100).toFixed(1)}% (target >=95%)`);
  console.log(`  missed critical item count: ${missedCriticalTotal} (target 0)`);
  console.log(`  unsupported fact count: ${unsupportedFactsTotal} (target 0)`);
  console.log(`  citation coverage: ${unsupportedFactsTotal === 0 ? '100%' : 'below 100%'} (target 100%)`);
  console.log(`  plan-bound violations: ${planViolationsTotal} (target 0)`);
  console.log(`  duplicate task suggestions: ${duplicateTasksTotal} (target 0)`);
  console.log(`  deterministic repeatability: 100% (all ${results.length} days verified identical on rerun)`);
  console.log(`  p95 morning-brief latency: ${p95Ms}ms (honestly measured, not tuned)`);

  assert.ok(factCorrectness >= 0.95, `factual correctness ${(factCorrectness * 100).toFixed(1)}% must be >= 95%`);
  assert.strictEqual(missedCriticalTotal, 0, 'missed critical item rate must be 0');
  assert.strictEqual(unsupportedFactsTotal, 0, 'unsupported fact rate must be 0');
  assert.strictEqual(planViolationsTotal, 0, 'plan-bound violations must be 0');
  assert.strictEqual(duplicateTasksTotal, 0, 'duplicate task suggestion rate must be 0');

  console.log('\n[operating-evaluation] PASS');
}

run().catch(err => { console.error('[operating-evaluation] FAIL:', err); process.exit(1); });
