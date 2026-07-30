const { shouldEscalate, getEscalationReason } = require('../ai/escalation-engine');

function evaluateEscalation(intent, text) {
  const escalate = shouldEscalate(intent, text);
  return {
    workflow: 'escalation-workflow',
    escalate,
    reason: escalate ? getEscalationReason(intent, text) : null,
  };
}

module.exports = { evaluateEscalation };
