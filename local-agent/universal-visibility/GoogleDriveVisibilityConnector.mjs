/**
 * GoogleDriveVisibilityConnector.mjs
 * Reads Google Drive cache. Falls back gracefully if not configured.
 */

import fs from 'fs';
import path from 'path';

const GLOBAL_DIR = process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global';
const CACHE_DIR  = path.join(GLOBAL_DIR, 'visibility', 'google-drive');
const TOKEN_PATH = path.join(GLOBAL_DIR, 'visibility', 'google-tokens.json');

export class GoogleDriveVisibilityConnector {
  constructor() {
    this.id = 'google-drive';
    this.name = 'Google Drive';
  }

  isConfigured() { return fs.existsSync(TOKEN_PATH); }

  getSnapshot() {
    if (!this.isConfigured()) {
      return {
        status: 'CONNECTOR_NOT_CONFIGURED',
        connector: 'google-drive',
        setup: 'Open /api/auth/google/start → connect Google account',
        data: null,
      };
    }
    const cacheFile = path.join(CACHE_DIR, 'files_cache.json');
    if (!fs.existsSync(cacheFile)) {
      return { status: 'CACHE_EMPTY', connector: 'google-drive', data: null };
    }
    try {
      const data = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
      return { status: 'ok', connector: 'google-drive', source: cacheFile, last_sync: data.synced_at, data };
    } catch (e) {
      return { status: 'error', connector: 'google-drive', error: e.message, data: null };
    }
  }

  /** Search Drive files by keyword */
  searchFiles(query) {
    const snap = this.getSnapshot();
    if (snap.status !== 'ok') return snap;
    const q = query.toLowerCase();
    const files = (snap.data.recent_files || []).filter(f =>
      f.name?.toLowerCase().includes(q) ||
      f.parent_folder?.toLowerCase().includes(q)
    );
    return {
      status: 'ok',
      source: 'drive-cache',
      query,
      count: files.length,
      files: files.slice(0, 10).map(f => ({
        id: f.id,
        name: f.name,
        type: f.mime_type,
        modified: f.modified_at,
        link: f.web_link,
        owner: f.owner,
      })),
    };
  }

  /** Get recent files */
  getRecentFiles(limit = 10) {
    const snap = this.getSnapshot();
    if (snap.status !== 'ok') return snap;
    return {
      status: 'ok',
      source: 'drive-cache',
      last_sync: snap.last_sync,
      files: (snap.data.recent_files || []).slice(0, limit),
    };
  }

  getSummaryText() {
    const snap = this.getSnapshot();
    if (snap.status === 'CONNECTOR_NOT_CONFIGURED') return `☁️ Google Drive: Not configured — ${snap.setup}`;
    if (snap.status !== 'ok') return `☁️ Google Drive: ${snap.status}`;
    return `☁️ Google Drive: ${snap.data.total_found ?? '?'} files indexed (synced ${snap.last_sync ? new Date(snap.last_sync).toLocaleString() : 'never'})`;
  }
}

export const driveConnector = new GoogleDriveVisibilityConnector();
