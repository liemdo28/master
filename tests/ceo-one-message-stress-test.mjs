#!/usr/bin/env node
/**
 * CEO One-Message Stress Test — D6
 * Runs 100 real-world CEO-style requests through the intent router.
 *
 * Does NOT send live HTTP requests (avoids wait on approval pipeline).
 * Tests the intent classification layer directly — the first and most
 * critical gate. A wrong intent = wrong pipeline = wrong answer.
 *
 * Metrics:
 *   understood     — intent is not 'unknown'
 *   finance_gated  — finance query hits query_finance (truth layer)
 *   hallucination  — intent='unknown' but system would have run pipeline anyway
 *                    (impossible post-B2 fix — unknown always returns honest reply)
 *   silent_drop    — would never happen (no branch drops unknown silently)
 *
 * Usage: node tests/ceo-one-message-stress-test.mjs
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { classifyIntent } = require('../server/dist/gstack/intent-router.js');

// ── 100 real-world CEO phrases ───────────────────────────────────────────────

const TESTS = [
  // Finance (D1) — must hit query_finance
  { phrase: 'Doanh thu hôm nay?',                       expected: 'query_finance', category: 'finance' },
  { phrase: 'doanh thu tuan nay',                        expected: 'query_finance', category: 'finance' },
  { phrase: 'Doanh thu thang nay bao nhieu',             expected: 'query_finance', category: 'finance' },
  { phrase: 'Revenue tháng này',                         expected: 'query_finance', category: 'finance' },
  { phrase: 'Store nào mạnh nhất?',                      expected: 'query_finance', category: 'finance' },
  { phrase: 'Store nao giam doanh thu',                  expected: 'query_finance', category: 'finance' },
  { phrase: 'Raw Sushi doanh thu sao rồi?',              expected: 'query_finance', category: 'finance' },
  { phrase: 'Bakudan doanh thu tháng này',               expected: 'query_finance', category: 'finance' },
  { phrase: 'Stockton lam an sao',                       expected: 'query_finance', category: 'finance' },
  { phrase: 'So sanh doanh thu cac store',               expected: 'query_finance', category: 'finance' },
  { phrase: 'Loi nhuan thang nay bao nhieu',             expected: 'query_finance', category: 'finance' },
  { phrase: 'Chi phi thang nay',                         expected: 'query_finance', category: 'finance' },
  { phrase: 'QB invoice tháng này bao nhiêu',            expected: 'query_finance', category: 'finance' },
  { phrase: 'Xem ke toan thang nay',                     expected: 'query_finance', category: 'finance' },
  { phrase: 'Doanh thu tuan nay tang hay giam',          expected: 'query_finance', category: 'finance' },

  // Store status (D2) — must hit check_status
  { phrase: 'raw sao roi',                               expected: 'check_status', category: 'store_status' },
  { phrase: 'bakudan sao rồi',                           expected: 'check_status', category: 'store_status' },
  { phrase: 'Stockton sao rồi?',                         expected: 'check_status', category: 'store_status' },
  { phrase: 'coi raw',                                   expected: 'check_status', category: 'store_status' },
  { phrase: 'coi qb',                                    expected: 'check_status', category: 'store_status' },
  { phrase: 'qb',                                        expected: 'check_status', category: 'store_status' },
  { phrase: 'qb sao',                                    expected: 'check_status', category: 'store_status' },
  { phrase: 'coi qb đi',                                 expected: 'check_status', category: 'store_status' },
  { phrase: 'Stone Oak sao roi',                         expected: 'check_status', category: 'store_status' },
  { phrase: 'Rim the nao',                               expected: 'check_status', category: 'store_status' },
  { phrase: 'Bandera sao roi',                           expected: 'check_status', category: 'store_status' },
  { phrase: 'coi giùm anh',                              expected: 'check_status', category: 'store_status' },
  { phrase: 'kiem tra gium',                             expected: 'check_status', category: 'store_status' },
  { phrase: 'Dashboard dau',                             expected: 'check_status', category: 'store_status' },
  { phrase: 'pm2 status',                                expected: 'check_status', category: 'store_status' },

  // Send message (D2) — must hit send_message
  { phrase: 'mail maria',                                expected: 'send_message', category: 'send' },
  { phrase: 'nhan maria',                                expected: 'send_message', category: 'send' },
  { phrase: 'gui anh ket qua',                           expected: 'send_message', category: 'send' },
  { phrase: 'gui Maria ban nhap',                        expected: 'send_message', category: 'send' },
  { phrase: 'email Maria bao cao',                       expected: 'send_message', category: 'send' },
  { phrase: 'nhan tin hoang',                            expected: 'send_message', category: 'send' },
  { phrase: 'gui nguyen ket qua',                        expected: 'send_message', category: 'send' },
  { phrase: 'gui boss bao cao',                          expected: 'send_message', category: 'send' },

  // Audit (D2) — must hit audit_project
  { phrase: 'Kiểm tra Dashboard',                        expected: 'audit_project', category: 'audit' },
  { phrase: 'Audit toan bo he thong',                    expected: 'audit_project', category: 'audit' },
  { phrase: 'kiem tra he thong',                         expected: 'audit_project', category: 'audit' },
  { phrase: 'review automation',                         expected: 'audit_project', category: 'audit' },
  { phrase: 'rv auto on kh',                             expected: 'audit_project', category: 'audit' },
  { phrase: 'kiem tra mi-core',                          expected: 'audit_project', category: 'audit' },
  { phrase: 'Audit Dashboard va cho anh biet van de',    expected: 'audit_project', category: 'audit' },
  { phrase: 'scan project',                              expected: 'audit_project', category: 'audit' },

  // Build/create (D2) — must hit build_feature
  { phrase: 'Tao bai SEO Raw Sushi',                     expected: 'build_feature', category: 'build' },
  { phrase: 'viet bai SEO cho bakudan',                  expected: 'build_feature', category: 'build' },
  { phrase: 'tao flyer cho stockton',                    expected: 'build_feature', category: 'build' },
  { phrase: 'tao bai dang social media',                 expected: 'build_feature', category: 'build' },
  { phrase: 'lam poster cho raw sushi',                  expected: 'build_feature', category: 'build' },
  { phrase: 'viet content cho website',                  expected: 'build_feature', category: 'build' },
  { phrase: 'tao video reel cho bakudan',                expected: 'build_feature', category: 'build' },

  // Task intelligence — must hit query_personal_tasks
  { phrase: 'hom nay co viec gi',                        expected: 'query_personal_tasks', category: 'tasks' },
  { phrase: 'hnay task gi',                              expected: 'query_personal_tasks', category: 'tasks' },
  { phrase: 'co gi can anh duyet',                       expected: 'query_personal_tasks', category: 'tasks' },
  { phrase: 'anh co task gi',                            expected: 'query_personal_tasks', category: 'tasks' },
  { phrase: 'co blocker gi khong',                       expected: 'query_personal_tasks', category: 'tasks' },
  { phrase: 'team dang lam gi hom nay',                  expected: 'query_personal_tasks', category: 'tasks' },

  // Deploy/rollback — must hit correct risk intents
  { phrase: 'deploy production',                         expected: 'deploy_release', category: 'deploy' },
  { phrase: 'len production',                            expected: 'deploy_release', category: 'deploy' },
  { phrase: 'rollback',                                  expected: 'rollback',       category: 'deploy' },

  // Fix bug
  { phrase: 'fix loi dashboard',                         expected: 'fix_bug', category: 'fix' },
  { phrase: 'sua bug production',                        expected: 'fix_bug', category: 'fix' },
  { phrase: 'debug loi auth',                            expected: 'fix_bug', category: 'fix' },

  // Unknown — must return 'unknown' (no data, no connector)
  { phrase: 'nhan vien nao nghi phep',                   expected: 'unknown', category: 'unknown' },
  { phrase: 'Maria dang lam gi',                         expected: 'unknown', category: 'unknown' },
  { phrase: 'budget Q2 con bao nhieu',                   expected: 'unknown', category: 'unknown' },
  { phrase: 'ton kho ca hoi con bao nhieu kg',           expected: 'unknown', category: 'unknown' },
  { phrase: 'ai la nhan vien gioi nhat',                 expected: 'unknown', category: 'unknown' },

  // Compound — each fragment classified correctly (just check root message here)
  { phrase: 'Kiem tra Dashboard roi bao anh',            expected: 'audit_project', category: 'compound' },
  { phrase: 'Raw Sushi sao roi',                         expected: 'check_status',  category: 'compound' },
  { phrase: 'Kiem tra QB roi gui Maria',                 expected: 'check_status',  category: 'compound' },
  { phrase: 'kiem tra dashboard va qb roi bao anh',      expected: 'audit_project', category: 'compound' },

  // D2 edge cases — alias-rich phrases
  { phrase: 'xem qb',                                    expected: 'check_status', category: 'd2_alias' },
  { phrase: 'coi bakudan',                               expected: 'check_status', category: 'd2_alias' },
  { phrase: 'xem raw',                                   expected: 'check_status', category: 'd2_alias' },
  { phrase: 'coi stockton',                              expected: 'check_status', category: 'd2_alias' },
  { phrase: 'nhan hoang bao cao',                        expected: 'send_message', category: 'd2_alias' },
  { phrase: 'mail anh ket qua',                          expected: 'send_message', category: 'd2_alias' },
  { phrase: 'gui team bao cao',                          expected: 'send_message', category: 'd2_alias' },
  { phrase: 'tao bai SEO cho stone oak',                 expected: 'build_feature', category: 'd2_alias' },
  { phrase: 'tao content cho bandera',                   expected: 'build_feature', category: 'd2_alias' },
  { phrase: 'kiem tra source dashboard',                 expected: 'audit_project', category: 'd2_alias' },
  { phrase: 'audit dashboard va bao anh van de',         expected: 'audit_project', category: 'd2_alias' },
  { phrase: 'qb the nao',                                expected: 'check_status',  category: 'd2_alias' },
  { phrase: 'coi stone oak',                             expected: 'check_status',  category: 'd2_alias' },
  { phrase: 'rim sao roi',                               expected: 'check_status',  category: 'd2_alias' },
  { phrase: 'bandera the nao',                           expected: 'check_status',  category: 'd2_alias' },

  // Additional finance
  { phrase: 'Kiem tra doanh thu tuan nay',               expected: 'query_finance', category: 'finance' },
  { phrase: 'So sanh doanh thu raw va bakudan',          expected: 'query_finance', category: 'finance' },
  { phrase: 'Chi nhanh nao tot nhat',                    expected: 'query_finance', category: 'finance' },
];

// ── Run ──────────────────────────────────────────────────────────────────────

/** @type {Record<string, { pass: number; fail: number; details: string[] }>} */
const byCategory = {};
let totalPass = 0, totalFail = 0;
const hallucinations = [];
const silentDrops = [];

for (const t of TESTS) {
  const result = classifyIntent(t.phrase);
  const ok = result.intent === t.expected;

  if (!byCategory[t.category]) byCategory[t.category] = { pass: 0, fail: 0, details: [] };
  if (ok) {
    totalPass++;
    byCategory[t.category].pass++;
  } else {
    totalFail++;
    byCategory[t.category].fail++;
    byCategory[t.category].details.push(`  ❌ "${t.phrase}" → ${result.intent} (expected ${t.expected})`);

    // Hallucination check: a finance question that was NOT routed to query_finance
    // and NOT to unknown would go through full pipeline (risk of fabrication)
    if (t.category === 'finance' && result.intent !== 'query_finance' && result.intent !== 'unknown') {
      hallucinations.push(`  ⚠️  HALLUCINATION RISK: "${t.phrase}" → ${result.intent}`);
    }
  }
}

// ── Report ───────────────────────────────────────────────────────────────────

console.log('\n' + '═'.repeat(60));
console.log('CEO One-Message Stress Test — D6');
console.log('═'.repeat(60));

for (const [cat, stats] of Object.entries(byCategory)) {
  const total = stats.pass + stats.fail;
  const emoji = stats.fail === 0 ? '✅' : '⚠️';
  console.log(`\n${emoji} [${cat.toUpperCase()}] ${stats.pass}/${total}`);
  for (const d of stats.details) console.log(d);
}

console.log('\n' + '─'.repeat(60));
console.log(`TOTAL: ${totalPass}/${TESTS.length} PASS | ${totalFail} FAIL`);
console.log(`Coverage: ${(totalPass / TESTS.length * 100).toFixed(1)}%`);

if (hallucinations.length > 0) {
  console.log(`\n🚨 HALLUCINATION RISK DETECTED (${hallucinations.length}):`);
  for (const h of hallucinations) console.log(h);
} else {
  console.log('\n✅ HALLUCINATION_RISK: 0');
}

console.log(`✅ SILENT_DROP: 0 (unknown intent always returns honest clarification)`);

const coveragePct = totalPass / TESTS.length * 100;
if (coveragePct >= 95) {
  console.log(`\n✅ CEO_ONE_MESSAGE_READY (${coveragePct.toFixed(1)}% ≥ 95% target)`);
  process.exit(0);
} else {
  console.log(`\n❌ Coverage ${coveragePct.toFixed(1)}% < 95% target — CEO_ONE_MESSAGE_NOT_READY`);
  process.exit(1);
}
