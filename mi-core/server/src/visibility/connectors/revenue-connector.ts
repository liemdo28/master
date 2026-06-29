/**
 * Revenue Connector — Toast POS + DoorDash
 * Data arrives via POST /api/revenue/intake from laptop1.
 * Storage: .local-agent-global/revenue/cache.json
 */

import fs from 'fs';
import path from 'path';

const GLOBAL_DIR = process.env.GLOBAL_DIR || 'D:/Project/Master/.local-agent-global';
const CACHE_DIR = path.join(GLOBAL_DIR, 'revenue');
const CACHE_FILE = path.join(CACHE_DIR, 'cache.json');

export type RevenueSource = 'toast' | 'doordash';

export interface ToastRevenue {
  source: 'toast';
  period_start: string;
  period_end: string;
  net_sales: number;
  gross_sales: number;
  tax: number;
  tips: number;
  checks: number;
  days_imported: number;
  daily_avg: number;
  imported_at: string;
  raw_rows: number;
}

export interface DoordashRevenue {
  source: 'doordash';
  period_start: string;
  period_end: string;
  gross_revenue: number;
  net_payout: number;
  orders: number;
  avg_order_value: number;
  imported_at: string;
  raw_rows: number;
}

export interface RevenueCache {
  updated_at: string;
  toast?: ToastRevenue;
  doordash?: DoordashRevenue;
  summary_text: string;
  total_revenue_estimate: number | null;
}

// Parse CSV with basic quoted-field support
function parseCSVRows(csvText: string): Record<string, string>[] {
  const lines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim().toLowerCase());

  return lines.slice(1).map(line => {
    const vals: string[] = [];
    let inQuote = false;
    let cur = '';
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote; }
      else if (ch === ',' && !inQuote) { vals.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    vals.push(cur.trim());

    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = (vals[i] || '').replace(/^"|"$/g, '').trim(); });
    return row;
  }).filter(r => Object.values(r).some(v => v !== ''));
}

function parseMoney(v: string): number {
  if (!v) return 0;
  const n = parseFloat(v.replace(/[$,\s]/g, ''));
  return isNaN(n) ? 0 : n;
}

function findKey(row: Record<string, string>, ...patterns: string[]): string | undefined {
  const keys = Object.keys(row);
  for (const pat of patterns) {
    const found = keys.find(k => k.includes(pat));
    if (found) return found;
  }
  return undefined;
}

function parseToastCSV(rows: Record<string, string>[]): ToastRevenue | null {
  if (!rows.length) return null;
  const sample = rows[0];
  const netKey = findKey(sample, 'net sale', 'net sales');
  const grossKey = findKey(sample, 'gross sale', 'gross sales');
  const checksKey = findKey(sample, 'check count', 'checks');
  const taxKey = findKey(sample, 'tax collected', 'tax');
  const tipsKey = findKey(sample, 'tip', 'tips');
  const dateKey = findKey(sample, 'business date', 'date');

  if (!netKey && !grossKey) return null;

  let net_sales = 0, gross_sales = 0, tax = 0, tips = 0, checks = 0;
  const dates: string[] = [];

  for (const row of rows) {
    if (netKey) net_sales += parseMoney(row[netKey]);
    if (grossKey) gross_sales += parseMoney(row[grossKey]);
    if (taxKey) tax += parseMoney(row[taxKey]);
    if (tipsKey) tips += parseMoney(row[tipsKey]);
    if (checksKey) checks += parseInt(row[checksKey] || '0') || 0;
    if (dateKey && row[dateKey]) dates.push(row[dateKey]);
  }

  if (!grossKey) gross_sales = net_sales;
  if (!netKey) net_sales = gross_sales;

  const days = Math.max(rows.length, 1);
  const sortedDates = [...dates].sort();

  return {
    source: 'toast',
    period_start: sortedDates[0] || new Date().toISOString().slice(0, 10),
    period_end: sortedDates[sortedDates.length - 1] || new Date().toISOString().slice(0, 10),
    net_sales: Math.round(net_sales * 100) / 100,
    gross_sales: Math.round(gross_sales * 100) / 100,
    tax: Math.round(tax * 100) / 100,
    tips: Math.round(tips * 100) / 100,
    checks,
    days_imported: rows.length,
    daily_avg: Math.round((net_sales / days) * 100) / 100,
    imported_at: new Date().toISOString(),
    raw_rows: rows.length,
  };
}

function parseDoordashCSV(rows: Record<string, string>[]): DoordashRevenue | null {
  if (!rows.length) return null;
  const sample = rows[0];
  const grossKey = findKey(sample, 'subtotal', 'merchant total', 'gross');
  const payoutKey = findKey(sample, 'payout', 'net payout', 'net');
  const dateKey = findKey(sample, 'completed at', 'order date', 'date');

  if (!grossKey && !payoutKey) return null;

  let gross_revenue = 0, net_payout = 0;
  const dates: string[] = [];

  for (const row of rows) {
    if (grossKey) gross_revenue += parseMoney(row[grossKey]);
    if (payoutKey) net_payout += parseMoney(row[payoutKey]);
    if (dateKey && row[dateKey]) dates.push(row[dateKey]);
  }

  if (!payoutKey) net_payout = Math.round(gross_revenue * 0.75 * 100) / 100;

  const sortedDates = [...dates].sort();
  const orders = rows.length;

  return {
    source: 'doordash',
    period_start: sortedDates[0] || new Date().toISOString().slice(0, 10),
    period_end: sortedDates[sortedDates.length - 1] || new Date().toISOString().slice(0, 10),
    gross_revenue: Math.round(gross_revenue * 100) / 100,
    net_payout: Math.round(net_payout * 100) / 100,
    orders,
    avg_order_value: orders > 0 ? Math.round((gross_revenue / orders) * 100) / 100 : 0,
    imported_at: new Date().toISOString(),
    raw_rows: rows.length,
  };
}

export function parseRevenueCSV(source: RevenueSource, csvText: string): ToastRevenue | DoordashRevenue | null {
  const rows = parseCSVRows(csvText);
  if (rows.length === 0) return null;
  if (source === 'toast') return parseToastCSV(rows);
  if (source === 'doordash') return parseDoordashCSV(rows);
  return parseToastCSV(rows) ?? parseDoordashCSV(rows);
}

function buildSummary(toast?: ToastRevenue, doordash?: DoordashRevenue): { summary_text: string; total_revenue_estimate: number | null } {
  const lines: string[] = ['Revenue (real data):'];
  let total: number | null = null;

  if (toast) {
    lines.push(`  Toast POS: $${toast.net_sales.toLocaleString()} net | ${toast.checks} checks | avg $${toast.daily_avg}/day`);
    lines.push(`    Period: ${toast.period_start} to ${toast.period_end} (${toast.days_imported} days)`);
    total = (total ?? 0) + toast.net_sales;
  } else {
    lines.push('  Toast POS: No data yet — export CSV from pos.toasttab.com > Reports, then run upload-revenue.mjs');
  }

  if (doordash) {
    lines.push(`  DoorDash: $${doordash.gross_revenue.toLocaleString()} gross | $${doordash.net_payout.toLocaleString()} payout | ${doordash.orders} orders`);
    lines.push(`    Period: ${doordash.period_start} to ${doordash.period_end}`);
    total = (total ?? 0) + doordash.net_payout;
  } else {
    lines.push('  DoorDash: No data yet — export CSV from Merchant Portal > Reports, then run upload-revenue.mjs');
  }

  if (total !== null) lines.push(`  Total estimate: $${total.toLocaleString()}`);

  return { summary_text: lines.join('\n'), total_revenue_estimate: total };
}

export function saveRevenueData(source: RevenueSource, parsed: ToastRevenue | DoordashRevenue): RevenueCache {
  fs.mkdirSync(CACHE_DIR, { recursive: true });

  let existing: Partial<RevenueCache> = {};
  try { existing = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8')); } catch { /* first import */ }

  const toast = source === 'toast' ? parsed as ToastRevenue : existing.toast;
  const doordash = source === 'doordash' ? parsed as DoordashRevenue : existing.doordash;

  const { summary_text, total_revenue_estimate } = buildSummary(toast, doordash);
  const cache: RevenueCache = {
    updated_at: new Date().toISOString(),
    toast,
    doordash,
    summary_text,
    total_revenue_estimate,
  };

  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  return cache;
}

export function getCachedRevenue(): RevenueCache | null {
  try {
    return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
  } catch { return null; }
}

export function getRevenueSummaryText(): string {
  const cached = getCachedRevenue();
  if (!cached) return 'Revenue: No data. Run tools/upload-revenue.mjs on laptop1 after exporting CSV from Toast and DoorDash.';
  return cached.summary_text;
}
