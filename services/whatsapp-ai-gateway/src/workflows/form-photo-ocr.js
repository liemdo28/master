/**
 * Form Photo OCR — processes line check form images using existing OCR engine
 * 
 * Output structured JSON:
 * {
 *   store_id, form_date, shift, employee_name,
 *   items: [{ field_id, label, value, unit: "F", confidence }],
 *   ocr_confidence, warnings, no_data
 * }
 * 
 * IMPORTANT: Uses LOW-LEVEL OCR components only.
 * Does NOT call template-ocr-workflow.js (which creates a session).
 * This ensures form-photo workflow owns its session exclusively.
 */

const { makeLogger } = require('../logger');

const log = makeLogger('form-photo-ocr');

const LOW_CONFIDENCE = 0.6;

/**
 * Process a form photo and extract structured data.
 * Reuses OCR engine, validator, preprocessor — NO conversation session.
 */
async function processFormImage(imagePath, metadata = {}) {
  log.info('Processing form photo', { imagePath, store: metadata.store, chatId: metadata.chatId });

  // Try template-ocr engine first (low-level only — no session created)
  try {
    const router = require('../template-ocr/template-image-router');
    const registry = require('../template-ocr/template-registry');
    const preprocessor = require('../template-ocr/image-preprocessor');
    const ocrEngine = require('../template-ocr/ocr-engine');
    const validator = require('../template-ocr/template-ocr-validator');

    // Check if this looks like a template form
    const detection = await router.looksLikeTemplate(imagePath, metadata).catch(() => null);
    if (detection?.isTemplate) {
      const template = registry.getTemplate(detection.templateId) || registry.getDefaultTemplate();
      if (template) {
        const prep = await preprocessor.preprocessTemplateImage(imagePath, template, metadata).catch(() => null);
        if (prep?.crops?.length) {
          const ocr = await ocrEngine.ocrCrops(prep.crops).catch(() => []);
          const validation = validator.validateOcrResults(ocr, template);
          const payload = buildPayloadFromValidation(validation, metadata, prep, detection);
          return convertTemplateOcrToFormPhoto(payload, metadata);
        }
      }
    }
  } catch (err) {
    log.warn('Template OCR engine not available, falling back to vision pipeline', { error: err.message });
  }

  // Fall back to vision pipeline
  try {
    const visionPipeline = require('../vision/ocr-engine');
    const raw = await visionPipeline.ocrImage(imagePath, {
      ...metadata,
      task: 'form_photo',
    });
    return parseVisionOcrResult(raw, metadata);
  } catch (err) {
    log.warn('Vision OCR fallback failed', { error: err.message });
  }

  // Final fallback: simple temperature extraction from image description
  return await extractFromFallback(imagePath, metadata);
}

/**
 * Build a payload object from validation results (low-level OCR path).
 * Mirrors the structure expected by convertTemplateOcrToFormPhoto.
 */
function buildPayloadFromValidation(validation, metadata, prep, detection) {
  return {
    validation,
    storeId: detection?.storeId || metadata.storeId || '',
    timestamp: metadata.timestamp || new Date().toISOString(),
    senderName: metadata.senderName || 'Unknown',
    alignedImagePath: prep?.alignedPath || '',
    originalPath: prep?.originalPath || '',
  };
}

function convertTemplateOcrToFormPhoto(payload, metadata) {
  const validation = payload.validation || {};
  const items = (validation.items || []).map(item => ({
    field_id: item.item?.toLowerCase().replace(/\s+/g, '_') || '',
    label: item.item || '',
    value: parseFloat(item.value) || null,
    unit: 'F',
    confidence: item.confidence || 0.5,
    status: item.status || 'PASS',
  }));

  // Calculate overall OCR confidence
  const confidences = items.map(i => i.confidence).filter(c => c > 0);
  const ocr_confidence = confidences.length > 0
    ? confidences.reduce((a, b) => a + b, 0) / confidences.length
    : 0;

  // Detect warnings from validation failures
  const warnings = [];
  if (validation.failCount > 0) {
    for (const f of validation.failures || []) {
      warnings.push(`${f.item}: ${f.value}°F is outside range (${f.target})`);
    }
  }
  if (validation.unclearCount > Math.max(3, Math.floor(items.length / 3))) {
    warnings.push(`Low clarity: ${validation.unclearCount} items unclear`);
  }

  return {
    store_id: payload.storeId || metadata.storeId || '',
    form_date: extractDateFromTimestamp(payload.timestamp || metadata.timestamp || new Date().toISOString()),
    shift: extractShiftFromTimestamp(payload.timestamp || metadata.timestamp || new Date().toISOString()),
    employee_name: payload.senderName || metadata.senderName || 'Unknown',
    items,
    ocr_confidence,
    warnings,
    no_data: items.length === 0,
    source: 'template_ocr',
  };
}

function parseVisionOcrResult(raw, metadata) {
  // Parse vision pipeline output into form photo format
  const text = typeof raw === 'string' ? raw : JSON.stringify(raw);
  
  // Extract temperatures from OCR text using regex patterns
  const temperaturePattern = /(\d{2,3})\s*°?\s*[Ff]/g;
  const matches = [...text.matchAll(temperaturePattern)];
  
  const items = [];
  const lines = text.split('\n');
  
  for (const line of lines) {
    // Look for item labels and temperature values
    const tempMatch = line.match(/(\d{2,3})\s*°?\s*[Ff]/);
    if (tempMatch) {
      const value = parseFloat(tempMatch[1]);
      // Try to extract item name from the line
      const label = extractLabelFromLine(line);
      items.push({
        field_id: label.toLowerCase().replace(/\s+/g, '_'),
        label,
        value,
        unit: 'F',
        confidence: estimateConfidence(line),
        status: classifyTemperature(label, value),
      });
    }
  }

  const ocr_confidence = items.length > 0
    ? items.reduce((sum, i) => sum + i.confidence, 0) / items.length
    : 0;

  const warnings = [];
  const failures = items.filter(i => i.status === 'FAIL');
  if (failures.length > 0) {
    warnings.push(`${failures.length} temperature(s) out of range`);
  }
  if (items.length === 0) {
    warnings.push('No temperature values detected in image');
  }

  return {
    store_id: metadata.storeId || '',
    form_date: new Date().toISOString().slice(0, 10),
    shift: extractShiftFromTimestamp(new Date().toISOString()),
    employee_name: metadata.senderName || 'Unknown',
    items,
    ocr_confidence,
    warnings,
    no_data: items.length === 0,
    source: 'vision_ocr',
  };
}

async function extractFromFallback(imagePath, metadata) {
  // When all OCR methods fail, return a low-confidence result
  log.warn('All OCR methods failed for form photo', { imagePath });
  return {
    store_id: metadata.storeId || '',
    form_date: new Date().toISOString().slice(0, 10),
    shift: extractShiftFromTimestamp(new Date().toISOString()),
    employee_name: metadata.senderName || 'Unknown',
    items: [],
    ocr_confidence: 0,
    warnings: ['Could not extract data from form photo'],
    no_data: true,
    source: 'fallback',
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function extractLabelFromLine(line) {
  // Remove temperature value from line to get the label
  const cleaned = line
    .replace(/\d{2,3}\s*°?\s*[Ff]/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim();
  return cleaned.slice(0, 50) || 'Unknown Item';
}

function estimateConfidence(line) {
  // Simple confidence estimation based on line clarity
  const hasNumber = /\d{2,3}/.test(line);
  const hasUnit = /°?\s*[Ff]/.test(line);
  const hasLabel = /[a-zA-Z]{3,}/.test(line);
  let score = 0.3;
  if (hasNumber) score += 0.2;
  if (hasUnit) score += 0.2;
  if (hasLabel) score += 0.2;
  return Math.min(score, 1);
}

function classifyTemperature(label, value) {
  // Basic temperature classification thresholds
  const labelLower = (label || '').toLowerCase();
  
  // Freezer items
  if (labelLower.includes('freezer') || labelLower.includes('frozen')) {
    return value >= -10 && value <= 0 ? 'PASS' : 'FAIL';
  }
  
  // Cooler/cold items
  if (labelLower.includes('cooler') || labelLower.includes('refrigerat') || labelLower.includes('cold')) {
    return value >= 32 && value <= 40 ? 'PASS' : 'FAIL';
  }
  
  // Hot holding
  if (labelLower.includes('hot') || labelLower.includes('holding') || labelLower.includes('chicken') || labelLower.includes('rice')) {
    return value >= 140 ? 'PASS' : 'FAIL';
  }
  
  // Default: reasonable food temperature range
  if (value >= -10 && value <= 200) {
    return 'PASS';
  }
  return 'FAIL';
}

function extractDateFromTimestamp(timestamp) {
  try {
    return new Date(timestamp).toISOString().slice(0, 10);
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function extractShiftFromTimestamp(timestamp) {
  try {
    const hour = new Date(timestamp).getHours();
    if (hour >= 5 && hour < 12) return 'AM';
    if (hour >= 12 && hour < 18) return 'PM';
    if (hour >= 18 && hour < 23) return 'EVE';
    return 'CLOSE';
  } catch {
    return 'AM';
  }
}

module.exports = { processFormImage };