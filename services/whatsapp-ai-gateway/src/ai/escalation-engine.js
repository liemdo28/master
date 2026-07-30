const { getConfidence } = require('./response-generator');

const ESCALATION_INTENTS = ['complaint'];
const ESCALATION_KEYWORDS = /\b(urgent|emergency|manager|owner|refund|lawsuit|angry|furious|sue|terrible|disgusting)\b/i;
const CONFIDENCE_THRESHOLD = 70; // escalate if AI confidence is below this

function shouldEscalate(intent, message) {
  if (ESCALATION_INTENTS.includes(intent)) return true;
  if (ESCALATION_KEYWORDS.test(message)) return true;
  if (getConfidence(intent) < CONFIDENCE_THRESHOLD) return true;
  return false;
}

function getEscalationReason(intent, message) {
  if (ESCALATION_INTENTS.includes(intent)) return `Intent is "${intent}"`;
  if (ESCALATION_KEYWORDS.test(message)) return 'Urgent keyword detected';
  if (getConfidence(intent) < CONFIDENCE_THRESHOLD) return `Low AI confidence (${getConfidence(intent)}%)`;
  return null;
}

module.exports = { shouldEscalate, getEscalationReason };
