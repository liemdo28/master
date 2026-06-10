'use strict';
/**
 * food-safety-action-item-skill.js
 * Mi skill: list outstanding action items (failures, missing submissions).
 */

const { makeLogger } = require('../../logger');
const log = makeLogger('mi');

const TRIGGERS = [/action.?item/i, /what.*(need|fix|overdue|missing)/i, /missing.*submission/i, /failed.*check/i];

function matches(text) {
  return TRIGGERS.some(t => t.test(text));
}

async function handle(query, context = {}) {
  log.info('food-safety-action-item-skill triggered', { query });
  try {
    const { detectMissing } = require('../../food-safety/alerts/missing-submission-detector');
    const db = (() => { try { return require('../../storage/sqlite'); } catch (_) { return null; } })();
    const date = context.date || new Date().toISOString().slice(0, 10);

    const [missingResult, failRows] = await Promise.all([
      detectMissing(date),
      db ? db.all(`SELECT store_id, employee, shift FROM food_safety_submissions WHERE date(submitted_at) = date(?) AND status IN ('FAIL','UNSAFE') ORDER BY submitted_at DESC LIMIT 10`, [date]).catch(() => []) : [],
    ]);

    const lines = [];
    if (missingResult.missing.length) {
      lines.push('*Missing Submissions:*');
      missingResult.missing.forEach(m => lines.push(`• ${m.store_name || m.store_id} — ${m.shift}`));
    }
    if (failRows.length) {
      lines.push('*Failed Checks:*');
      failRows.forEach(r => lines.push(`• ${r.store_id} — ${r.employee || 'Unknown'} (${r.shift || ''})`));
    }

    if (lines.length === 0) return { ok: true, reply: `No action items for ${date}. All clear!` };
    return { ok: true, reply: `*Food Safety Action Items — ${date}*\n${lines.join('\n')}` };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = { matches, handle, name: 'food-safety-action-items' };
