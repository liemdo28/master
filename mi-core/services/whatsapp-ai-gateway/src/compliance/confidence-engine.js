/**
 * Multi-Source Confidence Engine (Phase 1.4)
 * Combines human, sensor, and photo data to determine final value and confidence.
 *
 * Inputs:
 *   human_value   (number | null)
 *   sensor_value  (number | null)
 *   photo_value   (number | null)
 *   template_min  (number | null)
 *   template_max  (number | null)
 *   sensor_status ('PASS'|'FAIL_HIGH'|'FAIL_LOW'|'STALE'|'OFFLINE'|null)
 *   employee_trust_score (number)
 *   sensor_trust_score  (number)
 *
 * Output: { confidence, final_value, source_priority, status, reason, manager_review_required }
 */
const { makeLogger } = require('../logger');
const log = makeLogger('confidence');

const DEFAULT_TRUST = 80;

function calculateConfidence(inputs) {
  const {
    human_value, sensor_value, photo_value,
    template_min, template_max,
    sensor_status,
    employee_trust_score = DEFAULT_TRUST,
    sensor_trust_score = DEFAULT_TRUST,
  } = inputs;

  const sources = [];
  if (human_value != null) sources.push({ type: 'human', value: human_value, trust: employee_trust_score });
  if (sensor_value != null && sensor_status !== 'OFFLINE' && sensor_status !== 'STALE') {
    sources.push({ type: 'sensor', value: sensor_value, trust: sensor_trust_score });
  }
  if (photo_value != null) sources.push({ type: 'photo', value: photo_value, trust: 85 }); // photo has good baseline trust

  if (sources.length === 0) {
    return {
      confidence: 0,
      final_value: null,
      source_priority: 'none',
      status: 'NO_DATA',
      reason: 'No data sources available',
      manager_review_required: true,
    };
  }

  // Compute differences between sources
  let humanSensorDiff = null;
  let humanPhotoDiff = null;
  let sensorPhotoDiff = null;

  if (human_value != null && sensor_value != null) humanSensorDiff = Math.abs(human_value - sensor_value);
  if (human_value != null && photo_value != null) humanPhotoDiff = Math.abs(human_value - photo_value);
  if (sensor_value != null && photo_value != null) sensorPhotoDiff = Math.abs(sensor_value - photo_value);

  // Two or more sources agree → high confidence
  if (human_value != null && sensor_value != null && humanSensorDiff <= 2) {
    return buildResult({
      confidence: 0.92,
      final_value: sensor_value, // prefer sensor in case of template violation
      source_priority: 'sensor',
      status: evaluateRange(sensor_value, template_min, template_max),
      reason: 'Human and sensor agree within tolerance',
      manager_review_required: sensor_status === 'FAIL_HIGH' || sensor_status === 'FAIL_LOW',
    });
  }

  if (human_value != null && photo_value != null && humanPhotoDiff <= 2) {
    return buildResult({
      confidence: 0.90,
      final_value: human_value,
      source_priority: 'human',
      status: evaluateRange(human_value, template_min, template_max),
      reason: 'Human and photo agree',
      manager_review_required: false,
    });
  }

  if (sensor_value != null && photo_value != null && sensorPhotoDiff <= 2) {
    return buildResult({
      confidence: 0.93,
      final_value: sensor_value,
      source_priority: 'sensor',
      status: evaluateRange(sensor_value, template_min, template_max),
      reason: 'Sensor and photo agree; human entry differs',
      manager_review_required: true,
    });
  }

  // All three available and disagree
  if (human_value != null && sensor_value != null && photo_value != null) {
    return buildResult({
      confidence: 0.4,
      final_value: null,
      source_priority: 'none',
      status: evaluateRange(human_value, template_min, template_max),
      reason: 'All sources disagree — manager review required',
      manager_review_required: true,
    });
  }

  // Exactly two sources, disagreement
  if (human_value != null && sensor_value != null) {
    const trusted = sensor_trust_score >= employee_trust_score ? 'sensor' : 'human';
    return buildResult({
      confidence: 0.65,
      final_value: trusted === 'sensor' ? sensor_value : human_value,
      source_priority: trusted,
      status: evaluateRange(trusted === 'sensor' ? sensor_value : human_value, template_min, template_max),
      reason: `Disagreement between human and sensor (diff=${humanSensorDiff}°F). Trusted: ${trusted}.`,
      manager_review_required: humanSensorDiff > 5,
    });
  }

  if (human_value != null && photo_value != null) {
    return buildResult({
      confidence: 0.75,
      final_value: human_value,
      source_priority: 'human',
      status: evaluateRange(human_value, template_min, template_max),
      reason: 'Human and photo disagree. Prefer human (employee entry primary)',
      manager_review_required: humanPhotoDiff > 5,
    });
  }

  // Only one source
  if (human_value != null) {
    return buildResult({
      confidence: 0.70,
      final_value: human_value,
      source_priority: 'human',
      status: evaluateRange(human_value, template_min, template_max),
      reason: 'Only human entry available',
      manager_review_required: false,
    });
  }

  if (sensor_value != null) {
    const conf = sensor_status === 'PASS' ? 0.80 : 0.60;
    return buildResult({
      confidence: conf,
      final_value: sensor_value,
      source_priority: 'sensor',
      status: evaluateRange(sensor_value, template_min, template_max),
      reason: sensor_status === 'PASS' ? 'Sensor reading (in range)' : 'Sensor reading (out of range)',
      manager_review_required: sensor_status === 'FAIL_HIGH' || sensor_status === 'FAIL_LOW',
    });
  }

  if (photo_value != null) {
    return buildResult({
      confidence: 0.70,
      final_value: photo_value,
      source_priority: 'photo',
      status: evaluateRange(photo_value, template_min, template_max),
      reason: 'Only photo value available',
      manager_review_required: false,
    });
  }

  // Fallback
  return {
    confidence: 0,
    final_value: null,
    source_priority: 'none',
    status: 'NO_DATA',
    reason: 'No usable data',
    manager_review_required: true,
  };
}

function evaluateRange(value, min, max) {
  if (value == null) return 'NO_DATA';
  if (max != null && value > max) return 'FAIL_HIGH';
  if (min != null && value < min) return 'FAIL_LOW';
  return 'PASS';
}

function buildResult(partial) {
  return {
    confidence: partial.confidence,
    final_value: partial.final_value,
    source_priority: partial.source_priority,
    status: partial.status,
    reason: partial.reason,
    manager_review_required: partial.manager_review_required || false,
  };
}

module.exports = { calculateConfidence, evaluateRange };