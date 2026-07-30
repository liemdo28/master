const fs = require('fs');
const path = require('path');
const { all } = require('../src/storage/sqlite');
const foodSafetyStorage = require('../src/storage/food-safety-storage');

let passed = 0;
let failed = 0;

function assert(label, condition, detail = '') {
  if (condition) { console.log(`  ✅ PASS: ${label}`); passed++; }
  else { console.log(`  ❌ FAIL: ${label}${detail ? ' — ' + detail : ''}`); failed++; }
}

async function main() {
  console.log('\n=== Phase 3 Architecture Tests ===\n');

  const requiredDirs = [
    'src/food-safety',
    'src/commands',
    'src/vision',
    'src/ai-agents',
    'src/workflows',
    'src/integrations',
    'src/google',
    'src/knowledge',
    'src/audit',
    'knowledge/food-safety',
    'knowledge/operations',
    'knowledge/stores',
    'knowledge/faq',
    'knowledge/rewards',
  ];

  for (const dir of requiredDirs) {
    assert(`${dir} exists`, fs.existsSync(path.resolve(dir)));
  }

  const modules = [
    '../src/vision/ocr-engine',
    '../src/vision/image-normalizer',
    '../src/vision/image-validator',
    '../src/ai-agents/food-safety-agent',
    '../src/ai-agents/manager-agent',
    '../src/ai-agents/operations-agent',
    '../src/ai-agents/audit-agent',
    '../src/workflows/food-safety-workflow',
    '../src/workflows/escalation-workflow',
    '../src/workflows/human-review-workflow',
    '../src/google/google-auth',
    '../src/google/sheets-client',
    '../src/google/daily-log-writer',
    '../src/google/sheet-mapper',
    '../src/google/log-sheet-sync',
    '../src/google/broth-log-writer',
    '../src/commands/command-router',
    '../src/commands/broth-command',
    '../src/commands/broth-parser',
    '../src/commands/broth-validator',
    '../src/knowledge/knowledge-loader',
    '../src/audit/audit-log',
  ];

  for (const mod of modules) {
    try {
      require(mod);
      assert(`${mod.replace('../', '')} loads`, true);
    } catch (err) {
      assert(`${mod.replace('../', '')} loads`, false, err.message);
    }
  }

  const knowledgeLoader = require('../src/knowledge/knowledge-loader');
  const domains = knowledgeLoader.listKnowledgeDomains();
  assert('knowledge domains include food-safety', domains.includes('food-safety'));
  assert('knowledge domains include operations', domains.includes('operations'));

  const rules = knowledgeLoader.loadKnowledge('food-safety/default-rules.json').rules;
  assert('default food safety rules count >= 19', Array.isArray(rules) && rules.length >= 19);
  assert('default rules include Chicken Chashu <= 40', rules.some(r => r.item === 'Chicken Chashu' && r.operator === '<=' && r.target === 40));

  const aliases = knowledgeLoader.loadKnowledge('food-safety/item-aliases.json').aliases;
  assert('food safety aliases include FREEZER - LINE', aliases['Line Freezer'].includes('freezer - line'));
  assert('food safety aliases include BOILER - LEFT', aliases['Pasta Boiler 1'].includes('boiler - left'));

  await foodSafetyStorage.ensureTables();
  const rows = await all(`
    SELECT name FROM sqlite_master
    WHERE type = 'table' AND name IN (
      'food_safety_checks',
      'food_safety_readings',
      'food_safety_warnings',
      'food_safety_incidents',
      'food_safety_sheet_queue',
      'broth_log_entries',
      'image_audit',
      'workflow_runs'
    )
  `);
  const tableNames = rows.map(r => r.name);
  for (const table of ['food_safety_incidents', 'food_safety_sheet_queue', 'broth_log_entries', 'image_audit', 'workflow_runs']) {
    assert(`${table} table exists`, tableNames.includes(table));
  }

  const packPs1 = fs.readFileSync(path.resolve('pack.ps1'), 'utf8');
  const packSh = fs.readFileSync(path.resolve('pack.sh'), 'utf8');
  for (const required of ['.env', 'node_modules', 'secrets', 'data\\session', '.wwebjs_cache', 'data\\*.db', 'logs', '*.zip']) {
    assert(`pack.ps1 excludes ${required}`, packPs1.includes(required));
  }
  for (const required of ['.env', 'node_modules/*', 'secrets/*', 'data/session/*', '.wwebjs_cache/*', 'data/*.db', 'logs/*', '*.zip']) {
    assert(`pack.sh excludes ${required}`, packSh.includes(required));
  }

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed === 0) {
    console.log('Phase 3 architecture tests PASSED\n');
    process.exit(0);
  }
  process.exit(1);
}

main().catch(err => { console.error('Architecture test runner error:', err); process.exit(1); });
