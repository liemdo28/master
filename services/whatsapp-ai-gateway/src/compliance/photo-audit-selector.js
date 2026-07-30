/**
 * Photo Audit Selector
 * 
 * Selects which items to audit after a daily entry confirmation.
 * 
 * Selection strategies:
 *   1. Random audit — based on PHOTO_AUDIT_RATE (default 20%)
 *   2. Suspicious pattern — based on pattern detector output
 *   3. Out-of-range values — items that were borderline
 */

const { makeLogger } = require('../logger');
const patternDetector = require('./pattern-detector');

const log = makeLogger('compliance');

function getAuditRate() {
  return parseFloat(process.env.PHOTO_AUDIT_RATE || '0.20');
}

function getMaxItems() {
  return parseInt(process.env.PHOTO_AUDIT_MAX_ITEMS || '2', 10);
}

function getTimeoutMinutes() {
  return parseInt(process.env.PHOTO_AUDIT_TIMEOUT_MINUTES || '10', 10);
}

/**
 * Select items to audit based on payload analysis.
 * 
 * @param {object} payload  - { storeId, storeName, employeeId, employeeName, counts, thresholds }
 * @returns {Promise<{ items: Array<{item, enteredValue, targetMin, targetMax, reason}>, auditId }>}
 */
async function selectItemsForAudit(payload) {
  const { storeId, storeName, employeeId, employeeName, counts, thresholds } = payload || {};

  // Check pattern detector first
  const patternResult = await patternDetector.shouldTriggerAudit(payload);

  if (patternResult.shouldAudit && patternResult.selectedItems?.length > 0) {
    const items = patternResult.selectedItems.map(itemName => ({
      item: itemName,
      enteredValue: counts?.[itemName] ?? null,
      targetMin: thresholds?.[itemName]?.min ?? null,
      targetMax: thresholds?.[itemName]?.max ?? null,
      reason: patternResult.reason,
      severity: patternResult.severity || 'MEDIUM',
    }));
    return { items, auditId: makeAuditId(), triggeredBy: 'pattern' };
  }

  // Random audit
  const rate = getAuditRate();
  if (Math.random() < rate) {
    const allItems = Object.keys(counts || {});
    const selected = allItems
      .filter(k => typeof counts[k] === 'number')
      .sort(() => Math.random() - 0.5)
      .slice(0, getMaxItems());

    if (selected.length === 0) {
      return { items: [], auditId: null, triggeredBy: 'none' };
    }

    const items = selected.map(itemName => ({
      item: itemName,
      enteredValue: counts[itemName],
      targetMin: thresholds?.[itemName]?.min ?? null,
      targetMax: thresholds?.[itemName]?.max ?? null,
      reason: `Random audit (${Math.round(rate * 100)}% rate)`,
      severity: 'LOW',
    }));
    return { items, auditId: makeAuditId(), triggeredBy: 'random' };
  }

  return { items: [], auditId: null, triggeredBy: 'none' };
}

/**
 * Filter items to only temperature-related items (those with thresholds).
 * For food safety photo audit, we only audit items that have temperature thresholds.
 */
function filterTemperatureItems(items) {
  return items.filter(i => i.targetMin != null || i.targetMax != null);
}

function makeAuditId() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `AUD-${dateStr}-${rand}`;
}

module.exports = {
  selectItemsForAudit,
  filterTemperatureItems,
  getAuditRate,
  getMaxItems,
  getTimeoutMinutes,
  makeAuditId,
};