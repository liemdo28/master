const assert = require('assert');
const fs = require('fs');
const path = require('path');

const templateCache = require('../src/templates/template-cache');
const generator = require('../src/template-ocr/template-generator');
const registry = require('../src/template-ocr/template-registry');
const router = require('../src/template-ocr/template-image-router');
const validator = require('../src/template-ocr/template-ocr-validator');
const ocrEngine = require('../src/template-ocr/ocr-engine');
const workflow = require('../src/template-ocr/template-ocr-workflow');
const storage = require('../src/template-ocr/template-ocr-storage');
const deps = require('../src/template-ocr/dependency-check');
const sheetQueue = require('../src/workflows/sheet-write-queue');

function section(name) { console.log(`\n[ ${name} ]`); }
function ok(name, condition, detail = '') {
  assert(condition, detail || name);
  console.log(`OK ${name}`);
}

async function main() {
  templateCache.injectSnapshot([
    { name: 'Walk-in Cooler', min: 30, max: 40, sortOrder: 1 },
    { name: 'Walk-in Freezer', min: null, max: 0, sortOrder: 2 },
    { name: 'Prep Area Cooler', min: 30, max: 41, sortOrder: 3 },
  ]);

  section('1. Template generator');
  const generated = generator.generateDailyEntryTemplate();
  ok('PDF generated', fs.existsSync(generated.pdfPath));
  ok('Template JSON generated at required path', fs.existsSync(path.resolve('data/templates/daily-entry-template-v1.json')));
  ok('Template has dynamic item list', generated.template.fields.length === 3);
  ok('No OCR hardcoded item list needed', generated.template.fields[0].item_name === 'Walk-in Cooler');

  section('2. Registry and router');
  const template = registry.getDefaultTemplate();
  ok('Registry loads template', template.template_id === 'daily-entry-v1');
  const fixtureDir = path.resolve('tests/fixtures/template-ocr');
  fs.mkdirSync(fixtureDir, { recursive: true });
  const fixture = path.join(fixtureDir, 'clean-template.jpg');
  fs.writeFileSync(fixture, 'fake image fixture daily-entry-v1');
  const detection = await router.looksLikeTemplate(fixture, { caption: 'daily-entry-v1' });
  ok('Detects template from Form ID text', detection.isTemplate && detection.templateId === 'daily-entry-v1');

  section('3. OCR parsing and validation');
  ok('Numeric parser extracts negative decimal', ocrEngine.parseNumeric(' -12.5 F') === -12.5);
  const pass = validator.validateOcrResults([
    { item: 'Walk-in Cooler', value: 38, confidence: 0.95 },
    { item: 'Walk-in Freezer', value: -1, confidence: 0.95 },
    { item: 'Prep Area Cooler', value: 40, confidence: 0.95 },
  ], template);
  ok('PASS values pass', pass.status === 'PASS' && pass.failCount === 0);
  const fail = validator.validateOcrResults([
    { item: 'Walk-in Cooler', value: 44, confidence: 0.95 },
    { item: 'Walk-in Freezer', value: -1, confidence: 0.95 },
    { item: 'Prep Area Cooler', value: 40, confidence: 0.95 },
  ], template);
  ok('Out-of-range triggers FAIL', fail.status === 'FAIL' && fail.failures[0].reason === 'above_max');
  const missing = validator.validateOcrResults([
    { item: 'Walk-in Cooler', value: null, confidence: 0 },
    { item: 'Walk-in Freezer', value: -1, confidence: 0.95 },
    { item: 'Prep Area Cooler', value: 40, confidence: 0.95 },
  ], template);
  ok('Missing values trigger NEEDS_REVIEW', missing.status === 'NEEDS_REVIEW' && missing.unclearCount === 1);
  const low = validator.validateOcrResults([
    { item: 'Walk-in Cooler', value: 38, confidence: 0.2 },
    { item: 'Walk-in Freezer', value: -1, confidence: 0.95 },
    { item: 'Prep Area Cooler', value: 40, confidence: 0.95 },
  ], template);
  ok('Low confidence triggers NEEDS_REVIEW', low.status === 'NEEDS_REVIEW');

  section('4. Workflow confirmation controls');
  await storage.ensureTables();
  await sheetQueue.ensureTables();
  const previousSheets = process.env.GOOGLE_SHEETS_ENABLED;
  process.env.GOOGLE_SHEETS_ENABLED = 'false';
  const processed = await workflow.processImage(fixture, {
    chatId: 'template-test@g.us',
    sender: '15551234567',
    senderName: 'Omar',
    messageId: 'template-test-1',
    timestamp: new Date().toISOString(),
    caption: 'daily-entry-v1',
  });
  ok('Workflow handles template image', processed.handled);
  ok('Summary shown before confirm with all 4 options', /CONFIRM/.test(processed.reply) && /RETAKE/.test(processed.reply) && /MANAGER/.test(processed.reply) && /CANCEL/.test(processed.reply));
  const edit = await workflow.handleReply({ chatId: 'template-test@g.us', sender: '15551234567', senderName: 'Omar', text: 'EDIT 1 40' });
  ok('EDIT corrects OCR value', edit.handled && /CONFIRM/.test(edit.reply));
  const confirm = await workflow.handleReply({ chatId: 'template-test@g.us', sender: '15551234567', senderName: 'Omar', text: 'CONFIRM' });
  ok('CONFIRM handled', confirm.handled);
  const queued = await sheetQueue.getQueue('PENDING');
  ok('CONFIRM queues safely when Sheets unavailable', queued.some(q => q.workflow_type === 'template_ocr'));
  if (previousSheets === undefined) delete process.env.GOOGLE_SHEETS_ENABLED;
  else process.env.GOOGLE_SHEETS_ENABLED = previousSheets;

  const processed2 = await workflow.processImage(fixture, {
    chatId: 'template-test@g.us',
    sender: '15559876543',
    senderName: 'Maria',
    messageId: 'template-test-2',
    caption: 'daily-entry-v1',
  });
  ok('Second workflow handles template image', processed2.handled);
  const cancel = await workflow.handleReply({ chatId: 'template-test@g.us', sender: '15559876543', senderName: 'Maria', text: 'CANCEL' });
  ok('CANCEL prevents write', cancel.handled && /Nothing was written/.test(cancel.reply));

  section('5. Dependency check');
  const depStatus = deps.checkOcrDeps();
  ok('Missing Tesseract/OpenCV does not crash dependency check', typeof depStatus.ok === 'boolean');

  console.log('\nAll Template OCR tests passed\n');
}

main().catch(err => {
  console.error(err.stack || err.message);
  process.exit(1);
});
