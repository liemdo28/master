'use strict';
/**
 * food-safety-summary-skill.js
 * Mi skill: daily/weekly summary of food safety submissions.
 */

const { makeLogger } = require('../../logger');
const log = makeLogger('mi');

const TRIGGERS = [/summar/i, /report/i, /today.?food/i, /food.?today/i, /daily.?check/i];

function matches(text) {
  return TRIGGERS.some(t => t.test(text)) && /food|safety|line.?check/i.test(text);
}

async function handle(query, context = {}) {
  log.info('food-safety-summary-skill triggered', { query });
  try {
    const db = (() => { try { return require('../../storage/sqlite'); } catch (_) { return null; } })();
    if (!db) return { ok: false, error: 'Database unavailable' };

    const date = context.date || new Date().toISOString().slice(0, 10);
    const rows = await db.all(
      `SELECT store_id,
              SUM(CASE WHEN status IN ('PASS','pass') THEN 1 ELSE 0 END) as pass,
              SUM(CASE WHEN status IN ('FAIL','UNSAFE','fail') THEN 1 ELSE 0 END) as fail,
              COUNT(*) as total
       FROM food_safety_submissions
       WHERE date(created_at) = date(?)
       GROUP BY store_id`,
      [date]
    );

    if (rows.length === 0) return { ok: true, reply: `No food safety submissions found for ${date}.` };

    const lines = rows.map(r => `• ${r.store_id}: ${r.pass} pass, ${r.fail} fail (${r.total} total)`);
    return { ok: true, reply: `*Food Safety Summary — ${date}*\n${lines.join('\n')}`, rows };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = { matches, handle, name: 'food-safety-summary' };
