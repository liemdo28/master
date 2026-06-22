/**
 * SalesAnalyticsEngine — core analytics over normalized sales data.
 * All calculations are done on real data. Never fabricates values.
 */

import { normalizeDate, parseHour, parseNumber } from './ColumnMapper.mjs';

/**
 * Normalize rows using the column mapping for numeric/date parsing
 */
function prepareRows(rows, mapping) {
  return rows.map(row => {
    const r = { ...row, _parsed: {} };

    const dateHeader = mapping['date'];
    const timeHeader = mapping['time'];
    const grossHeader = mapping['gross_sales'];
    const netHeader = mapping['net_sales'];
    const qtyHeader = mapping['quantity'];
    const itemHeader = mapping['item_name'];
    const categoryHeader = mapping['category'];
    const storeHeader = mapping['store'];
    const tipHeader = mapping['tips'];
    const discountHeader = mapping['discount'];
    const taxHeader = mapping['tax'];
    const paymentHeader = mapping['payment_type'];
    const ticketHeader = mapping['ticket_total'];
    const orderHeader = mapping['order_id'];

    const dateStr = dateHeader ? row[dateHeader] : null;
    const timeStr = timeHeader ? row[timeHeader] : null;
    const dateNorm = normalizeDate(dateStr);
    const hourParsed = parseHour(timeStr);

    r._parsed.date = dateNorm;
    r._parsed.hour = hourParsed;
    r._parsed.weekday = dateNorm ? new Date(dateNorm + 'T12:00:00').getDay() : null; // 0=Sun
    r._parsed.gross_sales = grossHeader ? parseNumber(row[grossHeader]) : 0;
    r._parsed.net_sales = netHeader ? parseNumber(row[netHeader]) : r._parsed.gross_sales;
    r._parsed.quantity = qtyHeader ? parseNumber(row[qtyHeader]) : 1;
    r._parsed.item_name = itemHeader ? String(row[itemHeader] || '').trim() : '';
    r._parsed.category = categoryHeader ? String(row[categoryHeader] || '').trim() : '';
    r._parsed.store = storeHeader ? String(row[storeHeader] || '').trim() : '';
    r._parsed.tips = tipHeader ? parseNumber(row[tipHeader]) : 0;
    r._parsed.discount = discountHeader ? parseNumber(row[discountHeader]) : 0;
    r._parsed.tax = taxHeader ? parseNumber(row[taxHeader]) : 0;
    r._parsed.payment = paymentHeader ? String(row[paymentHeader] || '').trim() : '';
    r._parsed.ticket_total = ticketHeader ? parseNumber(row[ticketHeader]) : 0;
    r._parsed.order_id = orderHeader ? String(row[orderHeader] || '').trim() : '';

    return r;
  }).filter(r => r._parsed.date !== null); // Only rows with parseable dates
}

/**
 * Revenue by day → { date → total }
 */
export function revenueByDay(rows, mapping) {
  const prepared = prepareRows(rows, mapping);
  const totals = {};

  for (const r of prepared) {
    const d = r._parsed.date;
    if (!totals[d]) totals[d] = 0;
    totals[d] += r._parsed.gross_sales;
  }

  const sorted = Object.entries(totals)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, total]) => ({
      date,
      weekday: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(date + 'T12:00:00').getDay()],
      total: round2(total),
    }));

  if (sorted.length === 0) return { data: [], top_day: null, bottom_day: null, avg_daily: 0 };

  const top = sorted.reduce((a, b) => a.total > b.total ? a : b);
  const bottom = sorted.reduce((a, b) => a.total < b.total ? a : b);
  const avg = sorted.reduce((s, d) => s + d.total, 0) / sorted.length;

  return {
    data: sorted,
    top_day: top,
    bottom_day: bottom,
    avg_daily: round2(avg),
    total_revenue: round2(sorted.reduce((s, d) => s + d.total, 0)),
    days_analyzed: sorted.length,
  };
}

/**
 * Revenue by hour → { 0..23 → total }
 */
export function revenueByHour(rows, mapping) {
  const prepared = prepareRows(rows, mapping);
  const totals = Array(24).fill(0);
  const counts = Array(24).fill(0);

  for (const r of prepared) {
    const h = r._parsed.hour;
    if (h !== null && h >= 0 && h < 24) {
      totals[h] += r._parsed.gross_sales;
      counts[h]++;
    }
  }

  const data = totals
    .map((total, hour) => ({
      hour,
      label: hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`,
      total: round2(total),
      transactions: counts[hour],
    }))
    .filter(d => d.total > 0);

  if (data.length === 0) return { data: [], peak_hour: null, weak_hour: null, note: 'No time data available' };

  const peak = data.reduce((a, b) => a.total > b.total ? a : b);
  const weak = data.filter(d => d.total > 0).reduce((a, b) => a.total < b.total ? a : b);

  return { data, peak_hour: peak, weak_hour: weak };
}

/**
 * Revenue by weekday → { 0=Sun..6=Sat }
 */
export function revenueByWeekday(rows, mapping) {
  const prepared = prepareRows(rows, mapping);
  const names = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  const totals = Array(7).fill(0);
  const counts = Array(7).fill(0);

  for (const r of prepared) {
    const wd = r._parsed.weekday;
    if (wd !== null) {
      totals[wd] += r._parsed.gross_sales;
      counts[wd]++;
    }
  }

  const data = totals.map((total, i) => ({
    weekday_num: i,
    weekday: names[i],
    total: round2(total),
    count: counts[i],
    avg_per_day: counts[i] > 0 ? round2(total / counts[i]) : 0,
  })).filter(d => d.total > 0);

  if (data.length === 0) return { data: [], best_day: null, worst_day: null };

  const best = data.reduce((a, b) => a.avg_per_day > b.avg_per_day ? a : b);
  const worst = data.filter(d => d.count > 0).reduce((a, b) => a.avg_per_day < b.avg_per_day ? a : b);

  return { data, best_day: best, worst_day: worst };
}

/**
 * Top/slow items by revenue and quantity
 */
export function itemPerformance(rows, mapping, limit = 10) {
  if (!mapping['item_name']) return { top: [], slow: [], note: 'No item_name column found' };

  const prepared = prepareRows(rows, mapping);
  const items = {};

  for (const r of prepared) {
    const name = r._parsed.item_name;
    if (!name) continue;
    if (!items[name]) items[name] = { name, revenue: 0, quantity: 0, orders: 0 };
    items[name].revenue += r._parsed.gross_sales;
    items[name].quantity += r._parsed.quantity;
    items[name].orders++;
  }

  const sorted = Object.values(items)
    .map(i => ({ ...i, revenue: round2(i.revenue), avg_ticket: round2(i.revenue / Math.max(i.orders, 1)) }))
    .sort((a, b) => b.revenue - a.revenue);

  return {
    top: sorted.slice(0, limit),
    slow: sorted.slice(-limit).reverse().filter(i => i.revenue > 0),
    total_items: sorted.length,
  };
}

/**
 * Revenue by category
 */
export function revenueByCategory(rows, mapping) {
  if (!mapping['category']) return { data: [], note: 'No category column found' };

  const prepared = prepareRows(rows, mapping);
  const cats = {};

  for (const r of prepared) {
    const cat = r._parsed.category || 'Uncategorized';
    if (!cats[cat]) cats[cat] = 0;
    cats[cat] += r._parsed.gross_sales;
  }

  const data = Object.entries(cats)
    .map(([category, total]) => ({ category, total: round2(total) }))
    .sort((a, b) => b.total - a.total);

  return { data };
}

/**
 * Payment type breakdown
 */
export function paymentBreakdown(rows, mapping) {
  if (!mapping['payment_type']) return { data: [], note: 'No payment_type column found' };

  const prepared = prepareRows(rows, mapping);
  const payments = {};

  for (const r of prepared) {
    const p = r._parsed.payment || 'Unknown';
    if (!payments[p]) payments[p] = { type: p, count: 0, total: 0 };
    payments[p].count++;
    payments[p].total += r._parsed.gross_sales;
  }

  return {
    data: Object.values(payments)
      .map(p => ({ ...p, total: round2(p.total) }))
      .sort((a, b) => b.total - a.total),
  };
}

/**
 * Week-over-week trend
 */
export function weekOverWeekTrend(rows, mapping) {
  const byDay = revenueByDay(rows, mapping);
  if (!byDay.data.length) return { data: [], note: 'Not enough data' };

  // Group into weeks (Sun-Sat)
  const weeks = {};
  for (const d of byDay.data) {
    const date = new Date(d.date + 'T12:00:00');
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay()); // Previous Sunday
    const key = weekStart.toISOString().slice(0, 10);
    if (!weeks[key]) weeks[key] = { week_start: key, total: 0, days: 0 };
    weeks[key].total += d.total;
    weeks[key].days++;
  }

  const sorted = Object.values(weeks).sort((a, b) => a.week_start.localeCompare(b.week_start));

  // Calculate WoW change
  const withChange = sorted.map((w, i) => {
    if (i === 0) return { ...w, wow_change: null, wow_pct: null };
    const prev = sorted[i - 1].total;
    const change = w.total - prev;
    const pct = prev > 0 ? round2((change / prev) * 100) : null;
    return { ...w, wow_change: round2(change), wow_pct: pct };
  });

  return {
    data: withChange.map(w => ({ ...w, total: round2(w.total) })),
    trend: withChange.length >= 2
      ? withChange[withChange.length - 1].wow_pct
      : null,
  };
}

/**
 * Summary statistics
 */
export function summaryStats(rows, mapping) {
  const prepared = prepareRows(rows, mapping);
  if (prepared.length === 0) return { error: 'No analyzable rows' };

  const revenues = prepared.map(r => r._parsed.gross_sales).filter(v => v > 0);
  const dates = [...new Set(prepared.map(r => r._parsed.date).filter(Boolean))].sort();
  const items = new Set(prepared.map(r => r._parsed.item_name).filter(Boolean));
  const stores = new Set(prepared.map(r => r._parsed.store).filter(Boolean));
  const orders = new Set(prepared.map(r => r._parsed.order_id).filter(Boolean));

  const totalRevenue = revenues.reduce((a, b) => a + b, 0);
  const avgPerOrder = orders.size > 0 ? totalRevenue / orders.size : totalRevenue / prepared.length;

  return {
    total_revenue: round2(totalRevenue),
    total_rows: prepared.length,
    date_range: dates.length > 0 ? { from: dates[0], to: dates[dates.length - 1], days: dates.length } : null,
    unique_items: items.size,
    unique_stores: stores.size,
    unique_orders: orders.size,
    avg_order_value: round2(avgPerOrder),
    avg_daily_revenue: dates.length > 0 ? round2(totalRevenue / dates.length) : null,
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
