/**
 * Voice Output E2E Test — validates the complete VieNeu-TTS pipeline.
 *
 * Run: node scripts/voice-output-e2e-test.js
 *
 * Tests:
 *  1. TTS engine health check
 *  2. Vietnamese synthesis quality
 *  3. English-Vietnamese code-switching
 *  4. Daily brief voice memo generation
 *  5. Evidence save with workflow ID
 *  6. Approval gate (non-CEO recipient)
 *  7. CEO exemption (auto-approve)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE = process.env.MI_CORE_URL || 'http://localhost:4001';

const results = [];
function log(label, ok, detail = '') {
  const icon = ok ? '✅' : '❌';
  results.push({ label, ok, detail });
  console.log(`${icon} [${label}] ${detail || (ok ? 'PASS' : 'FAIL')}`);
}

function httpReq(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const bodyStr = body ? JSON.stringify(body) : '';
    const opts = {
      hostname: url.hostname, port: url.port, path: url.pathname,
      method, headers: {
        'Content-Type': 'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      },
    };
    const req = http.request(opts, (res) => {
      let raw = ''; res.on('data', d => raw += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('  VieNeu-TTS Integration — E2E Test Suite');
  console.log('═══════════════════════════════════════════════\n');

  // ── Test 1: TTS Health ──────────────────────────────────────────────────
  try {
    const res = await httpReq('GET', '/api/voice/output/health');
    const ttsOk = res.status === 200 && res.body?.tts?.available === true;
    log('TTS Health', ttsOk, `status=${res.status}, tts.available=${res.body?.tts?.available}, engine=${res.body?.tts?.engine}`);
    if (ttsOk) {
      log('Voices Available', res.body?.tts?.voices?.length > 0,
        `${res.body?.tts?.voices?.length} voice(s): ${res.body?.tts?.voices?.map(v => v.short_name).join(', ')}`);
    }
  } catch (e) {
    log('TTS Health', false, e.message);
  }

  // ── Test 2: Vietnamese Synthesis ───────────────────────────────────────
  try {
    const viText = 'Xin chào anh Liêm. Đây là Mi-Core, trợ lý quản lý của anh. Hôm nay hệ thống hoạt động bình thường.';
    const res = await httpReq('POST', '/api/voice/output/speak', {
      text: viText,
      workflow_id: 'e2e-vi-test-001',
    });
    const ok = res.status === 200 && res.body?.available === true;
    log('Vietnamese Synthesis', ok,
      `status=${res.status}, available=${res.body?.available}, audio_path=${res.body?.audio_path || 'none'}, size=${res.body?.file_size_bytes || 0} bytes`);
    if (ok) {
      const exists = fs.existsSync(res.body.audio_path);
      log('Audio File Created', exists, res.body.audio_path);
    }
  } catch (e) {
    log('Vietnamese Synthesis', false, e.message);
  }

  // ── Test 3: Code-Switching (Vi + En) ────────────────────────────────────
  try {
    const mixedText = 'Anh Liêm, hôm nay có 3 tasks từ Asana cần review. DoorDash revenue là $12,500. QuickBooks sync OK. System status: all green.';
    const res = await httpReq('POST', '/api/voice/output/speak', {
      text: mixedText,
      workflow_id: 'e2e-codeswitch-001',
    });
    const ok = res.status === 200 && res.body?.available === true;
    log('Code-Switching (Vi+En)', ok,
      `status=${res.status}, size=${res.body?.file_size_bytes || 0} bytes, synthesis_ms=${res.body?.synthesis_ms || 0}ms`);
  } catch (e) {
    log('Code-Switching (Vi+En)', false, e.message);
  }

  // ── Test 4: Daily Brief Voice Memo ──────────────────────────────────────
  try {
    const res = await httpReq('POST', '/api/voice/output/daily-brief', {
      is_ceo: true, // CEO exempt — auto-send
    });
    const ok = res.status === 200 && res.body?.ok === true;
    log('Daily Brief Voice Memo', ok,
      `workflow_id=${res.body?.workflow_id}, approval_status=${res.body?.approval_status}, whatsapp_sent=${res.body?.whatsapp_sent}`);
    if (ok) {
      log('Text Report Generated', !!res.body?.text_report, res.body?.text_report?.slice(0, 80) + '...');
      log('Audio Evidence Saved', !!res.body?.evidence?.audio_path, res.body?.evidence?.audio_path);
      log('CEO Exemption Works', res.body?.approval_status === 'skipped_ceo',
        `approval_status=${res.body?.approval_status}`);
    }
  } catch (e) {
    log('Daily Brief Voice Memo', false, e.message);
  }

  // ── Test 5: Evidence Record ─────────────────────────────────────────────
  try {
    const res = await httpReq('GET', '/api/voice/output/evidence?limit=5');
    const ok = res.status === 200 && res.body?.ok === true;
    log('Evidence Store', ok, `${res.body?.count} record(s) found`);
    if (ok && res.body?.records?.length > 0) {
      const latest = res.body.records[0];
      log('Evidence has workflow_id', !!latest.workflow_id, latest.workflow_id);
      log('Evidence has audio_path', !!latest.audio_path, latest.audio_path);
      log('Evidence has approval_status', !!latest.approval_status, latest.approval_status);
    }
  } catch (e) {
    log('Evidence Store', false, e.message);
  }

  // ── Test 6: Approval Gate (non-CEO) ────────────────────────────────────
  try {
    const res = await httpReq('POST', '/api/voice/output/send', {
      text: 'Đây là thông báo quan trọng từ Mi-Core cho nhân viên.',
      recipient: '+84999999999',
      recipient_name: 'Staff Member',
      is_ceo: false,
      workflow_id: 'e2e-approval-test-001',
    });
    const ok = res.status === 200 && res.body?.ok === true;
    log('Approval Gate (non-CEO)', ok,
      `approval_status=${res.body?.approval_status}, approval_id=${res.body?.approval_id || 'none'}`);
    if (ok) {
      log('Pending Approval Enqueued', res.body?.approval_status === 'pending_approval',
        `status=${res.body?.approval_status}`);
    }
  } catch (e) {
    log('Approval Gate (non-CEO)', false, e.message);
  }

  // ── Test 7: CEO Exemption ────────────────────────────────────────────────
  try {
    const res = await httpReq('POST', '/api/voice/output/send', {
      text: 'Báo cáo cập nhật từ Mi-Core — hệ thống hoạt động tốt.',
      is_ceo: true,
      workflow_id: 'e2e-ceo-exempt-001',
    });
    const ok = res.status === 200 && res.body?.ok === true;
    log('CEO Exemption (auto-approve)', ok,
      `approval_status=${res.body?.approval_status}, whatsapp_sent=${res.body?.whatsapp_sent}`);
  } catch (e) {
    log('CEO Exemption (auto-approve)', false, e.message);
  }

  // ── Summary ─────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════');
  const passed = results.filter(r => r.ok).length;
  const total = results.length;
  console.log(`  Result: ${passed}/${total} tests passed`);
  if (passed === total) {
    console.log('  🎉 ALL TESTS PASSED — MI_VOICE_OUTPUT_READY');
  } else {
    const failed = results.filter(r => !r.ok);
    console.log(`  ⚠️  ${failed.length} test(s) failed:`);
    failed.forEach(f => console.log(`     • ${f.label}: ${f.detail}`));
  }
  console.log('═══════════════════════════════════════════════\n');

  // Write proof file
  const proofPath = path.join(__dirname, '..', 'VOICE_OUTPUT_PROOF.md');
  const proof = `# VOICE_OUTPUT_PROOF.md\n` +
    `Generated: ${new Date().toISOString()}\n\n` +
    `## E2E Test Results\n\n` +
    results.map(r => `| ${r.ok ? '✅' : '❌'} | ${r.label} | ${r.detail} |`).join('\n') + '\n\n' +
    `## Conclusion\n\n` +
    `**MI_VOICE_OUTPUT_READY**: ${passed === total ? 'ACHIEVED ✅' : 'PARTIAL ⚠️'}\n\n` +
    `Passed: ${passed}/${total}\n`;
  fs.writeFileSync(proofPath, proof, 'utf-8');
  console.log(`Proof saved to: ${proofPath}`);
}

main().catch(console.error);
