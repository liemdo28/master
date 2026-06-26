/**
 * Accounting Engine Connector
 * Proxies to accounting-engine API server (port 8844).
 * Falls back to reading accounting.db directly via summary if service is offline.
 */

import http from 'http';
import fs from 'fs';
import path from 'path';

const ACCOUNTING_URL = process.env.ACCOUNTING_URL || 'http://127.0.0.1:8844';
const DB_PATH = process.env.ACCOUNTING_DB_PATH ||
  'D:/Project/Master/accounting-engine/ledgers/accounting.db';

export interface AccountingSnapshot {
  status: 'live' | 'offline' | 'error';
  synced_at: string;
  stats?: Record<string, unknown>;
  ledger_ok?: boolean;
  costs?: Record<string, unknown>;
  summary_text: string;
}

async function fetchAccounting(path: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const url = new URL(ACCOUNTING_URL + path);
    const req = http.get({ hostname: url.hostname, port: parseInt(url.port || '8844'), path: url.pathname }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
    });
    req.setTimeout(3000, () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', reject);
  });
}

export async function syncAccounting(): Promise<AccountingSnapshot> {
  const now = new Date().toISOString();

  // Try live API first
  try {
    const [stats, costs] = await Promise.all([
      fetchAccounting('/stats') as Promise<Record<string, unknown>>,
      fetchAccounting('/costs') as Promise<Record<string, unknown>>,
    ]);

    const ledgerRes = await fetchAccounting('/stats/ledger') as Record<string, unknown>;
    const ledgerOk = (ledgerRes as { ok?: boolean })?.ok !== false;

    const snap: AccountingSnapshot = {
      status: 'live',
      synced_at: now,
      stats: stats as Record<string, unknown>,
      costs: costs as Record<string, unknown>,
      ledger_ok: ledgerOk,
      summary_text: buildSummaryText(stats as Record<string, unknown>, costs as Record<string, unknown>, ledgerOk),
    };

    // Cache to global dir
    const cacheDir = path.join(
      process.env.GLOBAL_DIR || 'D:/Project/Master/.local-agent-global',
      'visibility', 'accounting'
    );
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(cacheDir, 'data.json'), JSON.stringify(snap, null, 2));
    fs.writeFileSync(path.join(cacheDir, 'last_sync.json'), JSON.stringify({ synced_at: now, status: 'live' }));

    return snap;
  } catch {
    // Offline — return cached if available
    const cacheFile = path.join(
      process.env.GLOBAL_DIR || 'D:/Project/Master/.local-agent-global',
      'visibility', 'accounting', 'data.json'
    );
    if (fs.existsSync(cacheFile)) {
      const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf-8')) as AccountingSnapshot;
      return { ...cached, status: 'offline', synced_at: now };
    }

    return {
      status: 'offline',
      synced_at: now,
      summary_text: 'Accounting engine offline. Start: node D:/Project/Master/accounting-engine/api/server.js',
    };
  }
}

function buildSummaryText(
  stats: Record<string, unknown> | null,
  costs: Record<string, unknown> | null,
  ledgerOk: boolean
): string {
  const lines: string[] = ['📊 Accounting Engine'];
  if (stats) {
    if (stats.total_patches !== undefined) lines.push(`  Patches: ${stats.total_patches}`);
    if (stats.total_sessions !== undefined) lines.push(`  Sessions: ${stats.total_sessions}`);
    if (stats.success_rate !== undefined) lines.push(`  Success rate: ${stats.success_rate}%`);
  }
  if (costs) {
    if (costs.total_cost !== undefined) lines.push(`  Total cost: $${costs.total_cost}`);
    if (costs.today !== undefined) lines.push(`  Today: $${costs.today}`);
  }
  lines.push(`  Ledger: ${ledgerOk ? '✓ verified' : '⚠ check needed'}`);
  return lines.join('\n');
}

export function getCachedAccounting(): AccountingSnapshot | null {
  try {
    const cacheFile = path.join(
      process.env.GLOBAL_DIR || 'D:/Project/Master/.local-agent-global',
      'visibility', 'accounting', 'data.json'
    );
    return JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
  } catch { return null; }
}

export function getAccountingSummaryText(): string {
  const cached = getCachedAccounting();
  if (!cached) return 'Accounting data chưa có — chưa sync.';
  return cached.summary_text + (cached.status === 'offline' ? '\n  ⚠ (cached, service offline)' : '');
}
