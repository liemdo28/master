/**
 * Natural Conversation Engine — Phase 1 True Human Assistant
 * Orchestrates: conversation-memory + intent router + action router + CEO personality.
 * This is the top-level entry point for all WhatsApp CEO messages.
 */

import { classifyNaturalMessage, NaturalRoute } from './natural-intent-router';
import { routeAssistantAction } from './whatsapp-action-router';
import { findSkill, executeSkill } from '../skills/skill-registry';
import {
  getOrCreateSession,
  addUserTurn,
  addAssistantTurn,
  getSessionContext,
  resolveMessage,
} from './conversation-memory';
import { isCEO } from './ceo-personality';
import { clarifyReply } from './ceo-response-style';

export interface ConversationResult {
  reply: string;
  intent: string;
  handled: boolean;
  source: 'natural_router' | 'skill' | 'fallback' | 'context_clarify' | 'jarvis_evolution' | 'executive_personality';
  requires_approval: boolean;
  confidence: number;
}

/**
 * Main entry point. Called for every inbound WhatsApp CEO message.
 * Handles: pronoun resolution, context continuity, skill matching, natural intents, fallback.
 */
export async function processNaturalConversation(
  phone: string,
  rawText: string,
): Promise<ConversationResult> {
  // 1. Resolve pronouns using session context
  const resolved = resolveMessage(phone, rawText);
  const ctx = getSessionContext(phone);

  // 1b. Executive Personality Engine — greetings, status, concerns, memory recall, context
  try {
    const { processExecutiveQuery, wrapWithPersonality } = await import('../jarvis/executive/executive-personality');
    const execResult = await processExecutiveQuery(rawText, phone);
    if (execResult.handled && execResult.reply) {
      addUserTurn(phone, rawText, execResult.intent || 'executive');
      addAssistantTurn(phone, execResult.reply);
      return {
        reply: execResult.reply,
        intent: execResult.intent || 'executive',
        handled: true,
        source: 'executive_personality',
        requires_approval: false,
        confidence: (execResult.confidence || 90) / 100,
      };
    }
  } catch { /* executive personality not critical */ }

  // 2. Try natural intent router FIRST (so pronoun resolution wins over skills)
  //    Exception: intents that naturally fall through to skills (unknown_clarify)
  const routeEarly: NaturalRoute = classifyNaturalMessage(resolved);
  if (routeEarly.handled && routeEarly.intent !== 'unknown_clarify') {
    const actionResult = await routeAssistantAction(routeEarly, resolved);
    // Track store name as last_target for context continuity
    const storeTarget = extractStoreTarget(rawText) || routeEarly.target;
    addUserTurn(phone, rawText, routeEarly.intent, storeTarget ? { target: storeTarget } : undefined);
    addAssistantTurn(phone, actionResult.reply);
    return {
      reply: actionResult.reply,
      intent: routeEarly.intent,
      handled: true,
      source: 'natural_router',
      requires_approval: actionResult.approval_required || false,
      confidence: 0.9,
    };
  }

  // 3. Try skill registry (keyword-level match)
  const skill = findSkill(resolved);
  if (skill) {
    const result = await executeSkill(resolved, {});
    const skillTarget = extractStoreTarget(rawText);
    addUserTurn(phone, rawText, 'skill:' + skill.name, skillTarget ? { target: skillTarget } : undefined);
    addAssistantTurn(phone, result.output);
    return {
      reply: result.output,
      intent: 'skill:' + skill.name,
      handled: true,
      source: 'skill',
      requires_approval: result.requires_approval,
      confidence: result.confidence,
    };
  }

  // 3b. Jarvis Evolution Phase 30 — handles knowledge/graph/twin/briefing/agent queries
  try {
    const { processJarvisQuery } = await import('../jarvis/phase30-jarvis/jarvis-core');
    const jarvisResult = await processJarvisQuery({ sender: phone, raw_text: rawText, normalized: resolved, timestamp: new Date().toISOString() });
    if (jarvisResult.handled && jarvisResult.reply) {
      addUserTurn(phone, rawText, 'jarvis:phase' + (jarvisResult.phase || '30'));
      // Track context for follow-up resolution
      try {
        const { wrapWithPersonality } = await import('../jarvis/executive/executive-personality');
        wrapWithPersonality(jarvisResult.reply, phone, 'jarvis');
      } catch {}
      addAssistantTurn(phone, jarvisResult.reply);
      return { reply: jarvisResult.reply, intent: 'jarvis:phase' + (jarvisResult.phase || '30'), handled: true, source: 'jarvis_evolution', requires_approval: false, confidence: 0.95 };
    }
  } catch { /* jarvis evolution not critical */ }

  // 4. Natural intent router fallback (for unknown intents after skills)
  const route: NaturalRoute = classifyNaturalMessage(resolved);
  if (route.handled && route.intent !== 'unknown_clarify') {
    const actionResult = await routeAssistantAction(route, resolved);
    addUserTurn(phone, rawText, route.intent, route.target ? { target: route.target } : undefined);
    addAssistantTurn(phone, actionResult.reply);
    return {
      reply: actionResult.reply,
      intent: route.intent,
      handled: true,
      source: 'natural_router',
      requires_approval: actionResult.approval_required || false,
      confidence: 0.9,
    };
  }

  // 4. Context-aware clarify: keep context, but do not blindly pin every vague
  // message to the previous target.
  if (ctx.turn_count > 0 && ctx.last_target) {
    const reply = contextAwareClarify(rawText, ctx.last_target);
    addUserTurn(phone, rawText, 'unknown');
    addAssistantTurn(phone, reply);
    return { reply, intent: 'context_clarify', handled: true, source: 'context_clarify', requires_approval: false, confidence: 0.5 };
  }

  // 5. Fallback clarify — still extract entities so next message can resolve pronouns
  const fallbackTarget = extractStoreTarget(rawText);
  const reply = !isCEO(phone) ? 'Em chỉ nhận lệnh từ anh.' : clarifyReply();
  addUserTurn(phone, rawText, 'unknown', fallbackTarget ? { target: fallbackTarget } : undefined);
  addAssistantTurn(phone, reply);
  return { reply, intent: 'unknown', handled: false, source: 'fallback', requires_approval: false, confidence: 0 };
}

export function getConversationStats(phone: string) {
  return getSessionContext(phone);
}

/** Extract a known store or node name from raw text for last_target tracking. */
function extractStoreTarget(text: string): string | undefined {
  const t = text.toLowerCase();
  if (/stone oak/i.test(t)) return 'Stone Oak';
  if (/bandera/i.test(t)) return 'Bandera';
  if (/bakudan/i.test(t)) return 'Bakudan';
  if (/raw sushi/i.test(t)) return 'Raw Sushi';
  if (/\brim\b/i.test(t)) return 'Rim';
  if (/laptop\s*1|laptop1/i.test(t)) return 'Laptop1';
  if (/laptop\s*2|laptop2/i.test(t)) return 'Laptop2';
  if (/doordash/i.test(t)) return 'DoorDash';
  if (/gateway|whatsapp.*agent/i.test(t)) return 'WhatsApp Gateway';
  if (/dashboard|approval center|task.*maria/i.test(t)) return 'Dashboard';
  return undefined;
}

function contextAwareClarify(text: string, lastTarget: string): string {
  const t = text.toLowerCase().trim();
  if (/^(hả|ha|hae|hà|sao|why|tai sao|tại sao)\??$/i.test(t)) {
    return `Ý em là: ngữ cảnh gần nhất đang là *${lastTarget}*, nhưng câu vừa rồi của anh quá ngắn nên em chưa chắc anh muốn em check status, link, logs hay task. Anh nói thêm 1 ý, em bám theo ngay.`;
  }
  if (/link|url|mo|open/i.test(t)) {
    if (/^(all|workspace|project)$/i.test(lastTarget)) {
      return [
        'Có anh. Link chính em hay dùng:',
        '📊 Dashboard: http://dashboard.bakudanramen.com',
        '🧭 Workspace/project thì em scan trực tiếp trong E:/Project/Master; anh nêu tên project, em mở đúng nhánh cho anh.',
      ].join('\n');
    }
    return `Em chưa chắc anh muốn link của *${lastTarget}* hay dashboard tổng. Nếu là dashboard thì đây: http://dashboard.bakudanramen.com`;
  }
  return `Em chưa bắt đúng ý câu này, anh nói thêm một chút. Ngữ cảnh gần nhất là *${lastTarget}*, nhưng em không muốn đoán bừa rồi trả lời sai nữa.`;
}
