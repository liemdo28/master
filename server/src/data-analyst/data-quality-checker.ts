/**
 * DataQualityChecker — TypeScript port of DataQualityChecker.mjs
 */

export interface QualityIssue {
  field: string;
  issue: string;
  severity: 'error' | 'warning' | 'info';
  count?: number;
}

export interface QualityResult {
  quality_score: number;
  total_rows: number;
  valid_rows: number;
  issues: QualityIssue[];
  field_coverage: Record<string, number>;
  recommendations: string[];
}

export function checkDataQuality(rows: Record<string, string>[], mapping: Record<string, string>): QualityResult {
  const issues: QualityIssue[] = [];
  const total_rows = rows.length;
  let score = 100;

  const dateField = mapping['date'];
  const salesField = mapping['gross_sales'];
  const itemField = mapping['item_name'];

  // Date check (30pts)
  if (!dateField) {
    issues.push({ field: 'date', issue: 'Date column not found', severity: 'error' });
    score -= 30;
  } else {
    const missingDates = rows.filter(r => !r[dateField] || r[dateField].trim() === '').length;
    if (missingDates > 0) {
      const pct = Math.round(missingDates / total_rows * 100);
      issues.push({ field: 'date', issue: `${missingDates} rows (${pct}%) missing date`, severity: 'warning', count: missingDates });
      score -= Math.min(30, Math.round(30 * pct / 100));
    }
  }

  // Gross sales check (30pts)
  if (!salesField) {
    issues.push({ field: 'gross_sales', issue: 'Revenue/sales column not found', severity: 'error' });
    score -= 30;
  } else {
    const missingSales = rows.filter(r => !r[salesField] || r[salesField].trim() === '').length;
    const negativeSales = rows.filter(r => {
      const v = parseFloat(String(r[salesField]).replace(/[$,]/g, ''));
      return !isNaN(v) && v < 0;
    }).length;
    if (missingSales > 0) {
      issues.push({ field: 'gross_sales', issue: `${missingSales} rows missing sales amount`, severity: 'warning', count: missingSales });
      score -= Math.min(15, Math.round(15 * missingSales / total_rows));
    }
    if (negativeSales > 0) {
      issues.push({ field: 'gross_sales', issue: `${negativeSales} rows have negative sales (refunds?)`, severity: 'info', count: negativeSales });
    }
  }

  // Item name check (20pts)
  if (!itemField) {
    issues.push({ field: 'item_name', issue: 'Item/product column not found', severity: 'warning' });
    score -= 20;
  } else {
    const missingItems = rows.filter(r => !r[itemField] || r[itemField].trim() === '').length;
    if (missingItems > 0) {
      issues.push({ field: 'item_name', issue: `${missingItems} rows missing item name`, severity: 'warning', count: missingItems });
      score -= Math.min(20, Math.round(20 * missingItems / total_rows));
    }
  }

  // Row count check (10pts)
  if (total_rows < 5) {
    issues.push({ field: 'rows', issue: `Only ${total_rows} rows — analysis may not be meaningful`, severity: 'warning' });
    score -= 10;
  }

  const field_coverage: Record<string, number> = {};
  for (const [stdField, srcField] of Object.entries(mapping)) {
    const filled = rows.filter(r => r[srcField] && r[srcField].trim() !== '').length;
    field_coverage[stdField] = total_rows > 0 ? Math.round(filled / total_rows * 100) : 0;
  }

  const recommendations: string[] = [];
  if (!dateField) recommendations.push('Add a date/ngày column to enable time-series analysis');
  if (!salesField) recommendations.push('Add a gross_sales/doanh_thu column to enable revenue analysis');
  if (!itemField) recommendations.push('Add an item_name/món column to enable product analysis');
  if (total_rows < 50) recommendations.push('More data rows will improve analysis accuracy');

  return {
    quality_score: Math.max(0, score),
    total_rows,
    valid_rows: total_rows - issues.filter(i => i.count).reduce((sum, i) => sum + (i.count || 0), 0),
    issues,
    field_coverage,
    recommendations,
  };
}
