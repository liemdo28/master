/**
 * YoLink Poller — scheduled polling with threshold validation and alerts
 */
const auth = require('./yolink-auth');
const readingService = require('./yolink-reading-service');
const { makeLogger } = require('../../logger');
const log = makeLogger('yolink');

let pollInterval = null;
let lastPollAt = null;
let pollCount = 0;

function isEnabled() {
  if (process.env.YOLINK_ENABLED !== 'true') return false;
  return auth.isConfigured();
}

// Async variant — reads enabled flag from DB-first apiSettings so that
// dashboard-saved credentials take effect without a .env edit.
async function isEnabledAsync() {
  try {
    const settings = require('./yolink-api-settings');
    const enabled = await settings.isEnabledFlag();
    if (!enabled) return false;
    return await settings.isConfigured();
  } catch (_) {
    return isEnabled();
  }
}

function getIntervalMs() {
  return parseInt(process.env.YOLINK_POLL_INTERVAL_SECONDS || '300', 10) * 1000;
}

async function poll() {
  if (!isEnabled()) return null;
  try {
    const result = await readingService.pollAllSensors();
    lastPollAt = new Date().toISOString();
    pollCount++;

    // Threshold validation is handled by sensor-threshold-validator (Phase 1.2E)
    // It's called separately after poll to keep concerns separated
    let thresholdValidator;
    try { thresholdValidator = require('../../compliance/sensor-threshold-validator'); } catch (_) {}
    if (thresholdValidator && result.readings.length) {
      for (const reading of result.readings) {
        try {
          await thresholdValidator.validateReading(reading);
        } catch (err) {
          log.error('Threshold validation error', { sensor_id: reading.sensor_id, error: err.message });
        }
      }
    }

    return result;
  } catch (err) {
    log.error('YoLink poll cycle failed', { error: err.message });
    return null;
  }
}

function start() {
  if (!isEnabled()) {
    log.info('YoLink poller disabled (YOLINK_ENABLED != true or credentials missing)');
    return;
  }
  if (pollInterval) return;

  const ms = getIntervalMs();
  log.info('YoLink poller starting', { intervalSeconds: ms / 1000 });

  // Initial poll after 10 seconds
  setTimeout(() => poll(), 10000);

  pollInterval = setInterval(() => poll(), ms);
}

function stop() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
    log.info('YoLink poller stopped');
  }
}

function getStatus() {
  return {
    enabled: isEnabled(),
    configured: auth.isConfigured(),
    polling: !!pollInterval,
    intervalSeconds: parseInt(process.env.YOLINK_POLL_INTERVAL_SECONDS || '300', 10),
    lastPollAt,
    pollCount,
  };
}

async function forcePoll() {
  return poll();
}

module.exports = { isEnabled, isEnabledAsync, start, stop, poll, forcePoll, getStatus };
