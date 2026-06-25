<<<<<<< HEAD
=======
/**
 * Google Drive Connector
 * Lists, reads, and ingests files from Google Drive into knowledge base.
 * Auth: Service Account JSON (GOOGLE_SERVICE_ACCOUNT_JSON) or OAuth token (GOOGLE_DRIVE_TOKEN)
 */

>>>>>>> seo/phase-29-revenue-execution-loop
import https from 'https';
import * as fs from 'fs';
import * as path from 'path';

<<<<<<< HEAD
const KNOWLEDGE_DIR = path.join(process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global', 'knowledge-db');

export interface DriveFile { id: string; name: string; mimeType: string; modifiedTime: string; size?: number; webViewLink?: string; }
export interface IngestResult { file_id: string; name: string; ingested: boolean; chars: number; error?: string; }

function getToken(): string | null { return process.env.GOOGLE_DRIVE_TOKEN || null; }

function driveGet(p: string, token: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname: 'www.googleapis.com', path: p, method: 'GET', headers: { 'Authorization': `Bearer ${token}` } }, (res) => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({ error: d.slice(0,200) }); } });
    });
    req.on('error', reject); req.end();
=======
const KNOWLEDGE_DIR = path.join(
  process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global',
  'knowledge-db'
);

export interface DriveFile {
  id:           string;
  name:         string;
  mimeType:     string;
  modifiedTime: string;
  size?:        number;
  webViewLink?: string;
}

export interface IngestResult {
  file_id:    string;
  name:       string;
  ingested:   boolean;
  chars:      number;
  error?:     string;
}

// ── Auth helpers ──────────────────────────────────────────────────────────────

function getToken(): string | null {
  return process.env.GOOGLE_DRIVE_TOKEN || null;
}

function driveGet(path_: string, token: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'www.googleapis.com',
      path: path_,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` },
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch { resolve({ error: d.slice(0, 200) }); }
      });
    });
    req.on('error', reject);
    req.end();
>>>>>>> seo/phase-29-revenue-execution-loop
  });
}

function driveDownload(fileId: string, token: string): Promise<string> {
  return new Promise((resolve, reject) => {
<<<<<<< HEAD
    const req = https.request({ hostname: 'www.googleapis.com', path: `/drive/v3/files/${fileId}?alt=media`, method: 'GET', headers: { 'Authorization': `Bearer ${token}` } }, (res) => {
      const chunks: Buffer[] = []; res.on('data', c => chunks.push(c)); res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });
    req.on('error', reject); req.end();
  });
}

function exportDoc(fileId: string, token: string, mimeType: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname: 'www.googleapis.com', path: `/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(mimeType)}`, method: 'GET', headers: { 'Authorization': `Bearer ${token}` } }, (res) => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d));
    });
    req.on('error', reject); req.end();
  });
}

export async function listFiles(folderId?: string, pageSize = 50): Promise<DriveFile[]> {
  const token = getToken(); if (!token) throw new Error('GOOGLE_DRIVE_TOKEN not set');
  const query = folderId ? `'${folderId}' in parents and trashed=false` : 'trashed=false';
  const url = `/drive/v3/files?q=${encodeURIComponent(query)}&fields=${encodeURIComponent('files(id,name,mimeType,modifiedTime,size,webViewLink)')}&pageSize=${pageSize}&orderBy=modifiedTime+desc`;
=======
    const req = https.request({
      hostname: 'www.googleapis.com',
      path: `/drive/v3/files/${fileId}?alt=media`,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` },
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });
    req.on('error', reject);
    req.end();
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function listFiles(folderId?: string, pageSize = 50): Promise<DriveFile[]> {
  const token = getToken();
  if (!token) throw new Error('GOOGLE_DRIVE_TOKEN not set');

  const query = folderId
    ? `'${folderId}' in parents and trashed=false`
    : 'trashed=false';

  const fields = 'files(id,name,mimeType,modifiedTime,size,webViewLink)';
  const url = `/drive/v3/files?q=${encodeURIComponent(query)}&fields=${encodeURIComponent(fields)}&pageSize=${pageSize}&orderBy=modifiedTime+desc`;

>>>>>>> seo/phase-29-revenue-execution-loop
  const data = await driveGet(url, token);
  if (data.error) throw new Error(JSON.stringify(data.error));
  return data.files || [];
}

export async function readFileText(fileId: string): Promise<string> {
<<<<<<< HEAD
  const token = getToken(); if (!token) throw new Error('GOOGLE_DRIVE_TOKEN not set');
  const meta: any = await driveGet(`/drive/v3/files/${fileId}?fields=mimeType,name`, token);
  if (meta.mimeType === 'application/vnd.google-apps.document') return exportDoc(fileId, token, 'text/plain');
  if (meta.mimeType === 'application/vnd.google-apps.spreadsheet') return exportDoc(fileId, token, 'text/csv');
=======
  const token = getToken();
  if (!token) throw new Error('GOOGLE_DRIVE_TOKEN not set');

  // Export Google Docs as plain text
  const meta: any = await driveGet(`/drive/v3/files/${fileId}?fields=mimeType,name`, token);

  if (meta.mimeType === 'application/vnd.google-apps.document') {
    return new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'www.googleapis.com',
        path: `/drive/v3/files/${fileId}/export?mimeType=text/plain`,
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
      }, (res) => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => resolve(d));
      });
      req.on('error', reject);
      req.end();
    });
  }

  if (meta.mimeType === 'application/vnd.google-apps.spreadsheet') {
    return new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'www.googleapis.com',
        path: `/drive/v3/files/${fileId}/export?mimeType=text/csv`,
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
      }, (res) => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => resolve(d));
      });
      req.on('error', reject);
      req.end();
    });
  }

  // Raw file (txt, md, json)
>>>>>>> seo/phase-29-revenue-execution-loop
  return driveDownload(fileId, token);
}

export async function ingestFilesToKnowledge(fileIds: string[]): Promise<IngestResult[]> {
  const token = getToken();
  if (!token) return fileIds.map(id => ({ file_id: id, name: id, ingested: false, chars: 0, error: 'GOOGLE_DRIVE_TOKEN not set' }));
<<<<<<< HEAD
  const results: IngestResult[] = [];
=======

  const results: IngestResult[] = [];

>>>>>>> seo/phase-29-revenue-execution-loop
  for (const fileId of fileIds) {
    try {
      const meta: any = await driveGet(`/drive/v3/files/${fileId}?fields=name,mimeType`, token);
      const text = await readFileText(fileId);
<<<<<<< HEAD
      if (!text || text.length < 10) { results.push({ file_id: fileId, name: meta.name || fileId, ingested: false, chars: 0, error: 'Empty file' }); continue; }
      fs.mkdirSync(path.join(KNOWLEDGE_DIR, 'drive'), { recursive: true });
      const fname = `${fileId}-${(meta.name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_')}.txt`;
      fs.writeFileSync(path.join(KNOWLEDGE_DIR, 'drive', fname), text, 'utf8');
      results.push({ file_id: fileId, name: meta.name || fileId, ingested: true, chars: text.length });
    } catch (e: any) { results.push({ file_id: fileId, name: fileId, ingested: false, chars: 0, error: e.message }); }
  }
=======

      if (!text || text.length < 10) {
        results.push({ file_id: fileId, name: meta.name || fileId, ingested: false, chars: 0, error: 'Empty or unreadable file' });
        continue;
      }

      // Save to knowledge dir for RAG pickup
      fs.mkdirSync(path.join(KNOWLEDGE_DIR, 'drive'), { recursive: true });
      const fname = `${fileId}-${(meta.name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_')}.txt`;
      fs.writeFileSync(path.join(KNOWLEDGE_DIR, 'drive', fname), text, 'utf8');

      results.push({ file_id: fileId, name: meta.name || fileId, ingested: true, chars: text.length });
    } catch (e: any) {
      results.push({ file_id: fileId, name: fileId, ingested: false, chars: 0, error: e.message });
    }
  }

>>>>>>> seo/phase-29-revenue-execution-loop
  return results;
}

export async function searchDriveFiles(query: string, pageSize = 20): Promise<DriveFile[]> {
<<<<<<< HEAD
  const token = getToken(); if (!token) throw new Error('GOOGLE_DRIVE_TOKEN not set');
  const q = `fullText contains '${query.replace(/'/g, "\'")}' and trashed=false`;
  const url = `/drive/v3/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent('files(id,name,mimeType,modifiedTime,webViewLink)')}&pageSize=${pageSize}`;
=======
  const token = getToken();
  if (!token) throw new Error('GOOGLE_DRIVE_TOKEN not set');

  const fullQuery = `fullText contains '${query.replace(/'/g, "\\'")}' and trashed=false`;
  const fields = 'files(id,name,mimeType,modifiedTime,webViewLink)';
  const url = `/drive/v3/files?q=${encodeURIComponent(fullQuery)}&fields=${encodeURIComponent(fields)}&pageSize=${pageSize}`;

>>>>>>> seo/phase-29-revenue-execution-loop
  const data = await driveGet(url, token);
  if (data.error) throw new Error(JSON.stringify(data.error));
  return data.files || [];
}
