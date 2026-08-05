/**
 * Transports for the Phase 5C read boundary.
 *
 * Both implement the same narrow `GoogleReadTransport.call(endpoint, params)` shape, so
 * fixture tests exercise exactly the surface the live client uses. Neither exposes a
 * Google client object to callers — the only way out of this module is a read endpoint
 * name that GoogleReadClient's allowlist already approved.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { GoogleReadTransport } from './google-read-client';

export class ConnectorUnavailableError extends Error {
  constructor(public readonly reason: 'NOT_CONFIGURED' | 'TOKEN_EXPIRED' | 'INSUFFICIENT_SCOPE' | 'API_DISABLED' | 'RATE_LIMIT' | 'TIMEOUT' | 'UNAVAILABLE', detail: string) {
    // Provider errors can carry request context; only the classified reason is surfaced.
    super(`${reason}: ${detail}`);
    this.name = 'ConnectorUnavailableError';
  }
}

/** Maps a provider failure to a classified reason without leaking provider payloads. */
export function classifyProviderError(err: unknown): ConnectorUnavailableError {
  const status = (err as { code?: number; status?: number })?.code ?? (err as { status?: number })?.status;
  const message = err instanceof Error ? err.message : String(err);
  if (status === 429 || /rate limit|quota|userRateLimitExceeded/i.test(message)) {
    return new ConnectorUnavailableError('RATE_LIMIT', 'provider rate limit reached');
  }
  if (status === 401 || /invalid_grant|unauthor/i.test(message)) {
    return new ConnectorUnavailableError('TOKEN_EXPIRED', 'provider rejected the credential');
  }
  // A disabled API and a missing scope are both 403 but need opposite fixes: enable the
  // API in Cloud Console, versus re-consent the OAuth grant. Keep them distinguishable.
  if (/has not been used in project|is disabled|accessNotConfigured|SERVICE_DISABLED/i.test(message)) {
    return new ConnectorUnavailableError('API_DISABLED', 'provider API is not enabled for this Cloud project');
  }
  if (status === 403 || /insufficient|forbidden|scope/i.test(message)) {
    return new ConnectorUnavailableError('INSUFFICIENT_SCOPE', 'provider refused for scope or permission');
  }
  if (/timeout|ETIMEDOUT|ESOCKETTIMEDOUT|abort/i.test(message)) {
    return new ConnectorUnavailableError('TIMEOUT', 'provider request timed out');
  }
  return new ConnectorUnavailableError('UNAVAILABLE', 'provider request failed');
}

/**
 * Live Google transport. googleapis is imported lazily so the module — and every test
 * that uses fixtures — loads without provider dependencies or credentials present.
 */
export function createLiveTransport(tokenFile: string): GoogleReadTransport {
  let clients: { gmail: any; calendar: any; people: any } | null = null;

  async function ensureClients() {
    if (clients) return clients;
    if (!fs.existsSync(tokenFile)) throw new ConnectorUnavailableError('NOT_CONFIGURED', 'no Google token file');
    const { google } = await import('googleapis');
    const tokens = JSON.parse(fs.readFileSync(tokenFile, 'utf8'));
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI,
    );
    auth.setCredentials(tokens);
    clients = {
      gmail: google.gmail({ version: 'v1', auth }),
      calendar: google.calendar({ version: 'v3', auth }),
      people: google.people({ version: 'v1', auth }),
    };
    return clients;
  }

  return {
    async call(endpoint, params) {
      const c = await ensureClients();
      try {
        switch (endpoint) {
          case 'gmail.users.messages.list': return (await c.gmail.users.messages.list(params)).data;
          case 'gmail.users.messages.get': return (await c.gmail.users.messages.get(params)).data;
          case 'gmail.users.threads.list': return (await c.gmail.users.threads.list(params)).data;
          case 'gmail.users.threads.get': return (await c.gmail.users.threads.get(params)).data;
          case 'gmail.users.labels.list': return (await c.gmail.users.labels.list(params)).data;
          case 'calendar.calendarList.list': return (await c.calendar.calendarList.list(params)).data;
          case 'calendar.events.list': return (await c.calendar.events.list(params)).data;
          case 'calendar.events.get': return (await c.calendar.events.get(params)).data;
          case 'calendar.freebusy.query': return (await c.calendar.freebusy.query({ requestBody: params })).data;
          case 'people.people.get': return (await c.people.people.get({ ...params, personFields: 'names,emailAddresses' })).data;
          default: throw new ConnectorUnavailableError('UNAVAILABLE', 'unmapped read endpoint');
        }
      } catch (err) {
        if (err instanceof ConnectorUnavailableError) throw err;
        throw classifyProviderError(err);
      }
    },
  };
}

export interface FixtureData {
  messages: Record<string, unknown>;
  threads: Record<string, { messages: unknown[] }>;
  messageList: Array<{ id: string }>;
  threadList: Array<{ id: string; snippet?: string }>;
  labels: string[];
  calendars: Array<{ id: string; summary: string; timeZone: string }>;
  events: Record<string, unknown[]>;
  busy: Record<string, Array<{ start: string; end: string }>>;
  people: Record<string, { names?: Array<{ displayName: string }> }>;
}

/** Deterministic transport for tests and fixture acceptance. */
export function createFixtureTransport(data: Partial<FixtureData>): GoogleReadTransport {
  const d: FixtureData = {
    messages: {}, threads: {}, messageList: [], threadList: [], labels: [],
    calendars: [], events: {}, busy: {}, people: {}, ...data,
  };
  return {
    async call(endpoint, params) {
      const p = params as Record<string, any>;
      switch (endpoint) {
        case 'gmail.users.messages.list': return { messages: d.messageList.slice(0, p.maxResults ?? 10) };
        case 'gmail.users.messages.get': return d.messages[p.id] ?? null;
        case 'gmail.users.threads.list': return { threads: d.threadList.slice(0, p.maxResults ?? 10) };
        case 'gmail.users.threads.get': return d.threads[p.id] ?? { messages: [] };
        case 'gmail.users.labels.list': return { labels: d.labels.map(name => ({ name })) };
        case 'calendar.calendarList.list': return { items: d.calendars };
        case 'calendar.events.list': return { items: d.events[p.calendarId] ?? [], timeZone: 'UTC' };
        case 'calendar.events.get': return (d.events[p.calendarId] || []).find((e: any) => e.id === p.eventId) ?? null;
        case 'calendar.freebusy.query': {
          const calendars: Record<string, { busy: Array<{ start: string; end: string }> }> = {};
          for (const item of p.items || []) calendars[item.id] = { busy: d.busy[item.id] ?? [] };
          return { calendars };
        }
        case 'people.people.get': {
          const email = String(p.resourceName || '').replace(/^people\//, '');
          return d.people[email] ?? null;
        }
        default: throw new ConnectorUnavailableError('UNAVAILABLE', 'unmapped fixture endpoint');
      }
    },
  };
}

export function defaultTokenFile(): string {
  const globalDir = process.env.MI_INTELLIGENCE_TOKEN_DIR
    || process.env.GLOBAL_DIR
    || path.resolve(process.cwd(), '.local-agent-global');
  return path.join(globalDir, 'visibility', 'google-tokens.json');
}
