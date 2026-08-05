import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  ALLOWED_ENDPOINTS, EndpointNotAllowedError, GoogleReadClient, assertNoWriteCapability,
  guardTransport, inspectToken,
} from '../google-read-client';
import { ConnectorUnavailableError, classifyProviderError, createFixtureTransport } from '../transports';
import { FORBIDDEN_CAPABILITY_METHODS } from '../types';
import { AGENDA_DATE, baseFixtures } from '../fixtures';

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mi-connector-'));
}

function writeToken(root: string, token: unknown): void {
  const dir = path.join(root, 'visibility');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'google-tokens.json'), JSON.stringify(token));
  process.env.MI_INTELLIGENCE_TOKEN_DIR = root;
}

const READ_SCOPES = 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.readonly';

async function run() {
  const root = tmp();
  const previousDir = process.env.MI_INTELLIGENCE_TOKEN_DIR;

  // --- the capability surface exposes no mutation method --------------------
  const client = new GoogleReadClient(createFixtureTransport(baseFixtures()), {
    status: 'READY', grantedScopes: READ_SCOPES.split(' '), detail: 'test',
  });
  assert.doesNotThrow(() => assertNoWriteCapability(client), 'the read client passes its own write assertion');
  for (const method of FORBIDDEN_CAPABILITY_METHODS) {
    assert.strictEqual((client as unknown as Record<string, unknown>)[method], undefined,
      `capability object must not expose ${method}`);
  }
  // The assertion has to actually catch something, or it proves nothing.
  class Sneaky { async gmailSend() { return true; } }
  assert.throws(() => assertNoWriteCapability(new Sneaky()), /read-only capability violation/,
    'the write assertion detects a mutation method');

  // --- only allowlisted endpoints can be dispatched -------------------------
  for (const endpoint of ['gmail.users.messages.send', 'gmail.users.messages.modify', 'gmail.users.messages.trash',
    'calendar.events.insert', 'calendar.events.update', 'calendar.events.delete', 'drive.files.create']) {
    assert.ok(!ALLOWED_ENDPOINTS.has(endpoint), `${endpoint} must not be allowlisted`);
  }
  const guarded = guardTransport({ async call() { return { reached: true }; } });
  await assert.rejects(() => guarded.call('gmail.users.messages.send', {}), EndpointNotAllowedError,
    'a mutation endpoint is refused before it reaches the provider');
  await assert.rejects(() => guarded.call('calendar.events.insert', {}), EndpointNotAllowedError);
  assert.deepStrictEqual(await guarded.call('gmail.users.labels.list', {}), { reached: true },
    'an allowlisted read endpoint still dispatches');

  // --- reads work ------------------------------------------------------------
  const emails = await client.gmailSearch({ query: 'newer_than:3d', maxResults: 10 });
  assert.ok(emails.length >= 3, 'gmail search returns messages');
  const events = await client.calendarListEvents({
    timeMin: `${AGENDA_DATE}T00:00:00Z`, timeMax: `${AGENDA_DATE}T23:59:59Z`,
  });
  assert.ok(events.length >= 4, 'calendar events are returned');
  assert.ok((await client.gmailListLabels()).includes('INBOX'));
  assert.ok((await client.calendarListCalendars()).some(c => c.calendarId === 'primary'));
  assert.ok((await client.calendarFreeBusy({ timeMin: `${AGENDA_DATE}T00:00:00Z`, timeMax: `${AGENDA_DATE}T23:59:59Z` })).length >= 2);

  // --- result bounds are enforced -------------------------------------------
  const capped = await client.gmailSearch({ query: 'x', maxResults: 9999 });
  assert.ok(capped.length <= 25, 'result count is capped regardless of caller request');

  // --- token states are classified, never guessed ---------------------------
  writeToken(root, { access_token: 'x', refresh_token: 'y', scope: READ_SCOPES, expiry_date: Date.now() + 60_000 });
  assert.strictEqual(inspectToken().status, 'READY');

  writeToken(root, { access_token: 'x', scope: 'https://www.googleapis.com/auth/gmail.readonly', expiry_date: Date.now() + 60_000 });
  assert.strictEqual(inspectToken().status, 'INSUFFICIENT_SCOPE', 'a missing calendar read scope is reported, not ignored');

  writeToken(root, { access_token: 'x', scope: READ_SCOPES, expiry_date: Date.now() - 60_000 });
  assert.strictEqual(inspectToken().status, 'TOKEN_EXPIRED', 'an expired token with no refresh token is reported');

  writeToken(root, { access_token: 'x', refresh_token: 'y', scope: READ_SCOPES, expiry_date: Date.now() - 60_000 });
  assert.strictEqual(inspectToken().status, 'READY', 'an expired token with a refresh token is still usable');

  writeToken(root, { scope: READ_SCOPES });
  assert.strictEqual(inspectToken().status, 'NOT_CONFIGURED', 'a token file with no credential is NOT_CONFIGURED');

  process.env.MI_INTELLIGENCE_TOKEN_DIR = path.join(root, 'absent');
  assert.strictEqual(inspectToken().status, 'NOT_CONFIGURED', 'a missing token file is NOT_CONFIGURED, not an error');

  // A revoked credential surfaces through the provider, classified not raw.
  const revoked = classifyProviderError(Object.assign(new Error('invalid_grant: Token has been expired or revoked.'), { code: 401 }));
  assert.strictEqual(revoked.reason, 'TOKEN_EXPIRED');
  assert.strictEqual(classifyProviderError(Object.assign(new Error('quota'), { code: 429 })).reason, 'RATE_LIMIT');
  assert.strictEqual(classifyProviderError(Object.assign(new Error('insufficient scope'), { code: 403 })).reason, 'INSUFFICIENT_SCOPE');
  // A disabled API is also 403 but needs a different fix, so it must stay distinguishable.
  assert.strictEqual(
    classifyProviderError(Object.assign(new Error('Google Calendar API has not been used in project 1234 before or it is disabled.'), { code: 403 })).reason,
    'API_DISABLED',
    'a disabled Cloud API is not reported as a scope problem');
  assert.strictEqual(classifyProviderError(new Error('socket hang up ETIMEDOUT')).reason, 'TIMEOUT');
  assert.strictEqual(classifyProviderError(new Error('weird provider explosion')).reason, 'UNAVAILABLE');

  // --- provider errors never carry credentials or payloads into messages -----
  const leaky = new Error('failed with access_token=ya29.SUPERSECRETVALUE and body {"to":"victim@example.com"}');
  const classified = classifyProviderError(leaky);
  assert.ok(!classified.message.includes('ya29.SUPERSECRETVALUE'), 'classified error must not echo the token');
  assert.ok(!classified.message.includes('victim@example.com'), 'classified error must not echo the provider payload');
  assert.ok(classified instanceof ConnectorUnavailableError);

  // --- nothing logs a token --------------------------------------------------
  const writes: string[] = [];
  const origLog = console.log; const origErr = console.error; const origWarn = console.warn;
  console.log = (...a: unknown[]) => { writes.push(a.map(String).join(' ')); };
  console.error = (...a: unknown[]) => { writes.push(a.map(String).join(' ')); };
  console.warn = (...a: unknown[]) => { writes.push(a.map(String).join(' ')); };
  try {
    const noisy = new GoogleReadClient(createFixtureTransport(baseFixtures()), {
      status: 'READY', grantedScopes: READ_SCOPES.split(' '), detail: 'test',
    });
    await noisy.gmailSearch({ query: 'anything' });
    await noisy.calendarListCalendars();
  } finally {
    console.log = origLog; console.error = origErr; console.warn = origWarn;
  }
  assert.ok(!writes.some(l => /ya29\.|access_token|refresh_token/.test(l)), 'no token material is logged');

  if (previousDir === undefined) delete process.env.MI_INTELLIGENCE_TOKEN_DIR;
  else process.env.MI_INTELLIGENCE_TOKEN_DIR = previousDir;
  fs.rmSync(root, { recursive: true, force: true });
  console.log('[connector-readonly] PASS');
}

run().catch(err => { console.error('[connector-readonly] FAIL:', err); process.exit(1); });
