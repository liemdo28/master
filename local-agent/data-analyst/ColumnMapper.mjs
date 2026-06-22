/**
 * ColumnMapper — detects and maps business column names to standard fields.
 * Supports English, Vietnamese, Toast POS, QuickBooks, and custom CSV headers.
 */

// Standard fields the analytics engine expects
export const STANDARD_FIELDS = {
  date: 'date',
  time: 'time',
  hour: 'hour',
  weekday: 'weekday',
  store: 'store',
  order_id: 'order_id',
  item_name: 'item_name',
  category: 'category',
  quantity: 'quantity',
  gross_sales: 'gross_sales',
  net_sales: 'net_sales',
  discount: 'discount',
  tax: 'tax',
  tips: 'tips',
  payment_type: 'payment_type',
  customer_count: 'customer_count',
  ticket_total: 'ticket_total',
};

// Aliases: recognized names → standard field
const FIELD_ALIASES = {
  date: ['date', 'ngày', 'ngay', 'order_date', 'sale_date', 'transaction_date', 'business_date', 'paid_date', 'created_at', 'day'],
  time: ['time', 'giờ', 'gio', 'order_time', 'sale_time', 'transaction_time', 'paid_time'],
  hour: ['hour', 'gio', 'giờ bán'],
  store: ['store', 'location', 'restaurant', 'branch', 'cửa hàng', 'chi nhánh', 'store_name', 'location_name'],
  order_id: ['order_id', 'order_number', 'receipt_id', 'check_number', 'id', 'transaction_id', 'check_id'],
  item_name: ['item_name', 'item', 'product', 'menu_item', 'mon', 'món ăn', 'product_name', 'item_description', 'sku_name', 'description'],
  category: ['category', 'danh_mục', 'product_category', 'item_category', 'group', 'menu_group', 'category_name'],
  quantity: ['quantity', 'qty', 'count', 'units', 'amount_sold', 'sold_qty', 'số lượng', 'sl'],
  gross_sales: ['gross_sales', 'gross', 'revenue', 'total_sales', 'sales', 'amount', 'subtotal', 'gross_total', 'doanh thu', 'doanh_thu', 'tong_tien', 'tổng tiền'],
  net_sales: ['net_sales', 'net', 'net_revenue', 'net_total', 'revenue_after_discount'],
  discount: ['discount', 'discounts', 'discount_amount', 'giảm giá', 'giam_gia', 'promotion'],
  tax: ['tax', 'taxes', 'tax_amount', 'thuế', 'thue'],
  tips: ['tips', 'gratuity', 'tip_amount', 'tiền boa', 'tip'],
  payment_type: ['payment_type', 'payment', 'payment_method', 'tender', 'payment_kind', 'phương thức thanh toán'],
  customer_count: ['customer_count', 'covers', 'guests', 'party_size', 'covers_count'],
  ticket_total: ['ticket_total', 'check_total', 'order_total', 'total', 'total_amount', 'tong_bill', 'bill'],
};

/**
 * Map CSV headers to standard fields.
 * Returns { mapping, confidence, unmapped, ambiguous }
 */
export function mapColumns(headers) {
  const mapping = {};         // standard_field → header
  const reverseMapping = {};  // header → standard_field
  const matched = new Set();
  const unmapped = [];

  for (const [stdField, aliases] of Object.entries(FIELD_ALIASES)) {
    for (const header of headers) {
      const normalized = header.toLowerCase().replace(/[\s\-_]+/g, '_');
      if (aliases.includes(normalized) || aliases.includes(header.toLowerCase())) {
        if (!mapping[stdField]) {
          mapping[stdField] = header;
          reverseMapping[header] = stdField;
          matched.add(header);
        }
        break;
      }
    }
  }

  // Track unmapped headers
  for (const h of headers) {
    if (!reverseMapping[h]) unmapped.push(h);
  }

  // Calculate confidence: percentage of key fields detected
  const keyFields = ['date', 'item_name', 'gross_sales'];
  const foundKey = keyFields.filter(f => mapping[f]).length;
  const confidence = Math.round((foundKey / keyFields.length) * 100);

  return {
    mapping,
    reverse_mapping: reverseMapping,
    confidence,
    mapped_count: Object.keys(mapping).length,
    unmapped,
    detected_fields: Object.keys(mapping),
  };
}

/**
 * Apply mapping to a dataset row → standard object
 */
export function normalizeRow(row, mapping) {
  const normalized = {};
  for (const [stdField, header] of Object.entries(mapping)) {
    if (header && row[header] !== undefined) {
      normalized[stdField] = row[header];
    }
  }
  return normalized;
}

/**
 * Normalize a full dataset
 */
export function normalizeDataset(rows, mapping) {
  return rows.map(row => normalizeRow(row, mapping));
}

/**
 * Parse common date formats into YYYY-MM-DD
 */
export function normalizeDate(dateStr) {
  if (!dateStr) return null;
  const s = String(dateStr).trim();

  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

  // M/D/YYYY or MM/DD/YYYY
  const mdyMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (mdyMatch) {
    const [, m, d, y] = mdyMatch;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }

  // D/M/YYYY (Vietnamese style)
  const dmyMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    // Ambiguous — try to detect by month range
    const numM = parseInt(m);
    if (numM <= 12) return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }

  // YYYY/MM/DD
  const ymdSlash = s.match(/^(\d{4})\/(\d{2})\/(\d{2})/);
  if (ymdSlash) return `${ymdSlash[1]}-${ymdSlash[2]}-${ymdSlash[3]}`;

  // Try native Date parse as fallback
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);

  return null;
}

/**
 * Parse time string to 0-23 hour
 */
export function parseHour(timeStr) {
  if (!timeStr) return null;
  const s = String(timeStr).trim().toLowerCase();

  // HH:MM:SS or HH:MM
  const hm = s.match(/^(\d{1,2}):(\d{2})/);
  if (hm) return parseInt(hm[1]);

  // "2 PM" / "2PM" / "14:00"
  const ampm = s.match(/^(\d{1,2})\s*(am|pm)/);
  if (ampm) {
    let h = parseInt(ampm[1]);
    if (ampm[2] === 'pm' && h < 12) h += 12;
    if (ampm[2] === 'am' && h === 12) h = 0;
    return h;
  }

  return null;
}

/**
 * Parse numeric value (handle commas, $ signs)
 */
export function parseNumber(val) {
  if (val === null || val === undefined || val === '') return 0;
  const s = String(val).replace(/[$,\s]/g, '');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}
