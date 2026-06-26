/**
 * Finance Truth Layer — D1
 *
 * Handles all CEO finance queries. Priority order:
 *   1. QuickBooks Runtime (qb-agent.db)
 *   2. Accounting Engine (port 8844)
 *   3. Certified Finance Cache (ops.db)
 *   4. Explicit "Data unavailable" — NEVER estimates or hallucinates
 *
 * Never returns generic certification.
 * Every response is stamped with source + timestamp + freshness.
 */

import fs from 'fs';
import path from 'path';
import http from 'http';

const GLOBAL_DIR = process.env.GLOBAL_DIR || 'D:/Project/Master/.local-agent-global';
const QB_AGENT_DB = process.env.QB_AGENT_DB || 'D:/Project/Master/mi-core/data/qb-agent.db';
const ACCOUNTING_URL = 'http://127.0.0.1:8844';

export interface FinanceQueryResult {
  answered: boolean;
  source: 'quickbooks' | 'accounting_engine' | 'finance_cache' | 'none';
  source_label: string;
  data: Record<string, unknown> | null;
  freshness_minutes: number | null;
  last_sync: string | null;
  ceo_message: string;
  connector_status: 'connected' | 'not_configured' | 'offline';
}

// ── Connector availability check ────────────────────────────────────────────

function qbIsAvailable(): { available: boolean; last_sync: string | null; record_count: number } {
  try {
    if (!fs.existsSync(QB_AGENT_DB)) {
      return { available: false, last_sync: null, record_count: 0 };
    }
    const Database = require('better-sqlite3');
    const db = new Database(QB_AGENT_DB, { readonly: true });
    const tables: Array<{ name: string }> = db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all();
    const tableNames = tables.map(t => t.name);

    // Check for transaction / sync data tables
    const dataTable = tableNames.find(n => /transaction|account|sync|summary|ledger|invoice/i.test(n));
    if (!dataTable) {
      db.close();
      return { available: false, last_sync: null, record_count: 0 };
    }

    const count = (db.prepare(`SELECT COUNT(*) as cnt FROM "${dataTable}"`).get() as { cnt: number }).cnt;
    // Try to find last-updated timestamp
    let lastSync: string | null = null;
    try {
      const cols: Array<{ name: string }> = db.prepare(`PRAGMA table_info("${dataTable}")`).all();
      const tsCol = cols.find(c => /date|time|sync|updated|created/i.test(c.name));
      if (tsCol) {
        const row = db.prepare(`SELECT MAX("${tsCol.name}") as ts FROM "${dataTable}"`).get() as { ts: string | null };
        lastSync = row?.ts ?? null;
      }
    } catch { /* column may not exist */ }

    db.close();
    return { available: count > 0, last_sync: lastSync, record_count: count };
  } catch {
    return { available: false, last_sync: null, record_count: 0 };
  }
}

function fetchAccountingHealth(): Promise<{ online: boolean; latency_ms: number }> {
  return new Promise(resolve => {
    const t0 = Date.now();
    const req = http.request(
      { hostname: '127.0.0.1', port: 8844, path: '/health', method: 'GET', timeout: 2000 },
      res => {
        res.resume();
        resolve({ online: res.statusCode === 200, latency_ms: Date.now() - t0 });
      },
    );
    req.on('error', () => resolve({ online: false, latency_ms: Date.now() - t0 }));
    req.on('timeout', () => { req.destroy(); resolve({ online: false, latency_ms: 2000 }); });
    req.end();
  });
}

function loadFinanceCache(): { data: Record<string, unknown> | null; timestamp: string | null } {
  try {
    const cachePath = path.join(GLOBAL_DIR, 'visibility', 'finance-cache.json');
    if (!fs.existsSync(cachePath)) return { data: null, timestamp: null };
    const raw = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
    return { data: raw.data ?? null, timestamp: raw.timestamp ?? null };
  } catch {
    return { data: null, timestamp: null };
  }
}

function freshnessMinutes(timestamp: string | null): number | null {
  if (!timestamp) return null;
  try {
    return Math.round((Date.now() - new Date(timestamp).getTime()) / 60000);
  } catch {
    return null;
  }
}

// ── Store name extractor ─────────────────────────────────────────────────────

function extractStoreFromQuery(rawRequest: string): string | null {
  const n = rawRequest.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd');

  if (/raw\s*sushi|rawsushi/.test(n)) return 'Raw Sushi';
  if (/bakudan|ramen/.test(n)) return 'Bakudan Ramen';
  if (/stockton/.test(n)) return 'Stockton';
  if (/stone\s*oak|stoneoaks/.test(n)) return 'Stone Oak';
  if (/\brim\b/.test(n)) return 'Rim';
  if (/bandera/.test(n)) return 'Bandera';
  return null;
}

// ── Time window extractor ────────────────────────────────────────────────────

function extractTimeWindow(rawRequest: string): string {
  const n = rawRequest.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd');

  if (/hom\s*nay|today/.test(n)) return 'hôm nay';
  if (/tuan\s*nay|this\s*week/.test(n)) return 'tuần này';
  if (/thang\s*nay|this\s*month/.test(n)) return 'tháng này';
  if (/quy\s*nay|this\s*quarter/.test(n)) return 'quý này';
  if (/nam\s*nay|this\s*year/.test(n)) return 'năm này';
  return 'kỳ hiện tại';
}

// ── Main entry point ─────────────────────────────────────────────────────────

export async function handleFinanceQuery(rawRequest: string): Promise<FinanceQueryResult> {
  const store = extractStoreFromQuery(rawRequest);
  const timeWindow = extractTimeWindow(rawRequest);

  // Priority 1: QuickBooks Runtime
  const qb = qbIsAvailable();
  if (qb.available) {
    const fresh = freshnessMinutes(qb.last_sync);
    const freshnessLabel = fresh === null ? 'freshness unknown'
      : fresh < 60 ? `${fresh} phút trước`
      : fresh < 1440 ? `${Math.round(fresh / 60)} giờ trước`
      : `${Math.round(fresh / 1440)} ngày trước`;

    const storeLabel = store ? ` — ${store}` : '';
    return {
      answered: true,
      source: 'quickbooks',
      source_label: 'QuickBooks Runtime',
      data: { record_count: qb.record_count, last_sync: qb.last_sync },
      freshness_minutes: fresh,
      last_sync: qb.last_sync,
      connector_status: 'connected',
      ceo_message: [
        `💼 *Dữ liệu tài chính${storeLabel} — ${timeWindow}*`,
        ``,
        `📊 *Nguồn:* QuickBooks Runtime`,
        `🕐 *Cập nhật:* ${freshnessLabel}`,
        `📋 *Số bản ghi:* ${qb.record_count.toLocaleString()} transactions`,
        ``,
        `⚠️ *Lưu ý:* Mi có quyền truy cập dữ liệu QB sync (${qb.record_count} records).`,
        `Để xem số liệu chi tiết (doanh thu, lợi nhuận), cần chạy query cụ thể qua QB Agent.`,
        ``,
        `*Thử:* "coi QB sync status" hoặc "QB invoice tháng này"`,
      ].join('\n'),
    };
  }

  // Priority 2: Accounting Engine (port 8844)
  const accounting = await fetchAccountingHealth();
  if (accounting.online) {
    return {
      answered: true,
      source: 'accounting_engine',
      source_label: 'Accounting Engine',
      data: { latency_ms: accounting.latency_ms },
      freshness_minutes: null,
      last_sync: null,
      connector_status: 'connected',
      ceo_message: [
        `💼 *Dữ liệu tài chính — ${timeWindow}*`,
        ``,
        `📊 *Nguồn:* Accounting Engine (port 8844) ✅ online`,
        `⏱️ *Latency:* ${accounting.latency_ms}ms`,
        ``,
        `Accounting Engine đang online nhưng Mi cần query cụ thể để lấy số liệu.`,
        `*Thử:* "báo cáo doanh thu tháng này" hoặc "xem ledger"`,
      ].join('\n'),
    };
  }

  // Priority 3: Finance cache
  const cache = loadFinanceCache();
  if (cache.data) {
    const fresh = freshnessMinutes(cache.timestamp);
    const staleWarning = fresh !== null && fresh > 1440
      ? `\n⚠️ *Cảnh báo:* Dữ liệu cache đã ${Math.round(fresh / 1440)} ngày — có thể lỗi thời.`
      : '';

    return {
      answered: true,
      source: 'finance_cache',
      source_label: 'Finance Cache',
      data: cache.data,
      freshness_minutes: fresh,
      last_sync: cache.timestamp,
      connector_status: 'connected',
      ceo_message: [
        `💼 *Dữ liệu tài chính (cache) — ${timeWindow}*`,
        ``,
        `📊 *Nguồn:* Finance Cache`,
        `🕐 *Timestamp:* ${cache.timestamp ?? 'N/A'}`,
        staleWarning,
        ``,
        JSON.stringify(cache.data, null, 2).slice(0, 500),
      ].filter(Boolean).join('\n'),
    };
  }

  // Priority 4: All sources offline — explicit "Data unavailable"
  const storeLabel = store ? ` cho ${store}` : '';
  return {
    answered: false,
    source: 'none',
    source_label: 'No source',
    data: null,
    freshness_minutes: null,
    last_sync: null,
    connector_status: 'not_configured',
    ceo_message: [
      `❌ *Không có dữ liệu tài chính${storeLabel}*`,
      ``,
      `*Câu hỏi:* "${rawRequest.slice(0, 80)}"`,
      `*Thời gian:* ${timeWindow}`,
      ``,
      `📋 *Trạng thái connector:*`,
      `  • QuickBooks Runtime: ❌ Không có dữ liệu (${fs.existsSync(QB_AGENT_DB) ? 'DB tồn tại nhưng rỗng' : 'DB không tồn tại'})`,
      `  • Accounting Engine (8844): ❌ Offline`,
      `  • Finance Cache: ❌ Không có cache`,
      ``,
      `Mi không tự bịa số liệu. Để lấy dữ liệu thực:`,
      `  1. Mở QuickBooks Desktop trên laptop1`,
      `  2. Chạy QB Web Connector sync`,
      `  3. Hoặc start Accounting Engine: node accounting-engine/api/server.js`,
    ].join('\n'),
  };
}
