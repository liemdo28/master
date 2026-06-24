// OCR Field Extractor — maps raw OCR output to structured fields using ocr-field-map.json.
//
// Validates extracted values against min/max ranges defined in the field map and
// produces a structured result with per-field confidence and pass/fail status.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIELD_MAP_PATH = path.join(__dirname, '..', '..', '..', 'config', 'ocr-field-map.json');

let _fieldMap = null;

function loadFieldMap() {
  if (_fieldMap) return _fieldMap;
  _fieldMap = JSON.parse(fs.readFileSync(FIELD_MAP_PATH, 'utf8'));
  return _fieldMap;
}

/**
 * Resolve the sections for a store (handles $REF pointers).
 */
function resolveSections(fieldMap, storeKey) {
  const store = fieldMap.stores[storeKey];
  if (!store) return null;
  if (typeof store.sections === 'string' && store.sections.startsWith('$REF:')) {
    const refKey = store.sections.replace('$REF:', '');
    return fieldMap.stores[refKey].sections;
  }
  return store.sections;
}

/**
 * @typedef {object} ExtractedField
 * @property {string} fieldId
 * @property {string} key
 * @property {string} label
 * @property {*} value
 * @property {string} type
 * @property {string} [unit]
 * @property {boolean} inRange
 * @property {number} confidence - 0..1
 * @property {string} status - 'PASS' | 'FAIL' | 'UNKNOWN'
 */

/**
 * @typedef {object} ExtractionResult
 * @property {string} store
 * @property {object} headers
 * @property {ExtractedField[]} fields
 * @property {number} totalFields
 * @property {number} extractedFields
 * @property {number} passedFields
 * @property {number} failedFields
 * @property {number} overallConfidence
 * @property {number} fieldAccuracy - ratio of correctly extracted fields (confidence > 0.7)
 */

/**
 * Extract and validate fields from raw OCR data using the field map.
 *
 * @param {object} rawOcr - Raw OCR output with items and fields
 * @param {string} storeKey - Store key: 'RIM' | 'STONE_OAK' | 'BANDERA'
 * @returns {ExtractionResult}
 */
export function extractAndValidate(rawOcr, storeKey) {
  const fieldMap = loadFieldMap();
  const store = fieldMap.stores[storeKey];
  if (!store) throw new Error(`Unknown store key: ${storeKey}`);

  const sections = resolveSections(fieldMap, storeKey);
  const headers = rawOcr.fields || {};

  const extractedFields = [];
  let totalFields = 0;
  let passed = 0;
  let failed = 0;
  let confidenceSum = 0;

  for (const [_sectionKey, section] of Object.entries(sections)) {
    for (const [fieldId, fieldDef] of Object.entries(section.fields)) {
      totalFields++;

      // Try to find this field in the raw OCR items (by key or label match)
      const match = findFieldInRaw(rawOcr, fieldDef);
      const confidence = match ? match.confidence : 0;
      const value = match ? match.value : null;
      const inRange = checkRange(value, fieldDef);
      const status = value == null ? 'UNKNOWN' : inRange ? 'PASS' : 'FAIL';

      if (status === 'PASS') passed++;
      if (status === 'FAIL') failed++;
      confidenceSum += confidence;

      extractedFields.push({
        fieldId,
        key: fieldDef.key,
        label: fieldDef.label,
        value,
        type: fieldDef.type,
        unit: fieldDef.unit || null,
        inRange,
        confidence,
        status,
      });
    }
  }

  const extractedCount = extractedFields.filter((f) => f.value != null).length;
  const overallConfidence = totalFields > 0 ? confidenceSum / totalFields : 0;
  const fieldAccuracy = totalFields > 0 ? extractedCount / totalFields : 0;

  return {
    store: store.store_name,
    headers,
    fields: extractedFields,
    totalFields,
    extractedFields: extractedCount,
    passedFields: passed,
    failedFields: failed,
    overallConfidence: Math.round(overallConfidence * 100) / 100,
    fieldAccuracy: Math.round(fieldAccuracy * 100) / 100,
  };
}

/**
 * Match a field definition to raw OCR items by key or label substring.
 */
function findFieldInRaw(rawOcr, fieldDef) {
  if (!rawOcr || !rawOcr.items) return null;

  // Match by key
  const byKey = rawOcr.items.find(
    (item) => item.key === fieldDef.key || item.fieldId === fieldDef.key,
  );
  if (byKey) return { value: byKey.value, confidence: byKey.confidence ?? 0.9 };

  // Match by label (fuzzy)
  const labelLower = fieldDef.label.toLowerCase();
  const byLabel = rawOcr.items.find(
    (item) => item.label && item.label.toLowerCase().includes(labelLower.slice(0, 15)),
  );
  if (byLabel) return { value: byLabel.value, confidence: byLabel.confidence ?? 0.8 };

  return null;
}

/**
 * Check if a value falls within the defined min/max range.
 */
function checkRange(value, fieldDef) {
  if (value == null) return false;
  if (fieldDef.type === 'boolean') {
    return typeof value === 'boolean' || value === 'YES' || value === 'NO' || value === true || value === false;
  }
  if (typeof value !== 'number') return false;
  const { min, max } = fieldDef;
  if (min != null && value < min) return false;
  if (max != null && value > max) return false;
  return true;
}

/**
 * Get all field IDs from the map.
 */
export function getAllFieldIds(storeKey = 'RIM') {
  const fieldMap = loadFieldMap();
  const sections = resolveSections(fieldMap, storeKey);
  const ids = [];
  for (const section of Object.values(sections)) {
    for (const fieldId of Object.keys(section.fields)) {
      ids.push(fieldId);
    }
  }
  return ids;
}

/**
 * Load the field map (for external use).
 */
export { loadFieldMap };
