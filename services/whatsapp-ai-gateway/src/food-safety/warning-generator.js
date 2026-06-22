/**
 * Warning Generator
 * Generates WhatsApp warning messages for FAIL and NEEDS_REVIEW results.
 *
 * FAIL format:
 *   ⚠️ FOOD SAFETY WARNING
 *   Store: Bandera Road
 *   Item: Walk-in Cooler
 *   Reading: 44°F
 *   Target: <= 40°F
 *   Action: Close door, re-temp in 10 min, alert MOD if still high.
 *
 * NEEDS_REVIEW format:
 *   ⚠️ NEEDS REVIEW
 *   The image was received, but some readings were unclear.
 *   Please retake the photo or manually confirm:
 *   - Walk-in Cooler
 *   - Chicken Chashu
 */

const { makeLogger } = require('../logger');

const log = makeLogger('food-safety');

/**
 * Generate a FAIL warning for a specific failing item.
 */
function generateItemWarning(failure) {
  const lines = [
    '⚠️ FOOD SAFETY WARNING',
    `Store: ${failure.store || 'Unknown'}`,
    `Item: ${failure.item}`,
    `Reading: ${failure.value}°${failure.unit || 'F'}`,
    `Target: ${failure.operator || '?'} ${failure.target}°${failure.unit || 'F'}`,
  ];
  if (failure.correctiveAction) {
    lines.push(`Action: ${failure.correctiveAction}`);
  }
  lines.push('');
  lines.push('Recorded to daily log.');
  lines.push('Please re-temp and confirm.');
  return lines.join('\n');
}

/**
 * Generate a full FAIL warning for a check with one or more failures.
 */
function generateFailWarning({ store, failures }) {
  if (!failures || failures.length === 0) return null;
  const first = failures[0];
  let msg = generateItemWarning({ ...first, store });
  if (failures.length > 1) {
    const extra = failures.slice(1).map(f => `• ${f.item}: ${f.value}°${f.unit || 'F'} (${f.operator} ${f.target}°${f.unit || 'F'})`).join('\n');
    msg += '\n\nOther failures:\n' + extra;
  }
  return msg;
}

/**
 * Generate a NEEDS_REVIEW warning listing unclear/unknown items.
 */
function generateNeedsReviewWarning({ store, needsReview, unclearFields }) {
  const items = [
    ...(needsReview || []),
    ...(unclearFields || []),
  ].filter(v => v && v !== '*');

  const unique = [...new Set(items)];
  if (unique.length === 0) {
    // Nothing specific to call out
  return [
    '⚠️ NEEDS REVIEW',
    'Image received but some fields were unclear.',
    `Store: ${store || 'Unknown'}`,
    '',
    'Please retake the photo and try again.',
    'Logged to Needs Review.',
    '',
    'If the problem persists, please contact your manager.',
  ].join('\n');
  }

  return [
    '⚠️ NEEDS REVIEW',
    'Image received but some fields were unclear.',
    `Store: ${store || 'Unknown'}`,
    '',
    'Unclear:',
    '',
    ...unique.map(item => `- ${item}`),
    '',
    'Please retake photo or confirm manually.',
    'Logged to Needs Review.',
  ].join('\n');
}

/**
 * Generate a PASS notification (only sent when FOOD_SAFETY_REPLY_MODE=always_reply).
 */
function generatePassNotice({ store }) {
  return [
    '✅ Food safety check passed.',
    `Store: ${store || 'Unknown'}`,
    '',
    'All readings were within acceptable ranges.',
  ].join('\n');
}

/**
 * Determine result and generate the appropriate warning/nothing.
 *
 * @param {object} checkResult - output from threshold-engine.checkAll()
 * @param {object} analyzed - output from image-analyzer
 * @returns {{ result: string, warning: string|null }}
 *   result: 'PASS' | 'FAIL' | 'NEEDS_REVIEW'
 */
function generateResult(checkResult, analyzed) {
  const { failures, needsReview: engineNeedsReview = [] } = checkResult;

  // Check for needs_review from image analyzer
  const analyzerNeedsReview = analyzed.needs_review || [];
  const hasGenericReview = analyzerNeedsReview.includes('*');
  const needsReview = [
    ...analyzerNeedsReview.filter(v => v !== '*'),
    ...engineNeedsReview.map(v => v.item || v),
  ];
  const unclearFields = analyzed.unclear_fields || [];
  const storeUnknown = !analyzed.store || analyzed.store === 'Unknown';
  const hasNeedsReview = hasGenericReview || needsReview.length > 0 || unclearFields.length > 0 || storeUnknown;

  // Check for failures (actual threshold violations)
  const hasFailures = failures.length > 0;

  let result;
  let warning;

  if (hasFailures) {
    result = 'FAIL';
    warning = generateFailWarning({ store: analyzed.store, failures });
    log.warn('Food safety FAIL', { store: analyzed.store, failures: failures.map(f => f.item) });
  } else if (hasNeedsReview) {
    result = 'NEEDS_REVIEW';
    warning = generateNeedsReviewWarning({
      store: analyzed.store || 'Unknown',
      needsReview: storeUnknown ? ['Store unclear — please confirm store.', ...needsReview] : needsReview,
      unclearFields,
    });
    log.warn('Food safety NEEDS_REVIEW', { store: analyzed.store, items: [...needsReview, ...unclearFields] });
  } else {
    result = 'PASS';
    warning = null;
    log.info('Food safety PASS', { store: analyzed.store });
  }

  return { result, warning };
}

module.exports = {
  generateItemWarning,
  generateFailWarning,
  generateNeedsReviewWarning,
  generatePassNotice,
  generateResult,
};
