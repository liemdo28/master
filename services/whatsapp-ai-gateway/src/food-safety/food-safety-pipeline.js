/**
 * Food Safety Pipeline
 * Orchestrates the full image→analysis→check→warning→storage flow.
 *
 * Workflow:
 *   1. Receive image path + metadata
 *   2. Run image analyzer
 *   3. Run threshold engine on extracted readings
 *   4. Generate warning (if FAIL / NEEDS_REVIEW)
 *   5. Persist to SQLite
 *   6. Return { result, warning, checkId }
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { makeLogger } = require('../logger');
const sheetSource = require('./sheet-source');
const thresholdEngine = require('./threshold-engine');
const warningGenerator = require('./warning-generator');
const imageAnalyzer = require('./image-analyzer');
const fsStorage = require('../storage/food-safety-storage');
const imageValidator = require('../vision/image-validator');
const dailyLogWriter = require('../google/daily-log-writer');

const log = makeLogger('food-safety');

const UPLOAD_DIR = path.resolve('./data/uploads/food-safety');

/**
 * Main pipeline entry point.
 *
 * @param {string} imagePath  - absolute path to the downloaded image
 * @param {object} metadata   - { chatId, sender, senderName, timestamp, messageId }
 * @param {object|null} mockAnalyzedResult - if provided, use this instead of real analyzer (for testing)
 * @returns {Promise<{ result, warning, checkId, analyzed, failures }>}
 */
async function runPipeline(imagePath, metadata, mockAnalyzedResult = null) {
  const { chatId, sender, senderName, timestamp, messageId } = metadata || {};

  log.info('Food safety pipeline started', { imagePath, chatId, sender, timestamp });

  // Step 1: Analyze image
  let analyzed;
  if (mockAnalyzedResult) {
    analyzed = mockAnalyzedResult;
  } else {
    analyzed = await imageAnalyzer.analyzeImage(imagePath);
  }

  // Step 2: Run threshold checks
  const checkResult = thresholdEngine.checkAll(analyzed.readings || []);
  const { failures, passed, needsReview: engineNeedsReview = [] } = checkResult;

  // Step 3: Determine result + generate warning
  const { result, warning } = warningGenerator.generateResult(checkResult, analyzed);

  // Step 4: Save to SQLite
  const readingsForStorage = [
    ...failures.map(f => ({ ...f, status: 'FAIL' })),
    ...passed.map(p => ({ ...p, status: 'PASS' })),
    // Mark needs_review items
    ...engineNeedsReview.map(item => ({
      item: item.item || item,
      value: item.value ?? null,
      unit: item.unit || 'F',
      confidence: item.confidence ?? null,
      status: 'NEEDS_REVIEW',
      operator: null,
      target: null,
      corrective: null,
    })),
    ...(analyzed.needs_review || []).map(item => ({
      item,
      value: null,
      unit: 'F',
      confidence: null,
      status: 'NEEDS_REVIEW',
      operator: null,
      target: null,
      corrective: null,
    })),
  ];

  const checkId = await fsStorage.saveCheck({
    chatId,
    sender,
    senderName,
    timestamp,
    messageId,
    imagePath,
    store: analyzed.store,
    result,
    readings: readingsForStorage,
    extractedJson: analyzed,
  });

  await fsStorage.saveReadings(checkId, readingsForStorage);

  if (warning) {
    await fsStorage.saveWarning(checkId, result, warning);
  }

  const sheetWrite = await dailyLogWriter.appendDailyLog({
    checkId,
    metadata: { chatId, sender, senderName, timestamp, messageId },
    imagePath,
    analyzed,
    readings: readingsForStorage,
    result,
    warning,
  });

  if (result === 'FAIL' || result === 'NEEDS_REVIEW') {
    await fsStorage.saveIncident({
      checkId,
      result,
      correctiveText: warning || '',
      notes: result === 'FAIL' ? 'Threshold violation detected.' : 'Manual review required.',
    });
  }

  log.info('Food safety pipeline complete', {
    checkId,
    result,
    store: analyzed.store,
    readingsCount: (analyzed.readings || []).length,
    failuresCount: failures.length,
    needsReviewCount: (analyzed.needs_review || []).length,
    warningSent: !!warning,
    sheetWriteStatus: sheetWrite.status,
  });

  return {
    result,
    warning,
    checkId,
    analyzed,
    failures,
    passed,
    needsReview: engineNeedsReview,
    sheetWrite,
    lastSynced: sheetSource.getLastSynced(),
  };
}

/**
 * Save a downloaded image to the structured directory.
 * Returns the saved path.
 */
function saveImage(mediaData, metadata) {
  const { timestamp } = metadata || {};
  const dateStr = timestamp ? new Date(timestamp).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  const dir = path.join(UPLOAD_DIR, dateStr);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const ext = getMediaExtension(mediaData) || '.jpg';
  const filename = `${Date.now()}-${(metadata?.messageId || 'unknown').replace(/[^a-zA-Z0-9]/g, '_')}${ext}`;
  const filePath = path.join(dir, filename);

  // mediaData may be a Buffer or have a data property
  const buffer = mediaData.data ? Buffer.from(mediaData.data, 'base64') : mediaData;
  fs.writeFileSync(filePath, buffer);

  // Also save metadata alongside
  const metaPath = filePath.replace(/\.[^.]+$/, '.meta.json');
  fs.writeFileSync(metaPath, JSON.stringify(metadata || {}, null, 2));

  try {
    const audit = imageValidator.inspectImage(filePath);
    fsStorage.saveImageAudit({
      imagePath: filePath,
      chatId: metadata?.chatId,
      sender: metadata?.sender,
      messageId: metadata?.messageId,
      mimeType: audit.mimeType,
      sizeBytes: audit.sizeBytes,
      metadata,
    }).catch(err => log.warn('Image audit save failed', { error: err.message }));
  } catch (err) {
    log.warn('Image audit inspection failed', { error: err.message });
  }

  log.info('Image saved', { filePath, size: buffer.length });
  return filePath;
}

function getMediaExtension(mediaData) {
  const mime = mediaData?.mimetype || mediaData?.mimeType || '';
  const map = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
  };
  return map[mime.toLowerCase()] || '.jpg';
}

/**
 * Initialize the food safety pipeline (call on startup).
 */
async function init() {
  const enabled = process.env.FOOD_SAFETY_ENABLED === 'true';
  if (!enabled) {
    log.info('Food safety pipeline disabled');
    return;
  }
  await sheetSource.init();
  await fsStorage.ensureTables();
  if (dailyLogWriter.isEnabled()) {
    dailyLogWriter.retryPending(10).catch(err => log.warn('Sheet queue retry failed', { error: err.message }));
  }
  log.info('Food safety pipeline initialized');
}

module.exports = { runPipeline, saveImage, init };
