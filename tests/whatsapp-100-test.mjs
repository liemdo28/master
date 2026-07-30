/**
 * WhatsApp 100-message regression test
 * Simulates CEO sending 100 messages to Mi via the /api/whatsapp/mi endpoint
 * Run: node tests/whatsapp-100-test.mjs
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));

const GW_KEY = 'mi-core-c2f780a9af394c23b5057913ed5ea86d49f815b0a260a0835593846604cfed73';
const MI_CORE_URL = 'http://localhost:4001';
const CEO_ID = '84931773657@c.us';
const CHAT_ID = '84931773657@c.us';

// 100 test messages — varied intents, Vietnamese + English, casual + formal
const MESSAGES = [
  // Greetings / casual
  'chào Mi',
  'Mi ơi',
  'hey Mi',
  'good morning Mi',
  'Alo Mi',
  'Mi có đó không',
  'Mi đang làm gì vậy',
  'Mi khỏe không',
  'hi Mi, hôm nay thế nào',
  'Mi, bạn ổn không',

  // Status checks
  'kiểm tra hệ thống',
  'pm2 status',
  'dashboard đâu',
  'hệ thống ổn không',
  'check status',
  'services đang chạy không',
  'server ổn không',
  'Mi, check pm2',
  'mọi thứ ổn không',
  'health check',

  // Finance queries
  'doanh thu Raw hôm nay bao nhiêu',
  'kiểm tra QB',
  'doanh thu tháng này',
  'Nguyen đã reconcile B1 chưa',
  'số liệu QB mới nhất',
  'QB sync chưa',
  'doanh thu Raw Stockton',
  'check accounting',
  'profit margin Raw',
  'kiểm tra cash flow',

  // Task queries
  'hôm nay có việc gì',
  'todo list của tôi',
  'việc gì cần làm hôm nay',
  'nhắc tôi họp lúc 3 giờ',
  'tạo task mới: review menu',
  'tasks nào đang pending',
  'deadline hôm nay là gì',
  'Mi, nhắc tôi gọi nhà cung cấp',
  'có task nào overdue không',
  'show me my tasks',

  // SEO / Content
  'Mi ơi, tạo bài SEO cho Raw',
  'viết bài về sushi Stockton',
  'tạo content về mì ramen',
  'blog post về hải sản tươi',
  'SEO cho Bakudan',
  'bài viết về Japanese food',
  'content marketing cho Raw Sushi',
  'tạo bài về omakase',
  'viết về fresh fish',
  'SEO article về sashimi',

  // Information requests
  'Raw Sushi mở cửa lúc mấy giờ',
  'địa chỉ Raw Stockton',
  'menu Raw có gì mới',
  'Bakudan có promotion không',
  'phone number của Raw',
  'giờ mở cửa Bakudan',
  'show me Raw Sushi info',
  'thông tin về cửa hàng',
  'website Raw Sushi',
  'contact info',

  // Reminders
  'nhắc tôi họp team lúc 2pm',
  'reminder: gọi Nguyen lúc 4 giờ',
  'set reminder kiểm tra inventory',
  'nhắc tôi nộp báo cáo',
  'remind me to check emails',
  'tạo reminder cho meeting',
  'nhắc tôi lúc 5 giờ chiều',
  'morning reminder cho ngày mai',
  'weekly reminder kiểm tra QB',
  'nhắc họp staff meeting',

  // Knowledge / search
  'tìm tài liệu về payroll',
  'search knowledge base',
  'hướng dẫn QB Web Connector',
  'tìm SOP cho kitchen',
  'recipe tiêu chuẩn cho broth',
  'tìm email từ Nguyen',
  'knowledge về food safety',
  'search: inventory management',
  'tìm báo cáo tháng trước',
  'procedure onboarding nhân viên',

  // Project queries
  'dự án nào đang active',
  'tiến độ Mi-Core thế nào',
  'project Raw Website update',
  'status của Bakudan project',
  'milestone nào tiếp theo',
  'review automation project',
  'Mi-Core progress update',
  'project list',
  'any blocked projects',
  'sprint update',

  // Multi-intent / complex
  'check doanh thu và tạo bài SEO về Raw',
  'kiểm tra hệ thống và nhắc họp lúc 3h',
  'Mi ơi hôm nay có việc gì và QB sync chưa',
  'show dashboard, check QB, và tạo reminder',
  'check Raw revenue và viết content về sushi',

  // Edge cases
  '???',
  '.',
  'ok',
  'thanks',
  'cảm ơn Mi',
  'bỏ qua đi',
  'không cần nữa',
  'cancel',
  'stop',
  'test',
];

const results = [];
let pass = 0, fail = 0, unavailable = 0, approval = 0;

const REQUEST_TIMEOUT_MS = 15000; // 15s max per message

async function sendMessage(text, index) {
  const msgId = `test-100-${Date.now()}-${index}`;
  const payload = {
    source: 'whatsapp',
    client_id: 'mi-core',
    message_id: msgId,
    chat_id: CHAT_ID,
    sender: CEO_ID,
    senderName: 'Liem Do [TEST]',
    text,
    is_group: false,
  };

  const start = Date.now();
  let status, reply, error, intent;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const res = await fetch(`${MI_CORE_URL}/api/whatsapp/mi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': GW_KEY },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timer);
    const data = await res.json();
    const ms = Date.now() - start;

    reply = data.reply || data.error || '';
    intent = data.metadata?.intent || data.error || '';
    const isUnavailable = /temporarily unavailable|mi-core is|pipeline_error/i.test(reply);
    const isApproval = data.approval_required === true;
    const isOk = data.ok !== false && !isUnavailable;

    if (isUnavailable) { status = 'UNAVAILABLE'; unavailable++; }
    else if (isApproval) { status = 'APPROVAL'; approval++; }
    else if (isOk) { status = 'PASS'; pass++; }
    else { status = 'FAIL'; fail++; }

    results.push({ index, text: text.slice(0, 50), status, intent, reply: reply.slice(0, 100), ms });

    const icon = status === 'PASS' ? '✅' : status === 'APPROVAL' ? '⏳' : status === 'UNAVAILABLE' ? '🔴' : '❌';
    console.log(`${icon} [${String(index).padStart(3)}] ${String(ms).padStart(4)}ms | ${status.padEnd(11)} | ${intent.padEnd(20)} | "${text.slice(0, 40)}"`);

  } catch (e) {
    const ms = Date.now() - start;
    if (e.name === 'AbortError') {
      fail++;
      results.push({ index, text: text.slice(0, 50), status: 'TIMEOUT', error: `>${REQUEST_TIMEOUT_MS}ms`, ms });
      console.log(`⏰ [${String(index).padStart(3)}] ${ms}ms TIMEOUT | "${text.slice(0, 40)}"`);
    } else {
      fail++;
      results.push({ index, text: text.slice(0, 50), status: 'ERROR', error: e.message, ms });
      console.log(`💥 [${String(index).padStart(3)}] ERROR: ${e.message} | "${text.slice(0, 40)}"`);
    }
  }
}

async function run() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  WhatsApp 100-Message Regression Test');
  console.log(`  Target: ${MI_CORE_URL}`);
  console.log(`  CEO ID: ${CEO_ID}`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  const start = Date.now();

  for (let i = 0; i < MESSAGES.length; i++) {
    await sendMessage(MESSAGES[i], i + 1);
    // Small delay to avoid hammering (100ms between messages)
    await new Promise(r => setTimeout(r, 150));
  }

  const totalMs = Date.now() - start;

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  RESULTS');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Total:       ${MESSAGES.length}`);
  console.log(`  ✅ PASS:     ${pass}`);
  console.log(`  ⏳ APPROVAL: ${approval}`);
  console.log(`  🔴 UNAVAIL:  ${unavailable}`);
  console.log(`  ❌ FAIL:     ${fail}`);
  console.log(`  Time:        ${(totalMs/1000).toFixed(1)}s`);
  console.log(`  Pass rate:   ${Math.round((pass+approval)/MESSAGES.length*100)}%`);

  // Failures detail
  const failures = results.filter(r => r.status === 'UNAVAILABLE' || r.status === 'FAIL' || r.status === 'ERROR');
  if (failures.length) {
    console.log('\n  FAILURES:');
    failures.forEach(f => console.log(`  [${f.index}] ${f.status}: "${f.text}" → ${f.reply || f.error || ''}`));
  }

  // Save report
  const reportDir = join(__dir, '../reports');
  mkdirSync(reportDir, { recursive: true });
  const reportPath = join(reportDir, `WA100_TEST_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.json`);
  writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    total: MESSAGES.length, pass, approval, unavailable, fail,
    pass_rate: Math.round((pass+approval)/MESSAGES.length*100),
    total_ms: totalMs,
    results,
  }, null, 2));
  console.log(`\n  Report: ${reportPath}`);
  console.log('═══════════════════════════════════════════════════════════════');

  if (unavailable > 0) {
    console.log(`\n⚠️  ${unavailable} "temporarily unavailable" responses — needs investigation`);
    process.exit(1);
  }
}

run().catch(e => { console.error('Test suite error:', e); process.exit(1); });
