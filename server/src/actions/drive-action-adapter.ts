/**
 * Google Drive Action Adapter — search, read, upload, share (with approval).
 */

import path from 'path';
import fs from 'fs';

const GLOBAL_DIR = process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global';
const TOKEN_PATH = path.join(GLOBAL_DIR, 'visibility', 'google-tokens.json');

async function getDriveClient() {
  if (!fs.existsSync(TOKEN_PATH)) throw new Error('Google tokens not found. Complete OAuth: GET /api/auth/google/start');
  const { google } = await import('googleapis');
  const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'http://localhost:' + (process.env.MI_PORT || 4001) + '/api/auth/google/callback'
  );
  auth.setCredentials(tokens);
  return google.drive({ version: 'v3', auth });
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
}

export async function searchDrive(query: string, maxResults = 10): Promise<DriveFile[]> {
  const drive = await getDriveClient();
  const res = await drive.files.list({
    q: `fullText contains '${query.replace(/'/g, "\\'")}' and trashed=false`,
    pageSize: maxResults,
    fields: 'files(id,name,mimeType,size,modifiedTime,webViewLink)',
  });
  return (res.data.files || []) as DriveFile[];
}

export async function readDriveFile(fileId: string): Promise<{ name: string; content: string; mimeType: string }> {
  const drive = await getDriveClient();
  const meta = await drive.files.get({ fileId, fields: 'name,mimeType' });
  const name = meta.data.name || fileId;
  const mimeType = meta.data.mimeType || '';

  // For Google Docs/Sheets, export as text/plain
  let content = '';
  if (mimeType.includes('google-apps.document')) {
    const res = await drive.files.export({ fileId, mimeType: 'text/plain' }, { responseType: 'text' });
    content = String(res.data).slice(0, 5000);
  } else if (mimeType.includes('google-apps.spreadsheet')) {
    const res = await drive.files.export({ fileId, mimeType: 'text/csv' }, { responseType: 'text' });
    content = String(res.data).slice(0, 5000);
  } else {
    const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'text' });
    content = String(res.data).slice(0, 5000);
  }
  return { name, content, mimeType };
}

export async function uploadToDrive(params: {
  name: string;
  content: Buffer | string;
  mimeType: string;
  folderId?: string;
}): Promise<{ file_id: string; webViewLink: string }> {
  const drive = await getDriveClient();
  const { Readable } = await import('stream');
  const body = typeof params.content === 'string' ? Readable.from([params.content]) : Readable.from([params.content]);
  const res = await drive.files.create({
    requestBody: { name: params.name, parents: params.folderId ? [params.folderId] : undefined },
    media: { mimeType: params.mimeType, body },
    fields: 'id,webViewLink',
  });
  return { file_id: res.data.id!, webViewLink: res.data.webViewLink || '' };
}
