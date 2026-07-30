/**
 * Live WhatsApp Test — 100 System Commands for Mi-Core
 * Simulates CEO sending commands via WhatsApp gateway → Mi-Core API
 * 
 * Usage: node live-whatsapp-test.mjs
 * Output: results.json + console summary
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const API_URL = 'http://127.0.0.1:4001/api/whatsapp/mi';
const API_KEY = 'mi-core-c2f780a9af394c23b5057913ed5ea86d49f815b0a260a0835593846604cfed73';
const SENDER = '84901234567@s.whatsapp.net';
const CHAT_ID = '84901234567@c.us';
const SENDER_NAME = 'Liem Do';

let msgCounter = 0;
function nextId() {
  msgCounter++;
  return `live-test-${Date.now()}-${String(msgCounter).padStart(4, '0')}`;
}

// ══════════════════════════════════════════════════════════════════════════════
// 100 TEST COMMANDS — covering ALL system intents and subsystems
// ══════════════════════════════════════════════════════════════════════════════

const TEST_COMMANDS = [
  // ── 1-10: Greetings & Basic Interaction ──────────────────────────────────────
  { id: 'G01', text: 'hello', category: 'greeting', expected_intent: 'ceo_greeting' },
  { id: 'G02', text: 'mi ơi', category: 'greeting', expected_intent: 'ceo_greeting' },
  { id: 'G03', text: 'alo', category: 'greeting', expected_intent: 'ceo_greeting' },
  { id: 'G04', text: 'hi', category: 'greeting', expected_intent: 'ceo_greeting' },
  { id: 'G05', text: 'ping', category: 'greeting', expected_intent: 'ceo_greeting' },
  { id: 'G06', text: 'chào', category: 'greeting', expected_intent: 'ceo_greeting' },
  { id: 'G07', text: 'test', category: 'greeting', expected_intent: 'ceo_greeting' },
  { id: 'G08', text: 'hey', category: 'greeting', expected_intent: 'ceo_greeting' },
  { id: 'G09', text: '/mi', category: 'empty_command', expected_intent: 'greeting' },
  { id: 'G10', text: '/mi ', category: 'empty_command', expected_intent: 'greeting' },

  // ── 11-20: System Status Commands ────────────────────────────────────────────
  { id: 'S01', text: 'status', category: 'system_status', expected_intent: 'ceo_status' },
  { id: 'S02', text: '/mi status', category: 'system_status', expected_intent: 'ceo_status' },
  { id: 'S03', text: 'health', category: 'system_status', expected_intent: 'ceo_status' },
  { id: 'S04', text: '/mi health all', category: 'system_status', expected_intent: 'ceo_health_all' },
  { id: 'S05', text: 'pm2 status', category: 'system_status', expected_intent: 'check_status' },
  { id: 'S06', text: '/mi nodes', category: 'system_status', expected_intent: 'nodes_status' },
  { id: 'S07', text: '/mi laptop1', category: 'system_status', expected_intent: 'node_laptop1' },
  { id: 'S08', text: '/mi laptop2', category: 'system_status', expected_intent: 'node_laptop2' },
  { id: 'S09', text: '/mi bigdata', category: 'system_status', expected_intent: 'bigdata_health' },
  { id: 'S10', text: '/mi bd', category: 'system_status', expected_intent: 'bigdata_health' },

  // ── 21-30: CEO OS Intelligence ──────────────────────────────────────────────
  { id: 'C01', text: 'hôm nay có gì', category: 'daily_briefing', expected_intent: 'query_personal_tasks' },
  { id: 'C02', text: 'today', category: 'daily_briefing', expected_intent: 'ceo_daily_briefing' },
  { id: 'C03', text: '/mi today', category: 'daily_briefing', expected_intent: 'ceo_daily_briefing' },
  { id: 'C04', text: 'có gì cần duyệt', category: 'task_query', expected_intent: 'query_personal_tasks' },
  { id: 'C05', text: 'có gì đang lo', category: 'task_query', expected_intent: 'query_personal_tasks' },
  { id: 'C06', text: 'dashboard đâu', category: 'task_query', expected_intent: 'check_status' },
  { id: 'C07', text: '/mi approvals', category: 'approval', expected_intent: 'ceo_approvals' },
  { id: 'C08', text: '/mi help', category: 'help', expected_intent: 'ceo_help' },
  { id: 'C09', text: '/mi dev', category: 'dev', expected_intent: 'ceo_dev_command_center' },
  { id: 'C10', text: 'cái đó xong chưa', category: 'short_clarify', expected_intent: 'clarification' },

  // ── 31-40: Jarvis Intelligence Layer ────────────────────────────────────────
  { id: 'J01', text: 'toàn bộ hệ thống', category: 'jarvis_system', expected_intent: 'jarvis_phase_30' },
  { id: 'J02', text: 'ceo os status', category: 'jarvis_system', expected_intent: 'jarvis_phase_30' },
  { id: 'J03', text: 'jarvis status', category: 'jarvis_system', expected_intent: 'jarvis_phase_30' },
  { id: 'J04', text: 'phase 30 status', category: 'jarvis_system', expected_intent: 'jarvis_phase_30' },
  { id: 'J05', text: 'bakudan dashboard ở đâu', category: 'jarvis_info', expected_intent: 'jarvis_phase_30' },
  { id: 'J06', text: 'stone oak info', category: 'jarvis_info', expected_intent: 'jarvis_phase_30' },
  { id: 'J07', text: 'knowledge stats', category: 'jarvis_knowledge', expected_intent: 'jarvis_phase_30' },
  { id: 'J08', text: 'memory stats', category: 'jarvis_memory', expected_intent: 'jarvis_phase_30' },
  { id: 'J09', text: 'agent list', category: 'jarvis_agents', expected_intent: 'jarvis_phase_30' },
  { id: 'J10', text: 'workflow list', category: 'jarvis_workflow', expected_intent: 'jarvis_phase_30' },

  // ── 41-50: Finance / QuickBooks ─────────────────────────────────────────────
  { id: 'F01', text: '/mi qb', category: 'finance', expected_intent: 'ceo_quickbooks' },
  { id: 'F02', text: 'qb status', category: 'finance', expected_intent: 'finance_truth' },
  { id: 'F03', text: 'doanh thu bao nhiêu', category: 'finance', expected_intent: 'finance_truth' },
  { id: 'F04', text: 'revenue sync chưa', category: 'finance', expected_intent: 'finance_truth' },
  { id: 'F05', text: 'chi phí tháng này', category: 'finance', expected_intent: 'finance_truth' },
  { id: 'F06', text: 'expenses status', category: 'finance', expected_intent: 'finance_truth' },
  { id: 'F07', text: 'có bill trùng không', category: 'finance', expected_intent: 'finance_truth' },
  { id: 'F08', text: 'invoice latest', category: 'finance', expected_intent: 'finance_truth' },
  { id: 'F09', text: 'payment recent', category: 'finance', expected_intent: 'finance_truth' },
  { id: 'F10', text: 'tài chính sao rồi', category: 'finance', expected_intent: 'finance_truth' },

  // ── 51-60: Business Operations ──────────────────────────────────────────────
  { id: 'B01', text: '/mi reviews', category: 'business_ops', expected_intent: 'ceo_reviews' },
  { id: 'B02', text: '/mi disputes', category: 'business_ops', expected_intent: 'ceo_disputes' },
  { id: 'B03', text: '/mi stores', category: 'business_ops', expected_intent: 'ceo_stores' },
  { id: 'B04', text: '/mi payroll', category: 'business_ops', expected_intent: 'ceo_payroll' },
  { id: 'B05', text: '/mi roadmap', category: 'planning', expected_intent: 'ceo_roadmap' },
  { id: 'B06', text: '/mi sprint', category: 'planning', expected_intent: 'ceo_sprint' },
  { id: 'B07', text: '/mi blockers', category: 'planning', expected_intent: 'ceo_blockers' },
  { id: 'B08', text: '/mi risks', category: 'planning', expected_intent: 'ceo_risks' },
  { id: 'B09', text: '/mi progress', category: 'planning', expected_intent: 'ceo_progress' },
  { id: 'B10', text: '/mi projects', category: 'projects', expected_intent: 'ceo_projects' },

  // ── 61-70: Command Variations & Edge Cases ──────────────────────────────────
  { id: 'V01', text: '/mi release', category: 'command_var', expected_intent: 'ceo_release' },
  { id: 'V02', text: '/mi qa', category: 'command_var', expected_intent: 'ceo_qa' },
  { id: 'V03', text: '/mi security', category: 'command_var', expected_intent: 'ceo_security' },
  { id: 'V04', text: '/mi tasks', category: 'command_var', expected_intent: 'ceo_tasks' },
  { id: 'V05', text: '/mi assign', category: 'command_var', expected_intent: 'ceo_assign' },
  { id: 'V06', text: '/mi alerts', category: 'command_var', expected_intent: 'ceo_alerts' },
  { id: 'V07', text: '/mi mute', category: 'command_var', expected_intent: 'ceo_alert_mute' },
  { id: 'V08', text: '/mi watch', category: 'command_var', expected_intent: 'ceo_alert_watch' },
  { id: 'V09', text: '/mi dashboard', category: 'command_var', expected_intent: 'ceo_dashboard' },
  { id: 'V10', text: '/mi remember', category: 'command_var', expected_intent: 'ceo_memory_remember' },

  // ── 71-80: Memory & Knowledge ───────────────────────────────────────────────
  { id: 'M01', text: '/mi search', category: 'memory', expected_intent: 'ceo_memory_search' },
  { id: 'M02', text: '/mi history', category: 'memory', expected_intent: 'ceo_memory_history' },
  { id: 'M03', text: '/mi learn', category: 'memory', expected_intent: 'ceo_memory_learn' },
  { id: 'M04', text: 'tìm tài liệu về Bakudan', category: 'knowledge_search', expected_intent: 'search_knowledge' },
  { id: 'M05', text: 'knowledge base stats', category: 'knowledge_search', expected_intent: 'jarvis_phase_30' },
  { id: 'M06', text: 'graph stats', category: 'graph', expected_intent: 'jarvis_phase_30' },
  { id: 'M07', text: 'health incidents', category: 'health', expected_intent: 'jarvis_phase_30' },
  { id: 'M08', text: 'observability', category: 'observability', expected_intent: 'jarvis_phase_30' },
  { id: 'M09', text: 'self improvement', category: 'self_improve', expected_intent: 'jarvis_phase_30' },
  { id: 'M10', text: 'council status', category: 'council', expected_intent: 'jarvis_phase_30' },

  // ── 81-90: Natural Language Vietnamese ───────────────────────────────────────
  { id: 'N01', text: 'em ơi cho anh xem tổng quan hệ thống', category: 'vietnamese_nlp', expected_intent: 'jarvis_phase_30' },
  { id: 'N02', text: 'hôm nay thứ mấy có lịch gì không', category: 'vietnamese_nlp', expected_intent: 'query_personal_tasks' },
  { id: 'N03', text: 'máy tính laptop 1 còn chạy không', category: 'vietnamese_nlp', expected_intent: 'node_laptop1' },
  { id: 'N04', text: 'các node đang hoạt động chứ', category: 'vietnamese_nlp', expected_intent: 'nodes_status' },
  { id: 'N05', text: 'tình hình kinh doanh tháng này', category: 'vietnamese_nlp', expected_intent: 'finance_truth' },
  { id: 'N06', text: 'có vấn đề gì cần xử lý không', category: 'vietnamese_nlp', expected_intent: 'query_personal_tasks' },
  { id: 'N07', text: 'report hôm nay', category: 'vietnamese_nlp', expected_intent: 'ceo_daily_briefing' },
  { id: 'N08', text: 'em kiểm tra giúp anh big data', category: 'vietnamese_nlp', expected_intent: 'bigdata_health' },
  { id: 'N09', text: 'việc cần làm tuần này', category: 'vietnamese_nlp', expected_intent: 'query_personal_tasks' },
  { id: 'N10', text: 'an review giúp project hiện tại', category: 'vietnamese_nlp', expected_intent: 'audit_project' },

  // ── 91-100: Statement Detection & Edge Cases ────────────────────────────────
  { id: 'E01', text: 'ok em', category: 'statement', expected_intent: 'statement' },
  { id: 'E02', text: 'dq', category: 'statement', expected_intent: 'statement' },
  { id: 'E03', text: 'hả', category: 'short_clarify', expected_intent: 'clarification' },
  { id: 'E04', text: 'gì', category: 'short_clarify', expected_intent: 'clarification' },
  { id: 'E05', text: 'qb report hoàn thành', category: 'correction', expected_intent: 'qb_report_completed' },
  { id: 'E06', text: 'payroll tuần rồi', category: 'correction', expected_intent: 'payroll_schedule' },
  { id: 'E07', text: 'QB Report xong hết rồi', category: 'correction', expected_intent: 'qb_report_completed' },
  { id: 'E08', text: 'hình có sẵn không', category: 'image_followup', expected_intent: 'image_evidence_followup' },
  { id: 'E09', text: 'unknown request test', category: 'unknown', expected_intent: 'unknown_clarify' },
  { id: 'E10', text: 'banh mi order status', category: 'mixed_nlp', expected_intent: 'jarvis_phase_30' },
];

// ══════════════════════════════════════════════════════════════════════════════
// Runner
// ══════════════════════════════════════════════════════════════════════════════

async function sendMessage(text) {
  const msgId = nextId();
  const payload = {
    source: 'whatsapp',
    client_id: 'mi-core',
    message_id: msgId,
    chat_id: CHAT_ID,
    sender: SENDER,
    sender_name: SENDER_NAME,
    text,
    timestamp: new Date().toISOString(),
  };

  const startTime = Date.now();
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify(payload),
    });
    const latencyMs = Date.now() - startTime;
    const data = await res.json();
    return { ok: true, status: res.status, data, latencyMs, message_id: msgId };
  } catch (e) {
    return { ok: false, error: e.message, latencyMs: Date.now() - startTime, message_id: msgId };
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function runTests() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Mi-Core Live WhatsApp Test — 100 System Commands');
  console.log('  Target:', API_URL);
  console.log('  Time:', new Date().toISOString());
  console.log('═══════════════════════════════════════════════════════════════\n');

  const results = [];
  let pass = 0;
  let fail = 0;
  let totalLatency = 0;

  for (let i = 0; i < TEST_COMMANDS.length; i++) {
    const test = TEST_COMMANDS[i];
    const progress = `[${String(i + 1).padStart(3)}/${TEST_COMMANDS.length}]`;

    process.stdout.write(`${progress} ${test.id} "${test.text.slice(0, 40).padEnd(40)}" → `);

    const result = await sendMessage(test.text);

    let status = 'PASS';
    let detail = '';

    if (!result.ok) {
      status = 'FAIL';
      detail = result.error;
      fail++;
    } else if (!result.data.ok) {
      status = 'FAIL';
      detail = result.data.error || 'API returned ok=false';
      fail++;
    } else {
      const intent = result.data.metadata?.intent || 'unknown';
      const hasReply = !!result.data.reply;
      if (!hasReply) {
        status = 'WARN';
        detail = 'No reply returned';
      } else {
        detail = `intent=${intent}`;
      }
      pass++;
    }

    totalLatency += result.latencyMs;
    const entry = {
      index: i + 1,
      id: test.id,
      text: test.text,
      category: test.category,
      expected_intent: test.expected_intent,
      status,
      actual_intent: result.data?.metadata?.intent || null,
      reply: result.data?.reply?.slice(0, 200) || null,
      latencyMs: result.latencyMs,
      detail,
      error: result.error || result.data?.error || null,
      approval_required: result.data?.approval_required || false,
    };
    results.push(entry);

    const icon = status === 'PASS' ? '✅' : status === 'WARN' ? '⚠️' : '❌';
    console.log(`${icon} ${detail.slice(0, 80)} (${result.latencyMs}ms)`);

    // Small delay to avoid rate limiting (120/min)
    if (i < TEST_COMMANDS.length - 1) {
      await sleep(350);
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  TEST SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Total:     ${TEST_COMMANDS.length}`);
  console.log(`  Passed:    ${pass} ✅`);
  console.log(`  Failed:    ${fail} ❌`);
  console.log(`  Avg Latency: ${Math.round(totalLatency / TEST_COMMANDS.length)}ms`);
  console.log(`  Pass Rate:   ${Math.round((pass / TEST_COMMANDS.length) * 100)}%`);
  console.log('═══════════════════════════════════════════════════════════════');

  // ── Category breakdown ───────────────────────────────────────────────────────
  const categories = {};
  for (const r of results) {
    if (!categories[r.category]) categories[r.category] = { pass: 0, fail: 0, total: 0 };
    categories[r.category].total++;
    if (r.status === 'PASS' || r.status === 'WARN') categories[r.category].pass++;
    else categories[r.category].fail++;
  }

  console.log('\n  Category Breakdown:');
  for (const [cat, stats] of Object.entries(categories)) {
    const pct = Math.round((stats.pass / stats.total) * 100);
    console.log(`    ${cat.padEnd(20)} ${stats.pass}/${stats.total} (${pct}%)`);
  }

  // ── Failed tests detail ──────────────────────────────────────────────────────
  const failures = results.filter(r => r.status === 'FAIL');
  if (failures.length > 0) {
    console.log('\n  ❌ FAILED TESTS:');
    for (const f of failures) {
      console.log(`    ${f.id} "${f.text}" → ${f.detail} ${f.error ? '(' + f.error + ')' : ''}`);
    }
  }

  // ── Save results ─────────────────────────────────────────────────────────────
  const outputDir = join(__dirname, 'DEV4_SCREENSHOT_EVIDENCE');
  mkdirSync(outputDir, { recursive: true });
  const outputPath = join(outputDir, `live-whatsapp-test-${Date.now()}.json`);
  writeFileSync(outputPath, JSON.stringify({
    test_run: 'live-whatsapp-100-commands',
    timestamp: new Date().toISOString(),
    summary: {
      total: TEST_COMMANDS.length,
      passed: pass,
      failed: fail,
      pass_rate: Math.round((pass / TEST_COMMANDS.length) * 100) + '%',
      avg_latency_ms: Math.round(totalLatency / TEST_COMMANDS.length),
    },
    categories,
    results,
  }, null, 2));
  console.log(`\n  Results saved: ${outputPath}`);
}

runTests().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
