/**
 * Temperature Reading Extractor
 * 
 * Wrapper around vision-provider for extracting temperature readings
 * from photo audit proof images.
 * 
 * Input:
 *   - image_path
 *   - target_item (e.g. 'Walk-in Cooler')
 *   - store_id, store_name
 * 
 * Output:
 *   {
 *     item: string,
 *     observed_value: number | null,
 *     unit: 'F',
 *     confidence: 0.0-1.0,
 *     image_quality: 'GOOD | BLURRY | DARK | OBSTRUCTED',
 *     needs_review: boolean,
 *     reason: string
 *   }
 */

const visionProvider = require('./vision-provider');
const { visionPrompts } = require('./vision-prompts');
const { makeLogger } = require('../logger');

const log = makeLogger('vision');

function getKnownTempItems() {
  try { return require('../templates/template-cache').getItemNames(); } catch (_) { return []; }
}

/**
 * Extract a temperature reading from a proof photo.
 * 
 * @param {string} imagePath  - absolute path to the photo
 * @param {string} targetItem - item name being verified
 * @param {object} metadata   - { storeId, storeName }
 * @returns {Promise<object>} - extraction result
 */
async function extract(imagePath, targetItem, metadata = {}) {
  log.info('Temperature extraction started', { imagePath, targetItem, store: metadata?.storeName });

  if (!visionProvider.isEnabled()) {
    return {
      item: targetItem,
      observed_value: null,
      unit: 'F',
      confidence: 0,
      image_quality: 'UNKNOWN',
      needs_review: true,
      reason: 'Vision not configured',
    };
  }

  const result = await visionProvider.extractTemperatureReading(imagePath, targetItem, metadata);

  if (!result.ok) {
    log.warn('Vision extraction failed', { reason: result.reason });
    return {
      item: targetItem,
      observed_value: null,
      unit: 'F',
      confidence: 0,
      image_quality: 'UNKNOWN',
      needs_review: true,
      reason: result.reason || 'Vision call failed',
    };
  }

  const parsed = visionProvider.parseJsonResponse(result.content);

  if (!parsed) {
    log.warn('Vision returned unparseable content', { content: result.content?.slice(0, 200) });
    return {
      item: targetItem,
      observed_value: null,
      unit: 'F',
      confidence: 0,
      image_quality: 'UNKNOWN',
      needs_review: true,
      reason: 'Could not parse vision response',
    };
  }

  // Post-process: normalize value
  let value = parsed.observed_value;
  if (value != null) {
    value = parseFloat(value);
    if (Number.isNaN(value)) value = null;
  }

  // Post-process: convert °C to °F if needed
  if (parsed.unit === 'C' && value != null) {
    value = Math.round((value * 9 / 5 + 32) * 10) / 10; // round to 1 decimal
  }

  const needsReview = parsed.needs_review === true
    || parsed.confidence < 0.60
    || value == null;

  log.info('Temperature extraction result', {
    item: parsed.item || targetItem,
    value,
    unit: parsed.unit || 'F',
    confidence: parsed.confidence,
    quality: parsed.image_quality,
    needs_review: needsReview,
  });

  return {
    item: parsed.item || targetItem,
    observed_value: value,
    unit: 'F',
    confidence: parsed.confidence ?? 0,
    image_quality: parsed.image_quality || 'UNKNOWN',
    needs_review: needsReview,
    reason: parsed.reason || '',
  };
}

/**
 * Extract from a mock result (for testing).
 */
async function extractMock(imagePath, mockResult) {
  return mockResult;
}

module.exports = { extract, extractMock, getKnownTempItems };
