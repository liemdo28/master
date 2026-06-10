/**
 * YoLink Normalizer — converts raw YoLink API data to internal format
 */

function celsiusToFahrenheit(c) {
  return Math.round((c * 9 / 5 + 32) * 10) / 10;
}

function batteryLevelToPercent(level) {
  // YoLink battery: 0=empty, 1=low, 2=medium, 3=high, 4=full
  const map = { 0: 0, 1: 25, 2: 50, 3: 75, 4: 100 };
  return map[level] ?? null;
}

function normalizeReading(deviceState, sensorMeta) {
  if (!deviceState || !deviceState.state) return null;

  const state = deviceState.state;
  const online = deviceState.online !== false;
  const tempC = state.temperature;
  const tempF = tempC != null ? celsiusToFahrenheit(tempC) : null;

  return {
    sensor_id: sensorMeta?.sensor_id || null,
    store_id: sensorMeta?.store_id || null,
    item_name: sensorMeta?.item_name || null,
    value: tempF,
    unit: 'F',
    humidity: state.humidity ?? null,
    battery_level: batteryLevelToPercent(state.battery),
    signal_status: online ? 'good' : 'offline',
    online_status: online ? 1 : 0,
    provider_timestamp: state.reportAt || null,
    raw_payload_json: JSON.stringify(deviceState),
  };
}

function normalizeDevice(device) {
  return {
    provider_device_id: device.deviceId,
    device_name: device.name || device.deviceId,
    device_type: device.type || 'THSensor',
    model: device.modelName || '',
    token: device.token || '',
  };
}

module.exports = { celsiusToFahrenheit, batteryLevelToPercent, normalizeReading, normalizeDevice };
