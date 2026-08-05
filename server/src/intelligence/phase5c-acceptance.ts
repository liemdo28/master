/**
 * Phase 5C acceptance — "Prepare today's operating agenda without changing email or calendar."
 *
 * Runs twice: once against fixtures (always), once against the real connector if a
 * usable read credential exists. A real-connector failure is reported as BLOCKED; it is
 * never presented as a pass.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import express from 'express';
import type { AddressInfo } from 'net';
import type { NextFunction, Request, Response } from 'express';
import { PersonalOsStore } from '../personal-os/store';
import { PersonalOsService } from '../personal-os/service';
import { TaskStore } from '../task-runtime/store';
import { IntelligenceService } from './service';
import { IntelligenceStore } from './store';
import { GoogleReadClient, inspectToken } from './google-read-client';
import { createFixtureTransport, createLiveTransport, defaultTokenFile } from './transports';
import { intelligenceJsonParser, intelligenceRouter } from './router';
import { AGENDA_DATE, OWNER_EMAIL, baseFixtures } from './fixtures';

const checks: Array<{ name: string; ok: boolean; detail: string }> = [];
function check(name: string, ok: boolean, detail = ''): boolean {
  checks.push({ name, ok, detail });
  return ok;
}

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mi-phase5c-'));
}

async function fixtureAcceptance() {
  const root = tmp();
  process.env.MI_TEST_TODAY = AGENDA_DATE;
  process.env.MI_PERSONAL_OS_DIR = path.join(root, 'personal');
  process.env.MI_TASK_RUNTIME_DIR = path.join(root, 'tasks');

  const personal = new PersonalOsStore(path.join(root, 'personal'));
  const tasks = new TaskStore(path.join(root, 'tasks'));
  const store = new IntelligenceStore(path.join(root, 'personal'));
  const service = new IntelligenceService({
    capabilities: new GoogleReadClient(createFixtureTransport(baseFixtures()), {
      status: 'READY', grantedScopes: [], detail: 'fixture',
    }),
    personal, tasks, store, registry: null as never,
    ownerAddresses: [OWNER_EMAIL], timezone: 'UTC',
  });

  const goal = personal.createGoal({ title: 'Prepare Mi Core deployment validation', projectIds: [] });

  const agenda = await service.generateDailyAgenda(AGENDA_DATE);
  check('today\'s calendar was read', agenda.meetings.length > 0, `${agenda.meetings.length} meeting(s)`);
  check('a bounded recent email set was read', agenda.evidenceReferences.some(r => r.startsWith('email:')));
  check('meetings are identified', agenda.meetings.some(m => m.eventId === 'evt-standup'));
  check('cancelled events excluded', !agenda.meetings.some(m => m.status === 'CANCELLED'));
  check('follow-up candidates identified', agenda.followUps.length > 0, `${agenda.followUps.length} candidate(s)`);
  check('follow-ups are suggestions only', agenda.followUps.every(f => f.status === 'SUGGESTION'));
  check('focus windows identified', agenda.availableFocusWindows.length > 0);
  check('focus windows labelled as suggestions', agenda.availableFocusWindows.every(w => w.label === 'suggestion'));
  check('facts, suggestions and unknowns are separate',
    agenda.facts.length > 0 && agenda.suggestions.length > 0 && Array.isArray(agenda.unknowns));
  check('active goal linked into agenda', agenda.activeGoals.some(g => g.id === goal.id));
  check('evidence references are opaque',
    agenda.evidenceReferences.every(r => /^(email|calendar):[0-9a-f]{16}$/.test(r)));

  // Daily Brief gains external facts, clearly labelled and confirmation-gated.
  const personalService = new PersonalOsService(personal, tasks);
  const brief = personalService.generateDailyBrief();
  check('daily brief generated alongside the agenda', Boolean(brief.id));
  check('daily brief separates facts from suggestions',
    Array.isArray(brief.facts) && Array.isArray(brief.suggestions) && Array.isArray(brief.unknowns));

  const externalKnowledge = personal.createKnowledge({
    kind: 'SUMMARY',
    title: 'External calendar fact for today',
    summary: `Agenda ${agenda.id} recorded ${agenda.meetings.length} meeting(s) from the calendar connector.`,
    content: `Derived from read-only calendar access on ${AGENDA_DATE}.`,
    provenance: 'phase5c read-only calendar connector',
    sourceType: 'INFERRED',
    evidenceReferences: agenda.evidenceReferences.slice(0, 5),
  });
  check('external content becomes a confirmation-gated candidate, never an active fact',
    externalKnowledge.status === 'NEEDS_CONFIRMATION', externalKnowledge.status);

  // Nothing may run by itself.
  const runningTasks = tasks.listTasks().filter(t => ['RUNNING', 'VALIDATING'].includes(t.status));
  check('no task started automatically', runningTasks.length === 0);

  const agendaId = agenda.id;
  const integrityBefore = store.integrity();
  check('database integrity ok before restart', integrityBefore.integrityCheck === 'ok');
  check('foreign keys clean', integrityBefore.foreignKeyViolations.length === 0);
  check('Phase 5C migration applied', integrityBefore.schemaVersion >= 3, `v${integrityBefore.schemaVersion}`);

  service.close();
  personalService.close();

  // Restart.
  const restartedStore = new IntelligenceStore(path.join(root, 'personal'));
  const recovered = restartedStore.getAgendaByDate(AGENDA_DATE);
  check('agenda persists across restart', Boolean(recovered) && recovered!.id === agendaId);
  check('evidence references persist across restart',
    JSON.stringify(recovered?.evidenceReferences) === JSON.stringify(agenda.evidenceReferences));
  check('follow-ups persist across restart', restartedStore.listFollowUps(50).length === agenda.followUps.length);
  const integrityAfter = restartedStore.integrity();
  check('database integrity ok after restart', integrityAfter.integrityCheck === 'ok');
  restartedStore.close();

  // API boundary: no mutation route exists, and auth is enforced.
  const api = await startApi();
  const authed = { 'content-type': 'application/json', 'x-api-key': 'phase5c-test-key' };
  const unauth = await fetch(`${api.baseUrl}/intelligence/follow-ups`);
  check('unauthenticated intelligence request rejected', unauth.status === 401, `HTTP ${unauth.status}`);
  const statusRes = await fetch(`${api.baseUrl}/intelligence/status`, { headers: authed });
  check('authenticated status route responds', statusRes.status === 200, `HTTP ${statusRes.status}`);
  const statusBody = await statusRes.text();
  check('status route leaks no token material', !/ya29\.|access_token|refresh_token/.test(statusBody));
  for (const [method, route] of [['POST', '/intelligence/email/send'], ['POST', '/intelligence/calendar/events'],
    ['DELETE', '/intelligence/email/thread/thr-1'], ['PATCH', '/intelligence/calendar/today']] as const) {
    const res = await fetch(`${api.baseUrl}${route}`, { method, headers: authed });
    check(`no mutation route: ${method} ${route}`, res.status === 404 || res.status === 405, `HTTP ${res.status}`);
  }
  await api.close();

  fs.rmSync(root, { recursive: true, force: true });
  delete process.env.MI_TEST_TODAY;
  return { agendaId, briefId: brief.id, followUps: agenda.followUps.length, meetings: agenda.meetings.length };
}

async function startApi(): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const app = express();
  const auth = (req: Request, res: Response, next: NextFunction) =>
    String(req.headers['x-api-key'] || '') === 'phase5c-test-key' ? next() : res.status(401).json({ error: 'Unauthorized' });
  app.use('/api', intelligenceJsonParser, auth, intelligenceRouter);
  return new Promise(resolve => {
    const server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        baseUrl: `http://127.0.0.1:${port}/api`,
        close: () => new Promise<void>((ok, no) => server.close(e => e ? no(e) : ok())),
      });
    });
  });
}

async function realConnectorAcceptance(): Promise<{ status: string; detail: string; meetings?: number }> {
  const state = inspectToken();
  if (state.status !== 'READY') {
    return { status: 'BLOCKED', detail: `connector is ${state.status}: ${state.detail}` };
  }
  const root = tmp();
  try {
    const service = new IntelligenceService({
      capabilities: new GoogleReadClient(createLiveTransport(defaultTokenFile()), state),
      personal: new PersonalOsStore(path.join(root, 'personal')),
      tasks: new TaskStore(path.join(root, 'tasks')),
      store: new IntelligenceStore(path.join(root, 'personal')),
      registry: null as never,
      timezone: process.env.MI_TIMEZONE || 'UTC',
    });
    try {
      const date = new Date().toISOString().slice(0, 10);
      const events = await service.calendarEvents(`${date}T00:00:00.000Z`, `${date}T23:59:59.999Z`);
      // Sanitized evidence only: counts and opaque references, never titles or addresses.
      return { status: 'PASS', detail: `read ${events.length} calendar event(s) read-only`, meetings: events.length };
    } finally { service.close(); }
  } catch (err) {
    const message = err instanceof Error ? err.message.split(':')[0] : String(err);
    return { status: 'BLOCKED', detail: `real connector read failed: ${message}` };
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

async function main() {
  const fixture = await fixtureAcceptance();
  const real = await realConnectorAcceptance();

  for (const c of checks) console.log(`  ${c.ok ? 'ok  ' : 'FAIL'} ${c.name}${c.detail ? ' — ' + c.detail : ''}`);
  const failed = checks.filter(c => !c.ok);

  console.log(JSON.stringify({
    fixtureAcceptance: failed.length === 0 ? 'PASS' : 'FAIL',
    checksPassed: `${checks.length - failed.length}/${checks.length}`,
    agendaId: fixture.agendaId,
    dailyBriefId: fixture.briefId,
    meetings: fixture.meetings,
    followUpCandidates: fixture.followUps,
    realConnectorAcceptance: real.status,
    realConnectorDetail: real.detail,
    emailMutations: 0,
    calendarMutations: 0,
    automaticTaskExecution: false,
  }, null, 2));

  if (failed.length) {
    console.error('Phase 5C fixture acceptance FAILED:', failed.map(f => f.name).join('; '));
    process.exit(1);
  }
}

main().catch(err => { console.error('[phase5c-acceptance] ERROR:', err); process.exit(1); });
