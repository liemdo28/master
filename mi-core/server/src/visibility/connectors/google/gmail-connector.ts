/**
 * Gmail Connector — reads recent emails, extracts important ones.
 * Read-only. Caches to .local-agent-global/visibility/gmail/
 */

import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { getAuthedClient } from './google-auth';

const GLOBAL_DIR = process.env.GLOBAL_DIR || 'D:/Project/Master/.local-agent-global';
const CACHE_DIR = path.join(GLOBAL_DIR, 'visibility', 'gmail');

export interface EmailSummary {
  id: string;
  thread_id: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  labels: string[];
  is_unread: boolean;
  is_important: boolean;
}

export interface GmailSnapshot {
  synced_at: string;
  unread_count: number;
  important_count: number;
  emails: EmailSummary[];
  labels: string[];
}

function decodeBase64(data: string): string {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
}

function parseHeader(headers: Array<{ name?: string | null; value?: string | null }>, name: string): string {
  return headers.find(h => (h.name || '').toLowerCase() === name.toLowerCase())?.value || '';
}

export async function syncGmail(maxMessages = 50): Promise<GmailSnapshot> {
  const auth = await getAuthedClient();
  const gmail = google.gmail({ version: 'v1', auth });

  // Get label list
  const labelsRes = await gmail.users.labels.list({ userId: 'me' });
  const labelMap: Record<string, string> = {};
  for (const l of labelsRes.data.labels || []) {
    if (l.id && l.name) labelMap[l.id] = l.name;
  }

  // Get recent messages
  const listRes = await gmail.users.messages.list({
    userId: 'me',
    maxResults: maxMessages,
    q: 'newer_than:7d',
  });

  const messages = listRes.data.messages || [];
  const emails: EmailSummary[] = [];
  let unreadCount = 0;
  let importantCount = 0;

  // Fetch in batches of 10
  const batchSize = 10;
  for (let i = 0; i < Math.min(messages.length, maxMessages); i += batchSize) {
    const batch = messages.slice(i, i + batchSize);
    await Promise.all(batch.map(async (msg) => {
      try {
        const detail = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id!,
          format: 'metadata',
          metadataHeaders: ['Subject', 'From', 'Date'],
        });
        const headers = detail.data.payload?.headers || [];
        const labelIds = detail.data.labelIds || [];
        const isUnread = labelIds.includes('UNREAD');
        const isImportant = labelIds.includes('IMPORTANT') || labelIds.includes('STARRED');

        if (isUnread) unreadCount++;
        if (isImportant) importantCount++;

        emails.push({
          id: detail.data.id!,
          thread_id: detail.data.threadId!,
          subject: parseHeader(headers, 'Subject') || '(no subject)',
          from: parseHeader(headers, 'From'),
          date: parseHeader(headers, 'Date'),
          snippet: detail.data.snippet?.slice(0, 200) || '',
          labels: labelIds.map(id => labelMap[id] || id).filter(Boolean),
          is_unread: isUnread,
          is_important: isImportant,
        });
      } catch { /* skip failed message */ }
    }));
  }

  // Sort by date desc
  emails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const snapshot: GmailSnapshot = {
    synced_at: new Date().toISOString(),
    unread_count: unreadCount,
    important_count: importantCount,
    emails,
    labels: Object.values(labelMap),
  };

  // Write cache
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(path.join(CACHE_DIR, 'data.json'), JSON.stringify(snapshot, null, 2));
  fs.writeFileSync(path.join(CACHE_DIR, 'summary.json'), JSON.stringify({
    unread: unreadCount, important: importantCount, total: emails.length, synced_at: snapshot.synced_at,
  }, null, 2));
  fs.writeFileSync(path.join(CACHE_DIR, 'last_sync.json'), JSON.stringify({ synced_at: snapshot.synced_at }));
  fs.writeFileSync(path.join(CACHE_DIR, 'errors.json'), JSON.stringify([]));

  return snapshot;
}

export function getCachedGmail(): GmailSnapshot | null {
  try { return JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'data.json'), 'utf-8')); }
  catch { return null; }
}

export function getImportantEmails(limit = 10): EmailSummary[] {
  const cached = getCachedGmail();
  if (!cached) return [];
  return cached.emails
    .filter(e => e.is_important || e.is_unread)
    .slice(0, limit);
}
