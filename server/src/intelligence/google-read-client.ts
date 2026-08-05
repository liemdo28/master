/**
 * Phase 5C read-only Google boundary.
 *
 * The existing actions/gmail-action-adapter.ts and actions/google-executor.ts can send
 * mail and write calendar events. Neither is imported here, and nothing in this module
 * re-exports a raw Google client, so no Phase 5C caller has a mutation method in reach.
 *
 * The stored OAuth token is over-privileged — it carries gmail.send, gmail.compose and
 * calendar.events alongside the read scopes — so read-only cannot be assumed from the
 * credential. It is enforced here, in code: a fixed allowlist of read endpoints, a
 * runtime assertion that no forbidden method is exposed, and a scope check that reports
 * INSUFFICIENT_SCOPE rather than silently doing less.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  FORBIDDEN_CAPABILITY_METHODS,
  type BusyInterval, type CalendarEventContext, type CalendarRangeInput, type ConnectorStatus,
  type EmailContext, type GmailSearchInput, type GoogleReadCapabilities,
} from './types';
import {
  MAX_ATTACHMENTS, evidenceReference, isDangerousAttachment, sanitiseExternalText, sanitiseSubject,
} from './sanitize';

export const REQUIRED_READ_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
] as const;

/** Endpoints Phase 5C is permitted to call. Anything else is refused before dispatch. */
export const ALLOWED_ENDPOINTS = new Set([
  'gmail.users.messages.list',
  'gmail.users.messages.get',
  'gmail.users.threads.list',
  'gmail.users.threads.get',
  'gmail.users.labels.list',
  'calendar.calendarList.list',
  'calendar.events.list',
  'calendar.events.get',
  'calendar.freebusy.query',
  'people.people.get',
]);

export const MAX_GMAIL_RESULTS = 25;
export const MAX_CALENDAR_RESULTS = 100;
export const MAX_THREAD_DEPTH = 20;

function tokenPath(): string {
  const globalDir = process.env.MI_INTELLIGENCE_TOKEN_DIR
    || process.env.GLOBAL_DIR
    || path.resolve(process.cwd(), '.local-agent-global');
  return path.join(globalDir, 'visibility', 'google-tokens.json');
}

export interface StoredToken {
  access_token?: string;
  refresh_token?: string;
  scope?: string;
  expiry_date?: number;
}

export interface TokenState {
  status: ConnectorStatus;
  grantedScopes: string[];
  /** Never includes token values. */
  detail: string;
}

export function inspectToken(): TokenState {
  const file = tokenPath();
  if (!fs.existsSync(file)) {
    return { status: 'NOT_CONFIGURED', grantedScopes: [], detail: 'no Google token file present' };
  }
  let token: StoredToken;
  try {
    token = JSON.parse(fs.readFileSync(file, 'utf8')) as StoredToken;
  } catch {
    return { status: 'NOT_CONFIGURED', grantedScopes: [], detail: 'token file is not readable JSON' };
  }
  const grantedScopes = (token.scope || '').split(/\s+/).filter(Boolean);
  const missing = REQUIRED_READ_SCOPES.filter(s => !grantedScopes.includes(s));
  if (missing.length) {
    return { status: 'INSUFFICIENT_SCOPE', grantedScopes, detail: `missing read scopes: ${missing.join(', ')}` };
  }
  if (!token.access_token && !token.refresh_token) {
    return { status: 'NOT_CONFIGURED', grantedScopes, detail: 'token file has no usable credential' };
  }
  if (token.expiry_date && token.expiry_date < Date.now() && !token.refresh_token) {
    return { status: 'TOKEN_EXPIRED', grantedScopes, detail: 'access token expired and no refresh token' };
  }
  return { status: 'READY', grantedScopes, detail: 'read scopes present' };
}

/**
 * Raw provider access, narrowed to reads. A fixture transport implements the same
 * shape, so every test exercises the real capability surface.
 */
export interface GoogleReadTransport {
  call(endpoint: string, params: Record<string, unknown>): Promise<unknown>;
}

export class EndpointNotAllowedError extends Error {
  constructor(endpoint: string) {
    super(`endpoint not permitted in read-only intelligence: ${endpoint}`);
    this.name = 'EndpointNotAllowedError';
  }
}

/** Wraps any transport so a non-allowlisted endpoint cannot be dispatched. */
export function guardTransport(inner: GoogleReadTransport): GoogleReadTransport {
  return {
    async call(endpoint, params) {
      if (!ALLOWED_ENDPOINTS.has(endpoint)) throw new EndpointNotAllowedError(endpoint);
      return inner.call(endpoint, params);
    },
  };
}

function headerValue(headers: Array<{ name?: string; value?: string }> | undefined, name: string): string {
  const hit = (headers || []).find(h => (h.name || '').toLowerCase() === name.toLowerCase());
  return hit?.value || '';
}

function addressList(value: string): string[] {
  return value.split(',').map(v => v.trim()).filter(Boolean).slice(0, 25);
}

function decodeBody(payload: any): string {
  if (!payload) return '';
  if (payload.body?.data) {
    try { return Buffer.from(String(payload.body.data), 'base64url').toString('utf8'); } catch { return ''; }
  }
  const parts: any[] = payload.parts || [];
  // Prefer text/plain; HTML is sanitised anyway but plain text loses less meaning.
  const plain = parts.find(p => p.mimeType === 'text/plain');
  const html = parts.find(p => p.mimeType === 'text/html');
  const chosen = plain || html || parts[0];
  return chosen ? decodeBody(chosen) : '';
}

function collectAttachments(payload: any): EmailContext['attachmentMetadata'] {
  const out: EmailContext['attachmentMetadata'] = [];
  const walk = (node: any) => {
    if (!node || out.length >= MAX_ATTACHMENTS) return;
    if (node.filename) {
      out.push({
        filename: sanitiseSubject(node.filename).slice(0, 200),
        mimeType: String(node.mimeType || 'application/octet-stream'),
        sizeBytes: Number(node.body?.size || 0),
        downloaded: false,
      });
    }
    for (const child of node.parts || []) walk(child);
  };
  walk(payload);
  return out;
}

export function toEmailContext(message: any): EmailContext {
  const headers = message?.payload?.headers as Array<{ name?: string; value?: string }> | undefined;
  const body = sanitiseExternalText(decodeBody(message?.payload));
  const subject = sanitiseSubject(headerValue(headers, 'Subject'));
  const attachments = collectAttachments(message?.payload);
  const receivedAt = message?.internalDate
    ? new Date(Number(message.internalDate)).toISOString()
    : new Date(0).toISOString();
  return {
    messageId: String(message?.id || ''),
    threadId: String(message?.threadId || ''),
    from: headerValue(headers, 'From').slice(0, 320),
    to: addressList(headerValue(headers, 'To')),
    cc: addressList(headerValue(headers, 'Cc')),
    subject,
    receivedAt,
    labels: Array.isArray(message?.labelIds) ? message.labelIds.map(String).slice(0, 25) : [],
    bodySummary: body.text,
    attachmentMetadata: attachments,
    projectIds: [],
    goalIds: [],
    linkConfidence: 'NONE',
    actionCandidates: attachments.some(a => isDangerousAttachment(a.filename))
      ? ['attachment-type-blocked-from-review']
      : [],
    sensitivity: body.sensitivity,
    evidenceReference: evidenceReference('email', String(message?.id || '')),
  };
}

export function toCalendarEventContext(event: any, calendarId: string, fallbackTz: string): CalendarEventContext {
  const allDay = Boolean(event?.start?.date && !event?.start?.dateTime);
  const timezone = event?.start?.timeZone || fallbackTz || 'UTC';
  const description = sanitiseExternalText(String(event?.description || ''));
  const rawStatus = String(event?.status || 'confirmed').toUpperCase();
  const status = rawStatus === 'CANCELLED' ? 'CANCELLED' : rawStatus === 'TENTATIVE' ? 'TENTATIVE' : 'CONFIRMED';
  const attendees = (event?.attendees || []).slice(0, 50).map((a: any) => ({
    email: String(a.email || ''),
    displayName: a.displayName ? sanitiseSubject(String(a.displayName)) : null,
    responseStatus: String(a.responseStatus || 'needsAction'),
    organizer: Boolean(a.organizer),
  }));
  return {
    eventId: String(event?.id || ''),
    calendarId,
    title: sanitiseSubject(String(event?.summary || '(no title)')),
    start: String(event?.start?.dateTime || event?.start?.date || ''),
    end: String(event?.end?.dateTime || event?.end?.date || ''),
    timezone,
    allDay,
    attendees,
    organizer: event?.organizer?.email ? String(event.organizer.email) : null,
    location: event?.location ? sanitiseSubject(String(event.location)) : null,
    descriptionSummary: description.text,
    status: status as CalendarEventContext['status'],
    recurrence: Array.isArray(event?.recurrence) ? event.recurrence.map(String).slice(0, 10) : [],
    recurringEventId: event?.recurringEventId ? String(event.recurringEventId) : null,
    visibility: event?.visibility === 'private' ? 'private' : event?.visibility === 'public' ? 'public' : 'default',
    projectIds: [],
    goalIds: [],
    linkConfidence: 'NONE',
    sourceTimestamp: String(event?.updated || event?.created || ''),
    sensitivity: event?.visibility === 'private' ? 'PRIVATE' : description.sensitivity,
    evidenceReference: evidenceReference('calendar', String(event?.id || '')),
  };
}

export class GoogleReadClient implements GoogleReadCapabilities {
  private readonly transport: GoogleReadTransport;

  constructor(transport: GoogleReadTransport, private readonly tokenState: TokenState = inspectToken()) {
    this.transport = guardTransport(transport);
    assertNoWriteCapability(this);
  }

  async status(): Promise<ConnectorStatus> {
    return this.tokenState.status;
  }

  grantedScopes(): string[] {
    return [...this.tokenState.grantedScopes];
  }

  async gmailSearch(input: GmailSearchInput): Promise<EmailContext[]> {
    const maxResults = Math.max(1, Math.min(MAX_GMAIL_RESULTS, input.maxResults ?? 10));
    const listed = await this.transport.call('gmail.users.messages.list', {
      userId: 'me', q: String(input.query || '').slice(0, 500), maxResults,
      labelIds: input.labelIds?.slice(0, 10),
    }) as { messages?: Array<{ id: string }> };
    const ids = (listed?.messages || []).slice(0, maxResults).map(m => m.id);
    const out: EmailContext[] = [];
    for (const id of ids) {
      const message = await this.transport.call('gmail.users.messages.get', { userId: 'me', id, format: 'full' });
      if (message) out.push(toEmailContext(message));
    }
    return out;
  }

  async gmailListThreads(input: GmailSearchInput): Promise<Array<{ threadId: string; snippet: string }>> {
    const maxResults = Math.max(1, Math.min(MAX_GMAIL_RESULTS, input.maxResults ?? 10));
    const listed = await this.transport.call('gmail.users.threads.list', {
      userId: 'me', q: String(input.query || '').slice(0, 500), maxResults,
    }) as { threads?: Array<{ id: string; snippet?: string }> };
    return (listed?.threads || []).slice(0, maxResults).map(t => ({
      threadId: String(t.id),
      snippet: sanitiseExternalText(String(t.snippet || ''), 300).text,
    }));
  }

  async gmailGetThread(threadId: string): Promise<EmailContext[]> {
    const thread = await this.transport.call('gmail.users.threads.get', {
      userId: 'me', id: String(threadId), format: 'full',
    }) as { messages?: unknown[] };
    return (thread?.messages || []).slice(0, MAX_THREAD_DEPTH).map(toEmailContext)
      // Thread order is chronological; Gmail does not always return it that way.
      .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
  }

  async gmailGetMessage(messageId: string): Promise<EmailContext | null> {
    const message = await this.transport.call('gmail.users.messages.get', {
      userId: 'me', id: String(messageId), format: 'full',
    });
    return message ? toEmailContext(message) : null;
  }

  async gmailListLabels(): Promise<string[]> {
    const res = await this.transport.call('gmail.users.labels.list', { userId: 'me' }) as { labels?: Array<{ name?: string }> };
    return (res?.labels || []).map(l => String(l.name || '')).filter(Boolean).slice(0, 100);
  }

  async calendarListCalendars(): Promise<Array<{ calendarId: string; summary: string; timezone: string }>> {
    const res = await this.transport.call('calendar.calendarList.list', {}) as { items?: any[] };
    return (res?.items || []).slice(0, 50).map(c => ({
      calendarId: String(c.id),
      summary: sanitiseSubject(String(c.summary || '')),
      timezone: String(c.timeZone || 'UTC'),
    }));
  }

  async calendarListEvents(input: CalendarRangeInput): Promise<CalendarEventContext[]> {
    const calendarIds = input.calendarIds?.length ? input.calendarIds.slice(0, 10) : ['primary'];
    const maxResults = Math.max(1, Math.min(MAX_CALENDAR_RESULTS, input.maxResults ?? 50));
    const out: CalendarEventContext[] = [];
    for (const calendarId of calendarIds) {
      const res = await this.transport.call('calendar.events.list', {
        calendarId, timeMin: input.timeMin, timeMax: input.timeMax,
        singleEvents: true, orderBy: 'startTime', maxResults,
        timeZone: input.timezone,
      }) as { items?: any[]; timeZone?: string };
      for (const item of res?.items || []) {
        out.push(toCalendarEventContext(item, calendarId, input.timezone || res?.timeZone || 'UTC'));
      }
    }
    return out.sort((a, b) => a.start.localeCompare(b.start));
  }

  async calendarGetEvent(calendarId: string, eventId: string): Promise<CalendarEventContext | null> {
    const event = await this.transport.call('calendar.events.get', { calendarId, eventId });
    return event ? toCalendarEventContext(event, calendarId, 'UTC') : null;
  }

  async calendarFreeBusy(input: CalendarRangeInput): Promise<BusyInterval[]> {
    const calendarIds = input.calendarIds?.length ? input.calendarIds.slice(0, 10) : ['primary'];
    const res = await this.transport.call('calendar.freebusy.query', {
      timeMin: input.timeMin, timeMax: input.timeMax,
      items: calendarIds.map(id => ({ id })),
    }) as { calendars?: Record<string, { busy?: Array<{ start: string; end: string }> }> };
    const out: BusyInterval[] = [];
    for (const [calendarId, entry] of Object.entries(res?.calendars || {})) {
      for (const slot of entry?.busy || []) out.push({ calendarId, start: slot.start, end: slot.end });
    }
    return out.sort((a, b) => a.start.localeCompare(b.start));
  }

  async contactsLookup(email: string): Promise<{ email: string; displayName: string | null } | null> {
    try {
      const res = await this.transport.call('people.people.get', { resourceName: `people/${email}` }) as any;
      const name = res?.names?.[0]?.displayName;
      return { email, displayName: name ? sanitiseSubject(String(name)) : null };
    } catch {
      return null;
    }
  }
}

/**
 * Runtime proof that the capability object exposes no mutation method. Called from the
 * constructor so an accidental future addition fails loudly at startup, not in review.
 */
export function assertNoWriteCapability(candidate: object): void {
  const names = new Set<string>();
  for (let proto = candidate; proto && proto !== Object.prototype; proto = Object.getPrototypeOf(proto)) {
    for (const key of Object.getOwnPropertyNames(proto)) names.add(key);
  }
  const offenders = FORBIDDEN_CAPABILITY_METHODS.filter(method => names.has(method));
  if (offenders.length) {
    throw new Error(`read-only capability violation: mutation methods exposed: ${offenders.join(', ')}`);
  }
}
