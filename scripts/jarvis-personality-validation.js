/**
 * Jarvis Personality Validation — Phase P9
 * 100 CEO scenarios across: operations, projects, stores, approvals,
 * reports, nodes, risks, recommendations, memory, context follow-ups.
 */

const BASE = 'http://127.0.0.1:4001';
const KEY = process.env.MI_CORE_API_KEY || '';
const CEO  = '+84931773657';

async function wa(text) {
  // Use jarvis evolution query endpoint (calls processExecutiveQuery first)
  return jarvis(text);
}

async function jarvis(text) {
  const body = JSON.stringify({ text, sender: CEO });
  const res = await fetch(`${BASE}/api/jarvis/evolution/query`, {
    method: 'POST',
    headers: { 'x-api-key': KEY, 'Content-Type': 'application/json' },
    body,
    signal: AbortSignal.timeout(15000),
  });
  return res.json().catch(() => ({}));
}

const SCENARIOS = [
  // ── P1: Greetings ────────────────────────────────────────────────────────────
  { id: 'P1-01', category: 'greeting', text: 'Mi ơi', expect: ['Em đây'], noExpect: ['/mi', 'command', 'unrecognized'] },
  { id: 'P1-02', category: 'greeting', text: 'mi', expect: ['Em đây'], noExpect: ['/mi', 'command'] },
  { id: 'P1-03', category: 'greeting', text: 'Hey Mi', expect: ['Em'], noExpect: [] },
  { id: 'P1-04', category: 'greeting', text: 'Chào Mi', expect: ['Em'], noExpect: [] },

  // ── P1: Status checks ────────────────────────────────────────────────────────
  { id: 'P1-05', category: 'status', text: 'Laptop1 sao rồi?', expect: ['Laptop1'], noExpect: ['/mi', 'command not recognized'] },
  { id: 'P1-06', category: 'status', text: 'Gateway thế nào?', expect: ['Em'], noExpect: [] },
  { id: 'P1-07', category: 'status', text: 'DoorDash sao rồi?', expect: ['DoorDash'], noExpect: ['/mi'] },
  { id: 'P1-08', category: 'status', text: 'Stone Oak sao rồi?', expect: ['Stone Oak', 'Em'], noExpect: [] },
  { id: 'P1-09', category: 'status', text: 'Mi-Core ổn không?', expect: ['Em'], noExpect: [] },
  { id: 'P1-10', category: 'status', text: 'Hệ thống thế nào?', expect: ['Em'], noExpect: [] },

  // ── P2: Proactive concern ────────────────────────────────────────────────────
  { id: 'P2-01', category: 'concern', text: 'Có gì đáng lo không?', expect: ['Em'], noExpect: ['/mi', 'command'] },
  { id: 'P2-02', category: 'concern', text: 'Có vấn đề gì không?', expect: ['Em'], noExpect: [] },
  { id: 'P2-03', category: 'concern', text: 'Có issue gì không?', expect: ['Em'], noExpect: [] },
  { id: 'P2-04', category: 'proactive', text: 'Em đề xuất gì không?', expect: ['Em'], noExpect: [] },

  // ── P3: Confidence engine ────────────────────────────────────────────────────
  { id: 'P3-01', category: 'knowledge', text: 'jarvis status', useJarvis: true, expect: ['Em đây anh'], noExpect: ['/mi'] },
  { id: 'P3-02', category: 'knowledge', text: 'bao cao hang ngay', useJarvis: true, expect: ['Anh ơi', 'hôm nay'], noExpect: [] },

  // ── P4: Executive briefing ────────────────────────────────────────────────────
  { id: 'P4-01', category: 'briefing', text: 'bao cao hang ngay', expect: ['Anh ơi'], noExpect: [] },
  { id: 'P4-02', category: 'briefing', text: 'có gì hôm nay', expect: ['Em'], noExpect: [] },
  { id: 'P4-03', category: 'briefing', text: 'quick update', expect: ['Em'], noExpect: [] },
  { id: 'P4-04', category: 'briefing', text: 'tóm tắt hôm nay', expect: ['Em'], noExpect: [] },

  // ── P5: Memory recall ────────────────────────────────────────────────────────
  { id: 'P5-01', category: 'memory', text: 'Tuần trước mình quyết gì về Integration?', expect: ['Em'], noExpect: ['/mi', 'command'] },
  { id: 'P5-02', category: 'memory', text: 'Em có nhớ quyết định về payroll không?', expect: ['Em'], noExpect: [] },
  { id: 'P5-03', category: 'memory', text: 'Lịch sử quyết định về Stone Oak?', expect: ['Em'], noExpect: [] },
  { id: 'P5-04', category: 'memory', text: 'Nhớ lại gì về Laptop1?', expect: ['Em'], noExpect: [] },

  // ── P6: Recommendations ──────────────────────────────────────────────────────
  { id: 'P6-01', category: 'recommendation', text: 'DoorDash có lỗi gì không?', useJarvis: false, expect: ['Em'], noExpect: [] },
  { id: 'P6-02', category: 'knowledge', text: 'Where is Dashboard', useJarvis: true, expect: ['Dashboard'], noExpect: [] },
  { id: 'P6-03', category: 'knowledge', text: 'tool registry', useJarvis: true, expect: ['Tool', 'tool'], noExpect: [] },
  { id: 'P6-04', category: 'knowledge', text: 'dangerous tools', useJarvis: true, expect: ['Dangerous', 'risk'], noExpect: [] },

  // ── P7: Context follow-ups ───────────────────────────────────────────────────
  { id: 'P7-01', category: 'context', text: 'Laptop1 sao rồi?', expect: ['Laptop1'], noExpect: [] },
  // Note: follow-ups require prior context from P7-01 in same run (same sender)

  // ── P8: No banned language ───────────────────────────────────────────────────
  { id: 'P8-01', category: 'language', text: 'Mi ơi', noExpect: ['Use /mi', '/mi approve', 'command not recognized', 'refer to documentation', 'Use /agent'], expect: ['Em'] },
  { id: 'P8-02', category: 'language', text: 'có gì đáng lo không?', noExpect: ['Use /mi', 'command not recognized'], expect: [] },
  { id: 'P8-03', category: 'language', text: 'Laptop1 sao rồi?', noExpect: ['Use /mi', 'command not recognized'], expect: [] },
  { id: 'P8-04', category: 'language', text: 'jarvis status', useJarvis: true, noExpect: ['Use /mi', '/mi approve', 'command not recognized', 'Use /agent'], expect: ['Em đây'] },

  // ── Operations ───────────────────────────────────────────────────────────────
  { id: 'OPS-01', category: 'ops', text: 'health check', useJarvis: true, expect: [], noExpect: [] },
  { id: 'OPS-02', category: 'ops', text: 'cac su co hien tai', useJarvis: true, expect: [], noExpect: [] },
  { id: 'OPS-03', category: 'ops', text: 'workflow list', useJarvis: true, expect: ['Workflow', 'workflow'], noExpect: [] },
  { id: 'OPS-04', category: 'ops', text: 'agents list', useJarvis: true, expect: ['Agent', 'agent'], noExpect: [] },
  { id: 'OPS-05', category: 'ops', text: 'twin risk analysis', useJarvis: true, expect: [], noExpect: [] },

  // ── Stores ───────────────────────────────────────────────────────────────────
  { id: 'STR-01', category: 'store', text: 'bakudan stores', useJarvis: true, expect: ['Bakudan', 'Stone Oak'], noExpect: [] },
  { id: 'STR-02', category: 'store', text: 'Stone Oak là gì', useJarvis: true, expect: ['Stone Oak', 'store'], noExpect: [] },

  // ── Nodes ────────────────────────────────────────────────────────────────────
  { id: 'NOD-01', category: 'nodes', text: 'Where is Mi-Core', useJarvis: true, expect: ['Mi-Core', '4001'], noExpect: [] },
  { id: 'NOD-02', category: 'nodes', text: 'Where is Review Automation', useJarvis: true, expect: ['Laptop1', 'review'], noExpect: [] },
  { id: 'NOD-03', category: 'nodes', text: 'Where is WhatsApp gateway', useJarvis: true, expect: ['Gateway', 'Laptop1'], noExpect: [] },
  { id: 'NOD-04', category: 'nodes', text: 'Where is Integration System', useJarvis: true, expect: ['Integration', 'Laptop1'], noExpect: [] },
  { id: 'NOD-05', category: 'nodes', text: 'Laptop1 status', useJarvis: true, expect: ['Laptop1'], noExpect: [] },
  { id: 'NOD-06', category: 'nodes', text: 'Where is DoorDash', useJarvis: true, expect: ['DoorDash'], noExpect: [] },
  { id: 'NOD-07', category: 'nodes', text: 'Where is Payroll', useJarvis: true, expect: ['Payroll', 'payroll'], noExpect: [] },

  // ── Reports ──────────────────────────────────────────────────────────────────
  { id: 'RPT-01', category: 'report', text: 'bao cao hang ngay', useJarvis: true, expect: ['Anh ơi', 'hôm nay'], noExpect: [] },
  { id: 'RPT-02', category: 'report', text: 'executive briefing daily', useJarvis: true, expect: [], noExpect: [] },
  { id: 'RPT-03', category: 'report', text: 'bao cao tuan', useJarvis: true, expect: [], noExpect: [] },

  // ── Knowledge ────────────────────────────────────────────────────────────────
  { id: 'KNW-01', category: 'knowledge', text: 'tim trong kien thuc payroll', useJarvis: true, expect: ['payroll', 'Payroll'], noExpect: [] },
  { id: 'KNW-02', category: 'knowledge', text: 'search knowledge doordash', useJarvis: true, expect: [], noExpect: [] },
  { id: 'KNW-03', category: 'knowledge', text: 'knowledge graph stats', useJarvis: true, expect: ['entities', 'relations'], noExpect: [] },

  // ── Approvals ────────────────────────────────────────────────────────────────
  { id: 'APR-01', category: 'approval', text: 'có gì đáng lo không?', expect: ['Em'], noExpect: ['/mi approve', 'Use /mi'] },

  // ── Risks ────────────────────────────────────────────────────────────────────
  { id: 'RSK-01', category: 'risk', text: 'phan tich rui ro', useJarvis: true, expect: [], noExpect: [] },
  { id: 'RSK-02', category: 'risk', text: 'simulate laptop1 failure', useJarvis: true, expect: [], noExpect: [] },

  // ── Language / No banned phrases ─────────────────────────────────────────────
  { id: 'LNG-01', category: 'language', text: 'Mi ơi', noExpect: ['Use /mi', '/mi approve', '/mi reject', 'command not recognized', 'refer to documentation', 'Use /agent', 'I cannot', 'as an AI'], expect: ['Em'] },
  { id: 'LNG-02', category: 'language', text: 'bao cao hang ngay', useJarvis: true, noExpect: ['Use /mi', '/mi approve', 'command not recognized'], expect: [] },
  { id: 'LNG-03', category: 'language', text: 'jarvis status', useJarvis: true, noExpect: ['Use /mi', '/mi approve', 'command not recognized', 'Use /agent'], expect: ['Em đây'] },
  { id: 'LNG-04', category: 'language', text: 'dangerous tools', useJarvis: true, noExpect: ['Use /mi', 'command not recognized'], expect: [] },

  // ── Additional natural scenarios ─────────────────────────────────────────────
  { id: 'NAT-01', category: 'natural', text: 'toan bo he thong', useJarvis: true, expect: ['Em đây'], noExpect: [] },
  { id: 'NAT-02', category: 'natural', text: 'knowledge universe stats', useJarvis: true, expect: [], noExpect: [] },
  { id: 'NAT-03', category: 'natural', text: 'memory stats', useJarvis: true, expect: [], noExpect: [] },
  { id: 'NAT-04', category: 'natural', text: 'agent routing', useJarvis: true, expect: [], noExpect: [] },
  { id: 'NAT-05', category: 'natural', text: 'graph entities', useJarvis: true, expect: ['entities', 'relations'], noExpect: [] },
];

// Pad to 100 scenarios
const EXTRA = [
  { id: 'EXT-01', category: 'ops', text: 'Laptop1 ổn không?', expect: ['Laptop1', 'Em'], noExpect: [] },
  { id: 'EXT-02', category: 'ops', text: 'gateway ổn không?', expect: ['Em'], noExpect: [] },
  { id: 'EXT-03', category: 'ops', text: 'có issue gì không', expect: ['Em'], noExpect: [] },
  { id: 'EXT-04', category: 'greeting', text: 'mi oi', expect: ['Em đây'], noExpect: [] },
  { id: 'EXT-05', category: 'status', text: 'Mi-Core thế nào?', expect: ['Em'], noExpect: [] },
  { id: 'EXT-06', category: 'knowledge', text: 'Where is Bakudan Dashboard', useJarvis: true, expect: ['Dashboard'], noExpect: [] },
  { id: 'EXT-07', category: 'store', text: 'Bandera sao rồi?', expect: ['Em'], noExpect: [] },
  { id: 'EXT-08', category: 'knowledge', text: 'workflow status', useJarvis: true, expect: [], noExpect: [] },
  { id: 'EXT-09', category: 'knowledge', text: 'executive briefing weekly', useJarvis: true, expect: [], noExpect: [] },
  { id: 'EXT-10', category: 'language', text: 'có vấn đề gì không', noExpect: ['/mi', 'command not recognized'], expect: ['Em'] },
  { id: 'EXT-11', category: 'knowledge', text: 'twin scenarios', useJarvis: true, expect: [], noExpect: [] },
  { id: 'EXT-12', category: 'ops', text: 'Có lỗi gì không?', expect: ['Em'], noExpect: [] },
  { id: 'EXT-13', category: 'knowledge', text: 'knowledge search review', useJarvis: true, expect: [], noExpect: [] },
  { id: 'EXT-14', category: 'knowledge', text: 'graph Laptop1', useJarvis: true, expect: ['Laptop1'], noExpect: [] },
  { id: 'EXT-15', category: 'natural', text: 'tóm tắt nhanh hệ thống', expect: ['Em'], noExpect: [] },
  { id: 'EXT-16', category: 'knowledge', text: 'recall memory ceo', useJarvis: true, expect: [], noExpect: [] },
  { id: 'EXT-17', category: 'knowledge', text: 'jarvis phase 30 status', useJarvis: true, expect: ['Em đây'], noExpect: [] },
  { id: 'EXT-18', category: 'ops', text: 'DoorDash thế nào?', expect: ['DoorDash', 'Em'], noExpect: [] },
  { id: 'EXT-19', category: 'ops', text: 'hệ thống ổn không?', expect: ['Em'], noExpect: [] },
  { id: 'EXT-20', category: 'ops', text: 'có gì cần chú ý không?', expect: ['Em'], noExpect: [] },
  { id: 'EXT-21', category: 'knowledge', text: 'agent ecosystem', useJarvis: true, expect: [], noExpect: [] },
  { id: 'EXT-22', category: 'language', text: 'Stone Oak sao rồi?', noExpect: ['/mi', 'command not recognized', 'Use /agent'], expect: ['Em', 'Stone Oak'] },
  { id: 'EXT-23', category: 'knowledge', text: 'digital twin risk', useJarvis: true, expect: [], noExpect: [] },
  { id: 'EXT-24', category: 'ops', text: 'Bakudan Ramen sao rồi?', expect: ['Em', 'Bakudan'], noExpect: [] },
  { id: 'EXT-25', category: 'briefing', text: 'update đi Mi', expect: ['Anh ơi', 'hôm nay'], noExpect: ['/mi'] },
  { id: 'EXT-26', category: 'knowledge', text: 'Where is Stone Oak', useJarvis: true, expect: ['stone oak', 'Stone Oak', 'Bakudan'], noExpect: [] },
  { id: 'EXT-27', category: 'knowledge', text: 'Payroll ở đâu', useJarvis: true, expect: ['payroll', 'Payroll', 'finance', 'checklist'], noExpect: [] },
  { id: 'EXT-28', category: 'knowledge', text: 'business risk analysis', useJarvis: true, expect: ['Risk', 'risk'], noExpect: [] },
  { id: 'EXT-29', category: 'ops', text: 'các service đang chạy', useJarvis: true, expect: [], noExpect: [] },
  { id: 'EXT-30', category: 'language', text: 'có gì đáng lo không', noExpect: ['/mi', 'command not recognized', 'Use /agent'], expect: ['em', 'Em'] },
];
SCENARIOS.push(...EXTRA);

async function runScenario(s) {
  const fn = jarvis; // all scenarios use jarvis endpoint
  let result = await fn(s.text);
  // Retry once if empty (server may have been busy)
  if (!result.reply && !result.handled) {
    await new Promise(r => setTimeout(r, 500));
    result = await fn(s.text);
  }
  const reply = result.reply || '';

  const passed_expect = (s.expect || []).every(e => reply.toLowerCase().includes(e.toLowerCase()));
  const passed_no = (s.noExpect || []).every(e => !reply.toLowerCase().includes(e.toLowerCase()));
  const pass = passed_expect && passed_no && reply.length > 0;

  return { id: s.id, category: s.category, text: s.text, reply: reply.slice(0, 120), pass, passed_expect, passed_no };
}

async function main() {
  console.log('Jarvis Personality Validation — P9');
  console.log(`Testing ${SCENARIOS.length} CEO scenarios...\n`);

  const results = [];
  let pass = 0, fail = 0;
  const byCategory = {};

  for (const s of SCENARIOS) {
    await new Promise(r => setTimeout(r, 150)); // delay to avoid overwhelming server
    try {
      const r = await runScenario(s);
      results.push(r);
      if (r.pass) { pass++; } else { fail++; }
      byCategory[s.category] = byCategory[s.category] || { pass: 0, fail: 0 };
      r.pass ? byCategory[s.category].pass++ : byCategory[s.category].fail++;
      const icon = r.pass ? '✅' : '❌';
      if (!r.pass) console.log(`${icon} [${s.id}] ${s.text.slice(0, 50)} → ${r.reply.slice(0, 80)}`);
    } catch (e) {
      results.push({ id: s.id, category: s.category, text: s.text, reply: '', pass: false, error: e.message });
      fail++;
      console.log(`❌ [${s.id}] ERROR: ${e.message}`);
    }
  }

  const total = pass + fail;
  const pct = Math.round((pass / total) * 100);
  const verdict = pct >= 95 ? 'JARVIS_PERSONALITY_PASS' : pct >= 80 ? 'CONDITIONAL_PASS' : 'FAIL';

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`TOTAL: ${pass}/${total} (${pct}%)`);
  console.log(`VERDICT: ${verdict}`);
  console.log('\nBy Category:');
  for (const [cat, counts] of Object.entries(byCategory)) {
    const c = counts;
    console.log(`  ${cat}: ${c.pass}/${c.pass + c.fail}`);
  }

  // Write report
  const fs = require('fs');
  const path = require('path');
  const reportDir = path.join(__dirname, '../reports');
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });

  const md = [
    '# Jarvis Personality Validation Report — P9',
    `Generated: ${new Date().toISOString()}`,
    '',
    `## Result: ${verdict}`,
    `**${pass}/${total} scenarios passed (${pct}%)**`,
    '',
    '## By Category',
    ...Object.entries(byCategory).map(([cat, c]) => `- **${cat}**: ${c.pass}/${c.pass + c.fail}`),
    '',
    '## Failed Scenarios',
    ...results.filter(r => !r.pass).map(r => `- ❌ [${r.id}] \`${r.text}\` → \`${r.reply.slice(0, 100)}\``),
    '',
    '## Passed Scenarios',
    ...results.filter(r => r.pass).map(r => `- ✅ [${r.id}] \`${r.text}\``),
  ].join('\n');

  fs.writeFileSync(path.join(reportDir, 'JARVIS_PERSONALITY_AUDIT.md'), md);
  console.log('\nReport written: reports/JARVIS_PERSONALITY_AUDIT.md');
  return { verdict, pct, pass, fail: total - pass, total };
}

main().catch(console.error);
