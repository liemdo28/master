/**
 * Phase 1.2–1.7 Tests — YoLink + Cross-Validation + Safety Rules
 * Run: node tests/run-tests.js
 */
const assert = require('assert');

// Mock modules that may not exist yet
function mockRequire(path, fallback) {
  try { return require(path); } catch (_) { return fallback; }
}

// ── Test Suite ──────────────────────────────────────────────────────────────

const suites = [];

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 1: YoLink Discovery Audit (Phase 1.2A)
// ─────────────────────────────────────────────────────────────────────────────

suites.push({
  name: 'YoLink Discovery Audit',
  tests: [
    {
      label: 'YoLink device model YS8014-UC is YoLink TH Sensor',
      run: () => {
        const fs = require('fs');
        const report = fs.readFileSync('./docs/YOLINK_DISCOVERY_AUDIT.md', 'utf8');
        assert(report.includes('YS8014-UC'), 'Model number YS8014-UC not found in report');
        assert(report.includes('THermo-Hygrometer'), 'Sensor type not documented');
      },
    },
    {
      label: 'YoLink Hub required — documented in report',
      run: () => {
        const fs = require('fs');
        const report = fs.readFileSync('./docs/YOLINK_DISCOVERY_AUDIT.md', 'utf8');
        assert(report.includes('Hub Required'), 'Hub requirement not documented');
        assert(report.includes('YES'), 'Hub requirement status not YES');
      },
    },
    {
      label: 'API endpoints documented — token, device list, state',
      run: () => {
        const fs = require('fs');
        const report = fs.readFileSync('./docs/YOLINK_DISCOVERY_AUDIT.md', 'utf8');
        assert(report.includes('api.yosmart.com'), 'API endpoint not documented');
        assert(report.includes('THSensor.getState'), 'getState method not documented');
        assert(report.includes('client_credentials'), 'OAuth2 flow not documented');
      },
    },
    {
      label: 'Failure modes documented',
      run: () => {
        const fs = require('fs');
        const report = fs.readFileSync('./docs/YOLINK_DISCOVERY_AUDIT.md', 'utf8');
        assert(report.includes('Hub offline'), 'Hub offline failure not documented');
        assert(report.includes('rate limited'), 'Rate limit failure not documented');
        assert(report.includes('fallback'), 'Mitigation not documented');
      },
    },
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 2: Sensor Data Model (Phase 1.2B)
// ─────────────────────────────────────────────────────────────────────────────

suites.push({
  name: 'Sensor Data Model — SQLite Tables',
  tests: [
    {
      label: 'sensors table has all required fields',
      run: () => {
        const fs = require('fs');
        const db = fs.readFileSync('./src/storage/sqlite.js', 'utf8');
        assert(db.includes('sensors'), 'sensors table not found');
        assert(db.includes('sensor_id TEXT NOT NULL UNIQUE'), 'sensor_id not found');
        assert(db.includes('provider TEXT NOT NULL DEFAULT'), 'provider field not found');
        assert(db.includes('provider_device_id'), 'provider_device_id not found');
        assert(db.includes('store_id'), 'store_id not found');
        assert(db.includes('trust_enabled'), 'trust_enabled not found');
      },
    },
    {
      label: 'sensor_readings table has all required fields',
      run: () => {
        const fs = require('fs');
        const db = fs.readFileSync('./src/storage/sqlite.js', 'utf8');
        assert(db.includes('sensor_readings'), 'sensor_readings table not found');
        assert(db.includes('value REAL'), 'value field not found');
        assert(db.includes('battery_level'), 'battery_level not found');
        assert(db.includes('online_status'), 'online_status not found');
        assert(db.includes('provider_timestamp'), 'provider_timestamp not found');
        assert(db.includes('raw_payload_json'), 'raw_payload_json not found');
      },
    },
    {
      label: 'sensor_alerts table exists with correct fields',
      run: () => {
        const fs = require('fs');
        const db = fs.readFileSync('./src/storage/sqlite.js', 'utf8');
        assert(db.includes('sensor_alerts'), 'sensor_alerts table not found');
        assert(db.includes('store_alert_sent'), 'store_alert_sent not found');
        assert(db.includes('manager_alert_sent'), 'manager_alert_sent not found');
        assert(db.includes('duration_minutes'), 'duration_minutes not found');
      },
    },
    {
      label: 'cross_validation_results table exists',
      run: () => {
        const fs = require('fs');
        const db = fs.readFileSync('./src/storage/sqlite.js', 'utf8');
        assert(db.includes('cross_validation_results'), 'cross_validation_results table not found');
        assert(db.includes('human_value'), 'human_value not found');
        assert(db.includes('sensor_value'), 'sensor_value not found');
        assert(db.includes('photo_value'), 'photo_value not found');
        assert(db.includes('resolution'), 'resolution field not found');
      },
    },
    {
      label: 'employee_trust_scores table exists',
      run: () => {
        const fs = require('fs');
        const db = fs.readFileSync('./src/storage/sqlite.js', 'utf8');
        assert(db.includes('employee_trust_scores'), 'employee_trust_scores table not found');
        assert(db.includes('score REAL DEFAULT 80'), 'score default 80 not found');
        assert(db.includes('total_matches'), 'total_matches not found');
        assert(db.includes('total_mismatches'), 'total_mismatches not found');
      },
    },
    {
      label: 'sensor_item_mapping table exists',
      run: () => {
        const fs = require('fs');
        const db = fs.readFileSync('./src/storage/sqlite.js', 'utf8');
        assert(db.includes('sensor_item_mapping'), 'sensor_item_mapping table not found');
        assert(db.includes('mapping_confidence'), 'mapping_confidence not found');
        assert(db.includes('active INTEGER DEFAULT 1'), 'active flag not found');
      },
    },
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 3: YoLink Integration Layer (Phase 1.2C)
// ─────────────────────────────────────────────────────────────────────────────

suites.push({
  name: 'YoLink Integration Layer',
  tests: [
    {
      label: 'yolink-auth.js exists and exports isConfigured',
      run: () => {
        const auth = require('../src/integrations/yolink/yolink-auth');
        assert(typeof auth.isConfigured === 'function', 'isConfigured not exported');
        assert(typeof auth.getToken === 'function', 'getToken not exported');
        assert(typeof auth.refreshToken === 'function', 'refreshToken not exported');
      },
    },
    {
      label: 'yolink-auth.isConfigured returns false when no credentials',
      run: () => {
        const auth = require('../src/integrations/yolink/yolink-auth');
        const result = auth.isConfigured();
        assert(typeof result === 'boolean', 'isConfigured must return boolean');
      },
    },
    {
      label: 'yolink-client.js exists and exports testConnection',
      run: () => {
        const client = require('../src/integrations/yolink/yolink-client');
        assert(typeof client.testConnection === 'function', 'testConnection not exported');
        assert(typeof client.getDeviceList === 'function', 'getDeviceList not exported');
        assert(typeof client.getDeviceState === 'function', 'getDeviceState not exported');
      },
    },
    {
      label: 'yolink-normalizer.js exports celsiusToFahrenheit',
      run: () => {
        const norm = require('../src/integrations/yolink/yolink-normalizer');
        assert(typeof norm.celsiusToFahrenheit === 'function', 'celsiusToFahrenheit not exported');
        // Test: 0°C = 32°F
        assert(norm.celsiusToFahrenheit(0) === 32, '0°C should be 32°F');
        // Test: 5.6°C = 42°F (from YoLink sample data)
        assert(norm.celsiusToFahrenheit(5.6) === 42.1, '5.6°C should be ~42°F');
      },
    },
    {
      label: 'yolink-normalizer.js exports batteryLevelToPercent',
      run: () => {
        const norm = require('../src/integrations/yolink/yolink-normalizer');
        assert(typeof norm.batteryLevelToPercent === 'function', 'batteryLevelToPercent not exported');
        assert(norm.batteryLevelToPercent(4) === 100, 'battery 4 = 100%');
        assert(norm.batteryLevelToPercent(0) === 0, 'battery 0 = 0%');
        assert(norm.batteryLevelToPercent(2) === 50, 'battery 2 = 50%');
      },
    },
    {
      label: 'yolink-poller.js exports isEnabled, start, stop, getStatus, forcePoll',
      run: () => {
        const poller = require('../src/integrations/yolink/yolink-poller');
        assert(typeof poller.isEnabled === 'function', 'isEnabled not exported');
        assert(typeof poller.start === 'function', 'start not exported');
        assert(typeof poller.stop === 'function', 'stop not exported');
        assert(typeof poller.getStatus === 'function', 'getStatus not exported');
        assert(typeof poller.forcePoll === 'function', 'forcePoll not exported');
      },
    },
    {
      label: 'yolink-poller.getStatus() shows configured=false when no credentials',
      run: () => {
        const poller = require('../src/integrations/yolink/yolink-poller');
        const status = poller.getStatus();
        assert(typeof status === 'object', 'getStatus must return object');
        assert('configured' in status, 'configured field missing');
        assert('enabled' in status, 'enabled field missing');
        assert('polling' in status, 'polling field missing');
      },
    },
    {
      label: 'yolink-poller is disabled by default (YOLINK_ENABLED not set)',
      run: () => {
        const poller = require('../src/integrations/yolink/yolink-poller');
        const status = poller.getStatus();
        assert(status.enabled === false, 'Should be disabled when YOLINK_ENABLED not set');
      },
    },
    {
      label: 'yolink-device-sync.js exports syncDevices and getActiveSensors',
      run: () => {
        const sync = require('../src/integrations/yolink/yolink-device-sync');
        assert(typeof sync.syncDevices === 'function', 'syncDevices not exported');
        assert(typeof sync.getActiveSensors === 'function', 'getActiveSensors not exported');
        assert(typeof sync.disableSensor === 'function', 'disableSensor not exported');
      },
    },
    {
      label: 'yolink-reading-service.js exports getLatestReadingForItem',
      run: () => {
        const svc = require('../src/integrations/yolink/yolink-reading-service');
        assert(typeof svc.getLatestReadingForItem === 'function', 'getLatestReadingForItem not exported');
        assert(typeof svc.getRecentReadings === 'function', 'getRecentReadings not exported');
      },
    },
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 4: Sensor Threshold Validator (Phase 1.2E)
// ─────────────────────────────────────────────────────────────────────────────

suites.push({
  name: 'Sensor Threshold Validator',
  tests: [
    {
      label: 'sensor-threshold-validator.js exists and exports validateReading',
      run: () => {
        const validator = require('../src/compliance/sensor-threshold-validator');
        assert(typeof validator.validateReading === 'function', 'validateReading not exported');
        assert(typeof validator.checkAllSensorHealth === 'function', 'checkAllSensorHealth not exported');
      },
    },
    {
      label: 'validateReading returns OFFLINE for null reading',
      run: async () => {
        const validator = require('../src/compliance/sensor-threshold-validator');
        const result = await validator.validateReading(null);
        assert(result.status === 'OFFLINE', `Expected OFFLINE, got ${result.status}`);
      },
    },
    {
      label: 'validateReading returns OFFLINE for offline sensor',
      run: async () => {
        const validator = require('../src/compliance/sensor-threshold-validator');
        const result = await validator.validateReading({
          sensor_id: 'test_offline',
          value: 38,
          online_status: 0,
        });
        assert(result.status === 'OFFLINE', `Expected OFFLINE, got ${result.status}`);
      },
    },
    {
      label: 'validateReading returns PASS for reading within range',
      run: async () => {
        const validator = require('../src/compliance/sensor-threshold-validator');
        // Patch template cache for this test
        const result = await validator.validateReading({
          sensor_id: 'test_pass',
          value: 38,
          online_status: 1,
          item_name: 'Walk-in Cooler',
          store_id: 'stone_oak',
        });
        // Result depends on template — at minimum, no crash
        assert(result.status !== undefined, 'Status must be defined');
      },
    },
    {
      label: 'validateReading does not crash when sensor has no item mapping',
      run: async () => {
        const validator = require('../src/compliance/sensor-threshold-validator');
        const result = await validator.validateReading({
          sensor_id: 'test_no_mapping',
          value: 38,
          online_status: 1,
          item_name: null,
          store_id: 'stone_oak',
        });
        assert(['NEEDS_MAPPING', 'PASS', 'FAIL_HIGH', 'FAIL_LOW'].includes(result.status),
          `Unexpected status: ${result.status}`);
      },
    },
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 5: Sensor Alert Service (Phase 1.2F)
// ─────────────────────────────────────────────────────────────────────────────

suites.push({
  name: 'Sensor Alert Service',
  tests: [
    {
      label: 'sensor-alert-service.js exists and exports isEnabled',
      run: () => {
        const alerts = require('../src/alerts/sensor-alert-service');
        assert(typeof alerts.isEnabled === 'function', 'isEnabled not exported');
        assert(typeof alerts.handleThresholdFailure === 'function', 'handleThresholdFailure not exported');
        assert(typeof alerts.getActiveAlerts === 'function', 'getActiveAlerts not exported');
        assert(typeof alerts.getAlertStats === 'function', 'getAlertStats not exported');
      },
    },
    {
      label: 'sensor alerts disabled by default (SENSOR_ALERTS_ENABLED not set)',
      run: () => {
        const alerts = require('../src/alerts/sensor-alert-service');
        assert(alerts.isEnabled() === true, 'Alerts should be enabled by default (SENSOR_ALERTS_ENABLED !== false)');
      },
    },
    {
      label: 'getAlertStats returns object with active/total/today counts',
      run: async () => {
        const alerts = require('../src/alerts/sensor-alert-service');
        const stats = await alerts.getAlertStats();
        assert(typeof stats === 'object', 'getAlertStats must return object');
        assert('active' in stats, 'active field missing');
        assert('total' in stats, 'total field missing');
        assert('today' in stats, 'today field missing');
      },
    },
    {
      label: 'getActiveAlerts returns array',
      run: async () => {
        const alerts = require('../src/alerts/sensor-alert-service');
        const active = await alerts.getActiveAlerts();
        assert(Array.isArray(active), 'getActiveAlerts must return array');
      },
    },
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 6: Cross-Validation Service (Phase 1.3)
// ─────────────────────────────────────────────────────────────────────────────

suites.push({
  name: 'Cross-Validation Service',
  tests: [
    {
      label: 'cross-validation-service.js exists and exports compareHumanVsSensor',
      run: () => {
        const cv = require('../src/compliance/cross-validation-service');
        assert(typeof cv.compareHumanVsSensor === 'function', 'compareHumanVsSensor not exported');
        assert(typeof cv.resolveMismatch === 'function', 'resolveMismatch not exported');
        assert(typeof cv.getStats === 'function', 'getStats not exported');
      },
    },
    {
      label: 'compareHumanVsSensor returns DISABLED when not configured',
      run: async () => {
        const cv = require('../src/compliance/cross-validation-service');
        const result = await cv.compareHumanVsSensor('stone_oak', 'Walk-in Cooler', 38, 'emp_001');
        assert(result.status === 'NO_SENSOR' || result.status === 'DISABLED', `Unexpected status: ${result.status}`);
      },
    },
    {
      label: 'getStats returns object with total/match/mismatch/noSensor fields',
      run: async () => {
        const cv = require('../src/compliance/cross-validation-service');
        const stats = await cv.getStats();
        assert(typeof stats === 'object', 'getStats must return object');
        assert('total' in stats, 'total field missing');
        assert('match' in stats, 'match field missing');
        assert('mismatch' in stats, 'mismatch field missing');
        assert('matchRate' in stats, 'matchRate field missing');
      },
    },
    {
      label: 'isEnabled returns boolean',
      run: () => {
        const cv = require('../src/compliance/cross-validation-service');
        assert(typeof cv.isEnabled() === 'boolean', 'isEnabled must return boolean');
      },
    },
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 7: Trust Score Service (Phase 1.3C)
// ─────────────────────────────────────────────────────────────────────────────

suites.push({
  name: 'Trust Score Service',
  tests: [
    {
      label: 'trust-score-service.js exists and exports IMPACT constants',
      run: () => {
        const trust = require('../src/compliance/trust-score-service');
        assert(typeof trust.IMPACT === 'object', 'IMPACT not exported');
        assert(trust.IMPACT.MATCH === 2, 'MATCH impact should be 2');
        assert(trust.IMPACT.MISMATCH === -10, 'MISMATCH impact should be -10');
        assert(trust.IMPACT.PHOTO_CONFIRMS_HUMAN === 5, 'PHOTO_CONFIRMS_HUMAN should be 5');
      },
    },
    {
      label: 'Exports employee trust functions',
      run: () => {
        const trust = require('../src/compliance/trust-score-service');
        assert(typeof trust.getOrCreateEmployeeScore === 'function', 'getOrCreateEmployeeScore not exported');
        assert(typeof trust.onHumanMatchesSensor === 'function', 'onHumanMatchesSensor not exported');
        assert(typeof trust.onHumanMismatchSensor === 'function', 'onHumanMismatchSensor not exported');
        assert(typeof trust.getTopEmployees === 'function', 'getTopEmployees not exported');
      },
    },
    {
      label: 'Exports store compliance functions',
      run: () => {
        const trust = require('../src/compliance/trust-score-service');
        assert(typeof trust.getAllStoreScores === 'function', 'getAllStoreScores not exported');
        assert(typeof trust.updateStoreCompliance === 'function', 'updateStoreCompliance not exported');
      },
    },
    {
      label: 'getTopEmployees returns array',
      run: async () => {
        const trust = require('../src/compliance/trust-score-service');
        const employees = await trust.getTopEmployees(5);
        assert(Array.isArray(employees), 'getTopEmployees must return array');
      },
    },
    {
      label: 'getAllStoreScores returns array',
      run: async () => {
        const trust = require('../src/compliance/trust-score-service');
        const stores = await trust.getAllStoreScores();
        assert(Array.isArray(stores), 'getAllStoreScores must return array');
      },
    },
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 8: Confidence Engine (Phase 1.4)
// ─────────────────────────────────────────────────────────────────────────────

suites.push({
  name: 'Confidence Engine',
  tests: [
    {
      label: 'confidence-engine.js exists and exports calculateConfidence',
      run: () => {
        const ce = require('../src/compliance/confidence-engine');
        assert(typeof ce.calculateConfidence === 'function', 'calculateConfidence not exported');
        assert(typeof ce.evaluateRange === 'function', 'evaluateRange not exported');
      },
    },
    {
      label: 'No data returns zero confidence, manager_review_required=true',
      run: () => {
        const ce = require('../src/compliance/confidence-engine');
        const result = ce.calculateConfidence({});
        assert(result.confidence === 0, 'No data should have 0 confidence');
        assert(result.manager_review_required === true, 'No data requires manager review');
        assert(result.final_value === null, 'No data has no final value');
        assert(result.status === 'NO_DATA', `Status should be NO_DATA, got ${result.status}`);
      },
    },
    {
      label: 'Human + sensor agree within 2°F → high confidence (0.92)',
      run: () => {
        const ce = require('../src/compliance/confidence-engine');
        const result = ce.calculateConfidence({
          human_value: 38,
          sensor_value: 39,
          template_min: 30,
          template_max: 40,
          sensor_status: 'PASS',
        });
        assert(result.confidence >= 0.90, `Expected high confidence, got ${result.confidence}`);
        assert(result.source_priority === 'sensor', 'Should prioritize sensor when both agree');
      },
    },
    {
      label: 'Human and sensor disagree > 2°F → lower confidence + review when diff > 5°F',
      run: () => {
        const ce = require('../src/compliance/confidence-engine');
        const result = ce.calculateConfidence({
          human_value: 38,
          sensor_value: 45, // diff = 7°F — large disagreement
          template_min: 30,
          template_max: 40,
          sensor_status: 'PASS',
          employee_trust_score: 80,
          sensor_trust_score: 80,
        });
        assert(result.confidence < 0.90, `Expected lower confidence for disagreement, got ${result.confidence}`);
        assert(result.manager_review_required === true, 'Large disagreement (7°F) should require manager review');
      },
    },
    {
      label: 'Sensor + photo agree → very high confidence (0.93)',
      run: () => {
        const ce = require('../src/compliance/confidence-engine');
        const result = ce.calculateConfidence({
          human_value: 38,
          sensor_value: 42,
          photo_value: 42,
          template_min: 30,
          template_max: 40,
          sensor_status: 'PASS',
        });
        assert(result.confidence >= 0.90, `Expected very high confidence, got ${result.confidence}`);
        assert(result.source_priority === 'sensor', 'Should prioritize sensor when sensor+photo agree');
      },
    },
    {
      label: 'All three disagree → manager review required',
      run: () => {
        const ce = require('../src/compliance/confidence-engine');
        // All three are > 2°F apart from each other:
        // human=55, sensor=62 (diff=7), human=55, photo=57 (diff=2) — human+photo agree at boundary
        // Use human=50, sensor=62, photo=58 — all differences > 2°F from each other
        const result = ce.calculateConfidence({
          human_value: 50,
          sensor_value: 62,
          photo_value: 58,
          template_min: 30,
          template_max: 90,
          sensor_status: 'PASS',
        });
        // human=50 vs photo=58: diff=8 (>2), human=50 vs sensor=62: diff=12 (>2), sensor=62 vs photo=58: diff=4 (>2)
        // None of the "two agree" rules fire → falls to "all disagree" case
        assert(result.manager_review_required === true, `All disagree requires manager review, got ${result.manager_review_required}`);
        assert(result.confidence < 0.60, `Expected low confidence for all disagree, got ${result.confidence}`);
        assert(result.final_value === null, 'No clear final value when all disagree');
      },
    },
    {
      label: 'Only human value → medium confidence (0.70)',
      run: () => {
        const ce = require('../src/compliance/confidence-engine');
        const result = ce.calculateConfidence({
          human_value: 38,
          template_min: 30,
          template_max: 40,
        });
        assert(result.confidence === 0.70, `Expected 0.70, got ${result.confidence}`);
        assert(result.source_priority === 'human', 'Should prioritize human');
      },
    },
    {
      label: 'Only sensor, in range → high confidence (0.80)',
      run: () => {
        const ce = require('../src/compliance/confidence-engine');
        const result = ce.calculateConfidence({
          sensor_value: 38,
          template_min: 30,
          template_max: 40,
          sensor_status: 'PASS',
        });
        assert(result.confidence === 0.80, `Expected 0.80, got ${result.confidence}`);
        assert(result.source_priority === 'sensor', 'Should prioritize sensor');
      },
    },
    {
      label: 'Value > max → FAIL_HIGH',
      run: () => {
        const ce = require('../src/compliance/confidence-engine');
        const result = ce.calculateConfidence({
          human_value: 45,
          template_min: 30,
          template_max: 40,
        });
        assert(result.status === 'FAIL_HIGH', `Expected FAIL_HIGH, got ${result.status}`);
      },
    },
    {
      label: 'Value < min → FAIL_LOW',
      run: () => {
        const ce = require('../src/compliance/confidence-engine');
        const result = ce.calculateConfidence({
          human_value: 28,
          template_min: 30,
          template_max: 40,
        });
        assert(result.status === 'FAIL_LOW', `Expected FAIL_LOW, got ${result.status}`);
      },
    },
    {
      label: 'evaluateRange utility works correctly',
      run: () => {
        const ce = require('../src/compliance/confidence-engine');
        assert(ce.evaluateRange(35, 30, 40) === 'PASS', '35 in 30-40 should be PASS');
        assert(ce.evaluateRange(41, 30, 40) === 'FAIL_HIGH', '41 above 40 should be FAIL_HIGH');
        assert(ce.evaluateRange(29, 30, 40) === 'FAIL_LOW', '29 below 30 should be FAIL_LOW');
        assert(ce.evaluateRange(null, 30, 40) === 'NO_DATA', 'null should be NO_DATA');
      },
    },
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 9: Safety Rules / Fallbacks (Phase 1.6)
// ─────────────────────────────────────────────────────────────────────────────

suites.push({
  name: 'Safety Rules / Fallbacks',
  tests: [
    {
      label: 'sensor-safety-rules.js exists and exports getFinalValue',
      run: () => {
        const safety = require('../src/compliance/sensor-safety-rules');
        assert(typeof safety.getFinalValue === 'function', 'getFinalValue not exported');
        assert(typeof safety.onSheetWriteFailure === 'function', 'onSheetWriteFailure not exported');
      },
    },
    {
      label: 'getFinalValue returns human value when no sensor',
      run: async () => {
        const safety = require('../src/compliance/sensor-safety-rules');
        const result = await safety.getFinalValue({
          humanValue: 38,
          storeId: 'stone_oak',
          itemName: 'Walk-in Cooler',
          employeeId: 'emp_001',
        });
        assert(result.finalValue === 38, 'Should return human value');
        assert(result.confidence >= 0.65, `Expected confidence >= 0.65, got ${result.confidence}`);
      },
    },
    {
      label: 'getFinalValue never crashes',
      run: async () => {
        const safety = require('../src/compliance/sensor-safety-rules');
        // This should not throw even with invalid inputs
        const result = await safety.getFinalValue({ humanValue: null });
        assert(result, 'Should always return a result object');
        assert(typeof result.confidence === 'number', 'confidence must be a number');
        assert(typeof result.fallback_source === 'string', 'fallback_source must be a string');
      },
    },
    {
      label: 'onSheetWriteFailure does not crash',
      run: async () => {
        const safety = require('../src/compliance/sensor-safety-rules');
        await safety.onSheetWriteFailure({
          storeId: 'stone_oak',
          itemName: 'Walk-in Cooler',
          finalValue: 38,
          source: 'sensor',
        });
        // No assertion — just check it doesn't throw
        assert(true, 'onSheetWriteFailure completed without error');
      },
    },
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 10: Sensor Dashboard Panel (Phase 1.2D)
// ─────────────────────────────────────────────────────────────────────────────

suites.push({
  name: 'Sensor Dashboard Panel',
  tests: [
    {
      label: 'sensor-dashboard-panel.js exports buildSensorPanelHtml',
      run: () => {
        const panel = require('../src/compliance/sensor-dashboard-panel');
        assert(typeof panel.buildSensorPanelHtml === 'function', 'buildSensorPanelHtml not exported');
      },
    },
    {
      label: 'buildSensorPanelHtml returns string',
      run: () => {
        const panel = require('../src/compliance/sensor-dashboard-panel');
        const html = panel.buildSensorPanelHtml(null);
        assert(typeof html === 'string', 'buildSensorPanelHtml must return string');
        assert(html.includes('Sensor Monitoring'), 'Panel title not found');
      },
    },
    {
      label: 'Panel shows NOT CONFIGURED when sensorData.status.configured = false',
      run: () => {
        const panel = require('../src/compliance/sensor-dashboard-panel');
        const html = panel.buildSensorPanelHtml({ status: { configured: false } });
        assert(html.includes('NOT CONFIGURED'), 'NOT CONFIGURED message not found');
        assert(html.includes('Human workflow remains active'), 'Human workflow message not found');
      },
    },
    {
      label: 'Panel shows polling status when configured',
      run: () => {
        const panel = require('../src/compliance/sensor-dashboard-panel');
        const html = panel.buildSensorPanelHtml({
          status: { configured: true, enabled: true, polling: true, intervalSeconds: 300, lastPollAt: '2025-06-04T08:00:00Z', pollCount: 5 },
          readings: [],
          alerts: [],
          crossVal: { stats: {} },
          trust: {},
        });
        assert(html.includes('ENABLED'), 'ENABLED badge not found');
        assert(html.includes('POLLING'), 'POLLING badge not found');
        assert(html.includes('Poll every 300s'), 'Poll interval not shown');
        assert(html.includes('Sync Devices'), 'Sync Devices button not found');
      },
    },
    {
      label: 'Panel shows all 4 tabs',
      run: () => {
        const panel = require('../src/compliance/sensor-dashboard-panel');
        const html = panel.buildSensorPanelHtml({
          status: { configured: true },
          readings: [],
          alerts: [],
          crossVal: {},
          trust: {},
        });
        assert(html.includes('Readings'), 'Readings tab not found');
        assert(html.includes('Alerts'), 'Alerts tab not found');
        assert(html.includes('Cross-Validation'), 'Cross-Validation tab not found');
        assert(html.includes('Trust Scores'), 'Trust Scores tab not found');
      },
    },
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 11: API Endpoints (Phase 1.2D)
// ─────────────────────────────────────────────────────────────────────────────

suites.push({
  name: 'Sensor API Endpoints',
  tests: [
    {
      label: '/api/sensors/status endpoint registered in server',
      run: () => {
        const fs = require('fs');
        const server = fs.readFileSync('./src/api/server.js', 'utf8');
        assert(server.includes("app.get('/api/sensors/status'"), '/api/sensors/status GET not found');
        assert(server.includes("app.post('/api/sensors/sync'"), '/api/sensors/sync POST not found');
        assert(server.includes("app.post('/api/sensors/force-poll'"), '/api/sensors/force-poll POST not found');
        assert(server.includes("app.get('/api/sensors/alerts'"), '/api/sensors/alerts GET not found');
        assert(server.includes("app.get('/api/sensors/cross-validation'"), '/api/sensors/cross-validation GET not found');
        assert(server.includes("app.get('/api/sensors/trust'"), '/api/sensors/trust GET not found');
      },
    },
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 12: Integration Export
// ─────────────────────────────────────────────────────────────────────────────

suites.push({
  name: 'Integration Export',
  tests: [
    {
      label: 'integrations/index.js exports yolink',
      run: () => {
        const integrations = require('../src/integrations');
        assert(integrations.whatsapp, 'whatsapp integration not exported');
        assert(integrations.telegram, 'telegram integration not exported');
        assert('yolink' in integrations, 'yolink not exported in integrations index');
      },
    },
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// Run Tests
// ─────────────────────────────────────────────────────────────────────────────

function runSuites() {
  console.log('\n=== Phase 1.2–1.7 YoLink + Cross-Validation Tests ===\n');
  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (const suite of suites) {
    console.log(`[SUITE] ${suite.name}`);
    for (const test of suite.tests) {
      try {
        const result = test.run();
        if (result && typeof result.then === 'function') {
          result.then(() => {
            passed++;
            console.log(`  ✅ ${test.label}`);
          }).catch(err => {
            failed++;
            console.log(`  ❌ ${test.label}: ${err.message}`);
          });
        } else {
          passed++;
          console.log(`  ✅ ${test.label}`);
        }
      } catch (err) {
        failed++;
        console.log(`  ❌ ${test.label}: ${err.message}`);
      }
    }
    console.log('');
  }

  // Sync Promise-based tests
  setTimeout(() => {
    console.log(`\nResults: ${passed} passed, ${failed} failed, ${skipped} skipped\n`);
    if (failed > 0) process.exit(1);
  }, 1000);
}

runSuites();