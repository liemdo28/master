'use strict';
/**
 * food-safety-skill.js
 * Mi skill: answer food safety questions, look up submissions, run summaries.
 */

const { makeLogger } = require('../../logger');
const log = makeLogger('mi');

const TRIGGERS = [
  /food.?safety/i, /line.?check/i, /temperature/i, /walk.?in/i,
  /fryer/i, /cooler/i, /freezer/i, /sanitizer/i, /pass.?fail/i,
];

function matches(text) {
  return TRIGGERS.some(t => t.test(text));
}

async function handle(query, context = {}) {
  log.info('food-safety-skill triggered', { query });

  try {
    const { searchSubmissions } = require('../../agent-tools/memory/food-safety-memory-indexer');
    const { results, source } = await searchSubmissions(query, { limit: 10, store: context.store });
    if (results.length === 0) return { ok: true, reply: `No food safety records found matching "${query}".` };

    const lines = results.slice(0, 5).map(r =>
      `• ${r.store || r.store_id || ''} | ${r.submitted_at || ''} | ${r.item_name || r.field_id || ''}: ${r.value ?? ''} [${r.status || ''}]`
    );
    return {
      ok: true,
      reply: `Found ${results.length} record(s) (source: ${source}):\n${lines.join('\n')}`,
      results,
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = { matches, handle, name: 'food-safety' };
