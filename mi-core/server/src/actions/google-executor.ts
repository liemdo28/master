/**
 * Google Action Executor
 * Executes approved actions: Gmail send, Calendar create/update, Drive upload.
 * Called ONLY after CEO approves via approval gate.
 * All actions are logged.
 */

import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { assertGoogleConnectorWriteEnabled, getAuthedClient, isConfigured, hasTokens, GOOGLE_WRITE_DISABLED_ERROR } from '../visibility/connectors/google/google-auth';

export type ExecutionResult = {
  success: boolean;
  action_type: string;
  detail?: string;
  link?: string;
  error?: string;
};

// ── Gmail Send ──────────────────────────────────────────────────────────────

export interface EmailPayload {
  to: string;
  subject: string;
  body: string;
  attachment_path?: string;
  cc?: string;
}

export async function executeGmailSend(payload: EmailPayload): Promise<ExecutionResult> {
  try { assertGoogleConnectorWriteEnabled(); } catch { return { success: false, action_type: 'gmail_send', error: GOOGLE_WRITE_DISABLED_ERROR }; }
  if (!isConfigured() || !hasTokens()) {
    return { success: false, action_type: 'gmail_send', error: 'Google not authorized. Visit /api/auth/google/start' };
  }
  try {
    const auth = await getAuthedClient();
    const gmail = google.gmail({ version: 'v1', auth });

    // Build RFC 2822 message
    const lines = [
      `To: ${payload.to}`,
      `Subject: ${payload.subject}`,
      payload.cc ? `Cc: ${payload.cc}` : '',
      'Content-Type: text/plain; charset=utf-8',
      'MIME-Version: 1.0',
      '',
      payload.body,
    ].filter(l => l !== undefined);

    const raw = Buffer.from(lines.join('\r\n'))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    });

    return {
      success: true,
      action_type: 'gmail_send',
      detail: `Email sent to ${payload.to} — Message ID: ${res.data.id}`,
    };
  } catch (e: unknown) {
    return { success: false, action_type: 'gmail_send', error: String(e) };
  }
}

export async function executeGmailDraft(payload: EmailPayload): Promise<ExecutionResult> {
  try { assertGoogleConnectorWriteEnabled(); } catch { return { success: false, action_type: 'gmail_draft', error: GOOGLE_WRITE_DISABLED_ERROR }; }
  if (!isConfigured() || !hasTokens()) {
    return { success: false, action_type: 'gmail_draft', error: 'Google not authorized' };
  }
  try {
    const auth = await getAuthedClient();
    const gmail = google.gmail({ version: 'v1', auth });

    const lines = [
      `To: ${payload.to}`,
      `Subject: ${payload.subject}`,
      payload.cc ? `Cc: ${payload.cc}` : '',
      'Content-Type: text/plain; charset=utf-8',
      'MIME-Version: 1.0',
      '',
      payload.body,
    ].filter(l => l !== undefined);

    const raw = Buffer.from(lines.join('\r\n'))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    const res = await gmail.users.drafts.create({
      userId: 'me',
      requestBody: { message: { raw } },
    });

    return {
      success: true,
      action_type: 'gmail_draft',
      detail: `Draft created — ID: ${res.data.id}`,
      link: `https://mail.google.com/mail/u/0/#drafts/${res.data.id}`,
    };
  } catch (e: unknown) {
    return { success: false, action_type: 'gmail_draft', error: String(e) };
  }
}

// ── Calendar Create ──────────────────────────────────────────────────────────

export interface CalendarEventPayload {
  title: string;
  start_datetime: string;   // ISO8601
  end_datetime: string;     // ISO8601
  description?: string;
  location?: string;
  attendees?: string[];     // email addresses
  timezone?: string;
}

export async function executeCalendarCreate(payload: CalendarEventPayload): Promise<ExecutionResult> {
  try { assertGoogleConnectorWriteEnabled(); } catch { return { success: false, action_type: 'calendar_create', error: GOOGLE_WRITE_DISABLED_ERROR }; }
  if (!isConfigured() || !hasTokens()) {
    return { success: false, action_type: 'calendar_create', error: 'Google not authorized. Visit /api/auth/google/start' };
  }
  try {
    const auth = await getAuthedClient();
    const calendar = google.calendar({ version: 'v3', auth });

    const event: Record<string, unknown> = {
      summary: payload.title,
      description: payload.description || '',
      location: payload.location || '',
      start: { dateTime: payload.start_datetime, timeZone: payload.timezone || 'America/Los_Angeles' },
      end: { dateTime: payload.end_datetime, timeZone: payload.timezone || 'America/Los_Angeles' },
    };

    if (payload.attendees && payload.attendees.length > 0) {
      event['attendees'] = payload.attendees.map(email => ({ email }));
    }

    const res = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
      sendUpdates: payload.attendees?.length ? 'all' : 'none',
    });

    return {
      success: true,
      action_type: 'calendar_create',
      detail: `Event created: "${payload.title}"`,
      link: res.data.htmlLink || '',
    };
  } catch (e: unknown) {
    return { success: false, action_type: 'calendar_create', error: String(e) };
  }
}

export async function executeCalendarUpdate(eventId: string, updates: Partial<CalendarEventPayload>): Promise<ExecutionResult> {
  try { assertGoogleConnectorWriteEnabled(); } catch { return { success: false, action_type: 'calendar_update', error: GOOGLE_WRITE_DISABLED_ERROR }; }
  if (!isConfigured() || !hasTokens()) {
    return { success: false, action_type: 'calendar_update', error: 'Google not authorized' };
  }
  try {
    const auth = await getAuthedClient();
    const calendar = google.calendar({ version: 'v3', auth });

    const patch: Record<string, unknown> = {};
    if (updates.title) patch['summary'] = updates.title;
    if (updates.description) patch['description'] = updates.description;
    if (updates.location) patch['location'] = updates.location;
    if (updates.start_datetime) patch['start'] = { dateTime: updates.start_datetime, timeZone: updates.timezone || 'America/Los_Angeles' };
    if (updates.end_datetime) patch['end'] = { dateTime: updates.end_datetime, timeZone: updates.timezone || 'America/Los_Angeles' };

    const res = await calendar.events.patch({
      calendarId: 'primary',
      eventId,
      requestBody: patch,
    });

    return { success: true, action_type: 'calendar_update', detail: `Event updated: ${res.data.id}` };
  } catch (e: unknown) {
    return { success: false, action_type: 'calendar_update', error: String(e) };
  }
}

// ── Drive Upload ─────────────────────────────────────────────────────────────

export interface DriveUploadPayload {
  local_path: string;
  folder_name?: string;
  folder_id?: string;
  share_with?: string[];  // emails to share with
}

export async function executeDriveUpload(payload: DriveUploadPayload): Promise<ExecutionResult> {
  try { assertGoogleConnectorWriteEnabled(); } catch { return { success: false, action_type: 'drive_upload', error: GOOGLE_WRITE_DISABLED_ERROR }; }
  if (!isConfigured() || !hasTokens()) {
    return { success: false, action_type: 'drive_upload', error: 'Google not authorized. Visit /api/auth/google/start' };
  }
  if (!fs.existsSync(payload.local_path)) {
    return { success: false, action_type: 'drive_upload', error: `File not found: ${payload.local_path}` };
  }
  try {
    const auth = await getAuthedClient();
    const drive = google.drive({ version: 'v3', auth });

    const fileName = path.basename(payload.local_path);
    const fileStream = fs.createReadStream(payload.local_path);
    const mimeType = guessMimeType(fileName);

    const meta: Record<string, unknown> = { name: fileName };
    if (payload.folder_id) meta['parents'] = [payload.folder_id];

    const res = await drive.files.create({
      requestBody: meta,
      media: { mimeType, body: fileStream },
      fields: 'id,webViewLink,name',
    });

    let shareLink = res.data.webViewLink || '';

    // Share with specified emails
    if (payload.share_with?.length) {
      for (const email of payload.share_with) {
        await drive.permissions.create({
          fileId: res.data.id!,
          requestBody: { type: 'user', role: 'reader', emailAddress: email },
          sendNotificationEmail: true,
        });
      }
    }

    return {
      success: true,
      action_type: 'drive_upload',
      detail: `Uploaded "${fileName}" to Google Drive`,
      link: shareLink,
    };
  } catch (e: unknown) {
    return { success: false, action_type: 'drive_upload', error: String(e) };
  }
}

export async function executeDriveShare(fileId: string, email: string, role: 'reader' | 'writer' = 'reader'): Promise<ExecutionResult> {
  try { assertGoogleConnectorWriteEnabled(); } catch { return { success: false, action_type: 'drive_share', error: GOOGLE_WRITE_DISABLED_ERROR }; }
  if (!isConfigured() || !hasTokens()) {
    return { success: false, action_type: 'drive_share', error: 'Google not authorized' };
  }
  try {
    const auth = await getAuthedClient();
    const drive = google.drive({ version: 'v3', auth });
    await drive.permissions.create({
      fileId,
      requestBody: { type: 'user', role, emailAddress: email },
      sendNotificationEmail: true,
    });
    return { success: true, action_type: 'drive_share', detail: `Shared file ${fileId} with ${email} (${role})` };
  } catch (e: unknown) {
    return { success: false, action_type: 'drive_share', error: String(e) };
  }
}

// ── Asana Task Create ────────────────────────────────────────────────────────

export interface AsanaTaskPayload {
  name: string;
  notes?: string;
  assignee_email?: string;
  due_on?: string;
  project_id?: string;
  workspace_id?: string;
}

export async function executeAsanaCreateTask(payload: AsanaTaskPayload): Promise<ExecutionResult> {
  const token = process.env.ASANA_TOKEN;
  if (!token) return { success: false, action_type: 'asana_create', error: 'ASANA_TOKEN not set in .env' };

  try {
    // Get workspace if not provided
    let wsId = payload.workspace_id;
    if (!wsId) {
      const wsRes = await fetch('https://app.asana.com/api/1.0/workspaces', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const wsData = await wsRes.json() as { data: Array<{ gid: string }> };
      wsId = wsData.data[0]?.gid;
    }
    if (!wsId) return { success: false, action_type: 'asana_create', error: 'No Asana workspace found' };

    const body: Record<string, unknown> = {
      name: payload.name,
      notes: payload.notes || '',
      workspace: wsId,
    };
    if (payload.assignee_email) body['assignee'] = payload.assignee_email;
    if (payload.due_on) body['due_on'] = payload.due_on;
    if (payload.project_id) body['projects'] = [payload.project_id];

    const res = await fetch('https://app.asana.com/api/1.0/tasks', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data: body }),
    });

    const data = await res.json() as { data?: { gid: string; permalink_url?: string } };
    if (!res.ok) return { success: false, action_type: 'asana_create', error: JSON.stringify(data) };

    return {
      success: true,
      action_type: 'asana_create',
      detail: `Asana task created: "${payload.name}"`,
      link: data.data?.permalink_url || `https://app.asana.com/0/0/${data.data?.gid}`,
    };
  } catch (e: unknown) {
    return { success: false, action_type: 'asana_create', error: String(e) };
  }
}

export async function executeAsanaUpdateTask(taskId: string, updates: Partial<AsanaTaskPayload>): Promise<ExecutionResult> {
  const token = process.env.ASANA_TOKEN;
  if (!token) return { success: false, action_type: 'asana_update', error: 'ASANA_TOKEN not set' };
  try {
    const body: Record<string, unknown> = {};
    if (updates.name) body['name'] = updates.name;
    if (updates.notes) body['notes'] = updates.notes;
    if (updates.due_on) body['due_on'] = updates.due_on;
    if (updates.assignee_email) body['assignee'] = updates.assignee_email;

    const res = await fetch(`https://app.asana.com/api/1.0/tasks/${taskId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: body }),
    });
    if (!res.ok) return { success: false, action_type: 'asana_update', error: await res.text() };
    return { success: true, action_type: 'asana_update', detail: `Task ${taskId} updated` };
  } catch (e: unknown) {
    return { success: false, action_type: 'asana_update', error: String(e) };
  }
}

// ── Dashboard Task Create ────────────────────────────────────────────────────

export interface DashboardTaskPayload {
  title: string;
  description?: string;
  assignee?: string;
  priority?: 'low' | 'normal' | 'high';
  due_date?: string;
}

export async function executeDashboardCreateTask(payload: DashboardTaskPayload): Promise<ExecutionResult> {
  const base = process.env.DASHBOARD_URL || 'http://dashboard.bakudanramen.com';
  try {
    const res = await fetch(`${base}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return { success: false, action_type: 'dashboard_create', error: `HTTP ${res.status}` };
    const data = await res.json() as { id?: string | number };
    return {
      success: true,
      action_type: 'dashboard_create',
      detail: `Dashboard task created: "${payload.title}" (ID: ${data.id || 'unknown'})`,
      link: `${base}/tasks`,
    };
  } catch (e: unknown) {
    return { success: false, action_type: 'dashboard_create', error: String(e) };
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function guessMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    csv: 'text/csv',
    txt: 'text/plain',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    json: 'application/json',
    zip: 'application/zip',
  };
  return map[ext] || 'application/octet-stream';
}

// ── Action Dispatch (called by approval route) ────────────────────────────────

export async function executeApprovedAction(
  category: string,
  payload: Record<string, unknown>
): Promise<ExecutionResult> {
  switch (category) {
    case 'gmail_send':
      return executeGmailSend(payload as unknown as EmailPayload);
    case 'gmail_draft':
      return executeGmailDraft(payload as unknown as EmailPayload);
    case 'calendar_create':
      return executeCalendarCreate(payload as unknown as CalendarEventPayload);
    case 'calendar_update':
      return executeCalendarUpdate(payload['event_id'] as string, payload as unknown as Partial<CalendarEventPayload>);
    case 'drive_upload':
      return executeDriveUpload(payload as unknown as DriveUploadPayload);
    case 'drive_share':
      return executeDriveShare(payload['file_id'] as string, payload['email'] as string, (payload['role'] as 'reader' | 'writer') || 'reader');
    case 'asana_create':
      return executeAsanaCreateTask(payload as unknown as AsanaTaskPayload);
    case 'asana_update':
      return executeAsanaUpdateTask(payload['task_id'] as string, payload as unknown as Partial<AsanaTaskPayload>);
    case 'dashboard_create':
      return executeDashboardCreateTask(payload as unknown as DashboardTaskPayload);
    default:
      return { success: false, action_type: category, error: `No executor for category: ${category}` };
  }
}
