/**
 * Phase 5C CLI surface. Read-only by construction — there is no subcommand that can
 * send, draft, RSVP, label, archive or delete anything.
 */

import { IntelligenceService, today, weekStartOf } from './service';
import { GoogleReadClient, inspectToken } from './google-read-client';
import { createFixtureTransport, createLiveTransport, defaultTokenFile } from './transports';

function buildService(): IntelligenceService {
  const tokenState = inspectToken();
  const transport = tokenState.status === 'READY'
    ? createLiveTransport(defaultTokenFile())
    : createFixtureTransport({});
  return new IntelligenceService({ capabilities: new GoogleReadClient(transport, tokenState) });
}

export async function runIntelligenceCli(cmd: string, args: string[]): Promise<unknown> {
  const service = buildService();
  try {
    const status = await service.connectorStatus();

    if (cmd === 'calendar') {
      const date = today();
      if (args[0] === 'week') {
        const start = weekStartOf(date);
        const end = new Date(`${start}T00:00:00Z`);
        end.setUTCDate(end.getUTCDate() + 7);
        return { connector: status, weekStart: start, events: await service.calendarEvents(`${start}T00:00:00.000Z`, end.toISOString()) };
      }
      return { connector: status, date, events: await service.calendarEvents(`${date}T00:00:00.000Z`, `${date}T23:59:59.999Z`) };
    }

    if (cmd === 'email') {
      if (args[0] === 'thread') return { connector: status, messages: await service.emailThread(args[1] || '') };
      if (args[0] === 'search') return { connector: status, results: await service.searchEmail(args.slice(1).join(' '), 10) };
      return { connector: status, usage: 'email search "<query>" | email thread "<id>"' };
    }

    if (cmd === 'agenda') return await service.generateDailyAgenda();
    if (cmd === 'weekly-review') return await service.generateWeeklyReview();
    if (cmd === 'follow-ups') return { connector: status, followUps: service.listFollowUps() };

    return { usage: 'calendar today|week, email search|thread, agenda, weekly-review, follow-ups' };
  } finally {
    service.close();
  }
}
