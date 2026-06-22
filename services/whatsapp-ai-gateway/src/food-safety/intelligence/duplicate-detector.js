'use strict';
/**
 * duplicate-detector.js
 * Detects duplicate or copy-pasted submissions using SQLite.
 */

const { makeLogger } = require('../../logger');
const log = makeLogger('duplicate-detector');

let _db = null;
function getDb() {
  if (!_db) { try { _db = require('../../storage/sqlite'); } catch (_) {} }
  return _db;
}

async function isDuplicateImage(imageHash) {
  if (!imageHash) return false;
  const db = getDb();
  if (!db) return false;
  try {
    const rows = await db.all(
      `SELECT id FROM food_safety_submissions WHERE image_hash = ? LIMIT 1`,
      [imageHash]
    );
    return rows.length > 0;
  } catch (_) { return false; }
}

async function detectCopyPaste(items) {
  if (!items || items.length < 3) return { detected: false };
  const vals = items.map(i => String(i.value ?? '').trim()).filter(v => v !== '');
  if (vals.length < 3) return { detected: false };

  const unique = new Set(vals).size;
  const ratio = unique / vals.length;

  if (ratio <= 0.25) {
    return {
      detected: true,
      reason: 'copy_paste',
      message: `${vals.length} readings, only ${unique} unique — likely copy-pasted`,
      uniqueRatio: ratio,
    };
  }
  return { detected: false };
}

async function checkDuplicate(submission) {
  const [imageResult, copyPaste] = await Promise.all([
    isDuplicateImage(submission.imageHash || submission.image_hash),
    detectCopyPaste(submission.items),
  ]);
  return {
    isDuplicate: imageResult,
    isCopyPaste: copyPaste.detected,
    copyPasteDetail: copyPaste.detected ? copyPaste : null,
  };
}

module.exports = { checkDuplicate, isDuplicateImage, detectCopyPaste };
