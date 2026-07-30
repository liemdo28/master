/**
 * Mi Human Assistant — Phase 1 True Human Assistant Layer
 * Delegates to natural conversation engine with per-session memory.
 */
import { processNaturalConversation } from './natural-conversation-engine';

export interface HumanAssistantResult {
  reply: string;
  intent: string;
  action_mode: string;
  handled: boolean;
  approval_required: boolean;
  approval_id?: string | null;
}

export async function handleMiHumanAssistant(
  message: string,
  phone = process.env.CEO_WHATSAPP_NUMBER || '+84931773657',
): Promise<HumanAssistantResult | null> {
  const result = await processNaturalConversation(phone, message);
  if (!result.reply) return null;
  return {
    reply: result.reply,
    intent: result.intent,
    action_mode: result.source,
    handled: result.handled,
    approval_required: result.requires_approval,
    approval_id: null,
  };
}
