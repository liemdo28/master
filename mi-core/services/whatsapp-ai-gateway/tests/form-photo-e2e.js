/**
 * Form Photo End-to-End Test — Option B Phase 1
 *
 * Verifies the complete pilot flow:
 *   Store selection → photo upload → OCR → confirm → DB save → dashboard → sheet sync
 *
 * Run: node tests/form-photo-e2e.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Test environment — use isolated DB
process.env.GATEWAY_DB_PATH = path.join(__dirname, '..', 'data', `gateway-test-formphoto-${process.pid}.db`);
process.env.FOOD_SAFETY_ENABLED = 'true';
process.env.GOOGLE_SHEETS_ENABLED = 'false'; // Simulate missing credentials

let passed = 0;
let failed = 0;

function ok(label, cond) {
  if (cond) { console.log('  OK  ' + label); passed++; }
  else { console.log('  FAIL ' + label); failed++; }
}

function section(name) {
  console.log('\n[ ' + name + ' ]');
}

async function main() {
  console.log('=== Form Photo Workflow E2E Test (Option B Phase 1) ===\n');

  const formPhotoWorkflow = require('../src/workflows/form-photo-workflow');
  const formPhotoStorage = require('../src/workflows/form-photo-storage');
  const formPhotoOcr = require('../src/workflows/form-photo-ocr');
  const formPhotoSheetSync = require('../src/workflows/form-photo-sheet-sync');

  // Mock OCR to return a known good result (avoids dependency on real OCR engine)
  const originalProcess = formPhotoOcr.processFormImage;
  formPhotoOcr.processFormImage = async (imagePath, metadata) => {
    return {
      store_id: metadata.storeId || 'bandera',
      form_date: '2026-06-08',
      shift: 'AM',
      employee_name: metadata.senderName || 'Maria',
      items: [
        { field_id: 'walk_in_cooler', label: 'Walk-in Cooler', value: 38, unit: 'F', confidence: 0.92, status: 'PASS' },
        { field_id: 'freezer', label: 'Freezer', value: -2, unit: 'F', confidence: 0.90, status: 'PASS' },
        { field_id: 'chicken', label: 'Chicken', value: 165, unit: 'F', confidence: 0.88, status: 'PASS' },
      ],
      ocr_confidence: 0.90,
      warnings: [],
      no_data: false,
      source: 'mock',
    };
  };

  const client = { sendMessage: async () => true };
  // Mock replyService used internally
  const replyService = require('../src/whatsapp/reply-service');
  replyService.send = async () => true;

  const chatId = 'e2e-chat@c.us';
  const sender = 'e2e-user';

  // ── 1. Store selection starts photo workflow ──────────────────────────────
  section('1. Store selection starts photo workflow');
  const start = await formPhotoWorkflow.startFormPhotoWorkflow({
    chatId, isGroup: false, sender, senderName: 'Maria', groupName: '', client,
  });
  ok('Workflow started (handled)', start.handled === true);
  ok('Asks for store', /store/i.test(start.reply));
  ok('Session active', formPhotoWorkflow.hasActiveSession(chatId, sender));

  const storeReply = await formPhotoWorkflow.handleFormPhotoReply({
    chatId, sender, senderName: 'Maria', text: '3', client, // 3 = Bandera
  });
  ok('Store selection handled', storeReply.handled === true);
  ok('Asks for photo after store select', /photo/i.test(storeReply.reply));

  // ── 2. Image upload creates submission + OCR result saved ─────────────────
  section('2. Image upload creates submission and OCR result saved');
  // Create a fake image file
  const uploadDir = path.join(__dirname, '..', 'data', 'uploads', 'form-photo', 'test');
  fs.mkdirSync(uploadDir, { recursive: true });
  const fakeImage = path.join(uploadDir, 'e2e-form.jpg');
  fs.writeFileSync(fakeImage, 'fake-form-image-data');

  const upload = await formPhotoWorkflow.handleFormPhotoUpload({
    chatId, sender, senderName: 'Maria', imagePath: fakeImage, metadata: {}, client,
  });
  ok('Upload handled', upload.handled === true);
  ok('OCR summary shows temperatures', /Walk-in Cooler|Temperatures/i.test(upload.reply));
  ok('Summary asks YES/RETAKE', /YES|RETAKE/i.test(upload.reply));

  // Verify submission saved to DB
  const submissions = await formPhotoStorage.getRecentSubmissions(10);
  ok('Submission saved to DB', submissions.length >= 1);
  const lastSub = submissions[0];
  ok('Submission has OCR_REVIEW_READY status', lastSub.status === 'OCR_REVIEW_READY');
  ok('Submission has items', lastSub.items && lastSub.items.length === 3);
  ok('Submission stored image path', !!lastSub.image_path);

  // ── 3. YES confirms record + saves to DB ──────────────────────────────────
  section('3. YES confirms record and saves to database');
  const confirm = await formPhotoWorkflow.handleFormPhotoReply({
    chatId, sender, senderName: 'Maria', text: 'YES', client,
  });
  ok('Confirmation handled', confirm.handled === true);
  ok('Saved reply shown', /Saved|Daily Entry/i.test(confirm.reply));
  ok('Session cleared after save', !formPhotoWorkflow.hasActiveSession(chatId, sender));

  // Verify a CONFIRMED submission now exists
  const afterConfirm = await formPhotoStorage.getRecentSubmissions(10);
  const confirmed = afterConfirm.find(s => s.status === 'CONFIRMED' || s.status === 'SAVED' || s.status === 'SYNC_FAILED');
  ok('Confirmed submission exists in DB', !!confirmed);

  // ── 4. Low confidence OCR goes to NEEDS_REVIEW ────────────────────────────
  section('4. Low confidence OCR goes to NEEDS_REVIEW');
  formPhotoOcr.processFormImage = async () => ({
    store_id: 'bandera', form_date: '2026-06-08', shift: 'AM', employee_name: 'Juan',
    items: [{ field_id: 'cooler', label: 'Cooler', value: null, unit: 'F', confidence: 0.2, status: 'NEEDS_REVIEW' }],
    ocr_confidence: 0.3, warnings: ['Low clarity'], no_data: false, source: 'mock-low',
  });

  const chatId2 = 'e2e-chat2@c.us';
  const sender2 = 'e2e-user2';
  await formPhotoWorkflow.startFormPhotoWorkflow({ chatId: chatId2, isGroup: false, sender: sender2, senderName: 'Juan', groupName: '', client });
  await formPhotoWorkflow.handleFormPhotoReply({ chatId: chatId2, sender: sender2, text: '1', client });
  const lowConf = await formPhotoWorkflow.handleFormPhotoUpload({
    chatId: chatId2, sender: sender2, senderName: 'Juan', imagePath: fakeImage, metadata: {}, client,
  });
  ok('Low confidence upload handled', lowConf.handled === true);
  ok('Review reply shows needs review', /review/i.test(lowConf.reply));
  const lowSubs = await formPhotoStorage.getSubmissionsByStatus('NEEDS_REVIEW', 10);
  ok('NEEDS_REVIEW submission saved', lowSubs.length >= 1);

  // ── 5. RETAKE resets to photo upload ──────────────────────────────────────
  section('5. RETAKE resets to photo upload');
  const retake = await formPhotoWorkflow.handleFormPhotoReply({
    chatId: chatId2, sender: sender2, text: 'RETAKE', client,
  });
  ok('Retake handled', retake.handled === true);
  ok('Retake asks for new photo', /retake|photo/i.test(retake.reply));
  ok('Session still active after retake', formPhotoWorkflow.hasActiveSession(chatId2, sender2));

  // ── 6. Google Sheet failure does not lose record ──────────────────────────
  section('6. Google Sheet failure does not lose record');
  // GOOGLE_SHEETS_ENABLED is 'false', so sync should mark PENDING_CREDENTIALS but NOT delete record
  const syncResult = await formPhotoSheetSync.syncSubmission(confirmed.submission_id);
  ok('Sync returns gracefully (not configured)', syncResult.ok === false);
  const stillThere = await formPhotoStorage.getSubmission(confirmed.submission_id);
  ok('Record still exists after sync failure', !!stillThere);

  // ── 7. Dashboard shows saved submission (stats) ───────────────────────────
  section('7. Dashboard shows saved submission');
  const stats = await formPhotoStorage.getSubmissionStats();
  ok('Stats has total count', stats.total >= 2);
  const dashSubs = await formPhotoStorage.getRecentSubmissions(30);
  ok('Dashboard query returns submissions', dashSubs.length >= 2);
  ok('Each submission has items attached', dashSubs.every(s => Array.isArray(s.items)));

  // ── 8. OCR failure does not crash ─────────────────────────────────────────
  section('8. OCR failure does not crash');
  formPhotoOcr.processFormImage = async () => { throw new Error('Simulated OCR crash'); };
  const chatId3 = 'e2e-chat3@c.us';
  const sender3 = 'e2e-user3';
  await formPhotoWorkflow.startFormPhotoWorkflow({ chatId: chatId3, isGroup: false, sender: sender3, senderName: 'Ana', groupName: '', client });
  await formPhotoWorkflow.handleFormPhotoReply({ chatId: chatId3, sender: sender3, text: '2', client });
  const crash = await formPhotoWorkflow.handleFormPhotoUpload({
    chatId: chatId3, sender: sender3, senderName: 'Ana', imagePath: fakeImage, metadata: {}, client,
  });
  ok('OCR crash handled gracefully', crash.handled === true);
  ok('Crash returns retake message', /could not read|retake|lighting/i.test(crash.reply));

  // Restore
  formPhotoOcr.processFormImage = originalProcess;

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n──────────────────────────────────────────────────');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed === 0) {
    console.log('🎉 Form Photo E2E PASS — Phase 1 pilot flow verified end-to-end');
  } else {
    console.log('❌ Form Photo E2E FAILED');
  }

  // Cleanup
  try {
    const { close } = require('../src/storage/sqlite');
    await close();
    if (fs.existsSync(process.env.GATEWAY_DB_PATH)) fs.unlinkSync(process.env.GATEWAY_DB_PATH);
    if (fs.existsSync(fakeImage)) fs.unlinkSync(fakeImage);
  } catch (_) {}

  process.exit(failed === 0 ? 0 : 1);
}

main().catch(err => {
  console.error('E2E test error:', err);
  process.exit(1);
});
