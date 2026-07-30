require('dotenv').config();

let passed = 0;
let failed = 0;

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`  PASS: ${label}`);
    passed += 1;
  } else {
    console.log(`  FAIL: ${label}${detail ? ' - ' + detail : ''}`);
    failed += 1;
  }
}

async function main() {
  console.log('\n=== Dynamic Template Sync Tests ===\n');
  const service = require('../../src/templates/daily-entry-template-service');
  const templateCache = require('../../src/templates/template-cache');
  const { validateAll } = require('../../src/templates/template-validator');
  require('../../src/storage/sqlite').getDb();

  const rows = [
    ['ignore', '', '', ''],
    ['Category', 'Item', 'Target Min', 'Target Max'],
    ['Cold Holding', 'Walk-in Cooler', '30', '45'],
    ['Cold Holding', 'Walk-in Freezer', '', '0'],
    ['Hot Holding', 'Hot Holding Cabinet', '165', ''],
    ['Prep', 'Noodle Station', 'N/A', 'N/A'],
  ];

  const template = service.parseTemplateRows(rows, {
    source: 'sheet',
    spreadsheetId: 'test-spreadsheet',
    tab: 'Daily_Entry_Template',
    syncedAt: '2026-06-04T12:00:00.000Z',
  });

  assert('header detected on row 2', template.header_row === 2, `got ${template.header_row}`);
  assert('four active items parsed', template.item_count === 4, `got ${template.item_count}`);
  assert('category preserved', template.items[0].category === 'Cold Holding');
  assert('min/max parsed', template.items[0].target_min === 30 && template.items[0].target_max === 45);
  assert('blank min handled', template.items[1].target_min === null && template.items[1].target_max === 0);
  assert('N/A range handled', template.items[3].target_min === null && template.items[3].target_max === null);
  assert('template validates', template.validation.ok === true, JSON.stringify(template.validation.errors));
  assert('format full range', service.formatRange(template.items[0]) === '30°F - 45°F');
  assert('format max only', service.formatRange(template.items[1]) === '<= 0°F');
  assert('format min only', service.formatRange(template.items[2]) === '>= 165°F');
  assert('format empty range', service.formatRange(template.items[3]) === 'No target range');

  service.injectTemplate(template);
  assert('get item by index works', service.getItemByIndex(3).item_name === 'Hot Holding Cabinet');
  assert('get item by name works', service.getItemByName('walk-in freezer').target_max === 0);
  assert('template cache sees dynamic names', templateCache.getItemNames().includes('Noodle Station'));

  const bad = service.parseTemplateRows([['Category', 'Item', 'Target Min', 'Target Max'], ['Hot', 'Bad Range', '50', '40']]);
  assert('bad min greater than max fails', bad.validation.ok === false);

  const rangeRows = [
    ['Walk-in Cooler', '30', '40'],
    ['Walk-in Freezer', '', '0'],
    ['Prep Area Cooler', '34', '40'],
    ['Ramen Refrigeration Top', '34', '40'],
    ['Ramen Refrigeration Below', '34', '40'],
    ['Line Freezer', '', '0'],
    ['Tapas Refrigeration Top', '34', '40'],
    ['Tapas Refrigeration Below', '34', '40'],
    ['Bowl Warmers', '135', ''],
    ['Hot Holding', '135', ''],
    ['Fryer 1', '325', ''],
    ['Fryer 2', '325', ''],
    ['Pasta Boiler 1', '185', ''],
    ['Pasta Boiler 2', '185', ''],
    ['Pork Broth', '200', '220'],
    ['Chicken Broth', '200', '220'],
    ['Rice Warmer', '135', ''],
    ['Dish Machine', '120', ''],
    ['Thermometer Calibration', 'N/A', 'N/A'],
    ['', '', ''],
    ['', '', ''],
    ['', '', ''],
    ['', '', ''],
    ['', '', ''],
    ['', '', ''],
  ];
  const ranged = service.parseTemplateRangeRows(rangeRows, { startRow: 11, source: 'sheet' });
  assert('B11:D35 parser returns 19 non-empty B rows', ranged.item_count === 19, `got ${ranged.item_count}`);
  assert('B11:B35 parser starts with Walk-in Cooler', ranged.items[0].item_name === 'Walk-in Cooler');
  assert('B11:D35 parser keeps row order', ranged.items[18].item_name === 'Thermometer Calibration');
  assert('B11:D35 parser skips blank B rows', !ranged.items.some(i => !i.item_name));
  assert('current 19-item template validates', ranged.validation.ok === true, JSON.stringify(ranged.validation.errors));
  assert('B11:D35 parses full min/max', ranged.items[0].target_min === 30 && ranged.items[0].target_max === 40);
  assert('B11:D35 parses max-only range', ranged.items[1].target_min === null && ranged.items[1].target_max === 0);
  assert('B11:D35 parses min-only range', ranged.items[10].target_min === 325 && ranged.items[10].target_max === null);
  assert('B11:D35 parses NA as no target', ranged.items[18].target_min === null && ranged.items[18].target_max === null);

  service.injectTemplate(ranged);
  const currentNames = templateCache.getItemNames();
  const currentThresholds = templateCache.getThresholds();
  assert('template cache has current 19 item structure', currentNames.length === 19, `got ${currentNames.length}`);
  assert('template cache includes Pork Broth', currentNames.includes('Pork Broth'));
  assert('template cache excludes no-target NA threshold', !currentThresholds['Thermometer Calibration']);

  const validation = validateAll({
    'Walk-in Cooler': 44,
    'Walk-in Freezer': -5,
    'Fryer 1': 330,
    'Pork Broth': 199,
    'Thermometer Calibration': 0,
  });
  assert('dynamic min/max validation marks out-of-range values', validation.overallStatus === 'FAIL' && validation.failCount === 2, `failCount=${validation.failCount}`);
  assert('dynamic validation flags Walk-in Cooler above max', validation.failures.some(f => f.name === 'Walk-in Cooler' && /outside/.test(f.reason)));
  assert('dynamic validation flags Pork Broth below min', validation.failures.some(f => f.name === 'Pork Broth' && /outside/.test(f.reason)));
  assert('dynamic validation accepts max-only freezer pass', validation.results.some(r => r.name === 'Walk-in Freezer' && r.status === 'PASS'));
  assert('dynamic validation accepts min-only fryer pass', validation.results.some(r => r.name === 'Fryer 1' && r.status === 'PASS'));
  assert('dynamic validation accepts NA/no-target item', validation.results.some(r => r.name === 'Thermometer Calibration' && r.status === 'PASS'));

  if (failed) {
    console.log(`\nFAILED: ${failed}, PASSED: ${passed}`);
    process.exit(1);
  }
  console.log(`\nPASSED: ${passed}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
