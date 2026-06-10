'use strict';
/**
 * missing-submission-detector.js
 * Detects stores that have not submitted required food safety forms for a given shift/date.
 */

const { makeLogger } = require('../../logger');
const log = makeLogger('alerts');

let _db = null;
function getDb() {
  if (!_db) { try { _db = require('../../storage/sqlite'); } catch (_) {} }
  return _db;
}

const REQUIRED_SHIFTS = ['AM', 'PM'];

async function getConfiguredStores() {
  try {
    const storeRegistry = require('../../stores/store-registry');
    const stores = await storeRegistry.getAllStores();
    return stores || [];
  } catch (_) {
    return [];
  }
}

async function getSubmissionsForDate(date) {
  const db = getDb();
  if (!db) return [];
  try {
    return await db.all(
      `SELECT store_id, shift FROM food_safety_submissions
       WHERE date(submitted_at) = date(?) AND status != 'rejected'`,
      [date]
    );
  } catch (_) { return []; }
}

async function detectMissing(date = null) {
  const targetDate = date || new Date().toISOString().slice(0, 10);
  const [stores, submissions] = await Promise.all([
    getConfiguredStores(),
    getSubmissionsForDate(targetDate),
  ]);

  const submitted = new Set(submissions.map(s => `${s.store_id}:${(s.shift || '').toUpperCase()}`));
  const missing = [];

  for (const store of stores) {
    for (const shift of REQUIRED_SHIFTS) {
      const key = `${store.store_id}:${shift}`;
      if (!submitted.has(key)) {
        missing.push({ store_id: store.store_id, store_name: store.name || store.store_id, shift, date: targetDate });
      }
    }
  }

  return { date: targetDate, missing, total: stores.length * REQUIRED_SHIFTS.length, received: submissions.length };
}

module.exports = { detectMissing, getSubmissionsForDate };
