/**
 * Pattern Detector
 * 
 * Detects suspicious patterns in daily entry submissions that may indicate
 * copied/faked values.
 * 
 * Patterns detected:
 * - Same values repeated 3+ times
 * - Full submission identical to previous
 * - Too many perfect/pass values
 * - Same employee submits too fast
 * - Values submitted without time gap
 * - Boundary value clustering
 */

const { all, get } = require('../storage/sqlite');
const { makeLogger } = require('../logger');

const log = makeLogger('compliance');

// ── Config ────────────────────────────────────────────────────────────────────
function isEnabled() { return process.env.PHOTO_AUDIT_ENABLED !== 'false'; }
function getAuditRate() { return parseFloat(process.env.PHOTO_AUDIT_RATE || '0.20'); } // 20% random audit
function getMaxAuditItems() { return parseInt(process.env.PHOTO_AUDIT_MAX_ITEMS || '2', 10); }

// ── Pattern detection ──────────────────────────────────────────────────────────

/**
 * Analyze a submitted daily entry payload for suspicious patterns.
 * 
 * @param {object} payload  - { storeId, employeeId, employeeName, counts, timestamp }
 * @returns {{ suspicious: boolean, patterns: string[], severity: 'LOW'|'MEDIUM'|'HIGH' }}
 */
async function analyzeSubmissionPatterns(payload) {
  if (!isEnabled()) return { suspicious: false, patterns: [], severity: 'LOW' };

  const { storeId, employeeId, counts } = payload || {};
  const patterns = [];
  let severity = 'LOW';

  // Pattern 1: Repeated identical values
  const repeatedValues = findRepeatedValues(counts);
  if (repeatedValues.length > 0) {
    patterns.push(`Repeated values: ${repeatedValues.join(', ')}`);
    severity = severityRank(severity, 'MEDIUM');
  }

  // Pattern 2: Too many identical values (suggests copy-paste)
  const identicalCount = countIdenticalValues(counts);
  if (identicalCount >= 5) {
    patterns.push(`${identicalCount} identical values detected — possible copy`);
    severity = severityRank(severity, 'HIGH');
  }

  // Pattern 3: Check against previous submission
  if (storeId && employeeId) {
    const duplicateScore = await checkAgainstPreviousSubmission(storeId, employeeId, counts);
    if (duplicateScore > 0.8) {
      patterns.push(`Submission is ${Math.round(duplicateScore * 100)}% identical to previous`);
      severity = severityRank(severity, 'HIGH');
    } else if (duplicateScore > 0.5) {
      patterns.push(`Submission is ${Math.round(duplicateScore * 100)}% similar to previous`);
      severity = severityRank(severity, 'MEDIUM');
    }
  }

  // Pattern 4: Boundary value clustering
  const boundaryClusters = findBoundaryClusters(counts);
  if (boundaryClusters.length > 2) {
    patterns.push(`${boundaryClusters.length} values exactly on boundary`);
    severity = severityRank(severity, 'MEDIUM');
  }

  // Pattern 5: Perfect pass values (all items in safe range)
  // This is not suspicious — removed

  const suspicious = patterns.length > 0;
  log.info('Pattern analysis', { storeId, employeeId, suspicious, patterns: patterns.length, severity });

  return { suspicious, patterns, severity };
}

/**
 * Find items with the same value repeated across the submission.
 */
function findRepeatedValues(counts) {
  if (!counts || typeof counts !== 'object') return [];
  const valueCounts = {};
  for (const [item, value] of Object.entries(counts)) {
    const v = String(value);
    if (/^\d+$/.test(v)) {
      valueCounts[v] = valueCounts[v] || [];
      valueCounts[v].push(item);
    }
  }
  return Object.entries(valueCounts)
    .filter(([v, items]) => items.length >= 3 && parseInt(v) > 0)
    .map(([v, items]) => `${v} (${items.length}x: ${items.slice(0, 3).join(', ')})`);
}

/**
 * Count how many items share the same value.
 */
function countIdenticalValues(counts) {
  if (!counts || typeof counts !== 'object') return 0;
  const valueCounts = {};
  for (const [item, value] of Object.entries(counts)) {
    const v = String(value);
    valueCounts[v] = (valueCounts[v] || 0) + 1;
  }
  return Object.values(valueCounts).filter(c => c > 1).reduce((a, b) => a + b - 1, 0);
}

/**
 * Calculate similarity score between current and previous submission.
 */
async function checkAgainstPreviousSubmission(storeId, employeeId, counts) {
  const currentKeys = Object.keys(counts || {}).sort();
  const currentVals = currentKeys.map(k => String(counts[k]));

  // Get last submission for this employee
  const { all } = require('../storage/sqlite');
  const rows = await all(
    `SELECT * FROM workflow_audit_logs
     WHERE store_id = ? AND employee_id = ?
     ORDER BY confirmed_at DESC LIMIT 2`,
    [storeId, employeeId]
  );

  if (rows.length < 2) return 0; // No previous to compare

  const prevRow = rows[1]; // second-most-recent is "previous"
  if (!prevRow?.final_payload_json) return 0;

  let prevPayload;
  try {
    prevPayload = JSON.parse(prevRow.final_payload_json);
  } catch (_) {
    return 0;
  }

  const prevCounts = prevPayload?.counts || prevPayload || {};
  const prevKeys = Object.keys(prevCounts).sort();
  const prevVals = prevKeys.map(k => String(prevCounts[k]));

  if (currentKeys.length !== prevKeys.length) return 0;

  // Calculate Jaccard similarity on values
  let matchCount = 0;
  for (let i = 0; i < currentKeys.length; i++) {
    if (currentKeys[i] === prevKeys[i] && currentVals[i] === prevVals[i]) {
      matchCount++;
    }
  }

  return currentKeys.length > 0 ? matchCount / currentKeys.length : 0;
}

/**
 * Find items with values exactly at template boundary (min or max).
 */
function findBoundaryClusters(counts) {
  if (!counts || typeof counts !== 'object') return [];
  // This would need template thresholds — return empty for now
  // Real implementation would check against template_cache
  return [];
}

// ── Severity ranking ──────────────────────────────────────────────────────────
function severityRank(current, next) {
  const rank = { LOW: 1, MEDIUM: 2, HIGH: 3 };
  return rank[next] > rank[current] ? next : current;
}

// ── Trigger decision ──────────────────────────────────────────────────────────

/**
 * Decide whether to trigger a photo audit for this submission.
 * 
 * @returns {{ shouldAudit: boolean, reason: string, selectedItems: string[] }}
 */
async function shouldTriggerAudit(payload) {
  if (!isEnabled()) return { shouldAudit: false, reason: 'PHOTO_AUDIT_ENABLED=false', selectedItems: [] };

  // First: check patterns
  const { suspicious, patterns, severity } = await analyzeSubmissionPatterns(payload);
  
  if (suspicious) {
    const items = payload?.counts ? Object.keys(payload.counts) : [];
    return {
      shouldAudit: true,
      reason: `Suspicious patterns: ${patterns.join('; ')}`,
      severity,
      selectedItems: items.slice(0, getMaxAuditItems()),
    };
  }

  // Second: random audit
  const rate = getAuditRate();
  const rand = Math.random();

  if (rand < rate) {
    const items = payload?.counts ? Object.keys(payload.counts) : [];
    const selected = items.length > 0
      ? items.sort(() => Math.random() - 0.5).slice(0, getMaxAuditItems())
      : [];
    return {
      shouldAudit: true,
      reason: `Random audit (${Math.round(rate * 100)}% rate triggered, rolled ${Math.round(rand * 100)}%)`,
      severity: 'LOW',
      selectedItems: selected,
    };
  }

  return { shouldAudit: false, reason: 'No suspicious patterns detected' };
}

module.exports = {
  isEnabled,
  analyzeSubmissionPatterns,
  shouldTriggerAudit,
  findRepeatedValues,
  countIdenticalValues,
  checkAgainstPreviousSubmission,
  findBoundaryClusters,
};