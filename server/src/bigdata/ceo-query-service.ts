/**
 * CEO Query Service — Phase 6
 * Rule-based operational queries with optional AI summarization.
 * Mi calls this to answer CEO operational questions.
 */

import { pgQuery } from './db-client';
import { hybridSearch } from './search-service';

export interface QueryResult {
  question: string;
  answer: string;
  data: unknown[];
  source: 'rule' | 'search' | 'empty';
}

type QueryHandler = (question: string, filters: Record<string, string>) => Promise<QueryResult>;

// ── Rule-based query handlers ─────────────────────────────────────────────────

async function storeIssueRanking(question: string, _f: Record<string, string>): Promise<QueryResult> {
  const rows = await pgQuery<{ store_id: string; cnt: string }>(
    `SELECT store_id, COUNT(*) as cnt FROM normalized_events
     WHERE status IN ('failed','error','escalated','overdue','dispute')
       AND event_time > NOW() - INTERVAL '30 days'
       AND store_id IS NOT NULL
     GROUP BY store_id ORDER BY cnt DESC`
  );
  if (rows.length === 0) return { question, answer: 'Không có store nào có issue trong 30 ngày qua.', data: [], source: 'rule' };
  const lines = rows.map(r => `• **${r.store_id}**: ${r.cnt} issues`).join('\n');
  return { question, answer: `**Store có nhiều issue nhất (30 ngày):**\n${lines}`, data: rows, source: 'rule' };
}

async function storeWeeklyIssues(question: string, filters: Record<string, string>): Promise<QueryResult> {
  const store = filters['store'] || 'bakudan';
  const rows = await pgQuery(
    `SELECT e.event_type, e.title, e.status, e.event_time, s.name as source
     FROM normalized_events e JOIN data_sources s ON s.id=e.source_id
     WHERE e.store_id ILIKE $1
       AND e.event_time > NOW() - INTERVAL '7 days'
       AND e.status IN ('error','failed','escalated','overdue','dispute','pending')
     ORDER BY e.event_time DESC LIMIT 20`,
    [`%${store}%`]
  );
  if (rows.length === 0) return { question, answer: `Không tìm thấy issue nào cho store "${store}" trong 7 ngày qua.`, data: [], source: 'rule' };
  const lines = (rows as Record<string, unknown>[]).map((r) =>
    `• [${r['event_type']}] ${r['title']} — ${r['status']} (${r['source']})`
  ).join('\n');
  return { question, answer: `**Issues tại ${store} (7 ngày):**\n${lines}`, data: rows, source: 'rule' };
}

async function doordashDisputesPending(question: string, _f: Record<string, string>): Promise<QueryResult> {
  const rows = await pgQuery(
    `SELECT e.* FROM normalized_events e JOIN data_sources s ON s.id=e.source_id
     WHERE s.type='doordash' AND e.event_type='dispute'
       AND (e.status = 'pending' OR e.status IS NULL)
     ORDER BY e.event_time DESC LIMIT 30`
  );
  if (rows.length === 0) return { question, answer: 'Không có DoorDash dispute nào đang pending.', data: [], source: 'rule' };
  return {
    question,
    answer: `**DoorDash disputes chưa xử lý: ${rows.length}**\n${(rows as Record<string,unknown>[]).map(r => `• ${r['title']} — ${r['event_time']}`).join('\n')}`,
    data: rows, source: 'rule',
  };
}

async function reviewsNeedEscalation(question: string, _f: Record<string, string>): Promise<QueryResult> {
  const rows = await pgQuery(
    `SELECT e.* FROM normalized_events e JOIN data_sources s ON s.id=e.source_id
     WHERE s.type='review'
       AND (e.metadata_json->>'rating')::int <= 2
       AND (e.status = 'pending' OR e.metadata_json->>'escalated' = 'false')
     ORDER BY e.event_time DESC LIMIT 20`
  );
  if (rows.length === 0) return { question, answer: 'Không có review xấu nào cần escalate.', data: [], source: 'rule' };
  return {
    question,
    answer: `**Reviews xấu cần escalate: ${rows.length}**\n${(rows as Record<string,unknown>[]).map(r => `• ${r['title']} (${r['store_id']})`).join('\n')}`,
    data: rows, source: 'rule',
  };
}

async function qbMissingDays(question: string, _f: Record<string, string>): Promise<QueryResult> {
  const rows = await pgQuery<{ event_day: string }>(
    `SELECT DATE(event_time) as event_day FROM normalized_events e
     JOIN data_sources s ON s.id=e.source_id
     WHERE s.type='quickbooks' AND event_time > NOW() - INTERVAL '30 days'
     GROUP BY DATE(event_time) ORDER BY event_day`
  );
  const present = new Set(rows.map(r => r.event_day));
  const missing: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    if (!present.has(ds)) missing.push(ds);
  }
  if (missing.length === 0) return { question, answer: 'QuickBooks có đầy đủ activity 30 ngày qua. ✅', data: [], source: 'rule' };
  return {
    question,
    answer: `**QB thiếu activity ${missing.length} ngày:**\n${missing.join(', ')}`,
    data: missing, source: 'rule',
  };
}

async function managerMissedSubmissions(question: string, _f: Record<string, string>): Promise<QueryResult> {
  const rows = await pgQuery<{ actor: string; cnt: string }>(
    `SELECT actor, COUNT(*) as cnt FROM normalized_events
     WHERE event_type IN ('task','submission') AND status='missed'
       AND event_time > NOW() - INTERVAL '30 days'
       AND actor IS NOT NULL
     GROUP BY actor ORDER BY cnt DESC`
  );
  if (rows.length === 0) return { question, answer: 'Không có manager nào miss submission trong 30 ngày qua.', data: [], source: 'rule' };
  const lines = rows.map(r => `• **${r.actor}**: ${r.cnt} lần`).join('\n');
  return { question, answer: `**Manager miss submission (30 ngày):**\n${lines}`, data: rows, source: 'rule' };
}

async function duplicateInvoices(question: string, _f: Record<string, string>): Promise<QueryResult> {
  const rows = await pgQuery<{ cnt: string }>(
    `SELECT COUNT(*) as cnt FROM raw_objects WHERE checksum IN (
       SELECT checksum FROM raw_objects WHERE object_type='invoice' GROUP BY checksum HAVING COUNT(*) > 1
     ) AND object_type='invoice'`
  );
  const count = parseInt(rows[0]?.cnt || '0');
  if (count === 0) return { question, answer: 'Không có invoice nào bị duplicate. ✅', data: [], source: 'rule' };
  return { question, answer: `⚠️ Phát hiện **${count} invoice duplicate** — kiểm tra lại để tránh thanh toán nhầm.`, data: rows, source: 'rule' };
}

// ── Intent → handler routing ──────────────────────────────────────────────────

const QUERY_RULES: Array<{ patterns: RegExp[]; handler: QueryHandler }> = [
  {
    patterns: [/store nào.*issue|issue.*nhiều nhất|nhiều lỗi nhất/i],
    handler: storeIssueRanking,
  },
  {
    patterns: [/stone oak|bakudan|raw.*tuần|tuần.*lỗi|week.*issue/i],
    handler: storeWeeklyIssues,
  },
  {
    patterns: [/doordash.*dispute|dispute.*doordash|chưa xử lý.*dispute/i],
    handler: doordashDisputesPending,
  },
  {
    patterns: [/review xấu|escalate.*review|review.*cần xử lý/i],
    handler: reviewsNeedEscalation,
  },
  {
    patterns: [/qb.*ngày thiếu|quickbooks.*missing|thiếu.*activity|missing.*day/i],
    handler: qbMissingDays,
  },
  {
    patterns: [/manager.*miss|miss.*submission|ai không submit/i],
    handler: managerMissedSubmissions,
  },
  {
    patterns: [/invoice.*duplicate|duplicate.*invoice|trùng.*invoice/i],
    handler: duplicateInvoices,
  },
];

export async function answerOperationalQuestion(
  question: string,
  filters: Record<string, string> = {}
): Promise<QueryResult> {
  // Try rule-based first
  for (const rule of QUERY_RULES) {
    if (rule.patterns.some(p => p.test(question))) {
      return rule.handler(question, filters);
    }
  }

  // Fallback to hybrid search
  const results = await hybridSearch(question, filters, 10);
  if (results.length === 0) {
    return { question, answer: 'Không tìm thấy thông tin liên quan. Kiểm tra lại data sources đã được ingest chưa.', data: [], source: 'empty' };
  }

  const summary = results.slice(0, 5).map(r =>
    `• **${r.title}** (${r.source || r.store_id || 'unknown'}) — ${r.description || r.text || ''}`
  ).join('\n');

  return {
    question,
    answer: `**Kết quả tìm kiếm cho:** "${question}"\n\n${summary}`,
    data: results,
    source: 'search',
  };
}
