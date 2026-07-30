/**
 * GmailVisibilityConnector.mjs
 * Reads Gmail data from local cache (written by TypeScript server after OAuth).
 * NEVER fakes data. Returns CONNECTOR_NOT_CONFIGURED if not set up.
 */

import fs from 'fs';
import path from 'path';

const GLOBAL_DIR = process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global';
const CACHE_DIR  = path.join(GLOBAL_DIR, 'visibility', 'gmail');
const TOKEN_PATH = path.join(GLOBAL_DIR, 'visibility', 'google-tokens.json');

function cacheAge(file) {
  try {
    const stat = fs.statSync(file);
    return Math.floor((Date.now() - stat.mtimeMs) / 60000);
  } catch { return null; }
}

export class GmailVisibilityConnector {
  constructor() {
    this.id = 'gmail';
    this.name = 'Gmail';
  }

  isConfigured() {
    return fs.existsSync(TOKEN_PATH);
  }

  getCacheFile() {
    return path.join(CACHE_DIR, 'inbox_cache.json');
  }

  /** Get full snapshot or not_configured status */
  getSnapshot() {
    if (!this.isConfigured()) {
      return {
        status: 'CONNECTOR_NOT_CONFIGURED',
        connector: 'gmail',
        setup: 'Open http://localhost:4001/api/auth/google/start → connect Google account',
        data: null,
      };
    }
    const cacheFile = this.getCacheFile();
    if (!fs.existsSync(cacheFile)) {
      return {
        status: 'CACHE_EMPTY',
        connector: 'gmail',
        message: 'Token exists but no cache yet — trigger sync at /api/visibility/sync/gmail',
        data: null,
      };
    }
    try {
      const data = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
      const age = cacheAge(cacheFile);
      return {
        status: 'ok',
        connector: 'gmail',
        source: cacheFile,
        last_sync: data.synced_at || null,
        cache_age_min: age,
        data,
      };
    } catch (e) {
      return { status: 'error', connector: 'gmail', error: e.message, data: null };
    }
  }

  /** Get important emails (summary format) */
  getImportantEmails(limit = 10) {
    const snap = this.getSnapshot();
    if (snap.status !== 'ok') return snap;
    const emails = (snap.data.emails || []).filter(e => e.is_important || e.is_unread);
    return {
      status: 'ok',
      source: 'gmail-cache',
      last_sync: snap.last_sync,
      count: emails.length,
      emails: emails.slice(0, limit).map(e => ({
        id: e.id,
        subject: e.subject,
        from: e.from,
        date: e.date,
        snippet: e.snippet?.slice(0, 120),
        is_unread: e.is_unread,
        is_important: e.is_important,
      })),
    };
  }

  /** Search emails by keyword */
  searchEmails(query) {
    const snap = this.getSnapshot();
    if (snap.status !== 'ok') return snap;
    const q = query.toLowerCase();
    const matches = (snap.data.emails || []).filter(e =>
      e.subject?.toLowerCase().includes(q) ||
      e.from?.toLowerCase().includes(q) ||
      e.snippet?.toLowerCase().includes(q)
    );
    return {
      status: 'ok',
      source: 'gmail-cache',
      query,
      count: matches.length,
      emails: matches.slice(0, 10),
    };
  }

  /** Find emails from a specific person */
  getEmailsFromPerson(name) {
    const snap = this.getSnapshot();
    if (snap.status !== 'ok') return snap;
    const n = name.toLowerCase();
    const matches = (snap.data.emails || []).filter(e =>
      e.from?.toLowerCase().includes(n) ||
      e.subject?.toLowerCase().includes(n)
    );
    return {
      status: 'ok',
      source: 'gmail-cache',
      person: name,
      count: matches.length,
      emails: matches.slice(0, 5),
    };
  }

  /** Summary text for Mi AI context */
  getSummaryText() {
    const snap = this.getSnapshot();
    if (snap.status === 'CONNECTOR_NOT_CONFIGURED') {
      return `📧 Gmail: Not configured — ${snap.setup}`;
    }
    if (snap.status !== 'ok') return `📧 Gmail: ${snap.status}`;
    const d = snap.data;
    const age = snap.cache_age_min !== null ? ` (synced ${snap.cache_age_min}min ago)` : '';
    return `📧 Gmail${age}: ${d.unread_count ?? '?'} unread, ${d.important_count ?? '?'} important`;
  }
}

export const gmailConnector = new GmailVisibilityConnector();
