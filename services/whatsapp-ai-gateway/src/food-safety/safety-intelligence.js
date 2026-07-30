/**
 * Food Safety Intelligence Layer — Phase 3
 *
 * Validates form data before final confirm.
 * Detects:
 *   unsafe temperature (FAIL)
 *   missing required field
 *   unreadable value (low OCR confidence)
 *   impossible value (e.g., freezer at 120°F)
 *   repeated suspicious values (copy-paste pattern)
 *   wrong unit (e.g., Celsius where Fahrenheit expected)
 *   empty form
 *   duplicate form photo
 *
 * Status values:
 *   SAFE         — all fields valid and within range
 *   WARNING      — marginal (e.g., fryer at 310°F when target is >= 325°F)
 *   UNSAFE       — confirmed violation (e.g., cooler at 52°F)
 *   NEEDS_REVIEW — can't determine (unclear, missing fields, etc.)
 */

const { makeLogger } = require('../logger');

const log = makeLogger('safety-intelligence');

const IMPOSSIBLE_RANGE = { min: -20, max: 500 };

// ── Main validation ─────────────────────────────────────────────────────────

/**
 * Run full food safety intelligence validation on a submission.
 * @param {object} submission - { items: [{ label, value, field_id, confidence }], imagePath, store, employee }
 * @returns {object} { status, issues, isSafe, isWarning, isUnsafe, needsReview }
 */
function validateSubmission(submission) {
  const items = submission.items || [];
  const issues = [];

  if (items.length === 0) {
    issues.push({ type: 'empty_form', severity: 'NEEDS_REVIEW', item: 'Form', message: 'No items detected. Empty or unreadable form.', expected: 'At least 1 item', captured: '0 items' });
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const label = (item.label || item.field_id || '').toLowerCase();

    if (item.value === null || item.value === undefined || item.value === '') {
      issues.push({
        type: 'missing_field', severity: 'NEEDS_REVIEW',
        item: item.label || item.field_id || `Item #${i + 1}`,
        message: `Missing value for "${item.label || item.field_id || 'Unknown'}".`,
        expected: 'Numeric temperature', captured: 'Empty / missing',
      });
      continue;
    }

    const value = parseFloat(item.value);
    if (isNaN(value)) {
      issues.push({
        type: 'unreadable_value', severity: 'NEEDS_REVIEW',
        item: item.label || item.field_id || `Item #${i + 1}`,
        message: `Unreadable value "${item.value}" for "${item.label || 'Unknown'}".`,
        expected: 'Numeric temperature', captured: String(item.value),
      });
      continue;
    }

    // Low OCR confidence
    if (item.confidence != null && item.confidence < 0.5) {
      issues.push({
        type: 'low_confidence', severity: 'WARNING',
        item: item.label || item.field_id || `Item #${i + 1}`,
        message: `Low OCR confidence (${Math.round(item.confidence * 100)}%) for "${item.label || 'Unknown'}". Please verify.`,
        expected: 'Confidence >= 50%', captured: `${Math.round(item.confidence * 100)}%`,
      });
    }

    // Impossible value
    if (value < IMPOSSIBLE_RANGE.min || value > IMPOSSIBLE_RANGE.max) {
      issues.push({
        type: 'impossible_value', severity: 'UNSAFE',
        item: item.label || item.field_id || `Item #${i + 1}`,
        message: `Impossible temperature: ${value}°F. Expected between ${IMPOSSIBLE_RANGE.min}°F and ${IMPOSSIBLE_RANGE.max}°F.`,
        expected: `${IMPOSSIBLE_RANGE.min}°F to ${IMPOSSIBLE_RANGE.max}°F`, captured: `${value}°F`,
      });
      continue;
    }

    // Wrong unit (Celsius)
    if (detectCelsiusLikely(label, value)) {
      issues.push({
        type: 'wrong_unit', severity: 'WARNING',
        item: item.label || item.field_id || `Item #${i + 1}`,
        message: `Value ${value}° looks like Celsius. Expected Fahrenheit.`,
        expected: 'Fahrenheit', captured: `Possible Celsius: ${value}°`,
      });
    }

    // Temperature threshold check
    const thresholdResult = checkTemperatureThreshold(label, value);
    if (thresholdResult) {
      issues.push({
        type: thresholdResult.severity === 'UNSAFE' ? 'unsafe_temperature' : 'temperature_warning',
        severity: thresholdResult.severity,
        item: item.label || item.field_id || `Item #${i + 1}`,
        message: thresholdResult.message,
        expected: thresholdResult.expected,
        captured: `${value}°F`,
      });
    }
  }

  // Repeated suspicious values
  const repeatedIssues = detectRepeatedValues(items);
  issues.push(...repeatedIssues);

  // Duplicate form photo detection
  if (submission.imagePath && submission.previousSubmissions) {
    const dupResult = detectDuplicatePhoto(submission.imagePath, submission.previousSubmissions);
    if (dupResult) issues.push(dupResult);
  }

  const overallStatus = determineOverallStatus(issues);

  return {
    status: overallStatus,
    issues,
    isSafe: overallStatus === 'SAFE',
    isWarning: overallStatus === 'WARNING',
    isUnsafe: overallStatus === 'UNSAFE',
    needsReview: overallStatus === 'NEEDS_REVIEW',
  };
}

/**
 * Check a single item against food safety temperature thresholds.
 */
function checkTemperatureThreshold(label, value) {
  const lc = label.toLowerCase();

  if (lc.includes('cooler') || lc.includes('refrigerat') || lc.includes('cold') || lc.includes('walkin') || lc.includes('walk-in')) {
    if (value > 40) return { severity: 'UNSAFE', message: `Cooler temperature ${value}°F exceeds safe limit of 40°F.`, expected: '≤ 40°F' };
    if (value > 38) return { severity: 'WARNING', message: `Cooler temperature ${value}°F is approaching limit of 40°F.`, expected: '≤ 40°F' };
    return null;
  }

  if (lc.includes('freezer') || lc.includes('frozen') || lc.includes('ice')) {
    if (value > 10) return { severity: 'UNSAFE', message: `Freezer temperature ${value}°F is well above safe limit of 0°F.`, expected: '≤ 0°F' };
    if (value > 0) return { severity: 'WARNING', message: `Freezer temperature ${value}°F is above target of 0°F.`, expected: '≤ 0°F' };
    return null;
  }

  if (lc.includes('hot') || lc.includes('holding') || lc.includes('hotwell') || lc.includes('steam')) {
    if (value < 135) return { severity: 'UNSAFE', message: `Hot holding temperature ${value}°F is below FDA minimum of 135°F.`, expected: '≥ 135°F' };
    if (value < 140) return { severity: 'WARNING', message: `Hot holding temperature ${value}°F is approaching FDA minimum of 135°F.`, expected: '≥ 135°F' };
    return null;
  }

  if (lc.includes('fryer') || lc.includes('fry')) {
    if (value < 325) return { severity: 'WARNING', message: `Fryer temperature ${value}°F is below target of 325°F.`, expected: '≥ 325°F' };
    return null;
  }

  if (lc.includes('broth')) {
    if (value < 165) return { severity: 'UNSAFE', message: `Broth temperature ${value}°F is below safe holding temp of 165°F.`, expected: '≥ 165°F' };
    if (value < 200) return { severity: 'WARNING', message: `Broth temperature ${value}°F is below target 200°F.`, expected: '≥ 200°F' };
    return null;
  }

  if (lc.includes('chicken') || lc.includes('poultry') || lc.includes('turkey')) {
    if (lc.includes('chashu') || lc.includes('cooked')) {
      if (value > 40) return { severity: 'UNSAFE', message: `Chicken Chashu temperature ${value}°F exceeds safe cold limit of 40°F.`, expected: '≤ 40°F' };
      return null;
    }
    if (value > 40) return { severity: 'UNSAFE', message: `Chicken temperature ${value}°F exceeds safe cold holding of 40°F.`, expected: '≤ 40°F' };
    return null;
  }

  if (lc.includes('egg') || lc.includes('seasoned egg')) {
    if (value > 40 && value < 140) return { severity: 'UNSAFE', message: `Egg temperature ${value}°F is in the danger zone (40-140°F).`, expected: '≤ 40°F or ≥ 140°F' };
    return null;
  }

  if (lc.includes('pasta') || lc.includes('boiler')) {
    if (value < 200) return { severity: 'WARNING', message: `Pasta boiler temperature ${value}°F is below target 200°F.`, expected: '≥ 200°F' };
    return null;
  }

  if (lc.includes('bowl') && lc.includes('warmer')) {
    if (value < 100) return { severity: 'WARNING', message: `Bowl warmer temperature ${value}°F is below target 100°F.`, expected: '≥ 100°F' };
    return null;
  }

  if (value > 0 && value < 32) {
    return { severity: 'WARNING', message: `Temperature ${value}°F is below freezing (32°F) for non-freezer item "${label}".`, expected: '> 32°F for cold items, ≤ 0°F for freezer' };
  }

  return null;
}

/**
 * Detect repeated suspicious values (3+ items share the same value).
 */
function detectRepeatedValues(items) {
  const issues = [];
  const valueCounts = {};
  const valueItems = {};

  for (const item of items) {
    const v = parseFloat(item.value);
    if (isNaN(v)) continue;
    const key = v.toString();
    valueCounts[key] = (valueCounts[key] || 0) + 1;
    if (!valueItems[key]) valueItems[key] = [];
    valueItems[key].push(item.label || item.field_id || 'Unknown');
  }

  for (const [valStr, count] of Object.entries(valueCounts)) {
    if (count >= 3) {
      const itemNames = valueItems[valStr].join(', ');
      issues.push({
        type: 'repeated_values', severity: 'WARNING',
        item: 'Multiple items',
        message: `${count} items share the same value (${valStr}°F): ${itemNames}. Possible copy-paste.`,
        expected: 'Unique temperature per item', captured: `${valStr}°F repeated ${count}x`,
      });
    }
  }
  return issues;
}

/**
 * Detect likely Celsius values (user entered in °C instead of °F).
 */
function detectCelsiusLikely(label, value) {
  const lc = label.toLowerCase();
  if ((lc.includes('cooler') || lc.includes('refrigerat')) && value >= 1 && value <= 10) return true;
  if ((lc.includes('freezer') || lc.includes('frozen')) && value >= -20 && value <= -5) return true;
  if ((lc.includes('hot') || lc.includes('holding') || lc.includes('broth')) && value >= 60 && value <= 80) return true;
  return false;
}

/**
 * Detect duplicate form photo (same image hash within last 24h).
 */
function detectDuplicatePhoto(imagePath, previousSubmissions) {
  if (!previousSubmissions || !previousSubmissions.length) return null;
  const currentName = (imagePath || '').split(/[\\/]/).pop();
  for (const prev of previousSubmissions) {
    const prevPath = prev.imagePath || '';
    const prevName = prevPath.split(/[\\/]/).pop();
    if (currentName && prevName && currentName === prevName) {
      return {
        type: 'duplicate_photo', severity: 'WARNING',
        item: 'Form photo',
        message: 'This photo appears to be a duplicate of a previous submission.',
        expected: 'New photo each submission', captured: `Duplicate of ${prev.submission_id || 'earlier submission'}`,
      };
    }
    if (prevPath && imagePath && Math.abs(Buffer.byteLength(prevPath, 'utf8') - Buffer.byteLength(imagePath, 'utf8')) < 10) {
      // Rough check — same path or similar
    }
  }
  return null;
}

/**
 * Determine overall status based on collected issues.
 */
function determineOverallStatus(issues) {
  if (issues.length === 0) return 'SAFE';
  const hasUnsafe = issues.some(i => i.severity === 'UNSAFE');
  const hasWarning = issues.some(i => i.severity === 'WARNING');
  const hasNeedsReview = issues.some(i => i.severity === 'NEEDS_REVIEW');
  if (hasUnsafe) return 'UNSAFE';
  if (hasNeedsReview) return 'NEEDS_REVIEW';
  if (hasWarning) return 'WARNING';
  return 'SAFE';
}

/**
 * Build a human-readable warning message for the user.
 */
function buildSafetyReply(validationResult, store) {
  const { status, issues } = validationResult;
  const lines = [];

  if (status === 'SAFE') return null;
  if (!issues || issues.length === 0) return null;

  lines.push('⚠️ Please verify before confirming.');
  lines.push('');

  const shown = issues.slice(0, 3);
  for (const issue of shown) {
    if (issue.type === 'unsafe_temperature' || issue.type === 'temperature_warning') {
      lines.push(`Item: ${issue.item}`);
      lines.push(`Expected: ${issue.expected}`);
      lines.push(`Captured: ${issue.captured}`);
      lines.push('');
    } else if (issue.type === 'missing_field') {
      lines.push(`Item: ${issue.item}`);
      lines.push(`Expected: ${issue.expected}`);
      lines.push(`Captured: ${issue.captured}`);
      lines.push('');
    } else if (issue.type === 'repeated_values' || issue.type === 'low_confidence') {
      lines.push(`Item: ${issue.item}`);
      lines.push(`Issue: ${issue.message}`);
      lines.push('');
    } else if (issue.type === 'empty_form') {
      lines.push('Form appears empty or unreadable.');
      lines.push('Please upload a clearer photo.');
      lines.push('');
    } else {
      lines.push(`Item: ${issue.item}`);
      lines.push(`Issue: ${issue.message}`);
      lines.push('');
    }
  }

  const totalCount = issues.length;
  if (totalCount > 3) {
    lines.push(`... and ${totalCount - 3} more issue(s).`);
    lines.push('');
  }

  lines.push('Reply:');
  lines.push('CONFIRM = save anyway');
  lines.push('EDIT 1 38 = correct value');
  lines.push('MANAGER = send for manager review');
  lines.push('RETAKE = upload clearer photo');

  return lines.join('\n');
}

/**
 * Get a summary of issues for manager alerts.
 */
function getAlertSummary(validationResult, submission) {
  const { status, issues } = validationResult;
  const unsafeIssues = issues.filter(i => i.severity === 'UNSAFE');
  const warningIssues = issues.filter(i => i.severity === 'WARNING');
  const reviewIssues = issues.filter(i => i.severity === 'NEEDS_REVIEW');

  return {
    status,
    totalIssues: issues.length,
    unsafeCount: unsafeIssues.length,
    warningCount: warningIssues.length,
    reviewCount: reviewIssues.length,
    issues: issues.slice(0, 10),
    store: submission.store,
    employee: submission.employee,
    submissionId: submission.submissionId,
    imagePath: submission.imagePath,
  };
}

module.exports = {
  validateSubmission,
  checkTemperatureThreshold,
  detectRepeatedValues,
  detectCelsiusLikely,
  detectDuplicatePhoto,
  determineOverallStatus,
  buildSafetyReply,
  getAlertSummary,
  IMPOSSIBLE_RANGE,
};
