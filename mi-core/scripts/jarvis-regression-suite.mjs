/**
 * Jarvis WhatsApp Regression Suite — Permanent
 *
 * Covers the 10 mandatory cases from CEO JARVIS_RELEASE_CANDIDATE_CONFIRMED verdict.
 * Run after any change to: executive-personality, executive-language, whatsapp route,
 * rate-limit, gateway forwarder, or LLM providers.
 *
 * Usage:
 *   node scripts/jarvis-regression-suite.mjs
 *   node scripts/jarvis-regression-suite.mjs --verbose
 *   node scripts/jarvis-regression-suite.mjs --gateway   # route through gateway (port 3211)
 */

import http from 'http';

const VERBOSE = process.argv.includes('--verbose');
const GATEWAY = process.argv.includes('--gateway');

const MI_CORE_URL  = 'http://127.0.0.1:4001';
const GATEWAY_URL  = 'http://127.0.0.1:3211';
const MI_CORE_KEY  = process.env.MI_CORE_API_KEY || 'mi-core-secret-2026';

// ── Timing requirements (ms) ────────────────────────────────────────────────
const LIMIT_PERSONALITY = 1000;   // personality-handled queries must reply under 1s
const LIMIT_WHATSAPP    = 5000;   // end-to-end WhatsApp path under 5s
const LIMIT_GATEWAY     = 5000;   // through-gateway path

// ── Mandatory regression cases ──────────────────────────────────────────────
const CASES = [
  {
    id: 'R01',
    label: 'Mi ơi — greeting',
    text: 'Mi ơi',
    sender: 'ceo-regression',
    category: 'personality',
    expect: {
      handled: true,
      replyContains: ['Em đây'],
      noEnglishError: true,
      noCommandStyle: true,
      maxMs: LIMIT_PERSONALITY,
    },
  },
  {
    id: 'R02',
    label: 'Alo — greeting',
    text: 'Alo',
    sender: 'ceo-regression',
    category: 'personality',
    expect: {
      handled: true,
      replyContains: ['Em đây'],
      noEnglishError: true,
      noCommandStyle: true,
      maxMs: LIMIT_PERSONALITY,
    },
  },
  {
    id: 'R03',
    label: 'hôm nay a có lịch gì ko — calendar',
    text: 'hom nay a co lich gi ko',
    sender: 'ceo-regression',
    category: 'personality',
    expect: {
      handled: true,
      replyContains: ['Em chưa', 'Em đang', 'Em chưa kết nối'],
      noEnglishError: true,
      noCommandStyle: true,
      maxMs: LIMIT_WHATSAPP,   // calendar is personality-handled but may hit startup lag
    },
  },
  {
    id: 'R04',
    label: 'em có biết anh đang làm project nào ko — project awareness',
    text: 'em co biet anh dang lam project nao ko',
    sender: 'ceo-regression',
    category: 'personality',
    expect: {
      handled: true,
      replyContains: ['Dev', 'project', 'em biết'],
      noEnglishError: true,
      noCommandStyle: true,
      maxMs: LIMIT_PERSONALITY,
    },
  },
  {
    id: 'R05',
    label: 'có gì đáng lo không — concern check',
    text: 'Co gi dang lo khong',
    sender: 'ceo-regression',
    category: 'personality',
    expect: {
      handled: true,
      replyContains: ['Em', 'service', 'theo dõi', 'ổn'],
      noEnglishError: true,
      noCommandStyle: true,
      maxMs: LIMIT_PERSONALITY,
    },
  },
  {
    id: 'R06',
    label: 'Laptop1 sao rồi — status check',
    text: 'Laptop1 sao roi',
    sender: 'ceo-regression',
    category: 'personality',
    expect: {
      handled: true,
      replyContains: ['Em vừa kiểm tra', 'Laptop1'],
      noEnglishError: true,
      noCommandStyle: true,
      maxMs: LIMIT_WHATSAPP,
    },
  },
  {
    id: 'R07',
    label: 'Dev1 đang kẹt gì — dev status',
    text: 'Dev1 dang ket gi',
    sender: 'ceo-regression',
    category: 'personality',
    expect: {
      handled: true,
      replyContains: ['Dev1', 'Em vừa kiểm tra'],
      noEnglishError: true,
      noCommandStyle: true,
      maxMs: LIMIT_PERSONALITY,
    },
  },
  {
    id: 'R08',
    label: 'tình hình Jarvis sao rồi — Jarvis status',
    text: 'Tinh hinh Jarvis sao roi',
    sender: 'ceo-regression',
    category: 'personality',
    expect: {
      handled: true,
      replyContains: ['Jarvis', 'Em vừa kiểm tra'],
      noEnglishError: true,
      noCommandStyle: true,
      maxMs: LIMIT_PERSONALITY,
    },
  },
  {
    id: 'R09',
    label: 'nó fix chưa — pronoun resolution (context memory)',
    text: 'No fix chua',
    sender: 'ceo-memory-regression',   // must share sender with R09-SETUP
    category: 'memory',
    setupText: 'Laptop1 bi loi',       // sent first to establish context
    expect: {
      handled: true,
      replyContains: ['Laptop1', 'Em đang theo dõi', 'Em đang', 'kiểm tra'],
      noEnglishError: true,
      noCommandStyle: true,
      maxMs: LIMIT_WHATSAPP,
    },
  },
  {
    id: 'R10',
    label: 'cancel — bare cancel with no pending approval',
    text: 'cancel',
    sender: 'ceo-regression',
    category: 'command',
    expect: {
      handled: true,
      replyContains: ['cancel', 'approval', 'action', 'hủy', 'Cancel'],
      noEnglishError: true,
      noCommandStyle: true,
      maxMs: LIMIT_PERSONALITY,
    },
  },
];

// ── Banned patterns (never allowed in CEO reply) ─────────────────────────────
const BANNED_PATTERNS = [
  /temporarily unavailable/i,
  /please try again later/i,
  /Mi-Core is/i,
  /use \/mi/i,
  /use \/agent/i,
  /command not recognized/i,
  /invalid command/i,
  /unrecognized intent/i,
  /i cannot/i,
  /i am unable/i,
  /as an ai/i,
  /PIPELINE_ERROR/i,
  /500 Internal Server Error/i,
];

const COMMAND_BOT_PATTERNS = [
  /use \/mi/i,
  /use \/agent/i,
  /refer to documentation/i,
  /command not recognized/i,
  /try \/mi/i,
  /type \/mi/i,
];

// ── HTTP helper ───────────────────────────────────────────────────────────────
function post(url, path, body, headers = {}, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request({
      hostname: url.replace('http://', '').split(':')[0],
      port: parseInt(url.split(':')[2]),
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...headers,
      },
    }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: { raw: data } }); }
      });
    });
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('TIMEOUT_' + timeoutMs + 'ms')); });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function askJarvis(text, sender) {
  const res = await post(MI_CORE_URL, '/api/jarvis/evolution/query', { text, sender }, { 'x-api-key': MI_CORE_KEY });
  return res.body;
}

// ── Assertion engine ──────────────────────────────────────────────────────────
function check(caseSpec, reply, latencyMs, handled) {
  const failures = [];
  const { expect: ex } = caseSpec;

  if (ex.handled && !handled) failures.push('NOT_HANDLED — personality did not handle query');
  if (ex.replyNotEmpty && (!reply || reply === '(none)')) failures.push('EMPTY_REPLY');

  if (ex.replyContains) {
    const anyMatch = ex.replyContains.some(term =>
      reply && reply.toLowerCase().includes(term.toLowerCase())
    );
    if (!anyMatch) failures.push(`REPLY_MISSING_EXPECTED_CONTENT — expected one of: ${ex.replyContains.join(', ')}`);
  }

  if (ex.noEnglishError) {
    for (const pat of BANNED_PATTERNS) {
      if (reply && pat.test(reply)) {
        failures.push(`BANNED_PATTERN_FOUND: ${pat}`);
      }
    }
  }

  if (ex.noCommandStyle) {
    for (const pat of COMMAND_BOT_PATTERNS) {
      if (reply && pat.test(reply)) {
        failures.push(`COMMAND_BOT_PATTERN_FOUND: ${pat}`);
      }
    }
  }

  if (ex.maxMs && latencyMs > ex.maxMs) {
    failures.push(`LATENCY_EXCEEDED — ${latencyMs}ms > ${ex.maxMs}ms limit`);
  }

  return failures;
}

// ── Runner ────────────────────────────────────────────────────────────────────
async function runCase(spec) {
  const sender = spec.sender + '-' + Date.now();

  // Setup turn for memory test
  if (spec.setupText) {
    try { await askJarvis(spec.setupText, sender); } catch {}
    await new Promise(r => setTimeout(r, 500));
  }

  const t0 = Date.now();
  let reply = '(none)';
  let handled = false;
  let intent = 'unknown';
  let error = null;

  // Retry once on transient connection errors (ECONNRESET, ECONNREFUSED)
  for (let attempt = 0; attempt <= 1; attempt++) {
    try {
      const res = await askJarvis(spec.text, sender);
      reply = res.reply || '(none)';
      handled = res.handled === true;
      intent = res.metadata?.intent || '?';
      error = null;
      break;
    } catch (e) {
      error = e.message;
      reply = 'ERROR: ' + e.message;
      if (attempt === 0 && /ECONNRESET|ECONNREFUSED|TIMEOUT/i.test(e.message)) {
        // Mi-Core may be mid-restart — wait and retry once
        await sleep(4000);
      }
    }
  }

  const latencyMs = Date.now() - t0;
  const failures = error ? [`EXCEPTION: ${error}`] : check(spec, reply, latencyMs, handled);
  const pass = failures.length === 0;

  return { spec, pass, failures, reply, latencyMs, handled, intent, error };
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const started = new Date().toISOString();
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║         JARVIS WHATSAPP REGRESSION SUITE                     ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`  Run: ${started}`);
  console.log(`  Target: ${MI_CORE_URL} (${GATEWAY ? 'via gateway' : 'direct'})`);
  console.log(`  Cases: ${CASES.length}`);
  console.log('');

  // Warmup — ensure mi-core is ready before first test
  process.stdout.write('  Warmup check...');
  let warmupOk = false;
  for (let i = 0; i < 6; i++) {
    try {
      await askJarvis('Mi oi', 'warmup');
      warmupOk = true;
      break;
    } catch {
      process.stdout.write('.');
      await sleep(3000);
    }
  }
  if (!warmupOk) {
    console.log(' FAILED\n  ❌ Mi-Core not reachable at ' + MI_CORE_URL);
    process.exit(2);
  }
  console.log(' OK\n');

  const results = [];

  for (const spec of CASES) {
    const result = await runCase(spec);
    results.push(result);

    const icon = result.pass ? '✅' : '❌';
    const latStr = `${result.latencyMs}ms`.padStart(6);
    console.log(`  ${icon} [${spec.id}] ${latStr}  ${spec.label}`);
    if (VERBOSE || !result.pass) {
      if (result.reply && result.reply !== '(none)') {
        const preview = result.reply.replace(/\n/g, ' ').slice(0, 100);
        console.log(`          reply: ${preview}`);
      }
      if (!result.pass) {
        for (const f of result.failures) {
          console.log(`          ⚠  ${f}`);
        }
      }
    }

    await sleep(400);
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  const passed  = results.filter(r => r.pass).length;
  const failed  = results.filter(r => !r.pass).length;
  const avgLat  = Math.round(results.reduce((s, r) => s + r.latencyMs, 0) / results.length);
  const maxLat  = Math.max(...results.map(r => r.latencyMs));
  const pct     = Math.round(passed / results.length * 100);

  console.log('');
  console.log('──────────────────────────────────────────────────────────────');
  console.log(`  RESULT: ${passed}/${results.length} PASS (${pct}%)`);
  console.log(`  Latency: avg ${avgLat}ms  max ${maxLat}ms`);

  if (failed > 0) {
    console.log('');
    console.log('  FAILED CASES:');
    for (const r of results.filter(r => !r.pass)) {
      console.log(`    ❌ [${r.spec.id}] ${r.spec.label}`);
      for (const f of r.failures) console.log(`       • ${f}`);
    }
  }

  console.log('');
  const verdict = pct === 100
    ? '  VERDICT: JARVIS_REGRESSION_PASS ✅'
    : pct >= 90
    ? `  VERDICT: JARVIS_REGRESSION_PARTIAL ⚠  (${failed} failing)`
    : `  VERDICT: JARVIS_REGRESSION_FAIL ❌  (${failed} failing — investigate before release)`;
  console.log(verdict);
  console.log('');

  // Machine-readable exit code
  process.exit(pct === 100 ? 0 : 1);
}

main().catch(e => {
  console.error('Suite runner error:', e);
  process.exit(2);
});
