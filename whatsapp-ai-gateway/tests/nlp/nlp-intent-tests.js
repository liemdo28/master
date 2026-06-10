const assert = require('assert');
const { detectIntent } = require('../../src/nlp/intent-detector');

const cases = [
  ['chào', 'GREETING', 'vi'],
  ['biết nói tiếng Việt không', 'LANGUAGE_QUESTION', 'vi'],
  ['hola', 'GREETING', 'es'],
  ['bonjour', 'GREETING', 'fr'],
  ['bắt đầu', 'START_AGENT', 'vi'],
  ['kiểm tra nhiệt độ', 'DAILY_ENTRY', 'vi'],
  ['44F', 'TEMPERATURE_VALUE', null],
  ['it is 44', 'TEMPERATURE_VALUE', null],
  ['cancelar', 'CANCEL', 'es'],
  ['annuler', 'CANCEL', 'fr'],
];

let passed = 0;
for (const [input, intent, lang] of cases) {
  const got = detectIntent(input);
  assert.strictEqual(got.intent, intent, `${input} intent`);
  if (lang) assert.strictEqual(got.language, lang, `${input} language`);
  assert.ok(got.confidence >= 0.8, `${input} confidence ${got.confidence}`);
  passed += 1;
}

console.log(`NLP intent tests passed: ${passed}/${cases.length}`);
