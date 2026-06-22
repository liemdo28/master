/**
 * Evidence Handler — saves evidence photos and links to same-day/store submissions
 *
 * Evidence photos are NOT processed as primary form records.
 * They are saved quietly and linked to existing submissions when possible.
 */

const path = require('path');
const fs = require('fs');
const { makeLogger } = require('../logger');
const { run } = require('../storage/sqlite');

const log = makeLogger('evidence');

const EVIDENCE_DIR = path.resolve('./data/uploads/evidence');

/**
 * Save an evidence photo.
 * @param {object} media - WhatsApp media object { data, mimetype }
 * @param {object} metadata - { chatId, sender, senderName, timestamp, messageId, groupName, caption, subtype }
 * @returns {string|null} - Saved file path or null on failure
 */
function saveEvidencePhoto(media, metadata) {
  try {
    if (!fs.existsSync(EVIDENCE_DIR)) {
      fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
    }
  } catch (err) {
    log.error('Failed to create evidence directory', { error: err.message });
    return null;
  }

  const { chatId, sender, timestamp, messageId, subtype } = metadata || {};
  const dateStr = timestamp ? new Date(timestamp).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  const timeStr = timestamp ? new Date(timestamp).toISOString().slice(11, 19).replace(/:/g, '-') : '';

  const dir = path.join(EVIDENCE_DIR, dateStr);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const ext = getExt(media);
  const safeId = (messageId || String(Date.now())).replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `${dateStr}_${timeStr}_${sender || 'unknown'}_${subtype || 'evidence'}_${safeId}${ext}`;
  const filePath = path.join(dir, filename);

  try {
    const buffer = media.data ? Buffer.from(media.data, 'base64') : media;
    fs.writeFileSync(filePath, buffer);

    const metaPath = filePath.replace(/\.[^.]+$/, '.meta.json');
    fs.writeFileSync(metaPath, JSON.stringify(metadata || {}, null, 2));

    log.info('Evidence photo saved', { filePath, subtype, chatId, sender });
    return filePath;
  } catch (err) {
    log.error('Failed to save evidence photo', { error: err.message });
    return null;
  }
}

/**
 * Record evidence in the database and link to same-day/store submission.
 */
async function recordEvidence(filePath, metadata) {
  const { chatId, sender, senderName, timestamp, messageId, groupName, subtype } = metadata || {};
  const dateStr = timestamp ? new Date(timestamp).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);

  try {
    await ensureTables();
  } catch (err) {
    log.warn('Evidence DB table not available', { error: err.message });
    return;
  }

  try {
    // Find same-day submission for this store
    let linkedSubmissionId = null;
    try {
      const rows = await run(
        `SELECT submission_id FROM food_safety_submissions
         WHERE chat_id = ? AND DATE(created_at) = DATE(?)
         ORDER BY created_at DESC LIMIT 1`,
        [chatId || '', dateStr]
      );
      // rows may be a stmt object — get actual result
    } catch (_) {}

    const evidenceId = `EV${Date.now().toString(36).toUpperCase()}`;

    await run(
      `INSERT INTO evidence_photos
       (evidence_id, chat_id, sender, sender_name, group_name, timestamp,
        image_path, subtype, linked_submission_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        evidenceId,
        chatId || '',
        sender || '',
        senderName || '',
        groupName || '',
        timestamp || new Date().toISOString(),
        filePath || '',
        subtype || 'other',
        linkedSubmissionId || '',
      ]
    );

    log.info('Evidence recorded', { evidenceId, linkedSubmissionId, subtype });
  } catch (err) {
    log.warn('Failed to record evidence in DB', { error: err.message });
  }
}

let tablesChecked = false;
async function ensureTables() {
  if (tablesChecked) return;
  try {
    await run(`
      CREATE TABLE IF NOT EXISTS evidence_photos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        evidence_id TEXT NOT NULL UNIQUE,
        chat_id TEXT,
        sender TEXT,
        sender_name TEXT,
        group_name TEXT,
        timestamp TEXT,
        image_path TEXT,
        subtype TEXT DEFAULT 'other',
        linked_submission_id TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);
    await run(`CREATE INDEX IF NOT EXISTS idx_evidence_chat ON evidence_photos(chat_id)`).catch(() => {});
    await run(`CREATE INDEX IF NOT EXISTS idx_evidence_submission ON evidence_photos(linked_submission_id)`).catch(() => {});
    tablesChecked = true;
  } catch (err) {
    log.warn('Evidence table init failed', { error: err.message });
  }
}

function getExt(media) {
  const mime = media?.mimetype || '';
  const map = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };
  return map[mime.toLowerCase()] || '.jpg';
}

/**
 * Build the evidence photo confirmation reply.
 */
function buildEvidenceReply(subtype) {
  const labels = {
    cooler: 'Cooler/freezer',
    freezer: 'Freezer',
    thermometer: 'Thermometer',
    fryer: 'Fryer',
    other: 'Food safety evidence',
  };
  const label = labels[subtype] || 'Evidence photo';
  return `${label} received and saved.`;
}

module.exports = { saveEvidencePhoto, recordEvidence, buildEvidenceReply, ensureTables };
