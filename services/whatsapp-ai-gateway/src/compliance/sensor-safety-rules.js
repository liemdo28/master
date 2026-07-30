/**
 * Multi-Source Safety Rules (Phase 1.6)
 * Fallback architecture — no single source can silently override others.
 *
 * Human + YoLink + Vision + Manager Review
 *
 * Sources:
 *   human  — employee WhatsApp entry
 *   sensor — YoLink temperature reading
 *   photo  — Vision AI photo verification
 *   manager — human manager override
 *
 * This module provides a unified getValue() interface that always returns
 * a result with a `fallback_source` field indicating which source was used,
 * and never crashes.
 */
const { makeLogger } = require('../logger');
const log = makeLogger('safety-rules');

const FALLBACK_ORDER = ['human', 'sensor', 'photo', 'manager'];

let crossValidationSvc;
try { crossValidationSvc = require('./cross-validation-service'); } catch (_) {}
let confidenceEngine;
try { confidenceEngine = require('./confidence-engine'); } catch (_) {}
let trustSvc;
try { trustSvc = require('./trust-score-service'); } catch (_) {}
let readingService;
try { readingService = require('../integrations/yolink/yolink-reading-service'); } catch (_) {}
let templateCache;
try { templateCache = require('../templates/template-cache'); } catch (_) {}
let replyService;
try { replyService = require('../whatsapp/reply-service'); } catch (_) {}

/**
 * Unified value resolver — gets final value from all sources.
 * NEVER throws. Always returns a result object.
 */
async function getFinalValue({ humanValue, storeId, itemName, employeeId, photoValue = null }) {
  const result = {
    humanValue,
    sensorValue: null,
    photoValue,
    finalValue: humanValue,
    fallback_source: 'human',
    confidence: 0.70,
    status: 'PASS',
    manager_review_required: false,
    reason: '',
  };

  // Step 1: Try sensor
  if (readingService && storeId && itemName) {
    try {
      const sensorReading = await readingService.getLatestReadingForItem(storeId, itemName);
      if (sensorReading && sensorReading.online_status) {
        result.sensorValue = sensorReading.value;

        // Cross-validate
        if (crossValidationSvc) {
          const cv = await crossValidationSvc.compareHumanVsSensor(storeId, itemName, humanValue, employeeId);
          result.cross_validation = cv;

          if (cv.status === 'MISMATCH') {
            result.manager_review_required = true;
            result.confidence = 0.55;
            result.reason = `Human ${humanValue} vs sensor ${sensorReading.value} — difference ${cv.difference}°F (tolerance ${cv.tolerance}°F)`;
            // Do NOT auto-switch to sensor — flag for review
          } else if (cv.status === 'MATCH') {
            result.confidence = 0.88;
            result.reason = 'Human and sensor match';
          }
        }

        // Step 2: Try confidence engine if photo available
        if (photoValue && confidenceEngine) {
          const thresholds = getItemThresholds(itemName);
          const sensorTrustScore = trustSvc ? (await trustSvc.getEmployeeScore(employeeId, storeId))?.score || 80 : 80;
          const ceResult = confidenceEngine.calculateConfidence({
            human_value: humanValue,
            sensor_value: sensorReading.value,
            photo_value: photoValue,
            template_min: thresholds?.min,
            template_max: thresholds?.max,
            sensor_status: sensorReading.online_status ? 'PASS' : 'OFFLINE',
            employee_trust_score: sensorTrustScore,
            sensor_trust_score: sensorTrustScore,
          });
          result.confidence = ceResult.confidence;
          result.final_value = ceResult.final_value;
          result.status = ceResult.status;
          result.manager_review_required = ceResult.manager_review_required;
          result.reason = ceResult.reason;
          result.source_priority = ceResult.source_priority;
        } else if (confidenceEngine) {
          const thresholds = getItemThresholds(itemName);
          const sensorTrust = trustSvc ? 80 : 80;
          const ceResult = confidenceEngine.calculateConfidence({
            human_value: humanValue,
            sensor_value: sensorReading.value,
            photo_value: null,
            template_min: thresholds?.min,
            template_max: thresholds?.max,
            sensor_status: sensorReading.online_status ? 'PASS' : 'OFFLINE',
            employee_trust_score: 80,
            sensor_trust_score: sensorTrust,
          });
          result.confidence = ceResult.confidence;
          result.final_value = ceResult.final_value;
          result.status = ceResult.status;
          result.manager_review_required = ceResult.manager_review_required;
          result.reason = ceResult.reason;
          result.source_priority = ceResult.source_priority;
        }
      } else {
        result.fallback_source = 'human';
        result.reason = 'Sensor offline — using human entry';
        log.info('Sensor offline, using human entry', { store_id: storeId, item_name: itemName });
      }
    } catch (err) {
      log.error('Sensor lookup failed', { error: err.message });
      result.fallback_source = 'human';
      result.reason = `Sensor unavailable: ${err.message}`;
    }
  }

  // Step 3: If no human value — use sensor only
  if (humanValue == null && result.sensorValue != null) {
    result.finalValue = result.sensorValue;
    result.fallback_source = 'sensor';
    result.confidence = 0.75;
    result.status = 'SENSOR_ONLY';
    result.reason = 'No human entry — using sensor reading. Manager alert sent for missing human log.';

    // Alert manager about missing human entry
    await alertMissingHumanEntry(storeId, itemName);
  }

  // Step 4: If all sources unavailable
  if (humanValue == null && result.sensorValue == null && photoValue == null) {
    result.finalValue = null;
    result.fallback_source = 'none';
    result.confidence = 0;
    result.status = 'NO_DATA';
    result.manager_review_required = true;
    result.reason = 'All sources unavailable — manager alert required';
    await alertAllSourcesUnavailable(storeId, itemName);
  }

  return result;
}

function getItemThresholds(itemName) {
  if (!templateCache) return null;
  const all = templateCache.getThresholds();
  if (!all) return null;
  const entry = all.find(t => t.item === itemName || t.name === itemName);
  if (!entry) return null;
  return { min: entry.min ?? entry.target_min, max: entry.max ?? entry.target_max };
}

async function alertMissingHumanEntry(storeId, itemName) {
  const managerChatId = process.env.MANAGER_ALERT_GROUP_CHAT_ID;
  if (!managerChatId || !replyService) return;
  try {
    await replyService.sendText(managerChatId,
      `⚠️ MISSING HUMAN ENTRY\n\nStore: ${storeId}\nItem: ${itemName}\nSensor reading available but no employee entry.\n\nPlease follow up with the store.`
    );
  } catch (_) {}
}

async function alertAllSourcesUnavailable(storeId, itemName) {
  const managerChatId = process.env.MANAGER_ALERT_GROUP_CHAT_ID;
  if (!managerChatId || !replyService) return;
  try {
    await replyService.sendText(managerChatId,
      `🚨 ALL SOURCES UNAVAILABLE\n\nStore: ${storeId}\nItem: ${itemName}\nNo human entry, no sensor reading, no photo.\n\nIMMEDIATE ACTION REQUIRED.`
    );
  } catch (_) {}
}

/**
 * Called when sheet write fails — queue locally
 */
async function onSheetWriteFailure(context) {
  const { storeId, itemName, finalValue, source } = context;
  log.error('Sheet write failed, queued locally', context);
  // Queue is handled by sheet-write-queue workflow — just log here
  const managerChatId = process.env.MANAGER_ALERT_GROUP_CHAT_ID;
  if (managerChatId && replyService) {
    try {
      await replyService.sendText(managerChatId,
        `⚠️ Google Sheet Write Failed\n\nStore: ${storeId}\nItem: ${itemName}\nValue: ${finalValue}°F (${source})\n\nEntry queued locally. Will retry automatically.`
      );
    } catch (_) {}
  }
}

module.exports = {
  getFinalValue,
  onSheetWriteFailure,
  alertMissingHumanEntry,
  alertAllSourcesUnavailable,
};