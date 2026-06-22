/**
 * DataQualityChecker — validates dataset quality before analysis.
 */

import { parseNumber, normalizeDate } from './ColumnMapper.mjs';

export function checkDataQuality(rows, mapping) {
  const issues = [];
  const warnings = [];
  const stats = {};

  const keyNumericFields = ['gross_sales', 'net_sales', 'quantity', 'ticket_total'];
  const keyFields = Object.keys(mapping);

  // Check missing key fields
  const requiredForAnalysis = ['date', 'gross_sales'];
  for (const field of requiredForAnalysis) {
    if (!mapping[field]) {
      issues.push({ type: 'missing_column', field, message: `Column "${field}" not found — analysis will be limited` });
    }
  }

  if (rows.length === 0) {
    issues.push({ type: 'empty_dataset', message: 'Dataset has no data rows' });
    return { issues, warnings, stats, quality_score: 0 };
  }

  // Analyze each mapped field
  for (const [stdField, header] of Object.entries(mapping)) {
    const values = rows.map(r => r[header]).filter(v => v !== undefined && v !== null && v !== '');
    const nullCount = rows.length - values.length;
    const nullPct = Math.round((nullCount / rows.length) * 100);

    stats[stdField] = { total: rows.length, filled: values.length, null_count: nullCount, null_pct: nullPct };

    if (nullPct > 20) {
      warnings.push({ field: stdField, message: `${nullPct}% missing values in "${header}"` });
    }

    // Validate numeric fields
    if (keyNumericFields.includes(stdField)) {
      const numericValues = values.map(v => parseNumber(v)).filter(n => !isNaN(n));
      const negatives = numericValues.filter(n => n < 0).length;
      const zeros = numericValues.filter(n => n === 0).length;

      stats[stdField].min = Math.min(...numericValues);
      stats[stdField].max = Math.max(...numericValues);
      stats[stdField].avg = numericValues.length > 0 ? numericValues.reduce((a, b) => a + b, 0) / numericValues.length : 0;
      stats[stdField].negatives = negatives;
      stats[stdField].zeros = zeros;

      if (negatives > rows.length * 0.1) {
        warnings.push({ field: stdField, message: `${negatives} negative values found — may indicate refunds or data issues` });
      }
    }

    // Validate date field
    if (stdField === 'date') {
      const parseable = values.filter(v => normalizeDate(v) !== null).length;
      const parsePct = Math.round((parseable / values.length) * 100);
      stats[stdField].parseable_pct = parsePct;
      if (parsePct < 80) {
        issues.push({ field: stdField, message: `Only ${parsePct}% of date values are parseable` });
      }
    }
  }

  // Calculate quality score (0-100)
  const hasDate = !!mapping['date'];
  const hasSales = !!mapping['gross_sales'];
  const hasItem = !!mapping['item_name'];
  const rowsOk = rows.length >= 5;
  const noMajorIssues = issues.filter(i => i.type !== 'missing_column').length === 0;

  let score = 0;
  if (hasDate) score += 30;
  if (hasSales) score += 30;
  if (hasItem) score += 20;
  if (rowsOk) score += 10;
  if (noMajorIssues) score += 10;

  return {
    issues,
    warnings,
    stats,
    quality_score: score,
    is_analyzable: score >= 60,
    row_count: rows.length,
    mapped_fields: Object.keys(mapping),
  };
}
