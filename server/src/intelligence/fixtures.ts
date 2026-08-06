/**
 * Deterministic Gmail/Calendar fixtures. Shared by tests and fixture acceptance so both
 * exercise the same code path the live transport uses.
 */

import type { FixtureData } from './transports';

function b64(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

export function gmailMessage(input: {
  id: string; threadId: string; from: string; to: string[]; subject: string;
  body: string; receivedAt: string; labels?: string[]; html?: boolean;
  attachments?: Array<{ filename: string; mimeType: string; size: number }>;
}): Record<string, unknown> {
  const parts: unknown[] = [{
    mimeType: input.html ? 'text/html' : 'text/plain',
    body: { data: b64(input.body), size: input.body.length },
  }];
  for (const a of input.attachments || []) {
    parts.push({ filename: a.filename, mimeType: a.mimeType, body: { size: a.size } });
  }
  return {
    id: input.id,
    threadId: input.threadId,
    internalDate: String(Date.parse(input.receivedAt)),
    labelIds: input.labels || ['INBOX'],
    payload: {
      headers: [
        { name: 'From', value: input.from },
        { name: 'To', value: input.to.join(', ') },
        { name: 'Subject', value: input.subject },
      ],
      parts,
    },
  };
}

export function calendarEvent(input: {
  id: string; summary: string; start: string; end: string; timeZone?: string;
  allDay?: boolean; status?: string; description?: string; location?: string;
  attendees?: Array<{ email: string; responseStatus?: string; organizer?: boolean }>;
  recurrence?: string[]; recurringEventId?: string; visibility?: string;
}): Record<string, unknown> {
  const startKey = input.allDay ? 'date' : 'dateTime';
  return {
    id: input.id,
    summary: input.summary,
    status: input.status || 'confirmed',
    description: input.description || '',
    location: input.location,
    start: { [startKey]: input.start, timeZone: input.timeZone },
    end: { [startKey]: input.end, timeZone: input.timeZone },
    attendees: input.attendees,
    recurrence: input.recurrence,
    recurringEventId: input.recurringEventId,
    visibility: input.visibility,
    updated: '2026-08-05T00:00:00.000Z',
    organizer: { email: 'organiser@example.com' },
  };
}

export const OWNER_EMAIL = 'owner@example.com';
export const AGENDA_DATE = '2026-08-05';

/** A realistic day: two meetings, a cancelled one, an all-day item, and real free/busy. */
export function baseFixtures(): FixtureData {
  const standup = calendarEvent({
    id: 'evt-standup', summary: 'Mi Core standup', start: `${AGENDA_DATE}T09:00:00Z`, end: `${AGENDA_DATE}T09:30:00Z`,
    timeZone: 'UTC', description: 'Please prepare the deployment agenda before we start.',
    attendees: [{ email: OWNER_EMAIL, responseStatus: 'accepted' }, { email: 'organiser@example.com', organizer: true }],
    recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR'],
  });
  const review = calendarEvent({
    id: 'evt-review', summary: 'Healthy-LD review', start: `${AGENDA_DATE}T14:00:00Z`, end: `${AGENDA_DATE}T15:00:00Z`,
    timeZone: 'UTC', attendees: [{ email: OWNER_EMAIL, responseStatus: 'tentative' }], status: 'tentative',
  });
  const cancelled = calendarEvent({
    id: 'evt-cancelled', summary: 'Cancelled sync', start: `${AGENDA_DATE}T11:00:00Z`, end: `${AGENDA_DATE}T11:30:00Z`,
    timeZone: 'UTC', status: 'cancelled',
  });
  const allDay = calendarEvent({
    id: 'evt-allday', summary: 'Quarter close', start: AGENDA_DATE, end: AGENDA_DATE, allDay: true,
  });
  const privateEvent = calendarEvent({
    id: 'evt-private', summary: 'Personal appointment', start: `${AGENDA_DATE}T17:00:00Z`, end: `${AGENDA_DATE}T18:00:00Z`,
    timeZone: 'UTC', visibility: 'private', description: 'Private note.',
  });

  const requestEmail = gmailMessage({
    id: 'msg-request', threadId: 'thr-1', from: 'client@partner.example',
    to: [OWNER_EMAIL], subject: 'Mi Core deployment sign-off',
    body: 'Hi — could you please confirm the release notes by 2026-08-07? We need them for the audit.',
    receivedAt: `${AGENDA_DATE}T08:00:00Z`,
  });
  const commitmentEmail = gmailMessage({
    id: 'msg-commit', threadId: 'thr-2', from: OWNER_EMAIL,
    to: ['client@partner.example'], subject: 'Re: Healthy-LD rollout',
    body: "Thanks for the summary. I'll send the updated rollout plan tomorrow.",
    receivedAt: `${AGENDA_DATE}T08:30:00Z`,
  });
  const newsletter = gmailMessage({
    id: 'msg-news', threadId: 'thr-3', from: 'news@marketing.example',
    to: [OWNER_EMAIL], subject: 'Weekly product digest',
    body: 'Lots of exciting updates this week. Read more on our blog.',
    receivedAt: `${AGENDA_DATE}T07:00:00Z`, labels: ['CATEGORY_PROMOTIONS'],
  });

  return {
    messages: { 'msg-request': requestEmail, 'msg-commit': commitmentEmail, 'msg-news': newsletter },
    threads: { 'thr-1': { messages: [requestEmail] } },
    messageList: [{ id: 'msg-request' }, { id: 'msg-commit' }, { id: 'msg-news' }],
    threadList: [{ id: 'thr-1', snippet: 'Mi Core deployment sign-off' }],
    labels: ['INBOX', 'SENT', 'CATEGORY_PROMOTIONS'],
    calendars: [{ id: 'primary', summary: 'Owner calendar', timeZone: 'UTC' }],
    events: { primary: [standup, review, cancelled, allDay, privateEvent] },
    busy: {
      primary: [
        { start: `${AGENDA_DATE}T09:00:00Z`, end: `${AGENDA_DATE}T09:30:00Z` },
        { start: `${AGENDA_DATE}T14:00:00Z`, end: `${AGENDA_DATE}T15:00:00Z` },
        // Overlapping double-booking must not invent free time between the two.
        { start: `${AGENDA_DATE}T14:30:00Z`, end: `${AGENDA_DATE}T15:30:00Z` },
      ],
    },
    people: { [OWNER_EMAIL]: { names: [{ displayName: 'Owner' }] } },
  };
}
