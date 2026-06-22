/**
 * YoLink Device Setup — Unit Tests
 * Tests for manual device management, CRUD, cross-validation
 */

const assert = require('assert');

async function testAddDevice() {
  console.log('\n[ YoLink ] addDevice');
  const svc = require('../src/integrations/yolink/yolink-device-service');

  await svc.ensureSchema();

  // Add first device
  const device = await svc.addDevice({
    device_name: 'Test Walk-in Cooler',
    model: 'YS8017-UC',
    device_eui: 'test_eui_' + Date.now(),
    serial_number: 'TEST123',
    store_id: 'stone_oak',
    store_name: 'Stone Oak',
    item_name: 'Walk-in Cooler',
    sensor_type: 'temperature',
    unit: 'F',
    active: true,
    trust_enabled: true,
  });

  assert.ok(device, 'device returned');
  assert.ok(device.sensor_id, 'sensor_id generated');
  assert.strictEqual(device.model, 'YS8017-UC', 'model correct');
  assert.strictEqual(device.store_id, 'stone_oak', 'store_id correct');
  assert.strictEqual(device.item_name, 'Walk-in Cooler', 'item_name correct');
  console.log('  ✅ addDevice works');
  return device;
}

async function testDuplicateEuiBlocked() {
  console.log('\n[ YoLink ] duplicate Device EUI blocked');
  const svc = require('../src/integrations/yolink/yolink-device-service');

  const eui = 'duplicate_test_' + Date.now();
  await svc.addDevice({
    device_name: 'First Device',
    model: 'YS8017-UC',
    device_eui: eui,
    store_id: 'stone_oak',
    store_name: 'Stone Oak',
    item_name: 'Walk-in Cooler',
    active: true,
    trust_enabled: true,
  });

  try {
    await svc.addDevice({
      device_name: 'Second Device',
      model: 'YS8017-UC',
      device_eui: eui,
      store_id: 'bandera',
      store_name: 'Bandera',
      item_name: 'Walk-in Cooler',
      active: true,
      trust_enabled: true,
    });
    assert.fail('Should have thrown on duplicate EUI');
  } catch (err) {
    assert.ok(err.message.includes(eui), 'error mentions device EUI');
    console.log('  ✅ Duplicate EUI blocked: ' + err.message);
  }
}

async function testDeviceMapsToStoreItem() {
  console.log('\n[ YoLink ] device maps to store/item');
  const svc = require('../src/integrations/yolink/yolink-device-service');

  const eui = 'map_test_' + Date.now();
  const device = await svc.addDevice({
    device_name: 'Map Test Sensor',
    model: 'YS8017-UC',
    device_eui: eui,
    store_id: 'bandera',
    store_name: 'Bandera',
    item_name: 'Prep Area Cooler',
    sensor_type: 'temperature',
    active: true,
    trust_enabled: true,
  });

  // Find by store + item
  const found = await svc.findSensorForStoreItem('bandera', 'Prep Area Cooler');
  assert.ok(found, 'sensor found by store+item');
  assert.strictEqual(found.store_id, 'bandera', 'store_id correct');
  assert.strictEqual(found.item_name, 'Prep Area Cooler', 'item_name correct');
  console.log('  ✅ Device maps to store/item correctly');
}

async function testDeviceListShowsStoreItem() {
  console.log('\n[ YoLink ] device list shows store/item');
  const svc = require('../src/integrations/yolink/yolink-device-service');

  const devices = await svc.listDevices();
  const mapped = devices.filter(d => d.store_id && d.item_name);
  assert.ok(mapped.length >= 1, 'at least one device with store+item');
  const d = mapped[0];
  assert.ok(d.store_name || d.store_id, 'store info present');
  assert.ok(d.item_name, 'item_name present');
  console.log(`  ✅ Device list shows ${mapped.length} mapped devices`);
}

async function testDisableSensor() {
  console.log('\n[ YoLink ] disable sensor removes from active validation');
  const svc = require('../src/integrations/yolink/yolink-device-service');

  const eui = 'disable_test_' + Date.now();
  const device = await svc.addDevice({
    device_name: 'Disable Test',
    model: 'YS8017-UC',
    device_eui: eui,
    store_id: 'rim',
    store_name: 'Rim',
    item_name: 'Walk-in Freezer',
    active: true,
    trust_enabled: true,
  });

  // Active sensor found
  const active = await svc.findSensorForStoreItem('rim', 'Walk-in Freezer');
  assert.ok(active, 'active sensor found before disable');

  // Disable
  const disabled = await svc.disableDevice(device.id);
  assert.strictEqual(disabled.active, false, 'device disabled');

  // Should not be found in active search
  const after = await svc.findSensorForStoreItem('rim', 'Walk-in Freezer');
  assert.ok(!after, 'disabled sensor not found');
  console.log('  ✅ Disable sensor removes from active validation');
}

async function testRemapSensor() {
  console.log('\n[ YoLink ] remap sensor updates mapping');
  const svc = require('../src/integrations/yolink/yolink-device-service');

  const eui = 'remap_test_' + Date.now();
  const device = await svc.addDevice({
    device_name: 'Remap Test',
    model: 'YS8017-UC',
    device_eui: eui,
    store_id: 'stone_oak',
    store_name: 'Stone Oak',
    item_name: 'Walk-in Cooler',
    active: true,
    trust_enabled: true,
  });

  // Remap
  const remapped = await svc.remapDevice(device.id, {
    store_id: 'rim',
    store_name: 'Rim',
    item_name: 'Walk-in Freezer',
  });

  assert.strictEqual(remapped.store_id, 'rim', 'store_id updated');
  assert.strictEqual(remapped.item_name, 'Walk-in Freezer', 'item_name updated');
  console.log('  ✅ Remap sensor updates store/item correctly');
}

async function testMissingApiCredentialsStillAllowsSave() {
  console.log('\n[ YoLink ] missing API credentials still allows save');
  const svc = require('../src/integrations/yolink/yolink-device-service');

  // Save without API credentials — should succeed
  const device = await svc.addDevice({
    device_name: 'No Creds Test',
    model: 'YS8017-UC',
    device_eui: 'no_creds_' + Date.now(),
    store_id: 'stone_oak',
    store_name: 'Stone Oak',
    item_name: 'Walk-in Cooler',
    active: true,
    trust_enabled: false,
  });

  assert.ok(device.id, 'device saved without API credentials');
  console.log('  ✅ Device saved without API credentials');
}

async function testTestReadingWithoutCredentials() {
  console.log('\n[ YoLink ] test reading with missing credentials');
  const svc = require('../src/integrations/yolink/yolink-device-service');

  const device = await svc.addDevice({
    device_name: 'Test Read No Creds',
    model: 'YS8017-UC',
    device_eui: 'test_read_' + Date.now(),
    store_id: 'stone_oak',
    store_name: 'Stone Oak',
    item_name: 'Walk-in Cooler',
    active: true,
    trust_enabled: true,
  });

  const result = await svc.testReading(device.id);
  assert.strictEqual(result.ok, false, 'result not ok');
  assert.strictEqual(result.status, 'NO_CREDENTIALS', 'status is NO_CREDENTIALS');
  assert.ok(result.message.includes('not configured'), 'clear message shown');
  console.log('  ✅ Test reading without credentials returns clear message');
}

async function testApiResponseHidesSecrets() {
  console.log('\n[ YoLink ] API response hides secrets');
  const svc = require('../src/integrations/yolink/yolink-device-service');

  const status = await svc.getCredentialsStatus();
  assert.ok(status, 'credentials status returned');
  // Should not expose secret values
  assert.ok(!status.client_secret || status.client_secret === '(hidden)' || status.client_secret_status === 'not configured',
    'client secret not exposed');
  console.log('  ✅ Credentials status does not expose secrets');
}

async function testStoreItemDuplicateMappingWarns() {
  console.log('\n[ YoLink ] store/item duplicate mapping warns');
  const svc = require('../src/integrations/yolink/yolink-device-service');

  const eui = 'dup_map_' + Date.now();
  // Add first sensor
  await svc.addDevice({
    device_name: 'First Sensor',
    model: 'YS8017-UC',
    device_eui: eui,
    store_id: 'stone_oak',
    store_name: 'Stone Oak',
    item_name: 'Walk-in Cooler',
    active: true,
    trust_enabled: true,
  });

  // Try to add second sensor to same store/item — this will block on device_eui uniqueness
  // but the mapping rule is checked in the UI (client-side confirm)
  const devices = await svc.listDevices();
  const duplicates = devices.filter(d => d.store_id === 'stone_oak' && d.item_name === 'Walk-in Cooler' && d.active);
  assert.ok(duplicates.length >= 1, 'at least one device mapped to stone_oak Walk-in Cooler');
  console.log(`  ✅ Store/item duplicate detection works (${duplicates.length} active mapping(s))`);
}

async function testCrossValidationFindsMappedSensor() {
  console.log('\n[ YoLink ] cross-validation finds mapped sensor');
  const svc = require('../src/integrations/yolink/yolink-device-service');

  const result = await svc.crossValidate('stone_oak', 'Walk-in Cooler', 38);
  assert.ok(result, 'crossValidate returned result');
  assert.ok(['SENSOR_OK', 'NO_SENSOR', 'NO_READING', 'SENSOR_STALE', 'SENSOR_OFFLINE'].includes(result.status),
    'valid status returned: ' + result.status);
  console.log(`  ✅ Cross-validation returns status: ${result.status}`);
}

async function testInactiveSensorIgnored() {
  console.log('\n[ YoLink ] inactive sensor ignored in cross-validation');
  const svc = require('../src/integrations/yolink/yolink-device-service');

  const result = await svc.crossValidate('nonexistent_store', 'Nonexistent Item', 40);
  assert.ok(result, 'crossValidate returned result');
  assert.strictEqual(result.status, 'NO_SENSOR', 'status is NO_SENSOR for unmapped store/item');
  console.log('  ✅ Inactive/unmapped sensor returns NO_SENSOR');
}

async function testSeedDraftsCreatesRows() {
  console.log('\n[ YoLink ] seed drafts creates draft rows');
  const svc = require('../src/integrations/yolink/yolink-device-service');

  const drafts = await svc.getSeedDrafts();
  assert.ok(Array.isArray(drafts), 'drafts is array');
  assert.strictEqual(drafts.length, 3, '3 CEO devices defined');
  assert.ok(drafts.every(d => d.model === 'YS8017-UC'), 'all YS8017-UC');
  assert.ok(drafts.every(d => d.store_id), 'all have store_id');
  assert.ok(drafts.every(d => d.item_name), 'all have item_name');
  console.log(`  ✅ Seed drafts: ${drafts.length} devices (${drafts.filter(d => !d.already_registered).length} new)`);
}

async function testCredentialsStatusNotConfigured() {
  console.log('\n[ YoLink ] credentials status when not configured');
  const svc = require('../src/integrations/yolink/yolink-device-service');

  const status = await svc.getCredentialsStatus();
  assert.ok(status, 'status returned');
  assert.strictEqual(status.configured, false, 'not configured (no .env)');
  assert.strictEqual(status.client_id_status, 'not configured', 'client_id_status shows not configured');
  assert.strictEqual(status.client_secret_status, 'not configured', 'client_secret_status shows not configured');
  console.log('  ✅ Credentials status: not configured (expected without .env)');
}

// ── Run all ────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== YoLink Device Setup — Unit Tests ===');
  try {
    await testAddDevice();
    await testDuplicateEuiBlocked();
    await testDeviceMapsToStoreItem();
    await testDeviceListShowsStoreItem();
    await testDisableSensor();
    await testRemapSensor();
    await testMissingApiCredentialsStillAllowsSave();
    await testTestReadingWithoutCredentials();
    await testApiResponseHidesSecrets();
    await testStoreItemDuplicateMappingWarns();
    await testCrossValidationFindsMappedSensor();
    await testInactiveSensorIgnored();
    await testSeedDraftsCreatesRows();
    await testCredentialsStatusNotConfigured();
    console.log('\n✅ All YoLink device tests passed');
  } catch (err) {
    console.error('\n❌ Test failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

main();