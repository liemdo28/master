import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { detectFollowUps, linkToProjects } from '../analysis';
import { IntelligenceStore } from '../store';
import { GoogleReadClient } from '../google-read-client';
import { createFixtureTransport } from '../transports';
import { AGENDA_DATE, OWNER_EMAIL, baseFixtures, calendarEvent, gmailMessage } from '../fixtures';

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mi-followups-'));
}

const PROJECTS = [
  { id: 'mi-core', displayName: 'Mi Core', confirmedDomains: ['partner.example'], tags: ['mi-core'] },
  { id: 'healthy-ld', displayName: 'Healthy LD', tags: ['healthy-ld'] },
];
const GOALS = [{ id: 'goal-11111111-2222-3333-4444-555555555555', title: 'Ship deployment validation', projectIds: ['mi-core'] }];

async function run() {
  const root = tmp();

  // --- linking is evidence-based --------------------------------------------
  const exact = linkToProjects('Please review the Mi Core release notes', null, PROJECTS, GOALS);
  assert.strictEqual(exact.confidence, 'CONFIRMED', 'an exact project name confirms the link');
  assert.deepStrictEqual(exact.projectIds, ['mi-core']);

  const byDomain = linkToProjects('Any update on the rollout?', 'Client <client@partner.example>', PROJECTS, GOALS);
  assert.strictEqual(byDomain.confidence, 'CONFIRMED', 'a confirmed sender domain confirms the link');

  const byGoalId = linkToProjects(`Progress on ${GOALS[0].id}?`, null, PROJECTS, GOALS);
  assert.strictEqual(byGoalId.confidence, 'CONFIRMED');
  assert.deepStrictEqual(byGoalId.goalIds, [GOALS[0].id]);

  const weak = linkToProjects('The healthy option core team met today', null, PROJECTS, GOALS);
  assert.strictEqual(weak.confidence, 'UNCERTAIN', 'weak token overlap must not confirm');
  assert.ok(weak.reasons[0].includes('needs confirmation'));

  const none = linkToProjects('Lunch is at noon', null, PROJECTS, GOALS);
  assert.strictEqual(none.confidence, 'NONE');

  // Cross-project leakage: a Healthy LD message must never carry mi-core.
  const other = linkToProjects('Healthy LD rollout question', null, PROJECTS, GOALS);
  assert.deepStrictEqual(other.projectIds, ['healthy-ld'], 'no cross-project bleed');

  // --- follow-up detection is bounded ---------------------------------------
  const client = new GoogleReadClient(createFixtureTransport(baseFixtures()), { status: 'READY', grantedScopes: [], detail: 't' });
  const emails = await client.gmailSearch({ query: 'x', maxResults: 10 });
  const events = await client.calendarListEvents({ timeMin: `${AGENDA_DATE}T00:00:00Z`, timeMax: `${AGENDA_DATE}T23:59:59Z` });
  const candidates = detectFollowUps({ emails, events, ownerAddresses: [OWNER_EMAIL], now: new Date().toISOString() });

  assert.ok(candidates.some(c => c.kind === 'DIRECT_REQUEST'), 'an explicit request is detected');
  assert.ok(candidates.some(c => c.kind === 'EXPLICIT_DEADLINE' && c.dueAt === '2026-08-07'), 'an explicit date is captured');
  assert.ok(candidates.some(c => c.kind === 'USER_COMMITMENT'), "the owner's own commitment is detected");
  assert.ok(candidates.some(c => c.kind === 'MEETING_PREPARATION'), 'a meeting asking for preparation is detected');
  assert.ok(!candidates.some(c => c.sourceId === 'msg-news'),
    'a marketing newsletter produces no follow-up');

  // Every candidate carries its provenance and stays a suggestion.
  for (const candidate of candidates) {
    assert.ok(candidate.sourceId, 'candidate names its source');
    assert.ok(candidate.reason.length > 10, 'candidate explains why');
    assert.ok(candidate.confidence > 0 && candidate.confidence <= 1, 'confidence is bounded');
    assert.ok(candidate.evidenceReference.startsWith('email:') || candidate.evidenceReference.startsWith('calendar:'));
    assert.strictEqual(candidate.status, 'SUGGESTION', 'no candidate is ever executable');
  }

  // An ambiguous message yields nothing rather than a guess.
  const vague = await new GoogleReadClient(createFixtureTransport({
    messages: {
      'msg-vague': gmailMessage({
        id: 'msg-vague', threadId: 't', from: 'someone@example.com', to: [OWNER_EMAIL],
        subject: 'FYI', body: 'Sharing this for your awareness. No action needed.',
        receivedAt: `${AGENDA_DATE}T08:00:00Z`,
      }),
    },
    messageList: [{ id: 'msg-vague' }],
  }), { status: 'READY', grantedScopes: [], detail: 't' }).gmailSearch({ query: 'x' });
  assert.strictEqual(
    detectFollowUps({ emails: vague, events: [], ownerAddresses: [OWNER_EMAIL], now: new Date().toISOString() }).length,
    0,
    'an ambiguous informational message produces no follow-up');

  // A cancelled meeting never generates preparation work.
  const cancelledPrep = detectFollowUps({
    emails: [],
    events: [{
      ...events[0],
      eventId: 'evt-cancelled-prep', status: 'CANCELLED',
      title: 'Prepare the agenda', descriptionSummary: 'Please prepare the agenda',
    }],
    ownerAddresses: [OWNER_EMAIL], now: new Date().toISOString(),
  });
  assert.strictEqual(cancelledPrep.length, 0, 'a cancelled meeting produces no preparation follow-up');

  // --- uncertain links never travel into a candidate ------------------------
  const uncertain = detectFollowUps({
    emails: [{ ...emails[0], projectIds: ['mi-core'], linkConfidence: 'UNCERTAIN' }],
    events: [], ownerAddresses: [OWNER_EMAIL], now: new Date().toISOString(),
  });
  assert.ok(uncertain.every(c => c.projectIds.length === 0),
    'an uncertain project link is dropped rather than carried into a follow-up');
  assert.ok(uncertain.every(c => c.linkConfidence === 'UNCERTAIN'), 'the uncertainty itself is preserved');

  // --- persistence is idempotent --------------------------------------------
  const store = new IntelligenceStore(path.join(root, 'personal'));
  const first = store.saveFollowUps(candidates);
  const second = store.saveFollowUps(candidates);
  assert.strictEqual(first.length, second.length);
  assert.deepStrictEqual(first.map(c => c.id).sort(), second.map(c => c.id).sort(),
    're-detecting the same follow-ups returns the stored rows, not duplicates');
  assert.strictEqual(store.listFollowUps(100).length, first.length, 'no duplicate rows are created');

  // A non-suggestion status is refused outright.
  assert.throws(() => store.saveFollowUps([{ ...candidates[0], status: 'RUNNING' as never }]),
    /SUGGESTION or WAITING_APPROVAL/, 'a runnable status is rejected');

  // Disconnecting a connector removes its derived output.
  const removed = store.purgeConnector('gmail');
  assert.ok(removed > 0, 'purging gmail removes its follow-ups');
  assert.ok(store.listFollowUps(100).every(c => c.sourceType !== 'EMAIL'), 'no email follow-ups remain');
  store.close();

  fs.rmSync(root, { recursive: true, force: true });
  console.log('[follow-ups] PASS');
}

run().catch(err => { console.error('[follow-ups] FAIL:', err); process.exit(1); });
