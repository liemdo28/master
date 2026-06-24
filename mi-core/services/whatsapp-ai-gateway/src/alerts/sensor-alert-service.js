/**
 * Sensor Alert Service (Phase 1.2F)
 * Sends WhatsApp alerts when sensors are out of range, with debouncing.
 */
const { run, all, get } = require('../storage/sqlite');
const { makeLogger } = require('../logger');
const log = makeLogger('yolink');

let replyService;
try { replyService = require('../whatsapp/reply-service'); } catch (_) {}
let storeRegistry;
try { storeRegistry = require('../stores/store-registry'); } catch (_) {}

function isEnabled() {
  return process.env.SENSOR_ALERTS_ENABLED !== 'false';
}

const ALERT_AFTER_MINUTES = () => parseInt(process.env.SENSOR_ALERT_AFTER_MINUTES || '5', 10);
const ALERT_REPEAT_MINUTES = () => parseInt(process.env.SENSOR_ALERT_REPEAT_MINUTES || '30', 10);

/**
 * Handle a threshold validation result that is FAIL_HIGH or FAIL_LOW
 */
async function handleThresholdFailure(validationResult) {
  if (!isEnabled()) return;

  const { status, reading, item_name, target_min, target_max } = validationResult;
  if (status !== 'FAIL_HIGH' && status !== 'FAIL_LOW') return;

  const sensorId = reading.sensor_id;
  const storeId = reading.store_id;
  const value = reading.value;

  // Check if there's an active (unresolved) alert for this sensor
  const activeAlert = await get(
    "SELECT * FROM sensor_alerts WHERE sensor_id = ? AND status = 'ACTIVE' ORDER BY created_at DESC LIMIT 1",
    [sensorId]
  );

  if (activeAlert) {
    // Update duration
    const durationMinutes = Math.round(
      (Date.now() - new Date(activeAlert.created_at).getTime()) / 60000
    );
    await run(
      'UPDATE sensor_alerts SET duration_minutes = ?, reading_value = ? WHERE id = ?',
      [durationMinutes, value, activeAlert.id]
    );

    // Check if we should send repeated alert (debounce)
    if (activeAlert.store_alert_sent || activeAlert.manager_alert_sent) {
      const lastSentAt = activeAlert.store_alert_sent
        ? new Date(activeAlert.created_at).getTime() + (activeAlert.duration_minutes || 0) * 60000
        : new Date(activeAlert.created_at).getTime();
      const minutesSinceSent = (Date.now() - lastSentAt) / 60000;

      if (minutesSinceSent < ALERT_REPEAT_MINUTES()) {
        log.info('Sensor alert debounced', { sensor_id: sensorId, minutesSinceSent });
        return;
      }
    }

    // Duration threshold met — send repeated alert
    if (durationMinutes >= ALERT_AFTER_MINUTES()) {
      await sendAlerts(activeAlert.id, sensorId, storeId, item_name, value, target_min, target_max, status, durationMinutes);
    }
    return;
  }

  // Create new alert
  const result = await run(`
    INSERT INTO sensor_alerts (sensor_id, store_id, item_name, alert_type, reading_value, target_min, target_max, duration_minutes)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0)
  `, [sensorId, storeId, item_name, status, value, target_min, target_max]);

  // Only send after ALERT_AFTER_MINUTES duration — so first alert is just recorded
  log.info('Sensor alert created', { alertId: result.lastID, sensor_id: sensorId, status });
}

async function sendAlerts(alertId, sensorId, storeId, itemName, value, targetMin, targetMax, status, durationMinutes) {
  if (!replyService) return;

  const storeName = await getStoreName(storeId);
  const statusLabel = status === 'FAIL_HIGH' ? 'HIGH' : 'LOW';
  const targetRange = `${targetMin ?? '?'}–${targetMax ?? '?'}°F`;

  // Send store group alert
  const storeChatId = await getStoreChatId(storeId);
  if (storeChatId) {
    const storeMsg = [
      `⚠️ SENSOR TEMPERATURE ALERT`,
      ``,
      `Store: ${storeName}`,
      `Item: ${itemName}`,
      `Sensor Reading: ${value}°F`,
      `Target: ${targetRange}`,
      `Status: ${statusLabel}`,
      `Duration: ${durationMinutes} minutes`,
      ``,
      `Please check the unit and confirm.`,
    ].join('\n');

    try {
      await replyService.sendText(storeChatId, storeMsg);
      await run('UPDATE sensor_alerts SET store_alert_sent = 1 WHERE id = ?', [alertId]);
    } catch (err) {
      log.error('Failed to send store sensor alert', { error: err.message });
    }
  }

  // Send manager group alert
  const managerChatId = process.env.MANAGER_ALERT_GROUP_CHAT_ID;
  if (managerChatId) {
    const mgrMsg = [
      `🚨 MANAGER SENSOR ALERT`,
      ``,
      `Store: ${storeName}`,
      `Item: ${itemName}`,
      `Sensor: YoLink ${itemName}`,
      `Reading: ${value}°F`,
      `Target: ${targetRange}`,
      `Duration: ${durationMinutes} minutes`,
      `Status: ${statusLabel}`,
      ``,
      `Action Required:`,
      `Verify cooler condition and document corrective action.`,
    ].join('\n');

    try {
      await replyService.sendText(managerChatId, mgrMsg);
      await run('UPDATE sensor_alerts SET manager_alert_sent = 1 WHERE id = ?', [alertId]);
    } catch (err) {
      log.error('Failed to send manager sensor alert', { error: err.message });
    }
  }

  log.warn('Sensor alerts sent', { alertId, sensor_id: sensorId, store: storeName, item: itemName, value, status: statusLabel });
}

/**
 * Resolve an alert (sensor back in range)
 */
async function resolveAlert(sensorId) {
  await run(
    "UPDATE sensor_alerts SET status = 'RESOLVED', resolved_at = datetime('now') WHERE sensor_id = ? AND status = 'ACTIVE'",
    [sensorId]
  );
}

async function getActiveAlerts() {
  return all("SELECT * FROM sensor_alerts WHERE status = 'ACTIVE' ORDER BY created_at DESC");
}

async function getRecentAlerts(limit = 20) {
  return all('SELECT * FROM sensor_alerts ORDER BY created_at DESC LIMIT ?', [limit]);
}

async function getAlertStats() {
  const active = await get("SELECT COUNT(*) as count FROM sensor_alerts WHERE status = 'ACTIVE'");
  const total = await get('SELECT COUNT(*) as count FROM sensor_alerts');
  const today = await get(
    "SELECT COUNT(*) as count FROM sensor_alerts WHERE created_at > datetime('now', 'start of day')"
  );
  return { active: active?.count || 0, total: total?.count || 0, today: today?.count || 0 };
}

async function getStoreName(storeId) {
  if (!storeId) return 'Unknown Store';
  if (storeRegistry) {
    const mapping = await storeRegistry.resolveGroup(storeId).catch(() => null);
    if (mapping) return mapping.store_name;
  }
  const sensor = await get('SELECT store_name FROM sensors WHERE store_id = ? LIMIT 1', [storeId]);
  return sensor?.store_name || storeId;
}

async function getStoreChatId(storeId) {
  if (!storeId) return null;
  if (storeRegistry) {
    const mappings = await storeRegistry.listMappings().catch(() => []);
    const m = mappings.find(x => x.store_id === storeId);
    if (m) return m.chat_id;
  }
  return storeId; // fallback: assume storeId is chat_id
}

module.exports = {
  isEnabled, handleThresholdFailure, resolveAlert,
  getActiveAlerts, getRecentAlerts, getAlertStats,
};
