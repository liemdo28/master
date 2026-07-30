/**
 * Gmail Action Adapter — search, read, draft, send (with approval).
 * Uses Google OAuth tokens saved by the Google visibility auth flow.
 * Send requires Level 3 approval.
 */

import path from 'path';
import fs from 'fs';

const GLOBAL_DIR = process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global';
const TOKEN_PATH = path.join(GLOBAL_DIR, 'visibility', 'google-tokens.json');

interface GmailClient {
  users: {
    messages: {
      list: (p: unknown) => Promise<{ data: { messages?: Array<{ id: string }> } }>;
      get: (p: unknown) => Promise<{ data: unknown }>;
    };
    drafts: {
      create: (p: unknown) => Promise<{ data: { id: string } }>;
      send: (p: unknown) => Promise<{ data: unknown }>;
    };
  };
}

async function getGmailClient(): Promise<GmailClient> {
  if (!fs.existsSync(TOKEN_PATH)) throw new Error('Google tokens not found. Complete OAuth: GET /api/auth/google/start');
  const { google } = await import('googleapis');
  const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'http://localhost:' + (process.env.MI_PORT || 4001) + '/api/auth/google/callback'
  );
  auth.setCredentials(tokens);
  return google.gmail({ version: 'v1', auth }) as unknown as GmailClient;
}

export interface GmailSearchResult {
  message_id: string;
  snippet?: string;
  subject?: string;
  from?: string;
  date?: string;
}

export async function searchGmail(query: string, maxResults = 10): Promise<GmailSearchResult[]> {
  const gmail = await getGmailClient();
  const res = await gmail.users.messages.list({ userId: 'me', q: query, maxResults });
  const messages = res.data.messages || [];

  const results: GmailSearchResult[] = [];
  for (const msg of messages.slice(0, 5)) {
    try {
      const detail = await gmail.users.messages.get({ userId: 'me', id: msg.id, format: 'metadata', metadataHeaders: ['Subject', 'From', 'Date'] }) as { data: { snippet?: string; payload?: { headers?: Array<{ name: string; value: string }> } } };
      const headers = detail.data.payload?.headers || [];
      const h = (name: string) => headers.find((x) => x.name === name)?.value;
      results.push({ message_id: msg.id, snippet: detail.data.snippet, subject: h('Subject'), from: h('From'), date: h('Date') });
    } catch { results.push({ message_id: msg.id }); }
  }
  return results;
}

export async function readGmail(messageId: string): Promise<{ subject: string; from: string; date: string; body: string }> {
  const gmail = await getGmailClient();
  const res = await gmail.users.messages.get({ userId: 'me', id: messageId, format: 'full' }) as { data: { payload?: { headers?: Array<{ name: string; value: string }>; parts?: Array<{ mimeType: string; body?: { data?: string } }> }; snippet?: string } };
  const headers = res.data.payload?.headers || [];
  const h = (name: string) => headers.find(x => x.name === name)?.value || '';
  const parts = res.data.payload?.parts || [];
  const textPart = parts.find(p => p.mimeType === 'text/plain');
  const body = textPart?.body?.data
    ? Buffer.from(textPart.body.data, 'base64').toString('utf8').slice(0, 2000)
    : res.data.snippet || '';
  return { subject: h('Subject'), from: h('From'), date: h('Date'), body };
}

export interface DraftParams { to: string; subject: string; body: string }

export async function draftEmail(params: DraftParams): Promise<{ draft_id: string }> {
  const gmail = await getGmailClient();
  const raw = Buffer.from(
    `To: ${params.to}\r\nSubject: ${params.subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${params.body}`
  ).toString('base64url');
  const res = await gmail.users.drafts.create({ userId: 'me', requestBody: { message: { raw } } });
  return { draft_id: res.data.id };
}

// sendEmail requires Level 3 approval — called only after approval gate clears
export async function sendEmail(draftId: string): Promise<{ ok: boolean }> {
  const gmail = await getGmailClient();
  await gmail.users.drafts.send({ userId: 'me', requestBody: { id: draftId } });
  return { ok: true };
}
