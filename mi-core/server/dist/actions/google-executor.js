"use strict";
/**
 * Google Action Executor
 * Executes approved actions: Gmail send, Calendar create/update, Drive upload.
 * Called ONLY after CEO approves via approval gate.
 * All actions are logged.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeGmailSend = executeGmailSend;
exports.executeGmailDraft = executeGmailDraft;
exports.executeCalendarCreate = executeCalendarCreate;
exports.executeCalendarUpdate = executeCalendarUpdate;
exports.executeDriveUpload = executeDriveUpload;
exports.executeDriveShare = executeDriveShare;
exports.executeAsanaCreateTask = executeAsanaCreateTask;
exports.executeAsanaUpdateTask = executeAsanaUpdateTask;
exports.executeDashboardCreateTask = executeDashboardCreateTask;
exports.executeApprovedAction = executeApprovedAction;
const googleapis_1 = require("googleapis");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const google_auth_1 = require("../visibility/connectors/google/google-auth");
async function executeGmailSend(payload) {
    if (!(0, google_auth_1.isConfigured)() || !(0, google_auth_1.hasTokens)()) {
        return { success: false, action_type: 'gmail_send', error: 'Google not authorized. Visit /api/auth/google/start' };
    }
    try {
        const auth = await (0, google_auth_1.getAuthedClient)();
        const gmail = googleapis_1.google.gmail({ version: 'v1', auth });
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
    }
    catch (e) {
        return { success: false, action_type: 'gmail_send', error: String(e) };
    }
}
async function executeGmailDraft(payload) {
    if (!(0, google_auth_1.isConfigured)() || !(0, google_auth_1.hasTokens)()) {
        return { success: false, action_type: 'gmail_draft', error: 'Google not authorized' };
    }
    try {
        const auth = await (0, google_auth_1.getAuthedClient)();
        const gmail = googleapis_1.google.gmail({ version: 'v1', auth });
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
    }
    catch (e) {
        return { success: false, action_type: 'gmail_draft', error: String(e) };
    }
}
async function executeCalendarCreate(payload) {
    if (!(0, google_auth_1.isConfigured)() || !(0, google_auth_1.hasTokens)()) {
        return { success: false, action_type: 'calendar_create', error: 'Google not authorized. Visit /api/auth/google/start' };
    }
    try {
        const auth = await (0, google_auth_1.getAuthedClient)();
        const calendar = googleapis_1.google.calendar({ version: 'v3', auth });
        const event = {
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
    }
    catch (e) {
        return { success: false, action_type: 'calendar_create', error: String(e) };
    }
}
async function executeCalendarUpdate(eventId, updates) {
    if (!(0, google_auth_1.isConfigured)() || !(0, google_auth_1.hasTokens)()) {
        return { success: false, action_type: 'calendar_update', error: 'Google not authorized' };
    }
    try {
        const auth = await (0, google_auth_1.getAuthedClient)();
        const calendar = googleapis_1.google.calendar({ version: 'v3', auth });
        const patch = {};
        if (updates.title)
            patch['summary'] = updates.title;
        if (updates.description)
            patch['description'] = updates.description;
        if (updates.location)
            patch['location'] = updates.location;
        if (updates.start_datetime)
            patch['start'] = { dateTime: updates.start_datetime, timeZone: updates.timezone || 'America/Los_Angeles' };
        if (updates.end_datetime)
            patch['end'] = { dateTime: updates.end_datetime, timeZone: updates.timezone || 'America/Los_Angeles' };
        const res = await calendar.events.patch({
            calendarId: 'primary',
            eventId,
            requestBody: patch,
        });
        return { success: true, action_type: 'calendar_update', detail: `Event updated: ${res.data.id}` };
    }
    catch (e) {
        return { success: false, action_type: 'calendar_update', error: String(e) };
    }
}
async function executeDriveUpload(payload) {
    if (!(0, google_auth_1.isConfigured)() || !(0, google_auth_1.hasTokens)()) {
        return { success: false, action_type: 'drive_upload', error: 'Google not authorized. Visit /api/auth/google/start' };
    }
    if (!fs_1.default.existsSync(payload.local_path)) {
        return { success: false, action_type: 'drive_upload', error: `File not found: ${payload.local_path}` };
    }
    try {
        const auth = await (0, google_auth_1.getAuthedClient)();
        const drive = googleapis_1.google.drive({ version: 'v3', auth });
        const fileName = path_1.default.basename(payload.local_path);
        const fileStream = fs_1.default.createReadStream(payload.local_path);
        const mimeType = guessMimeType(fileName);
        const meta = { name: fileName };
        if (payload.folder_id)
            meta['parents'] = [payload.folder_id];
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
                    fileId: res.data.id,
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
    }
    catch (e) {
        return { success: false, action_type: 'drive_upload', error: String(e) };
    }
}
async function executeDriveShare(fileId, email, role = 'reader') {
    if (!(0, google_auth_1.isConfigured)() || !(0, google_auth_1.hasTokens)()) {
        return { success: false, action_type: 'drive_share', error: 'Google not authorized' };
    }
    try {
        const auth = await (0, google_auth_1.getAuthedClient)();
        const drive = googleapis_1.google.drive({ version: 'v3', auth });
        await drive.permissions.create({
            fileId,
            requestBody: { type: 'user', role, emailAddress: email },
            sendNotificationEmail: true,
        });
        return { success: true, action_type: 'drive_share', detail: `Shared file ${fileId} with ${email} (${role})` };
    }
    catch (e) {
        return { success: false, action_type: 'drive_share', error: String(e) };
    }
}
async function executeAsanaCreateTask(payload) {
    const token = process.env.ASANA_TOKEN;
    if (!token)
        return { success: false, action_type: 'asana_create', error: 'ASANA_TOKEN not set in .env' };
    try {
        // Get workspace if not provided
        let wsId = payload.workspace_id;
        if (!wsId) {
            const wsRes = await fetch('https://app.asana.com/api/1.0/workspaces', {
                headers: { Authorization: `Bearer ${token}` },
            });
            const wsData = await wsRes.json();
            wsId = wsData.data[0]?.gid;
        }
        if (!wsId)
            return { success: false, action_type: 'asana_create', error: 'No Asana workspace found' };
        const body = {
            name: payload.name,
            notes: payload.notes || '',
            workspace: wsId,
        };
        if (payload.assignee_email)
            body['assignee'] = payload.assignee_email;
        if (payload.due_on)
            body['due_on'] = payload.due_on;
        if (payload.project_id)
            body['projects'] = [payload.project_id];
        const res = await fetch('https://app.asana.com/api/1.0/tasks', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ data: body }),
        });
        const data = await res.json();
        if (!res.ok)
            return { success: false, action_type: 'asana_create', error: JSON.stringify(data) };
        return {
            success: true,
            action_type: 'asana_create',
            detail: `Asana task created: "${payload.name}"`,
            link: data.data?.permalink_url || `https://app.asana.com/0/0/${data.data?.gid}`,
        };
    }
    catch (e) {
        return { success: false, action_type: 'asana_create', error: String(e) };
    }
}
async function executeAsanaUpdateTask(taskId, updates) {
    const token = process.env.ASANA_TOKEN;
    if (!token)
        return { success: false, action_type: 'asana_update', error: 'ASANA_TOKEN not set' };
    try {
        const body = {};
        if (updates.name)
            body['name'] = updates.name;
        if (updates.notes)
            body['notes'] = updates.notes;
        if (updates.due_on)
            body['due_on'] = updates.due_on;
        if (updates.assignee_email)
            body['assignee'] = updates.assignee_email;
        const res = await fetch(`https://app.asana.com/api/1.0/tasks/${taskId}`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: body }),
        });
        if (!res.ok)
            return { success: false, action_type: 'asana_update', error: await res.text() };
        return { success: true, action_type: 'asana_update', detail: `Task ${taskId} updated` };
    }
    catch (e) {
        return { success: false, action_type: 'asana_update', error: String(e) };
    }
}
async function executeDashboardCreateTask(payload) {
    const base = process.env.DASHBOARD_URL || 'http://dashboard.bakudanramen.com';
    try {
        const res = await fetch(`${base}/api/tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(10000),
        });
        if (!res.ok)
            return { success: false, action_type: 'dashboard_create', error: `HTTP ${res.status}` };
        const data = await res.json();
        return {
            success: true,
            action_type: 'dashboard_create',
            detail: `Dashboard task created: "${payload.title}" (ID: ${data.id || 'unknown'})`,
            link: `${base}/tasks`,
        };
    }
    catch (e) {
        return { success: false, action_type: 'dashboard_create', error: String(e) };
    }
}
// ── Helpers ──────────────────────────────────────────────────────────────────
function guessMimeType(filename) {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const map = {
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
async function executeApprovedAction(category, payload) {
    switch (category) {
        case 'gmail_send':
            return executeGmailSend(payload);
        case 'gmail_draft':
            return executeGmailDraft(payload);
        case 'calendar_create':
            return executeCalendarCreate(payload);
        case 'calendar_update':
            return executeCalendarUpdate(payload['event_id'], payload);
        case 'drive_upload':
            return executeDriveUpload(payload);
        case 'drive_share':
            return executeDriveShare(payload['file_id'], payload['email'], payload['role'] || 'reader');
        case 'asana_create':
            return executeAsanaCreateTask(payload);
        case 'asana_update':
            return executeAsanaUpdateTask(payload['task_id'], payload);
        case 'dashboard_create':
            return executeDashboardCreateTask(payload);
        default:
            return { success: false, action_type: category, error: `No executor for category: ${category}` };
    }
}
