import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PersonalOsStore } from '../../personal-os/store';
import { TaskStore } from '../../task-runtime/store';
import { IntelligenceService, weekStartOf } from '../service';
import { IntelligenceStore } from '../store';
import { GoogleReadClient } from '../google-read-client';
import { createFixtureTransport } from '../transports';
import { AGENDA_DATE, OWNER_EMAIL, baseFixtures } from '../fixtures';

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mi-weekly-'));
}

function buildService(root: string, status: 'READY' | 'NOT_CONFIGURED' = 'READY') {
  process.env.MI_PERSONAL_OS_DIR = path.join(root, 'personal');
  return new IntelligenceService({
    capabilities: new GoogleReadClient(createFixtureTransport(baseFixtures()), { status, grantedScopes: [], detail: 't' }),
    personal: new PersonalOsStore(path.join(root, 'personal')),
    tasks: new TaskStore(path.join(root, 'tasks')),
    store: new IntelligenceStore(path.join(root, 'personal')),
    registry: null as never,
    ownerAddresses: [OWNER_EMAIL],
    timezone: 'UTC',
  });
}

async function run() {
  const root = tmp();
  process.env.MI_TEST_TODAY = AGENDA_DATE;
  const weekStart = weekStartOf(AGENDA_DATE);
  assert.strictEqual(weekStart, '2026-08-03', 'ISO weeks start on Monday');

  const service = buildService(root);
  // Seed some completed work so the review has real data to report.
  const goal = service.personal.createGoal({ title: 'Close Phase 5B', projectIds: [] });
  service.personal.updateGoalStatus(goal.id, 'ACTIVE');
  service.personal.updateGoalStatus(goal.id, 'COMPLETED');

  await service.generateDailyAgenda(AGENDA_DATE); // produces follow-ups the review consumes
  const review = await service.generateWeeklyReview(weekStart);

  assert.strictEqual(review.weekStart, weekStart);
  assert.strictEqual(review.version, 1);
  assert.ok(review.completedGoals.some(g => g.id === goal.id), 'completed goal reported');
  assert.ok(review.facts.length > 0, 'review states facts');
  assert.ok(Array.isArray(review.unknowns));

  // --- derived metrics are honest about completeness ------------------------
  assert.strictEqual(review.meetingLoad.complete, true, 'meeting load is complete when calendar is readable');
  assert.ok(review.meetingLoad.meetingCount > 0, 'meetings counted');
  assert.ok(review.meetingLoad.totalMinutes > 0, 'meeting minutes computed from real start/end');
  assert.strictEqual(review.focusTimeEstimate.complete, true);

  assert.ok(review.unresolvedFollowUps.every(f => f.status === 'SUGGESTION'),
    'unresolved follow-ups remain suggestions');

  // --- idempotency -----------------------------------------------------------
  const again = await service.generateWeeklyReview(weekStart);
  assert.strictEqual(again.id, review.id, 'regenerating the same week returns the stored review');

  // --- restart persistence ---------------------------------------------------
  const integrity = service.store.integrity();
  assert.strictEqual(integrity.integrityCheck, 'ok');
  assert.deepStrictEqual(integrity.foreignKeyViolations, []);
  service.close();

  const restarted = buildService(root);
  const recovered = restarted.store.getWeeklyReview(weekStart);
  assert.ok(recovered && recovered.id === review.id, 'weekly review survives restart');
  restarted.close();

  // --- incomplete data must not be dressed up as a metric -------------------
  const offlineRoot = tmp();
  const offline = buildService(offlineRoot, 'NOT_CONFIGURED');
  const offlineReview = await offline.generateWeeklyReview(weekStart);
  assert.strictEqual(offlineReview.meetingLoad.complete, false, 'meeting load is flagged incomplete');
  assert.strictEqual(offlineReview.meetingLoad.meetingCount, 0, 'no meetings are invented');
  assert.strictEqual(offlineReview.focusTimeEstimate.complete, false, 'focus estimate is flagged incomplete');
  assert.strictEqual(offlineReview.focusTimeEstimate.minutes, 0, 'no focus minutes are fabricated');
  assert.ok(offlineReview.unknowns.some(u => /incomplete|unknown|NOT_CONFIGURED/i.test(u)),
    'the gap is stated in unknowns');
  assert.ok(offlineReview.facts.some(f => /unavailable/i.test(f)), 'facts admit the gap rather than guessing');
  offline.close();
  fs.rmSync(offlineRoot, { recursive: true, force: true });

  delete process.env.MI_TEST_TODAY;
  delete process.env.MI_PERSONAL_OS_DIR;
  fs.rmSync(root, { recursive: true, force: true });
  console.log('[weekly-review] PASS');
}

run().catch(err => { console.error('[weekly-review] FAIL:', err); process.exit(1); });
