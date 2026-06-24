const fs = require('fs');
const path = require('path');

const LOG_DIR = path.resolve(process.env.LOG_DIR || './logs');
const AUDIT_PATH = path.join(LOG_DIR, 'fallback-audit.json');
const MAX_ENTRIES = parseInt(process.env.FALLBACK_AUDIT_MAX_ENTRIES || '500', 10);

function ensureDir() {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
}

function readEntries() {
  try {
    if (!fs.existsSync(AUDIT_PATH)) return [];
    const parsed = JSON.parse(fs.readFileSync(AUDIT_PATH, 'utf8'));
    return Array.isArray(parsed.entries) ? parsed.entries : [];
  } catch (_) {
    return [];
  }
}

function writeEntries(entries) {
  ensureDir();
  const payload = {
    updated_at: new Date().toISOString(),
    entries: entries.slice(-MAX_ENTRIES),
  };
  fs.writeFileSync(AUDIT_PATH, JSON.stringify(payload, null, 2));
}

function normalizeMessage(message) {
  return String(message || '').trim().replace(/\s+/g, ' ').slice(0, 240);
}

async function recordFallback(entry) {
  const rows = readEntries();
  rows.push({
    timestamp: new Date().toISOString(),
    message: normalizeMessage(entry.message),
    language: entry.language || 'unknown',
    language_confidence: entry.language_confidence ?? null,
    intent: entry.intent || 'unknown',
    confidence: entry.confidence ?? null,
    response: String(entry.response || '').slice(0, 500),
    phone: entry.phone || '',
    chat_id: entry.chat_id || '',
    build_id: entry.build_id || '',
    commit: entry.commit || '',
  });
  writeEntries(rows);
}

function getTopUnknownMessages(limit = 10) {
  const counts = new Map();
  for (const row of readEntries()) {
    const key = normalizeMessage(row.message);
    if (!key) continue;
    const current = counts.get(key) || { message: key, count: 0, last_seen: '', language: row.language || 'unknown' };
    current.count += 1;
    if (!current.last_seen || String(row.timestamp || '').localeCompare(current.last_seen) > 0) {
      current.last_seen = row.timestamp || '';
      current.language = row.language || current.language;
    }
    counts.set(key, current);
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || String(b.last_seen).localeCompare(String(a.last_seen)))
    .slice(0, limit);
}

module.exports = { AUDIT_PATH, recordFallback, getTopUnknownMessages, readEntries };
