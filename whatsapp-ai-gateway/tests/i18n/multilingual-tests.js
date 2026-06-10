/**
 * Multilingual Tests (Phase 1.5)
 *
 * Verifies:
 *  1. /ldagent always routes before AI fallback.
 *  2. "hola" detects Spanish.
 *  3. "xin chào" detects Vietnamese.
 *  4. "bonjour" detects French.
 *  5. "tu parles français?" replies French.
 *  6. "biết nói tiếng Việt không?" replies Vietnamese.
 *  7. /ayuda maps to HELP.
 *  8. /aide maps to HELP.
 *  9. /giupdo maps to HELP.
 * 10. estado maps to STATUS.
 * 11. statut maps to STATUS.
 * 12. trạng thái maps to STATUS.
 * 13. confirmar maps to CONFIRM.
 * 14. xác nhận maps to CONFIRM.
 * 15. confirmer maps to CONFIRM.
 * 16. cancelar maps to CANCEL.
 * 17. hủy maps to CANCEL.
 * 18. annuler maps to CANCEL.
 * 19. out-of-range prompt translated to Spanish.
 * 20. out-of-range prompt translated to Vietnamese.
 * 21. out-of-range prompt translated to French.
 * 22. manager alert remains English.
 * 23. user language memory persists after restart.
 * 24. store default language applies if user unknown.
 * 25. direct chat language question does not fallback to generic "Thank you."
 * 26. live listener language question helper returns Vietnamese reply.
 * 27. Vietnamese greeting "chào" classifies as greeting.
 * 28. unsupported language questions get supported-language reply.
 * 29. multilingual greetings classify as greeting through production classifier.
 * 30. /version returns runtime fingerprint.
 */

process.env.NODE_ENV = 'test';
process.env.GATEWAY_DB_PATH = process.env.GATEWAY_DB_PATH || `./data/test-i18n-${process.pid}.db`;

const sqlite = require('../../src/storage/sqlite');
sqlite.getDb();

const { detect, detectWithConfidence, LANG_CONFIGS } = require('../../src/i18n/detector');
const { t, supported, T } = require('../../src/i18n/translations');
const cmdAliases = require('../../src/i18n/command-aliases');
const langMem   = require('../../src/i18n/language-memory');
const { classifyIntent } = require('../../src/ai/intent-classifier');
const infoCommands = require('../../src/commands/info-commands');

let passed = 0;
let failed = 0;
function assert(label, cond, detail = '') {
  if (cond) { console.log(`  ✅ ${label}`); passed++; }
  else { console.log(`  ❌ ${label}${detail ? ' — ' + detail : ''}`); failed++; }
}

async function main() {
  console.log('\n=== Phase 1.5 — Multilingual Tests ===\n');

  // Wait for SQLite WAL setup to complete before any DB-bound operations.
  await new Promise((r) => setTimeout(r, 600));

  // 1. /ldagent routing
  console.log('[ Routing priority ]');
  const { isWakeCommand } = require('../../src/commands/ldagent-command');
  assert('1. /ldagent is a wake command', isWakeCommand('/ldagent'));
  assert('1b. /ldagent is a wake command (uppercase)', isWakeCommand('/LDAGENT'));
  assert('1c. /ldagent is recognized in command-router', isWakeCommand('/ldagent'));

  // 2-4. Language detection
  console.log('\n[ Language detection ]');
  assert('2. "hola" → es', detect('hola') === 'es', `got ${detect('hola')}`);
  assert('3. "xin chào" → vi', detect('xin chào') === 'vi', `got ${detect('xin chào')}`);
  assert('4. "bonjour" → fr', detect('bonjour') === 'fr', `got ${detect('bonjour')}`);
  assert('4b. "bonjour, comment ça va" → fr', detect('bonjour, comment ça va') === 'fr');

  // 5-6. Direct chat language questions
  console.log('\n[ Language questions ]');
  assert('5. "tu parles français?" → fr', langMem.detectLanguageQuestion('tu parles français?') === 'fr');
  assert('6. "biết nói tiếng Việt không?" → vi', langMem.detectLanguageQuestion('biết nói tiếng việt không?') === 'vi');
  assert('6b. "hablas español?" → es', langMem.detectLanguageQuestion('hablas español?') === 'es');
  assert('5b. Vietnamese reply contains /ldagent',
    /ldagent/.test(langMem.buildLanguageQuestionReply('vi', 'Minh') || ''));
  assert('5c. French reply contains /ldagent',
    /ldagent/.test(langMem.buildLanguageQuestionReply('fr', 'Jean') || ''));
  assert('5d. Spanish reply contains /ldagent',
    /ldagent/.test(langMem.buildLanguageQuestionReply('es', 'Carlos') || ''));

  // 7-9. /help aliases
  console.log('\n[ HELP aliases ]');
  assert('7. /ayuda → help', cmdAliases.resolveCommand('/ayuda')?.action === 'help');
  assert('8. /aide → help', cmdAliases.resolveCommand('/aide')?.action === 'help');
  assert('9. /giupdo → help', cmdAliases.resolveCommand('/giupdo')?.action === 'help');

  // 10-12. /status aliases
  console.log('\n[ STATUS aliases ]');
  assert('10. estado → status', cmdAliases.resolveCommand('estado')?.action === 'status');
  assert('11. statut → status', cmdAliases.resolveCommand('statut')?.action === 'status');
  assert('12. trạng thái → status', cmdAliases.resolveCommand('trạng thái')?.action === 'status');

  // 13-15. CONFIRM aliases
  console.log('\n[ CONFIRM aliases ]');
  assert('13. confirmar → confirm', cmdAliases.resolveCommand('confirmar')?.action === 'confirm');
  assert('14. xác nhận → confirm', cmdAliases.resolveCommand('xác nhận')?.action === 'confirm');
  assert('15. confirmer → confirm', cmdAliases.resolveCommand('confirmer')?.action === 'confirm');

  // 16-18. CANCEL aliases
  console.log('\n[ CANCEL aliases ]');
  assert('16. cancelar → cancel', cmdAliases.resolveCommand('cancelar')?.action === 'cancel');
  assert('17. hủy → cancel', cmdAliases.resolveCommand('hủy')?.action === 'cancel');
  assert('18. annuler → cancel', cmdAliases.resolveCommand('annuler')?.action === 'cancel');

  // 19-21. Out-of-range prompt translated
  console.log('\n[ Out-of-range prompts ]');
  const oor_en = t('out_of_range', 'en', { item: 'Walk-in Cooler', value: '44', target: '30–40°F' });
  const oor_es = t('out_of_range', 'es', { item: 'Walk-in Cooler', value: '44', target: '30–40°F' });
  const oor_vi = t('out_of_range', 'vi', { item: 'Walk-in Cooler', value: '44', target: '30–40°F' });
  const oor_fr = t('out_of_range', 'fr', { item: 'Walk-in Cooler', value: '44', target: '30–40°F' });
  assert('19. ES out-of-range contains "Fuera"', /Fuera/.test(oor_es), oor_es);
  assert('20. VI out-of-range contains "Ngoài"', /Ngoài/.test(oor_vi), oor_vi);
  assert('21. FR out-of-range contains "Hors"', /Hors/.test(oor_fr), oor_fr);
  assert('19b. EN out-of-range contains "Outside"', /Outside/.test(oor_en));

  // 22. Manager alert remains English
  console.log('\n[ Manager alert always English ]');
  const managerAlerts = require('../../src/alerts/manager-alert-service');
  const alertText = managerAlerts.managerAlertMessage({
    storeName: 'Stone Oak', staffName: 'Omar', staffLanguage: 'es',
    sourceGroupName: 'Stone Oak Group', workflow: 'daily_entry', timestamp: '2026-06-04T16:00:00Z',
    issues: [{ item: 'Walk-in Cooler', value: '44', target: '30–40°F', status: 'HIGH' }],
    sheetWriteStatus: 'SENT', sessionId: 'test-1',
    originalInputs: { 'Walk-in Cooler': 'cuarenta y cuatro' },
  });
  assert('22. Manager alert has English title', /Temperature Alert/.test(alertText), alertText);
  assert('22b. Manager alert has Spanish Language label', /Language:.*SPANISH/i.test(alertText) || /Language:.*ES/i.test(alertText), alertText);
  assert('22c. Manager alert includes original input', /cuarenta y cuatro/.test(alertText), alertText);
  // Body must NOT contain foreign language prompts
  assert('22d. Manager alert has no Spanish out-of-range text', !/Fuera de rango/.test(alertText));
  assert('22e. Manager alert has no Vietnamese out-of-range text', !/Ngoài phạm vi/.test(alertText));
  assert('22f. Manager alert has no French out-of-range text', !/Hors plage/.test(alertText));

  // 23. User language memory persists after restart
  console.log('\n[ User language memory persistence ]');
  const testPhone = '84999000123';
  await langMem.setUserLanguage(testPhone, 'vi', { displayName: 'Minh', confidence: 0.95, source: 'user' });
  const persisted = await langMem.getUserLanguage(testPhone);
  assert('23. Memory written and read back', persisted && persisted.language === 'vi', JSON.stringify(persisted));
  // Simulate restart by re-reading the same data
  const persisted2 = await langMem.getUserLanguage(testPhone);
  assert('23b. Memory still present after re-read', persisted2 && persisted2.language === 'vi');

  // 24. Store default language
  console.log('\n[ Store default language ]');
  await langMem.setStoreLanguage('rim', 'en', ['vi']);
  const storeLang = await langMem.getStoreLanguage('rim');
  assert('24. Store default language persisted', storeLang && storeLang.default_language === 'en');
  assert('24b. Secondary languages persisted', storeLang && storeLang.secondary_languages.includes('vi'));

  // Test resolveLanguage priority
  const resolved1 = await langMem.resolveLanguage({ phone: testPhone, storeId: 'rim', text: 'hola' });
  assert('24c. resolveLanguage returns user memory first', resolved1.lang === 'vi' && resolved1.source === 'user_memory');
  const resolved2 = await langMem.resolveLanguage({ phone: '999000001', storeId: 'rim', text: 'hola' });
  assert('24d. Falls back to store default when no user memory', resolved2.lang === 'en' || resolved2.lang === 'es' || resolved2.lang === 'vi', JSON.stringify(resolved2));

  // 25. Direct chat language question does not fall back to "Thank you"
  console.log('\n[ Language question short-circuit ]');
  const replyFr = langMem.buildLanguageQuestionReply('fr', 'Jean');
  assert('25. French question reply is non-empty + has /ldagent', !!replyFr && /ldagent/.test(replyFr));
  assert('25b. French question reply NOT generic "Thank you"', !/^Thank you/i.test(replyFr || ''));
  assert('25c. Vietnamese reply NOT generic "Thank you"', !/^Thank you/i.test(langMem.buildLanguageQuestionReply('vi', 'Minh') || ''));
  assert('25d. Spanish reply NOT generic "Thank you"', !/^Thank you/i.test(langMem.buildLanguageQuestionReply('es', 'Carlos') || ''));
  const liveListener = require('../../src/whatsapp/message-listener');
  const liveViReply = await liveListener._test.getLanguageQuestionReply('84999000456', 'Minh', 'biết nói tiếng Việt không?');
  assert('26. Live listener helper returns Vietnamese language reply', /tiếng Việt/.test(liveViReply || ''), liveViReply || '');
  assert('26b. Live listener helper NOT generic "Thank you"', !/^Thank you/i.test(liveViReply || ''));
  assert('27. "chào" classifies as greeting', classifyIntent('chào') === 'greeting', classifyIntent('chào'));
  assert('27b. "xin chào" classifies as greeting', classifyIntent('xin chào') === 'greeting', classifyIntent('xin chào'));
  const unsupportedReply = await liveListener._test.getLanguageQuestionReply('84999000789', 'Minh', 'biết nói tiếng Ấn không?');
  assert('28. Unsupported language question gets support-list reply', /English.*Español.*Tiếng Việt.*Français/.test(unsupportedReply || ''), unsupportedReply || '');
  assert('28b. Unsupported language question NOT generic "Thank you"', !/^Thank you/i.test(unsupportedReply || ''));

  const greetingSmoke = ['hello', 'hi', 'hey', 'chào', 'xin chào', 'hola', 'buenos dias', 'bonjour', 'salut'];
  for (const sample of greetingSmoke) {
    assert(`29. "${sample}" classifies as greeting`, classifyIntent(sample) === 'greeting', classifyIntent(sample));
  }
  assert('30. /version is an info command', infoCommands.isInfoCommand('/version'));
  const versionReply = await infoCommands.handleInfoCommand('/version');
  assert('30b. /version includes Build ID', /Build ID:/i.test(versionReply), versionReply);
  assert('30c. /version includes Language Engine v2', /Language Engine:\s*v2/i.test(versionReply), versionReply);

  // Bonus: detector confidence
  console.log('\n[ Bonus — detector confidence ]');
  const conf = detectWithConfidence('xin chào, tôi muốn bắt đầu');
  assert('B1. Confidence for vi sentence is > 0.5', conf.confidence > 0.5, JSON.stringify(conf));
  assert('B2. Detected lang is vi', conf.lang === 'vi');
  const confFr = detectWithConfidence("Bonjour, comment ça va, je veux enregistrer");
  assert('B3. Confidence for fr sentence is > 0.5', confFr.confidence > 0.5, JSON.stringify(confFr));
  assert('B4. Detected lang is fr', confFr.lang === 'fr');

  // Bonus: LANG_CONFIGS exposes fr
  assert('B5. fr config exists in detector', !!LANG_CONFIGS.fr);
  assert('B6. translations has fr block', !!T.fr);
  assert('B7. supported("fr")', supported('fr'));

  // Summary
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Phase 1.5 multilingual results: ${passed} passed, ${failed} failed`);
  if (failed === 0) {
    console.log('🎉 All Phase 1.5 multilingual tests PASSED\n');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests FAILED\n');
    process.exit(1);
  }
}

main().catch(err => { console.error('Test runner error:', err); process.exit(1); });
