/**
 * QuickBooks Log Connector — ingests activity logs from local QB files.
 * Reads from: mi-core/data/qb-agent.db and local log files.
 */

import { ingestJson } from '../../ingestion-service';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const QB_DB_PATH  = process.env.QB_DB_PATH || 'E:/Project/Master/mi-core/data/qb-agent.db';
const QB_LOG_DIR  = process.env.QB_LOG_DIR || 'E:/Project/Master/mi-core/data/qb-logs';
const SOURCE_BAKUDAN = 'quickbooks-bakudan';
const SOURCE_RAW     = 'quickbooks-raw';

function readFromQbDb(store: 'bakudan' | 'raw'): Record<string, unknown> {
  if (!fs.existsSync(QB_DB_PATH)) {
    return { store, date: new Date().toISOString().slice(0, 10), transactions: [], bank_feed_items: [], error: 'qb_db_not_found' };
  }
  try {
    const db = new Database(QB_DB_PATH, { readonly: true });
    const today = new Date().toISOString().slice(0, 10);
    const rows = db.prepare(
      `SELECT * FROM transactions WHERE store=? AND date>=? ORDER BY date DESC LIMIT 100`
    ).all(store, `${today}T00:00:00`) as unknown[];
    db.close();
    return { store, date: today, transactions: rows, bank_feed_items: [], reconcile_status: { status: 'unknown' } };
  } catch (e) {
    return { store, date: new Date().toISOString().slice(0, 10), transactions: [], error: String(e) };
  }
}

function detectMissingDays(store: string): string[] {
  const missing: string[] = [];
  for (let i = 7; i >= 1; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    const logFile = path.join(QB_LOG_DIR, store, `${ds}.json`);
    if (!fs.existsSync(logFile)) missing.push(ds);
  }
  return missing;
}

export async function ingestQuickBooks(store: 'bakudan' | 'raw' = 'bakudan'): Promise<void> {
  const sourceName = store === 'bakudan' ? SOURCE_BAKUDAN : SOURCE_RAW;
  const payload = readFromQbDb(store);

  const missing = detectMissingDays(store);
  if (missing.length > 0) {
    console.warn(`[QB Connector] Missing activity for ${store} on days:`, missing);
    (payload as Record<string, unknown>)['missing_days'] = missing;
  }

  await ingestJson({ source_name: sourceName, payload, filename: `qb_${store}_${Date.now()}.json`, actor: 'qb-connector' });
  console.log(`[QB Connector] Ingest complete for ${store}`);
}

if (require.main === module) {
  Promise.all([ingestQuickBooks('bakudan'), ingestQuickBooks('raw')])
    .then(() => process.exit(0))
    .catch(e => { console.error(e); process.exit(1); });
}
