/**
 * Phase P3 — WhatsApp Executive Assistant Certification
 * Target: EXECUTIVE_ASSISTANT_CERTIFIED
 * Run: node tests/cert-p3-executive-assistant.mjs
 */
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const require   = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST      = path.resolve(__dirname, '../server/dist');
const EVIDENCE  = path.resolve(__dirname, '../reports/evidence/p3-executive');
fs.mkdirSync(EVIDENCE, { recursive: true });

const {
  answerHomNayAnhCogi, answerCoGiCanDuyet, answerCoGiDangLo,
  answerDoanhThuSaoRoi, answerProjectNaoRuiRo, askExecutiveAssistant,
} = require(`${DIST}/coo-v4/executive-assistant.js`);

let passed = 0, failed = 0;
const answers = {};

async function ask(question, fn) {
  const t0 = Date.now();
  try {
    const r = await fn();
    const ok = r?.success !== false && r?.output;
    console.log(`\n  ${ok ? '✅' : '❌'} Q: "${question}"`);
    if (r?.output) {
      const lines = String(r.output).split('\n');
      lines.slice(0, 8).forEach(l => console.log(`     ${l}`));
      if (lines.length > 8) console.log(`     ... (+${lines.length - 8} more lines)`);
    }
    console.log(`     (${Date.now() - t0}ms | agent: ${r?.agent})`);
    answers[question] = { ok, output: r?.output, metadata: r?.metadata, ms: Date.now() - t0 };
    if (ok) passed++; else failed++;
    return r;
  } catch (e) {
    console.log(`\n  ❌ Q: "${question}": ${e.message}`);
    answers[question] = { ok: false, error: e.message };
    failed++;
  }
}

console.log('\n🧠 Phase P3 — WhatsApp Executive Assistant Certification');
console.log('   5 CEO Questions → Real Data Answers');
console.log('═'.repeat(60));

// Q1: Hôm nay anh có gì?
await ask('Hôm nay anh có gì?', () => answerHomNayAnhCogi());

// Q2: Có gì cần duyệt?
await ask('Có gì cần duyệt?', () => answerCoGiCanDuyet());

// Q3: Có gì đáng lo?
await ask('Có gì đáng lo?', () => answerCoGiDangLo());

// Q4: Doanh thu sao rồi?
await ask('Doanh thu sao rồi?', () => answerDoanhThuSaoRoi());

// Q5: Project nào rủi ro?
await ask('Project nào rủi ro?', () => answerProjectNaoRuiRo());

// Test dispatcher
console.log('\n[6] Universal dispatcher test');
for (const q of ['hom nay co gi', 'co gi can duyet', 'dang lo gi khong', 'doanh thu sao', 'project rui ro']) {
  const r = await askExecutiveAssistant(q);
  const ok = r?.success !== false && r?.output;
  console.log(`  ${ok ? '✅' : '❌'} dispatch("${q}") → agent:${r?.agent}`);
  if (ok) passed++; else failed++;
}

fs.writeFileSync(path.join(EVIDENCE, 'evidence.json'), JSON.stringify({ phase: 'P3', answers, passed, failed, generated_at: new Date().toISOString() }, null, 2));

console.log('\n' + '═'.repeat(60));
console.log(`  PASSED: ${passed}  FAILED: ${failed}  TOTAL: ${passed + failed}`);
console.log(`  Evidence: reports/evidence/p3-executive/evidence.json`);
console.log('═'.repeat(60));

const cert = failed === 0;
console.log(cert ? '\n🎉 EXECUTIVE_ASSISTANT_CERTIFIED' : `\n⚠️  EA_PARTIAL — ${failed} failed`);
process.exit(cert ? 0 : 1);
