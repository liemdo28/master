/**
 * Google Drive Connector — lists recent files, searches docs.
 * Read-only. Caches to .local-agent-global/visibility/google-drive/
 */

import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { getAuthedClient } from './google-auth';

const GLOBAL_DIR = process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global';
const CACHE_DIR = path.join(GLOBAL_DIR, 'visibility', 'google-drive');

export interface DriveFile {
  id: string;
  name: string;
  mime_type: string;
  modified_at: string;
  size?: string;
  web_link: string;
  owner: string;
  shared: boolean;
  parent_folder?: string;
}

export interface DriveSnapshot {
  synced_at: string;
  recent_files: DriveFile[];
  total_found: number;
}

const MIME_LABELS: Record<string, string> = {
  'application/vnd.google-apps.document': 'Google Doc',
  'application/vnd.google-apps.spreadsheet': 'Google Sheet',
  'application/vnd.google-apps.presentation': 'Google Slides',
  'application/vnd.google-apps.folder': 'Folder',
  'application/pdf': 'PDF',
};

export async function syncDrive(maxFiles = 50): Promise<DriveSnapshot> {
  const auth = await getAuthedClient();
  const drive = google.drive({ version: 'v3', auth });

  const res = await drive.files.list({
    pageSize: maxFiles,
    fields: 'files(id,name,mimeType,modifiedTime,size,webViewLink,owners,shared,parents)',
    orderBy: 'modifiedTime desc',
    q: "trashed=false",
  });

  const files: DriveFile[] = (res.data.files || []).map((f: {
    id?: string | null;
    name?: string | null;
    mimeType?: string | null;
    modifiedTime?: string | null;
    size?: string | null;
    webViewLink?: string | null;
    owners?: Array<{ displayName?: string | null; emailAddress?: string | null }> | null;
    shared?: boolean | null;
    parents?: string[] | null;
  }) => ({
    id: f.id || '',
    name: f.name || '',
    mime_type: MIME_LABELS[f.mimeType || ''] || f.mimeType || '',
    modified_at: f.modifiedTime || '',
    size: f.size || undefined,
    web_link: f.webViewLink || '',
    owner: f.owners?.[0]?.displayName || f.owners?.[0]?.emailAddress || '',
    shared: f.shared || false,
    parent_folder: f.parents?.[0],
  }));

  const snapshot: DriveSnapshot = {
    synced_at: new Date().toISOString(),
    recent_files: files,
    total_found: files.length,
  };

  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(path.join(CACHE_DIR, 'data.json'), JSON.stringify(snapshot, null, 2));
  fs.writeFileSync(path.join(CACHE_DIR, 'summary.json'), JSON.stringify({
    total: files.length, synced_at: snapshot.synced_at,
  }, null, 2));
  fs.writeFileSync(path.join(CACHE_DIR, 'last_sync.json'), JSON.stringify({ synced_at: snapshot.synced_at }));
  fs.writeFileSync(path.join(CACHE_DIR, 'errors.json'), JSON.stringify([]));

  return snapshot;
}

export function getCachedDrive(): DriveSnapshot | null {
  try { return JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'data.json'), 'utf-8')); }
  catch { return null; }
}

export function searchDriveFiles(query: string): DriveFile[] {
  const cached = getCachedDrive();
  if (!cached) return [];
  const q = query.toLowerCase();
  return cached.recent_files.filter(f => f.name.toLowerCase().includes(q));
}
