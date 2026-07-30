require('dotenv').config();

const fs = require('fs');
const http = require('http');
const path = require('path');

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

function request(base, route, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request(new URL(route, base), { method, timeout: 15000 }, res => {
      res.resume();
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout ${method} ${route}`)); });
    req.end();
  });
}

async function main() {
  console.log('\n=== Printable Daily Entry Form Tests ===\n');

  const templateCache = require('../src/templates/template-cache');
  const formGenerator = require('../src/forms/daily-entry-test-form-generator');
  const guideGenerator = require('../src/forms/guide-generator');

  const items = [
    { name: 'Walk-in Cooler', min: 30, max: 40, sortOrder: 1, unit: 'F' },
    { name: 'Walk-in Freezer', min: null, max: 0, sortOrder: 2, unit: 'F' },
    { name: 'Prep Area Cooler', min: 34, max: 40, sortOrder: 3, unit: 'F' },
    { name: 'Ramen Refrigeration Top', min: 34, max: 40, sortOrder: 4, unit: 'F' },
    { name: 'Ramen Refrigeration Below', min: 34, max: 40, sortOrder: 5, unit: 'F' },
    { name: 'Line Freezer', min: null, max: 0, sortOrder: 6, unit: 'F' },
    { name: 'Tapas Refrigeration Top', min: 34, max: 40, sortOrder: 7, unit: 'F' },
    { name: 'Tapas Refrigeration Below', min: 34, max: 40, sortOrder: 8, unit: 'F' },
    { name: 'Bowl Warmers', min: 135, max: null, sortOrder: 9, unit: 'F' },
    { name: 'Hot Holding', min: 135, max: null, sortOrder: 10, unit: 'F' },
    { name: 'Fryer 1', min: 325, max: null, sortOrder: 11, unit: 'F' },
    { name: 'Fryer 2', min: 325, max: null, sortOrder: 12, unit: 'F' },
    { name: 'Pasta Boiler 1', min: 185, max: null, sortOrder: 13, unit: 'F' },
    { name: 'Pasta Boiler 2', min: 185, max: null, sortOrder: 14, unit: 'F' },
    { name: 'Pork Broth', min: 200, max: 220, sortOrder: 15, unit: 'F' },
    { name: 'Chicken Broth', min: 200, max: 220, sortOrder: 16, unit: 'F' },
    { name: 'Rice Warmer', min: 135, max: null, sortOrder: 17, unit: 'F' },
    { name: 'Dish Machine', min: 120, max: null, sortOrder: 18, unit: 'F' },
    { name: 'Thermometer Calibration', min: null, max: null, sortOrder: 19, unit: 'F' },
  ];
  templateCache.injectSnapshot(items, 'test');

  const parsed = formGenerator.getTemplateItems();
  assert('1. Form generation reads B11:B35/current template rows', parsed[0].name === 'Walk-in Cooler' && parsed[18].name === 'Thermometer Calibration');
  assert('2. Empty B rows skipped', !parsed.some(i => !i.name));
  assert('3. Current form has 19 items', parsed.length === 19, `got ${parsed.length}`);

  const generated = await formGenerator.generateDailyEntryTestForm({ items: parsed });
  guideGenerator.generateGuides();
  const md = fs.readFileSync(generated.mdPath, 'utf8');
  const pdf = fs.readFileSync(generated.pdfPath);
  const xlsx = fs.readFileSync(generated.xlsxPath);

  assert('4. PDF created', pdf.slice(0, 5).toString() === '%PDF-');
  assert('5. XLSX created', xlsx.slice(0, 2).toString() === 'PK');
  assert('6. Target ranges displayed', md.includes('30°F - 40°F') && md.includes('<= 0°F') && md.includes('>= 325°F') && md.includes('Not configured'));
  assert('7. QR/Form ID included', md.includes(formGenerator.FORM_ID) && pdf.includes(Buffer.from('FORM ID')));
  assert('8. Staff guide exists', fs.existsSync(guideGenerator.STAFF_MD_PATH) && fs.existsSync(guideGenerator.STAFF_PDF_PATH));
  assert('9. Manager guide exists', fs.existsSync(guideGenerator.MANAGER_MD_PATH));

  const { app } = require('../src/api/server');
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const routes = [
      ['/api/forms/daily-entry-test-form.pdf', 'GET'],
      ['/api/forms/daily-entry-test-form.xlsx', 'GET'],
      ['/api/forms/regenerate', 'POST'],
      ['/api/guides/staff-en', 'GET'],
      ['/api/guides/manager-en', 'GET'],
    ];
    const results = [];
    for (const [route, method] of routes) results.push(await request(base, route, method));
    assert('10. Dashboard links return 200', results.every(r => r.status === 200), JSON.stringify(results.map(r => r.status)));
  } finally {
    await new Promise(resolve => server.close(resolve));
  }

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
