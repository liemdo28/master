/**
 * Message Simulator — drives the full message pipeline without a real WhatsApp connection.
 * Used by the live validator to verify every safety guard and AI path.
 *
 * Simulates: incoming message → safety gates → AI reply → Telegram forward → DB persist
 */

require('dotenv').config();
const { getDb } = require('../storage/sqlite');
const { saveMessage } = require('../storage/conversations');
const { classifyIntent } = require('../ai/intent-classifier');
const { generateResponse, getConfidence } = require('../ai/response-generator');
const { shouldEscalate, getEscalationReason } = require('../ai/escalation-engine');
const { forwardMessage } = require('../telegram/telegram-forwarder');
const rateLimiter = require('../safety/rate-limiter');
const businessHours = require('../safety/business-hours');
const aiControl = require('../safety/ai-control');

// Collect results for reporting
const results = [];

async function simulateMessage({ phone, name, text, label }) {
  const result = {
    label,
    phone,
    text,
    intent: null,
    confidence: null,
    escalated: false,
    escalateReason: null,
    replyText: null,
    replyType: null, // 'ai' | 'holding' | 'closed' | 'none'
    blocked: false,
    rateLimited: false,
    aiPaused: false,
    humanTakeover: false,
    dbSaved: false,
    telegramForwarded: false,
    error: null,
  };

  try {
    // Gate 1: Blocklist
    if (aiControl.isBlocked(phone)) {
      result.blocked = true;
      result.replyType = 'none';
      results.push(result);
      return result;
    }

    // Gate 2: Rate limit
    const rateResult = rateLimiter.check(phone);
    if (!rateResult.allowed) {
      result.rateLimited = true;
      result.replyType = 'none';
      if (rateResult.reason === 'hard_block') {
        results.push(result);
        return result;
      }
      // Soft limit — forward to Telegram, no reply
      await saveMessage({ phone, name, direction: 'in', message: text, intent: 'rate_limited', aiReplied: false });
      result.dbSaved = true;
      const fwd = await tryForward({ phone, name, message: text, intent: 'rate_limited', confidence: 0, escalate: true, escalateReason: 'Rate limited' });
      result.telegramForwarded = fwd;
      results.push(result);
      return result;
    }

    // Classify
    result.intent = classifyIntent(text);
    result.confidence = getConfidence(result.intent);
    result.escalated = shouldEscalate(result.intent, text);
    result.escalateReason = result.escalated ? getEscalationReason(result.intent, text) : null;

    // Persist incoming
    await saveMessage({ phone, name, direction: 'in', message: text, intent: result.intent, aiReplied: false });
    result.dbSaved = true;

    // Forward to Telegram
    result.telegramForwarded = await tryForward({
      phone, name, message: text,
      intent: result.intent, confidence: result.confidence,
      escalate: result.escalated, escalateReason: result.escalateReason,
    });

    // Gate 3: Global AI pause
    if (aiControl.isAIPaused()) {
      result.aiPaused = true;
      result.replyType = 'none';
      results.push(result);
      return result;
    }

    // Gate 4: Human takeover
    if (aiControl.isHumanTakeover(phone)) {
      result.humanTakeover = true;
      result.replyType = 'none';
      results.push(result);
      return result;
    }

    // Gate 5: Business hours
    if (!businessHours.isOpen()) {
      result.replyText = businessHours.getClosedMessage();
      result.replyType = 'closed';
      await saveMessage({ phone, name, direction: 'out', message: result.replyText, intent: 'closed', aiReplied: false });
      results.push(result);
      return result;
    }

    // Gate 6: Escalation
    if (result.escalated) {
      result.replyText = result.intent === 'complaint'
        ? "We're really sorry to hear about your experience. 😔 Our team will reach out to you shortly."
        : "Thank you for your message! Our team will get back to you shortly. 🙏";
      result.replyType = 'holding';
      await saveMessage({ phone, name, direction: 'out', message: result.replyText, intent: result.intent, aiReplied: false });
      results.push(result);
      return result;
    }

    // AI reply
    result.replyText = generateResponse(result.intent, text);
    result.replyType = 'ai';
    await saveMessage({ phone, name, direction: 'out', message: result.replyText, intent: result.intent, aiReplied: true });
    results.push(result);
    return result;

  } catch (err) {
    result.error = err.message;
    results.push(result);
    return result;
  }
}

async function tryForward(payload) {
  try {
    await forwardMessage(payload);
    return true;
  } catch (_) {
    return false; // Telegram may not be configured — non-fatal
  }
}

function getResults() { return results; }
function clearResults() { results.length = 0; }

module.exports = { simulateMessage, getResults, clearResults };
