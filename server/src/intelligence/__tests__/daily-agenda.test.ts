import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PersonalOsStore } from '../../personal-os/store';
import { TaskStore } from '../../task-runtime/store';
import { IntelligenceService } from '../service';
import { IntelligenceStore } from '../store';
import { GoogleReadClient } from '../google-read-client';
import { createFixtureTransport } from '../transports';
import { computeFocusWindows } from '../analysis';
import { AGENDA_DATE, OWNER_EMAIL, baseFixtures, calendarEvent } from '../fixtures';

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mi-agenda-'));
}

function buildService(root: string, status: 'READY' | 'NOT_CONFIGURED' = 'READY', fixtures = baseFixtures()) {
  process.env.MI_PERSONAL_OS_DIR = path.join(root, 'personal');
  const personal = new PersonalOsStore(path.join(root, 'personal'));
  const tasks = new TaskStore(path.join(root, 'tasks'));
  const store = new IntelligenceStore(path.join(root, 'personal'));
  const capabilities = new GoogleReadClient(createFixtureTransport(fixtures), { status, grantedScopes: [], detail: 'test' });
  return new IntelligenceService({
    capabilities, personal, tasks, store, registry: null as never,
    ownerAddresses: [OWNER_EMAIL], timezone: 'UTC',
  });
}

async function run() {
  const root = tmp();
  process.env.MI_TEST_TODAY = AGENDA_DATE;
  const service = buildService(root);

  const goal = service.personal.createGoal({ title: 'Ship Mi Core deployment validation', projectIds: [] });
  const agenda = await service.generateDailyAgenda(AGENDA_DATE);

  // --- facts, suggestions and unknowns stay separate -------------------------
  assert.ok(agenda.facts.length > 0, 'agenda states facts');
  assert.ok(agenda.suggestions.length > 0, 'agenda states suggestions');
  assert.ok(Array.isArray(agenda.unknowns), 'agenda carries an unknowns list');
  assert.ok(agenda.facts.every(f => !/^suggest/i.test(f)), 'suggestions do not leak into facts');
  assert.strictEqual(agenda.version, 1);
  assert.strictEqual(agenda.timezone, 'UTC');

  // --- calendar handling -----------------------------------------------------
  assert.ok(agenda.meetings.some(m => m.eventId === 'evt-standup'), 'confirmed meeting present');
  assert.ok(agenda.meetings.some(m => m.eventId === 'evt-review' && m.status === 'TENTATIVE'), 'tentative event kept and labelled');
  assert.ok(!agenda.meetings.some(m => m.eventId === 'evt-cancelled'), 'cancelled event excluded from meetings');
  assert.ok(agenda.facts.some(f => /cancelled/i.test(f)), 'cancellation is reported as a fact, not silently dropped');
  assert.ok(agenda.meetings.some(m => m.eventId === 'evt-allday' && m.allDay), 'all-day event recognised');
  assert.ok(agenda.meetings.some(m => m.recurrence.length > 0), 'recurrence preserved');
  const privateEvent = agenda.meetings.find(m => m.eventId === 'evt-private');
  assert.ok(privateEvent && privateEvent.visibility === 'private' && privateEvent.sensitivity === 'PRIVATE',
    'private event is marked private');
  assert.ok(agenda.meetings.every(m => Boolean(m.timezone)), 'every meeting carries a timezone');
  assert.ok(agenda.activeGoals.some(g => g.id === goal.id), 'active goals included');

  // --- focus windows are arithmetic over free/busy, with overlaps merged -----
  assert.ok(agenda.availableFocusWindows.length > 0, 'focus windows proposed');
  assert.ok(agenda.availableFocusWindows.every(w => w.label === 'suggestion'), 'focus windows are labelled suggestions');
  assert.ok(agenda.availableFocusWindows.every(w => w.minutes >= 45), 'short gaps are not offered as focus time');
  const overlapping = computeFocusWindows({
    busy: [
      { calendarId: 'primary', start: `${AGENDA_DATE}T09:00:00Z`, end: `${AGENDA_DATE}T11:00:00Z` },
      { calendarId: 'primary', start: `${AGENDA_DATE}T10:00:00Z`, end: `${AGENDA_DATE}T12:00:00Z` },
    ],
    dayStart: `${AGENDA_DATE}T09:00:00Z`, dayEnd: `${AGENDA_DATE}T13:00:00Z`,
  });
  assert.strictEqual(overlapping.length, 1, 'overlapping meetings merge into one busy block');
  assert.strictEqual(overlapping[0].minutes, 60, 'the free window after the merged block is exactly one hour');

  // --- generation is idempotent per date ------------------------------------
  const again = await service.generateDailyAgenda(AGENDA_DATE);
  assert.strictEqual(again.id, agenda.id, 'regenerating the same date returns the stored agenda');
  assert.strictEqual(service.store.listFollowUps(50).length, agenda.followUps.length,
    'idempotent regeneration does not duplicate follow-ups');

  // --- evidence references never contain raw ids or addresses ---------------
  assert.ok(agenda.evidenceReferences.length > 0, 'evidence references recorded');
  assert.ok(agenda.evidenceReferences.every(r => /^(email|calendar):[0-9a-f]{16}$/.test(r)),
    'evidence references are opaque digests');
  assert.ok(!JSON.stringify(agenda.evidenceReferences).includes(OWNER_EMAIL), 'no address in evidence references');

  // --- restart persistence ---------------------------------------------------
  const integrityBefore = service.store.integrity();
  assert.strictEqual(integrityBefore.integrityCheck, 'ok');
  assert.deepStrictEqual(integrityBefore.foreignKeyViolations, []);
  assert.ok(integrityBefore.schemaVersion >= 3, 'Phase 5C migration recorded');
  service.close();

  const restarted = buildService(root);
  const recovered = restarted.store.getAgendaByDate(AGENDA_DATE);
  assert.ok(recovered, 'agenda survives restart');
  assert.strictEqual(recovered!.id, agenda.id);
  assert.deepStrictEqual(recovered!.evidenceReferences, agenda.evidenceReferences, 'evidence survives restart');
  restarted.close();

  // --- a missing connector is reported, never fabricated ---------------------
  const offlineRoot = tmp();
  const offline = buildService(offlineRoot, 'NOT_CONFIGURED', baseFixtures());
  const offlineAgenda = await offline.generateDailyAgenda(AGENDA_DATE);
  assert.strictEqual(offlineAgenda.meetings.length, 0, 'no meetings are invented without a connector');
  assert.ok(offlineAgenda.unknowns.some(u => /NOT_CONFIGURED/.test(u)),
    'the missing connector is stated as an unknown');
  assert.ok(offlineAgenda.facts.some(f => /0 meeting/.test(f)), 'the fact reports zero, not a guess');
  offline.close();
  fs.rmSync(offlineRoot, { recursive: true, force: true });

  // --- an event without a timezone is flagged --------------------------------
  const tzRoot = tmp();
  const noTz = baseFixtures();
  noTz.events.primary = [calendarEvent({
    id: 'evt-notz', summary: 'No timezone', start: `${AGENDA_DATE}T10:00:00Z`, end: `${AGENDA_DATE}T10:30:00Z`,
  })];
  const tzService = buildService(tzRoot, 'READY', noTz);
  const tzAgenda = await tzService.generateDailyAgenda(AGENDA_DATE);
  assert.ok(tzAgenda.meetings[0].timezone, 'a fallback timezone is applied rather than left blank');
  tzService.close();
  fs.rmSync(tzRoot, { recursive: true, force: true });

  delete process.env.MI_TEST_TODAY;
  delete process.env.MI_PERSONAL_OS_DIR;
  fs.rmSync(root, { recursive: true, force: true });
  console.log('[daily-agenda] PASS');
}

run().catch(err => { console.error('[daily-agenda] FAIL:', err); process.exit(1); });
