/**
 * SalesAnalyticsEngine — TypeScript port of SalesAnalyticsEngine.mjs
 */

import { normalizeDate, parseHour, parseNumber, ColumnMapping } from './column-mapper';

export interface SalesRow {
  date?: string;
  hour?: number;
  weekday?: string;
  item_name?: string;
  category?: string;
  gross_sales: number;
  net_sales?: number;
  quantity?: number;
  payment_type?: string;
  discount?: number;
  tax?: number;
}

function prepareRows(rows: Record<string, string>[], mapping: ColumnMapping): SalesRow[] {
  return rows.map(row => {
    const r: SalesRow = { gross_sales: 0 };
    if (mapping.date)         r.date        = normalizeDate(row[mapping.date]) || undefined;
    if (mapping.time)         r.hour        = parseHour(row[mapping.time]) ?? undefined;
    if (mapping.hour)         r.hour        = r.hour ?? parseHour(row[mapping.hour]) ?? undefined;
    if (mapping.item_name)    r.item_name   = row[mapping.item_name]?.trim() || undefined;
    if (mapping.category)     r.category    = row[mapping.category]?.trim() || undefined;
    if (mapping.gross_sales)  r.gross_sales = parseNumber(row[mapping.gross_sales]);
    if (mapping.net_sales)    r.net_sales   = parseNumber(row[mapping.net_sales]);
    if (mapping.quantity)     r.quantity    = parseNumber(row[mapping.quantity]);
    if (mapping.payment_type) r.payment_type = row[mapping.payment_type]?.trim() || undefined;
    if (mapping.discount)     r.discount    = parseNumber(row[mapping.discount]);
    if (mapping.tax)          r.tax         = parseNumber(row[mapping.tax]);

    if (r.date && !r.hour) {
      // try to extract from the raw date column if it has time component
      const rawDate = mapping.date ? row[mapping.date] : '';
      const h = parseHour(rawDate.split(' ')[1]);
      if (h !== null) r.hour = h;
    }
    if (r.date) {
      const d = new Date(r.date);
      if (!isNaN(d.getTime())) r.weekday = d.toLocaleDateString('en-US', { weekday: 'long' });
    }
    return r;
  }).filter(r => r.gross_sales > 0 || (r.item_name));
}

export function revenueByDay(rows: Record<string, string>[], mapping: ColumnMapping): Record<string, number> {
  const result: Record<string, number> = {};
  for (const row of prepareRows(rows, mapping)) {
    if (!row.date) continue;
    result[row.date] = (result[row.date] || 0) + row.gross_sales;
  }
  return Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b)));
}

export function revenueByHour(rows: Record<string, string>[], mapping: ColumnMapping): Record<number, number> {
  const result: Record<number, number> = {};
  for (const row of prepareRows(rows, mapping)) {
    if (row.hour === undefined) continue;
    result[row.hour] = (result[row.hour] || 0) + row.gross_sales;
  }
  return result;
}

export function revenueByWeekday(rows: Record<string, string>[], mapping: ColumnMapping): Record<string, number> {
  const result: Record<string, number> = {};
  for (const row of prepareRows(rows, mapping)) {
    if (!row.weekday) continue;
    result[row.weekday] = (result[row.weekday] || 0) + row.gross_sales;
  }
  return result;
}

export function itemPerformance(rows: Record<string, string>[], mapping: ColumnMapping): Array<{ item: string; revenue: number; quantity: number; avg_price: number }> {
  const result: Record<string, { revenue: number; quantity: number }> = {};
  for (const row of prepareRows(rows, mapping)) {
    if (!row.item_name) continue;
    const item = row.item_name;
    if (!result[item]) result[item] = { revenue: 0, quantity: 0 };
    result[item].revenue += row.gross_sales;
    result[item].quantity += row.quantity || 1;
  }
  return Object.entries(result).map(([item, { revenue, quantity }]) => ({
    item, revenue: Math.round(revenue * 100) / 100, quantity,
    avg_price: quantity > 0 ? Math.round(revenue / quantity * 100) / 100 : 0,
  })).sort((a, b) => b.revenue - a.revenue);
}

export function revenueByCategory(rows: Record<string, string>[], mapping: ColumnMapping): Record<string, number> {
  const result: Record<string, number> = {};
  for (const row of prepareRows(rows, mapping)) {
    const cat = row.category || 'Uncategorized';
    result[cat] = (result[cat] || 0) + row.gross_sales;
  }
  return Object.fromEntries(Object.entries(result).sort(([, a], [, b]) => b - a));
}

export function paymentBreakdown(rows: Record<string, string>[], mapping: ColumnMapping): Record<string, number> {
  const result: Record<string, number> = {};
  for (const row of prepareRows(rows, mapping)) {
    const pt = row.payment_type || 'Unknown';
    result[pt] = (result[pt] || 0) + row.gross_sales;
  }
  return result;
}

export function weekOverWeekTrend(rows: Record<string, string>[], mapping: ColumnMapping): Array<{ week: string; revenue: number; change_pct: number | null }> {
  const byDay = revenueByDay(rows, mapping);
  const byWeek: Record<string, number> = {};
  for (const [date, rev] of Object.entries(byDay)) {
    const d = new Date(date);
    const year = d.getFullYear();
    const jan1 = new Date(year, 0, 1);
    const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
    const key = `${year}-W${String(week).padStart(2, '0')}`;
    byWeek[key] = (byWeek[key] || 0) + rev;
  }
  const weeks = Object.entries(byWeek).sort(([a], [b]) => a.localeCompare(b));
  return weeks.map(([week, revenue], i) => ({
    week,
    revenue: Math.round(revenue * 100) / 100,
    change_pct: i === 0 ? null : Math.round((revenue - weeks[i - 1][1]) / weeks[i - 1][1] * 10000) / 100,
  }));
}

export function summaryStats(rows: Record<string, string>[], mapping: ColumnMapping) {
  const prepared = prepareRows(rows, mapping);
  const revenues = prepared.map(r => r.gross_sales).filter(v => v > 0);
  const total_revenue = revenues.reduce((s, v) => s + v, 0);
  const dates = [...new Set(prepared.map(r => r.date).filter(Boolean))];
  const items = [...new Set(prepared.map(r => r.item_name).filter(Boolean))];

  return {
    total_revenue: Math.round(total_revenue * 100) / 100,
    total_transactions: revenues.length,
    unique_dates: dates.length,
    unique_items: items.length,
    avg_transaction: revenues.length > 0 ? Math.round(total_revenue / revenues.length * 100) / 100 : 0,
    avg_daily_revenue: dates.length > 0 ? Math.round(total_revenue / dates.length * 100) / 100 : 0,
    max_transaction: revenues.length > 0 ? Math.round(Math.max(...revenues) * 100) / 100 : 0,
    min_transaction: revenues.length > 0 ? Math.round(Math.min(...revenues) * 100) / 100 : 0,
    date_range: dates.length > 0 ? { start: dates.sort()[0] as string, end: dates.sort()[dates.length - 1] as string } : null,
  };
}
