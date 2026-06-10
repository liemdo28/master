"use strict";
/**
 * Gmail Connector — reads recent emails, extracts important ones.
 * Read-only. Caches to .local-agent-global/visibility/gmail/
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncGmail = syncGmail;
exports.getCachedGmail = getCachedGmail;
exports.getImportantEmails = getImportantEmails;
const googleapis_1 = require("googleapis");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const google_auth_1 = require("./google-auth");
const GLOBAL_DIR = process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global';
const CACHE_DIR = path_1.default.join(GLOBAL_DIR, 'visibility', 'gmail');
function decodeBase64(data) {
    return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
}
function parseHeader(headers, name) {
    return headers.find(h => (h.name || '').toLowerCase() === name.toLowerCase())?.value || '';
}
async function syncGmail(maxMessages = 50) {
    const auth = await (0, google_auth_1.getAuthedClient)();
    const gmail = googleapis_1.google.gmail({ version: 'v1', auth });
    // Get label list
    const labelsRes = await gmail.users.labels.list({ userId: 'me' });
    const labelMap = {};
    for (const l of labelsRes.data.labels || []) {
        if (l.id && l.name)
            labelMap[l.id] = l.name;
    }
    // Get recent messages
    const listRes = await gmail.users.messages.list({
        userId: 'me',
        maxResults: maxMessages,
        q: 'newer_than:7d',
    });
    const messages = listRes.data.messages || [];
    const emails = [];
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
                    id: msg.id,
                    format: 'metadata',
                    metadataHeaders: ['Subject', 'From', 'Date'],
                });
                const headers = detail.data.payload?.headers || [];
                const labelIds = detail.data.labelIds || [];
                const isUnread = labelIds.includes('UNREAD');
                const isImportant = labelIds.includes('IMPORTANT') || labelIds.includes('STARRED');
                if (isUnread)
                    unreadCount++;
                if (isImportant)
                    importantCount++;
                emails.push({
                    id: detail.data.id,
                    thread_id: detail.data.threadId,
                    subject: parseHeader(headers, 'Subject') || '(no subject)',
                    from: parseHeader(headers, 'From'),
                    date: parseHeader(headers, 'Date'),
                    snippet: detail.data.snippet?.slice(0, 200) || '',
                    labels: labelIds.map(id => labelMap[id] || id).filter(Boolean),
                    is_unread: isUnread,
                    is_important: isImportant,
                });
            }
            catch { /* skip failed message */ }
        }));
    }
    // Sort by date desc
    emails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const snapshot = {
        synced_at: new Date().toISOString(),
        unread_count: unreadCount,
        important_count: importantCount,
        emails,
        labels: Object.values(labelMap),
    };
    // Write cache
    fs_1.default.mkdirSync(CACHE_DIR, { recursive: true });
    fs_1.default.writeFileSync(path_1.default.join(CACHE_DIR, 'data.json'), JSON.stringify(snapshot, null, 2));
    fs_1.default.writeFileSync(path_1.default.join(CACHE_DIR, 'summary.json'), JSON.stringify({
        unread: unreadCount, important: importantCount, total: emails.length, synced_at: snapshot.synced_at,
    }, null, 2));
    fs_1.default.writeFileSync(path_1.default.join(CACHE_DIR, 'last_sync.json'), JSON.stringify({ synced_at: snapshot.synced_at }));
    fs_1.default.writeFileSync(path_1.default.join(CACHE_DIR, 'errors.json'), JSON.stringify([]));
    return snapshot;
}
function getCachedGmail() {
    try {
        return JSON.parse(fs_1.default.readFileSync(path_1.default.join(CACHE_DIR, 'data.json'), 'utf-8'));
    }
    catch {
        return null;
    }
}
function getImportantEmails(limit = 10) {
    const cached = getCachedGmail();
    if (!cached)
        return [];
    return cached.emails
        .filter(e => e.is_important || e.is_unread)
        .slice(0, limit);
}
