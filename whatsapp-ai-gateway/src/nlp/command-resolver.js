const { detectIntent } = require('./intent-detector');

const SLASH = {
  START_AGENT: '/ldagent',
  HELP: '/help',
  STATUS: '/status',
  DAILY_ENTRY: '/ldagent',
  BROTH_COUNT: '/broth',
};

function greetingReply(language) {
  if (language === 'vi') return 'Xin chào. Tôi có thể hỗ trợ bằng tiếng Việt. Gõ /ldagent hoặc “bắt đầu” để bắt đầu.';
  if (language === 'es') return 'Hola. Puedo ayudar en español. Escribe /ldagent o “empezar”.';
  if (language === 'fr') return 'Bonjour. Je peux vous aider en français. Tapez /ldagent ou “commencer”.';
  return 'Hello. I can help you with store operations. Type /ldagent or “start”.';
}

function resolveCommand(text) {
  const detected = detectIntent(text);
  const command = SLASH[detected.intent] || null;
  return { ...detected, command, autoHandle: detected.confidence >= 0.8, needsClarification: detected.confidence >= 0.5 && detected.confidence < 0.8 };
}

module.exports = { resolveCommand, greetingReply };
